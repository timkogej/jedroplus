// lib/glas/orodja/obrazci.ts
//
// Faza 3 — dejanja prek obstoječih obrazcev (Timova odločitev 13. 11. 2026):
// asistent razume ukaz, razreši stranko, storitev, zaposleno in čas, preveri
// pravice in ali je čas prost, nato odpre OBSTOJEČI obrazec že izpolnjen
// (koledar: nov termin, prestavitev, odsotnost; stranke: nova stranka).
// Shrani uporabnik sam z gumbom Shrani — po isti poti kot ročno (n8n,
// potrdilo SMS, resursi, obvestilo o prestavitvi, čakanje na zapis). Strežnik
// tu NIČESAR ne zapiše; podatki za obrazec gredo odjemalcu v `obrazec` in ne
// v URL (imena, telefoni in razlogi ne sodijo v dnevnike strežnika).

import { z } from 'zod';
import { samoSvojiTermini } from '../pravice';
import { dodajDni, opisDatuma, razberiUro, vMinute } from '../razresevanje/datumi';
import { poisci } from '../razresevanje/imena';
import { prosteLuknje, razcleniUrnik, urnikOsebe } from '../razresevanje/urnik';
import { datumZaGovor, emailZaGovor, mestnik, povezavaKontakta, telefonZaGovor, telefonZaZaslon, uraZaGovor } from '../govor';
import type { Kontekst, LokacijaPovzetek, OsebaPovzetek, RezultatOrodja, StoritevPovzetek, TerminPovzetek } from '../tipi';
import { datumIzParametra } from './branje';
import { razresiStranko, ID_STRANKE } from './stranke';
import type { BralnoOrodje, OkoljeOrodja } from './tipi';

/** Na koncu odgovora, ko je obrazec izpolnjen: asistent vpraša, uporabnik reče "ja" (= gumb Shrani). */
const SHRANI = 'Shranim?';

/** Kar manjka, vpraša kratko, kot receptorka ("Za kdaj?"), namesto navodila za obrazec. */
export function vprasajZaManjkajoce(manjka: readonly ('dan' | 'uro' | 'storitev')[]): string {
  const dan = manjka.includes('dan');
  const ura = manjka.includes('uro');
  const storitev = manjka.includes('storitev');
  const kdaj = dan && ura ? 'Za kdaj' : dan ? 'Kateri dan' : ura ? 'Ob kateri uri' : '';
  if (kdaj && storitev) return `${kdaj} in katera storitev?`;
  if (kdaj) return `${kdaj}?`;
  return storitev ? 'Katera storitev?' : SHRANI;
}
const imeOsebe = (p: OsebaPovzetek) => `${p.ime} ${p.priimek}`.trim();
const aktiven = (t: TerminPovzetek) => t.status === 'scheduled' || t.status === 'confirmed';

/** Zaposleni sme urejati samo svoje termine (pravica "samo svoji"). */
export function samoSvojeUrejanje(k: Pick<Kontekst, 'vloga' | 'pravice'>): boolean {
  if (k.vloga !== 'staff') return false;
  return k.pravice?.can_edit_only_own_appointments === true && k.pravice?.can_edit_all_appointments !== true;
}

/** Ura iz LLM: "10:00", "9.30" ali izraz ("ob desetih", "pol enajstih"). */
export function uraIzParametra(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(s);
  if (m && Number(m[1]) < 24 && Number(m[2]) < 60) return `${m[1].padStart(2, '0')}:${m[2]}`;
  if (/^\d{1,2}$/.test(s) && Number(s) < 24) return `${s.padStart(2, '0')}:00`;
  return razberiUro(/^(ob|od|okoli|pol)\b/i.test(s) ? s : `ob ${s}`);
}

function izberiStoritev(ime: string, storitve: StoritevPovzetek[]): StoritevPovzetek | RezultatOrodja {
  // LLM včasih poda ID iz odprtega obrazca namesto imena.
  const poId = storitve.find((s) => s.id === ime.trim() && s.aktivna);
  if (poId) return poId;
  const izid = poisci(ime, storitve.filter((s) => s.aktivna), (s) => [s.naziv]);
  if (izid.izid === 'nic') return { sporocilo: `Storitve »${ime}« ne najdem.` };
  if (izid.izid === 'vec') {
    return {
      sporocilo: `Katero storitev? ${izid.kandidati.map((k) => k.vrednost.naziv).join(', ')}.`,
      vprasanje: { besedilo: 'Katero storitev?', moznosti: izid.kandidati.map((k) => ({ id: k.vrednost.id, oznaka: k.vrednost.naziv })) },
    };
  }
  return izid.najden;
}

function izberiOsebo(ime: string, osebe: OsebaPovzetek[]): OsebaPovzetek | RezultatOrodja {
  const poId = osebe.find((p) => p.id === ime.trim() && p.aktivna);
  if (poId) return poId;
  const izid = poisci(ime, osebe.filter((p) => p.aktivna), (p) => [p.ime, p.priimek]);
  if (izid.izid === 'nic') return { sporocilo: `Zaposlenega »${ime}« ne najdem.` };
  if (izid.izid === 'vec') {
    return {
      sporocilo: `Koga imate v mislih? ${izid.kandidati.map((k) => imeOsebe(k.vrednost)).join(', ')}.`,
      vprasanje: { besedilo: 'Katerega zaposlenega?', moznosti: izid.kandidati.map((k) => ({ id: k.vrednost.id, oznaka: imeOsebe(k.vrednost) })) },
    };
  }
  return izid.najden;
}

const jeRezultat = (x: unknown): x is RezultatOrodja => typeof (x as RezultatOrodja)?.sporocilo === 'string';

/**
 * Lokacija novega termina (samo pri podjetju z več lokacijami; sicer null).
 *   * povedana ("v Šiški") → preveri, da zaposleni tam dela in je storitev tam na voljo;
 *   * sicer ena možna (zaposleni dela samo tam ali je storitev samo tam) → ta;
 *   * zaposleni dela na več lokacijah → vpraša "Na kateri lokaciji?";
 *   * zaposleni ni znan → null: lokacijo izbere obrazec kot pri ročnem vnosu.
 * Oseba ali storitev brez povezav dela oz. je na voljo povsod (kot app/location-context).
 */
export async function lokacijaTermina(
  o: OkoljeOrodja,
  oseba: OsebaPovzetek | null,
  storitev: StoritevPovzetek | null,
  izgovorjena: string | null | undefined
): Promise<LokacijaPovzetek | null | RezultatOrodja> {
  const L = await o.podatki.lokacije();
  if (L.seznam.length <= 1) return null;
  const delaTam = (l: LokacijaPovzetek) => !oseba || !L.osebe[oseba.id] || L.osebe[oseba.id].includes(l.id);
  const naVoljo = (l: LokacijaPovzetek) => !storitev || !L.storitve[storitev.id] || L.storitve[storitev.id].includes(l.id);
  const vprasaj = (mozne: LokacijaPovzetek[]): RezultatOrodja => ({
    sporocilo: `Na kateri lokaciji${oseba ? ` (${oseba.ime})` : ''}? ${mozne.map((l) => l.naziv).join(' ali ')}.`,
    govor: `Na kateri lokaciji, ${mozne.map((l) => l.naziv).join(' ali ')}?`,
    vprasanje: { besedilo: 'Na kateri lokaciji?', moznosti: mozne.map((l) => ({ id: l.id, oznaka: l.naziv })) },
  });

  if (izgovorjena?.trim()) {
    let l = L.seznam.find((x) => x.id === izgovorjena.trim()) ?? null;
    if (!l) {
      const izid = poisci(izgovorjena, L.seznam, (x) => [x.naziv]);
      if (izid.izid === 'nic') return { sporocilo: `Lokacije »${izgovorjena}« ne najdem. Lokacije: ${L.seznam.map((x) => x.naziv).join(', ')}.` };
      if (izid.izid === 'vec') return vprasaj(izid.kandidati.map((k) => k.vrednost));
      l = izid.najden;
    }
    if (!delaTam(l)) {
      const kje = L.seznam.filter(delaTam).map((x) => x.naziv).join(', ');
      return { sporocilo: `${oseba!.ime} na lokaciji ${l.naziv} ne dela${kje ? ` (dela: ${kje})` : ''}.` };
    }
    if (!naVoljo(l)) return { sporocilo: `${storitev!.naziv} na lokaciji ${l.naziv} ni na voljo.` };
    return l;
  }

  const mozne = L.seznam.filter((l) => delaTam(l) && naVoljo(l));
  if (mozne.length === 1) return mozne[0];
  if (mozne.length === 0) {
    return oseba && storitev ? { sporocilo: `${oseba.ime} ne dela na nobeni lokaciji, kjer je ${storitev.naziv}.` } : null;
  }
  return oseba ? vprasaj(mozne) : null;
}

/**
 * Ali je oseba prosta ob danem času (delovni čas, termini, odsotnosti).
 * Vrne opozorilo za uporabnika ali null. Okvirno: brez resursov — te preveri obrazec.
 */
async function opozoriloZaCas(
  o: OkoljeOrodja,
  oseba: OsebaPovzetek,
  datum: string,
  ura: string,
  trajanje: number,
  brezTermina?: string
): Promise<string | null> {
  const [urnikSurov, termini, odsotnosti] = await Promise.all([
    o.podatki.urnikPodjetja(),
    o.podatki.termini(datum, datum),
    o.podatki.odsotnosti(datum, datum),
  ]);
  const zac = vMinute(ura);
  const luknje = prosteLuknje({
    osebaId: oseba.id,
    urnik: urnikOsebe(oseba, razcleniUrnik(urnikSurov)),
    datum,
    odMinute: 0,
    najmanjMin: 1,
    termini: termini.filter((t) => t.id !== brezTermina),
    odsotnosti,
    casovniPas: o.k.casovniPas,
  });
  if (luknje.some(([a, b]) => a <= zac && zac + trajanje <= b)) return null;
  const prekriva = termini.find(
    (t) => t.id !== brezTermina && t.osebaId === oseba.id && t.datum === datum && t.status !== 'cancelled' && t.status !== 'no_show' &&
      vMinute(t.zacetek) < zac + trajanje && (t.konec ? vMinute(t.konec) : vMinute(t.zacetek) + 60) > zac
  );
  if (prekriva) return `Pozor: ${oseba.ime} ima takrat že termin (${prekriva.zacetek}${prekriva.stranka ? `, ${prekriva.stranka}` : ''}).`;
  return `Pozor: ${oseba.ime} takrat po urniku ne dela ali je odsotna.`;
}

function govorPozor(pozor: string | null): string {
  return pozor ? ` ${pozor.replace(/\([^)]*\)/g, '').replace(/\s+\./g, '.').trim()}` : '';
}

/** Jeziki sporočil (kode, kot jih hrani baza in bere n8n). */
export const JEZIKI_SPOROCIL = ['slo', 'eng', 'de', 'it', 'hr'] as const;
const IME_JEZIKA: Record<(typeof JEZIKI_SPOROCIL)[number], string> = {
  slo: 'slovenščina', eng: 'angleščina', de: 'nemščina', it: 'italijanščina', hr: 'hrvaščina',
};
/** Opombe iz govora: brez znakov za oznake, kratko. */
const opomba = z.string().trim().max(300).transform((x) => x.replace(/[<>]/g, '')).nullable();

/** Razreši do dve dodatni storitvi ("dodaj še barvanje"); neznana ali dvoumna → rezultat. */
function dodatneStoritve(imena: string[] | null | undefined, storitve: StoritevPovzetek[]): StoritevPovzetek[] | RezultatOrodja {
  const out: StoritevPovzetek[] = [];
  for (const ime of (imena ?? []).slice(0, 2)) {
    const x = izberiStoritev(ime, storitve);
    if (jeRezultat(x)) return x;
    if (!out.some((y) => y.id === x.id)) out.push(x);
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
type VhodNov = {
  stranka: string; stranka_id: string | null; storitev: string | null; oseba: string | null; datum: string | null; ura: string | null;
  lokacija?: string | null;
  dodaj_storitve?: string[] | null;
  jezik?: (typeof JEZIKI_SPOROCIL)[number] | null;
  opombe?: string | null;
  interne_opombe?: string | null;
};

export const pripraviTermin: BralnoOrodje<VhodNov> = {
  ime: 'pripravi_termin',
  opis:
    'Nov termin: odpre obrazec v koledarju, izpolnjen s stranko, storitvijo, zaposlenim, dnevom in uro ("vpiši Ano Novak jutri ob desetih na barvanje pri Tini"). ' +
    'Pokliči tudi z nepopolnimi podatki ("vpiši Matejo jutri"): manjkajoče izbere uporabnik v obrazcu. Ničesar ne shrani — uporabnik preveri in shrani v obrazcu.',
  razred: 'branje',
  pravica: 'termini.ustvarjanje',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      stranka: { type: 'string', description: 'Ime stranke, kot je bilo izgovorjeno (lahko samo ime ali samo priimek).' },
      stranka_id: { type: ['string', 'null'], description: 'ID stranke, če je že znan, sicer null.' },
      storitev: { type: ['string', 'null'], description: 'Ime ali ID storitve; null, če ni povedana.' },
      oseba: { type: ['string', 'null'], description: 'Ime ali ID zaposlenega; null = uporabnik ali ni povedano.' },
      datum: { type: ['string', 'null'], description: 'Samo dan, ki ga je uporabnik izgovoril ("jutri", "v petek") ali YYYY-MM-DD; null, če dneva ni povedal (ne "danes" na pamet).' },
      ura: { type: ['string', 'null'], description: 'Samo ura, ki jo je uporabnik izgovoril ("HH:MM" ali "ob desetih"); null, če je ni povedal. Trenutna ura NI ura termina.' },
      lokacija: { type: ['string', 'null'], description: 'Ime ali ID lokacije (podjetja z več lokacijami), samo če jo je uporabnik povedal ("v Šiški" → "Šiška"); sicer null — orodje samo vpraša, če je treba.' },
      dodaj_storitve: { type: ['array', 'null'], items: { type: 'string' }, description: 'Druga in tretja storitev ("in še barvanje", "dodaj še pedikuro"); null = nič.' },
      jezik: { type: ['string', 'null'], enum: [...JEZIKI_SPOROCIL, null], description: 'Jezik sporočil (slo, eng, de, it, hr), samo če ga je uporabnik povedal ("v angleščini"); sicer null = privzeti jezik stranke ali podjetja.' },
      opombe: { type: ['string', 'null'], description: 'Opomba termina, samo če jo je uporabnik narekoval; sicer null.' },
      interne_opombe: { type: ['string', 'null'], description: 'Interna opomba (samo za salon), samo če jo je uporabnik narekoval; sicer null.' },
    },
    required: ['stranka', 'stranka_id', 'storitev', 'oseba', 'datum', 'ura', 'lokacija', 'dodaj_storitve', 'jezik', 'opombe', 'interne_opombe'],
    additionalProperties: false,
  },
  vhod: z.object({
    stranka: z.string().trim().min(1).max(80),
    stranka_id: z.string().regex(ID_STRANKE).nullable(),
    storitev: z.string().max(80).nullable(),
    oseba: z.string().max(80).nullable(),
    datum: z.string().max(60).nullable(),
    ura: z.string().max(40).nullable(),
    lokacija: z.string().max(80).nullable().optional(),
    dodaj_storitve: z.array(z.string().max(80)).max(2).nullable().optional(),
    jezik: z.enum(JEZIKI_SPOROCIL).nullable().optional(),
    opombe: opomba.optional(),
    interne_opombe: opomba.optional(),
  }),
  async izvedi(p, o) {
    const r = await razresiStranko(p.stranka, p.stranka_id, o);
    if ('odgovor' in r) {
      if (!r.odgovor.vprasanje) {
        return { ...r.odgovor, sporocilo: `${r.odgovor.sporocilo} Če je nova, recite »dodaj novo stranko ${p.stranka}«.` };
      }
      return r.odgovor;
    }
    const s = r.stranka;
    const datum = p.datum ? datumIzParametra(p.datum, o.danes) : null;
    if (p.datum && !datum) return { sporocilo: `Datuma »${p.datum}« ne razumem.` };
    if (datum && datum < o.danes) return { sporocilo: 'Termina za nazaj ne vpisujem.' };
    const ura = p.ura ? uraIzParametra(p.ura) : null;
    if (p.ura && !ura) return { sporocilo: `Ure »${p.ura}« ne razumem.` };

    const [storitve, osebe] = await Promise.all([o.podatki.storitve(), o.podatki.osebe()]);
    let storitev: StoritevPovzetek | null = null;
    // Neznana storitev ne ustavi obrazca: uporabnik jo izbere sam (več možnosti pa vpraša).
    let neznanaStoritev: string | null = null;
    if (p.storitev) {
      const x = izberiStoritev(p.storitev, storitve);
      if (jeRezultat(x)) {
        if (x.vprasanje) return x;
        neznanaStoritev = p.storitev;
      } else storitev = x;
    }
    let oseba: OsebaPovzetek | null = null;
    if (p.oseba) {
      const x = izberiOsebo(p.oseba, osebe);
      if (jeRezultat(x)) return x;
      oseba = x;
      if (samoSvojiTermini(o.k) && oseba.id !== o.k.osebaId) return { sporocilo: 'Vpisujete lahko samo svoje termine.' };
    } else if (o.k.osebaId) {
      oseba = osebe.find((x) => x.id === o.k.osebaId) ?? null;
    }
    if (oseba && storitev && !oseba.opravljaVse && !oseba.storitve.includes(storitev.id)) {
      return { sporocilo: `${oseba.ime} ne opravlja storitve ${storitev.naziv}.` };
    }
    const dodatne = dodatneStoritve(p.dodaj_storitve, storitve);
    if (jeRezultat(dodatne)) return dodatne;
    const lokacija = await lokacijaTermina(o, oseba, storitev, p.lokacija);
    if (jeRezultat(lokacija)) return lokacija;

    const pozor = oseba && datum && ura ? await opozoriloZaCas(o, oseba, datum, ura, storitev?.trajanjeMin ?? 60) : null;
    const ime = `${s.ime} ${s.priimek}`.trim();
    const deli = [
      ime,
      datum ? opisDatuma(datum, o.danes) : null,
      ura ? `ob ${ura}` : null,
      storitev?.naziv ?? null,
      dodatne.length ? `še ${dodatne.map((x) => x.naziv).join(' in ')}` : null,
      oseba && p.oseba ? `pri ${mestnik(oseba.ime)}` : null,
      lokacija ? `lokacija ${lokacija.naziv}` : null,
      p.jezik ? `jezik ${IME_JEZIKA[p.jezik]}` : null,
      p.opombe ? `opomba »${p.opombe}«` : null,
      p.interne_opombe ? `interna opomba »${p.interne_opombe}«` : null,
    ].filter(Boolean);
    const manjka = [!datum && 'dan', !ura && 'uro', !storitev && 'storitev'].filter(Boolean) as ('dan' | 'uro' | 'storitev')[];
    const neznana = neznanaStoritev ? ` Storitve »${neznanaStoritev}« ne najdem.` : '';
    const vprasanje = vprasajZaManjkajoce(manjka);
    const polja: Record<string, string> = { stranka: s.id };
    if (storitev) polja.storitev = storitev.id;
    if (oseba) polja.oseba = oseba.id;
    if (datum) polja.dan = datum;
    if (ura) polja.ura = ura;
    if (lokacija) polja.lokacija = lokacija.id;
    dodatne.forEach((x, i) => {
      polja[`dodaj${i + 1}`] = x.id;
    });
    if (p.jezik) polja.jezik = p.jezik;
    if (p.opombe) polja.opombe = p.opombe;
    if (p.interne_opombe) polja.interne = p.interne_opombe;
    const dodatek = [
      dodatne.length ? `še ${dodatne.map((x) => x.naziv).join(' in ')}` : '',
      p.jezik ? `jezik ${IME_JEZIKA[p.jezik]}` : '',
      p.opombe || p.interne_opombe ? 'z opombo' : '',
    ].filter(Boolean);
    return {
      sporocilo: `Nov termin: ${deli.join(', ')}.${pozor ? ` ${pozor}` : ''}${neznana}${manjka.length ? ` Manjka še: ${manjka.join(', ')}.` : ` ${SHRANI}`}`,
      govor: `${ime}${datum ? `, ${datumZaGovor(datum, o.danes)}` : ''}${ura ? ` ${uraZaGovor(ura)}` : ''}${storitev ? `, ${storitev.naziv}` : ''}${dodatek.length ? `, ${dodatek.join(', ')}` : ''}${oseba && p.oseba ? `, pri ${mestnik(oseba.ime)}` : ''}.${govorPozor(pozor)}${neznana} ${vprasanje}`,
      pojdi: '/koledar?glas=1',
      obrazec: { vrsta: 'nov_termin', polja },
      podatki: { stranka_id: s.id, datum, ura, storitev: storitev?.naziv ?? null, oseba: oseba ? imeOsebe(oseba) : null, lokacija: lokacija?.naziv ?? null, pozor },
    };
  },
};

// ───────────────────────────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────────────────────────
/** Prihodnji (ali današnji) aktivni termini stranke; ob več → vprašanje. */
async function izberiTermin(
  o: OkoljeOrodja,
  p: { stranka: string; stranka_id: string | null; termin_id: string | null; datum_zdaj: string | null },
  odDanes: boolean
): Promise<{ termin: TerminPovzetek; ime: string } | { odgovor: RezultatOrodja }> {
  const r = await razresiStranko(p.stranka, p.stranka_id, o);
  if ('odgovor' in r) return r;
  const s = r.stranka;
  const ime = `${s.ime} ${s.priimek}`.trim();
  const dan = p.datum_zdaj ? datumIzParametra(p.datum_zdaj, o.danes) : null;
  if (p.datum_zdaj && !dan) return { odgovor: { sporocilo: `Datuma »${p.datum_zdaj}« ne razumem.` } };
  const od = dan ?? (odDanes ? o.danes : dodajDni(o.danes, -1));
  const doo = dan ?? dodajDni(o.danes, 120);
  let termini = (await o.podatki.termini(od, doo))
    .filter((t) => t.idStranke === s.id && aktiven(t))
    .sort((a, b) => a.datum.localeCompare(b.datum) || vMinute(a.zacetek) - vMinute(b.zacetek));
  if (p.termin_id) termini = termini.filter((t) => t.id === p.termin_id);
  if (termini.length === 0) {
    return { odgovor: { sporocilo: `${ime} nima ${dan ? `termina ${opisDatuma(dan, o.danes)}` : 'prihodnjega termina'}.` } };
  }
  if (termini.length > 1) {
    return {
      odgovor: {
        sporocilo: `${ime} ima več terminov. Katerega?`,
        podatki: { stranka_id: s.id },
        vprasanje: {
          besedilo: 'Kateri termin?',
          moznosti: termini.slice(0, 5).map((t) => ({ id: t.id, oznaka: `${opisDatuma(t.datum, o.danes)} ob ${t.zacetek}${t.storitev ? `, ${t.storitev}` : ''}` })),
        },
      },
    };
  }
  return { termin: termini[0], ime };
}

const vhodTermina = {
  stranka: { type: 'string', description: 'Ime stranke, kot je bilo izgovorjeno (lahko samo ime ali samo priimek).' },
  stranka_id: { type: ['string', 'null'], description: 'ID stranke, če je že znan, sicer null.' },
  termin_id: { type: ['string', 'null'], description: 'ID termina, če ga je uporabnik izbral med možnostmi ali gre za aktiven termin, sicer null.' },
  datum_zdaj: { type: ['string', 'null'], description: 'Dan, na katerem je termin zdaj, samo če ga je uporabnik izrecno povedal; sicer null (orodje samo najde prihodnje termine stranke).' },
};
const zodTermina = {
  stranka: z.string().trim().min(1).max(80),
  stranka_id: z.string().regex(ID_STRANKE).nullable(),
  termin_id: z.string().max(40).nullable(),
  datum_zdaj: z.string().max(60).nullable(),
};

type VhodPrestavi = z.infer<z.ZodObject<typeof zodTermina>> & { nov_datum: string | null; nova_ura: string | null };

export const prestaviTermin: BralnoOrodje<VhodPrestavi> = {
  ime: 'prestavi_termin',
  opis:
    'Prestavitev termina: odpre termin v obrazcu z novim dnem in/ali uro ("prestavi Ano na petek ob desetih"). ' +
    'Ob shranjevanju aplikacija sama ponudi obvestilo stranki. Ničesar ne shrani samo.',
  razred: 'branje',
  pravica: 'termini.urejanje',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      ...vhodTermina,
      nov_datum: { type: ['string', 'null'], description: 'Nov dan (izraz ali YYYY-MM-DD); null = isti dan.' },
      nova_ura: { type: ['string', 'null'], description: 'Nova ura ("HH:MM" ali izraz); null = ista ura.' },
    },
    required: ['stranka', 'stranka_id', 'termin_id', 'datum_zdaj', 'nov_datum', 'nova_ura'],
    additionalProperties: false,
  },
  vhod: z.object({ ...zodTermina, nov_datum: z.string().max(60).nullable(), nova_ura: z.string().max(40).nullable() }),
  async izvedi(p, o) {
    const nov = p.nov_datum ? datumIzParametra(p.nov_datum, o.danes) : null;
    if (p.nov_datum && !nov) return { sporocilo: `Datuma »${p.nov_datum}« ne razumem.` };
    const ura = p.nova_ura ? uraIzParametra(p.nova_ura) : null;
    if (p.nova_ura && !ura) return { sporocilo: `Ure »${p.nova_ura}« ne razumem.` };
    const izbran = await izberiTermin(o, p, true);
    if ('odgovor' in izbran) return izbran.odgovor;
    const { termin: t, ime } = izbran;
    if (samoSvojeUrejanje(o.k) && t.osebaId !== o.k.osebaId) return { sporocilo: 'Urejate lahko samo svoje termine.' };
    // Brez novega časa: termin je najden in postane aktiven, zato "na ponedeljek" v naslednji izjavi ve, kaj prestavljamo.
    if (!p.nov_datum && !p.nova_ura) {
      return {
        sporocilo: `${ime}, ${opisDatuma(t.datum, o.danes)} ob ${t.zacetek}. Na kdaj naj ga prestavim?`,
        govor: `${ime}, ${datumZaGovor(t.datum, o.danes)} ${uraZaGovor(t.zacetek)}. Na kdaj?`,
        podatki: { termin_id: t.id, termin_datum: t.datum, stranka_id: t.idStranke },
      };
    }
    const datum = nov ?? t.datum;
    const zacetek = ura ?? t.zacetek;
    if (datum < o.danes) return { sporocilo: 'Termina ne prestavljam v preteklost.' };
    const trajanje = t.konec ? Math.max(5, vMinute(t.konec) - vMinute(t.zacetek)) : 60;
    const oseba = t.osebaId ? (await o.podatki.osebe()).find((x) => x.id === t.osebaId) ?? null : null;
    const pozor = oseba ? await opozoriloZaCas(o, oseba, datum, zacetek, trajanje, t.id) : null;
    return {
      sporocilo: `Prestavitev: ${ime}, ${opisDatuma(t.datum, o.danes)} ob ${t.zacetek} → ${opisDatuma(datum, o.danes)} ob ${zacetek}.${pozor ? ` ${pozor}` : ''} ${SHRANI}`,
      govor: `${ime}, nov čas ${datumZaGovor(datum, o.danes)} ${uraZaGovor(zacetek)}.${govorPozor(pozor)} ${SHRANI}`,
      pojdi: '/koledar?glas=1',
      obrazec: { vrsta: 'prestavi_termin', polja: { idt: t.id, dan_prej: t.datum, dan: datum, ura: zacetek } },
      podatki: { termin_id: t.id, termin_datum: t.datum, stranka_id: t.idStranke, od: { datum: t.datum, ura: t.zacetek }, na: { datum, ura: zacetek }, pozor },
    };
  },
};

// ───────────────────────────────────────────────────────────────────────────
const zodUredi = z.object({
  ...zodTermina,
  storitev: z.string().max(80).nullable(),
  dodaj_storitve: z.array(z.string().max(80)).max(2).nullable(),
  oseba: z.string().max(80).nullable(),
  jezik: z.enum(JEZIKI_SPOROCIL).nullable(),
  opombe: opomba,
  interne_opombe: opomba,
  lokacija: z.string().max(80).nullable(),
  nov_datum: z.string().max(60).nullable(),
  nova_ura: z.string().max(40).nullable(),
});
type VhodUredi = z.infer<typeof zodUredi>;

/**
 * Sprememba obstoječega termina prek obrazca za urejanje (isti kot ročno):
 * storitev, dodatna storitev, zaposleni, jezik sporočil, opombe, lokacija, dan, ura.
 * Nič se ne shrani: obrazec se odpre izpolnjen, uporabnik reče "ja" ali pritisne Shrani.
 */
export const urediTermin: BralnoOrodje<VhodUredi> = {
  ime: 'uredi_termin',
  opis:
    'Spremeni obstoječi termin: storitev, dodatna storitev ("dodaj še barvanje"), zaposleni ("daj ga k Maji"), jezik sporočil ("spremeni jezik v angleščino"), opombe ("v opombo napiši, da bo zamujala"), interne opombe, lokacija ("prestavi v Šiško"), dan in ura. ' +
    'Odpre obrazec termina izpolnjen s spremembami; shrani uporabnik. Podaj samo, kar se spremeni; ostalo null. Za samo dan ali uro lahko tudi prestavi_termin.',
  razred: 'branje',
  pravica: 'termini.urejanje',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      ...vhodTermina,
      storitev: { type: ['string', 'null'], description: 'Nova glavna storitev (zamenja obstoječo); null = ne spremeni.' },
      dodaj_storitve: { type: ['array', 'null'], items: { type: 'string' }, description: 'Storitve, ki se dodajo terminu kot druga ali tretja ("dodaj še barvanje"); null = nič.' },
      oseba: { type: ['string', 'null'], description: 'Nov zaposleni (ime ali ID); null = ne spremeni.' },
      jezik: { type: ['string', 'null'], enum: [...JEZIKI_SPOROCIL, null], description: 'Jezik sporočil termina: slo, eng, de, it ali hr; null = ne spremeni.' },
      opombe: { type: ['string', 'null'], description: 'Besedilo, ki se doda v opombe termina (stranka jih lahko vidi); null = nič.' },
      interne_opombe: { type: ['string', 'null'], description: 'Besedilo, ki se doda v interne opombe (samo za salon); null = nič.' },
      lokacija: { type: ['string', 'null'], description: 'Nova lokacija (ime ali ID), samo pri več lokacijah; null = ne spremeni.' },
      nov_datum: { type: ['string', 'null'], description: 'Nov dan (izraz ali YYYY-MM-DD); null = ne spremeni.' },
      nova_ura: { type: ['string', 'null'], description: 'Nova ura ("HH:MM" ali izraz); null = ne spremeni.' },
    },
    required: [
      'stranka', 'stranka_id', 'termin_id', 'datum_zdaj', 'storitev', 'dodaj_storitve', 'oseba', 'jezik', 'opombe', 'interne_opombe', 'lokacija', 'nov_datum', 'nova_ura',
    ],
    additionalProperties: false,
  },
  vhod: zodUredi,
  async izvedi(p, o) {
    const nov = p.nov_datum ? datumIzParametra(p.nov_datum, o.danes) : null;
    if (p.nov_datum && !nov) return { sporocilo: `Datuma »${p.nov_datum}« ne razumem.` };
    const ura = p.nova_ura ? uraIzParametra(p.nova_ura) : null;
    if (p.nova_ura && !ura) return { sporocilo: `Ure »${p.nova_ura}« ne razumem.` };
    const izbran = await izberiTermin(o, p, true);
    if ('odgovor' in izbran) return izbran.odgovor;
    const { termin: t, ime } = izbran;
    if (samoSvojeUrejanje(o.k) && t.osebaId !== o.k.osebaId) return { sporocilo: 'Urejate lahko samo svoje termine.' };
    const fokus = { termin_id: t.id, termin_datum: t.datum, stranka_id: t.idStranke };

    const [storitve, osebe] = await Promise.all([o.podatki.storitve(), o.podatki.osebe()]);
    let storitev: StoritevPovzetek | null = null;
    if (p.storitev) {
      const x = izberiStoritev(p.storitev, storitve);
      if (jeRezultat(x)) return { ...x, podatki: fokus };
      storitev = x;
    }
    const dodatne = dodatneStoritve(p.dodaj_storitve, storitve);
    if (jeRezultat(dodatne)) return { ...dodatne, podatki: fokus };
    let oseba: OsebaPovzetek | null = null;
    if (p.oseba) {
      const x = izberiOsebo(p.oseba, osebe);
      if (jeRezultat(x)) return { ...x, podatki: fokus };
      oseba = x;
      if (samoSvojeUrejanje(o.k) && oseba.id !== o.k.osebaId) return { sporocilo: 'Termin lahko dodelite samo sebi.', podatki: fokus };
    }
    const sedanjaOseba = oseba ?? osebe.find((x) => x.id === t.osebaId) ?? null;
    const sedanjaStoritev = storitev ?? storitve.find((x) => x.naziv === t.storitev) ?? null;
    if (sedanjaOseba && sedanjaStoritev && (oseba || storitev) && !sedanjaOseba.opravljaVse && !sedanjaOseba.storitve.includes(sedanjaStoritev.id)) {
      return { sporocilo: `${sedanjaOseba.ime} ne opravlja storitve ${sedanjaStoritev.naziv}.`, podatki: fokus };
    }
    const lokacija = p.lokacija ? await lokacijaTermina(o, sedanjaOseba, sedanjaStoritev, p.lokacija) : null;
    if (jeRezultat(lokacija)) return { ...lokacija, podatki: fokus };

    const datum = nov ?? t.datum;
    const zacetek = ura ?? t.zacetek;
    if ((nov || ura) && datum < o.danes) return { sporocilo: 'Termina ne prestavljam v preteklost.', podatki: fokus };
    const trajanje = t.konec ? Math.max(5, vMinute(t.konec) - vMinute(t.zacetek)) : 60;
    const pozor = (nov || ura || oseba) && sedanjaOseba ? await opozoriloZaCas(o, sedanjaOseba, datum, zacetek, trajanje, t.id) : null;

    const zaslon: string[] = [];
    const govor: string[] = [];
    const polja: Record<string, string> = { idt: t.id, dan_prej: t.datum };
    if (storitev) {
      polja.storitev = storitev.id;
      zaslon.push(`storitev ${storitev.naziv}`);
    }
    dodatne.forEach((x, i) => {
      polja[`dodaj${i + 1}`] = x.id;
    });
    if (dodatne.length) zaslon.push(`dodana storitev ${dodatne.map((x) => x.naziv).join(' in ')}`);
    if (oseba) {
      polja.oseba = oseba.id;
      zaslon.push(`pri ${mestnik(oseba.ime)}`);
    }
    if (p.jezik) {
      polja.jezik = p.jezik;
      zaslon.push(`jezik ${IME_JEZIKA[p.jezik]}`);
    }
    if (p.opombe) {
      polja.opombe = p.opombe;
      zaslon.push(`opomba »${p.opombe}«`);
    }
    if (p.interne_opombe) {
      polja.interne = p.interne_opombe;
      zaslon.push(`interna opomba »${p.interne_opombe}«`);
    }
    if (lokacija) {
      polja.lokacija = lokacija.id;
      zaslon.push(`lokacija ${lokacija.naziv}`);
    }
    if (nov || ura) {
      polja.dan = datum;
      polja.ura = zacetek;
      zaslon.push(`nov čas ${opisDatuma(datum, o.danes)} ob ${zacetek}`);
      govor.push(`nov čas ${datumZaGovor(datum, o.danes)} ${uraZaGovor(zacetek)}`);
    }
    const kdaj = `${opisDatuma(t.datum, o.danes)} ob ${t.zacetek}`;
    if (zaslon.length === 0) {
      return { sporocilo: `${ime}, ${kdaj}. Kaj naj spremenim?`, govor: `${ime}, ${datumZaGovor(t.datum, o.danes)} ${uraZaGovor(t.zacetek)}. Kaj naj spremenim?`, podatki: fokus };
    }
    const brezCasa = zaslon.filter((x) => !x.startsWith('nov čas')).map((x) => x.replace(/[»«]/g, ''));
    return {
      sporocilo: `Sprememba termina: ${ime}, ${kdaj} → ${zaslon.join(', ')}.${pozor ? ` ${pozor}` : ''} ${SHRANI}`,
      govor: `${ime}: ${[...brezCasa, ...govor].join(', ')}.${govorPozor(pozor)} ${SHRANI}`,
      pojdi: '/koledar?glas=1',
      obrazec: { vrsta: 'uredi_termin', polja },
      podatki: { ...fokus, spremembe: Object.keys(polja).filter((k) => k !== 'idt' && k !== 'dan_prej'), pozor },
    };
  },
};

// ───────────────────────────────────────────────────────────────────────────
const AKCIJE = { ni_prisla: 'Ni prišla', zakljuci: 'Zaključi', odpovej: 'Odpovej' } as const;
type Akcija = keyof typeof AKCIJE;

export const statusTermina: BralnoOrodje<z.infer<z.ZodObject<typeof zodTermina>> & { akcija: Akcija }> = {
  ime: 'status_termina',
  opis:
    'Stranka ni prišla, zaključi termin ali odpovej termin ("Mateja ni prišla", "zaključi Ano"): poišče termin stranke in ga odpre v koledarju, kjer uporabnik potrdi dejanje z gumbom. Zadostuje samo ime. Ničesar ne spremeni samo.',
  razred: 'branje',
  pravica: 'termini.urejanje',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: { ...vhodTermina, akcija: { type: 'string', enum: Object.keys(AKCIJE) } },
    required: ['stranka', 'stranka_id', 'termin_id', 'datum_zdaj', 'akcija'],
    additionalProperties: false,
  },
  vhod: z.object({ ...zodTermina, akcija: z.enum(Object.keys(AKCIJE) as [Akcija, ...Akcija[]]) }),
  async izvedi(p, o) {
    // Ni prišla / zaključi: tudi včerajšnji; odpovej: samo prihodnji.
    const izbran = await izberiTermin(o, { ...p, datum_zdaj: p.datum_zdaj ?? (p.akcija === 'odpovej' ? null : o.danes) }, p.akcija === 'odpovej');
    if ('odgovor' in izbran) return izbran.odgovor;
    const { termin: t, ime } = izbran;
    if (samoSvojeUrejanje(o.k) && t.osebaId !== o.k.osebaId) return { sporocilo: 'Urejate lahko samo svoje termine.' };
    const gumb = AKCIJE[p.akcija];
    return {
      sporocilo: `Termin ${ime}, ${opisDatuma(t.datum, o.danes)} ob ${t.zacetek}. V koledarju tapnite »${gumb}«.`,
      govor: `Odpiram termin ${ime}, ${datumZaGovor(t.datum, o.danes)} ${uraZaGovor(t.zacetek)}. Tapnite ${gumb}.`,
      // Obstoječa povezava koledarja (obvestila): skoči na dan in odpre termin. ID termina ni oseben podatek.
      pojdi: `/koledar?termin=${encodeURIComponent(t.id)}&datum=${t.datum}`,
      podatki: { termin_id: t.id, termin_datum: t.datum, stranka_id: t.idStranke, akcija: p.akcija },
    };
  },
};

// ───────────────────────────────────────────────────────────────────────────
type VhodOdsotnost = { oseba: string | null; od: string; do: string | null; ura_od: string | null; ura_do: string | null; razlog: string | null };

export const vpisiOdsotnost: BralnoOrodje<VhodOdsotnost> = {
  ime: 'vpisi_odsotnost',
  opis: 'Odsotnost ali blokiran čas zaposlenega ("jutri od dveh do štirih me ni", "Urška je bolna do petka"): odpre obrazec za odsotnost, izpolnjen. Ničesar ne shrani samo.',
  razred: 'branje',
  pravica: 'termini.urejanje',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      oseba: { type: ['string', 'null'], description: 'Ime zaposlenega; null = uporabnik sam.' },
      od: { type: 'string', description: 'Prvi dan (izraz ali YYYY-MM-DD).' },
      do: { type: ['string', 'null'], description: 'Zadnji dan; null = isti dan.' },
      ura_od: { type: ['string', 'null'], description: 'Od ure (samo za del dneva), sicer null.' },
      ura_do: { type: ['string', 'null'], description: 'Do ure (samo za del dneva), sicer null.' },
      razlog: { type: ['string', 'null'], description: 'Kratek razlog, če je povedan.' },
    },
    required: ['oseba', 'od', 'do', 'ura_od', 'ura_do', 'razlog'],
    additionalProperties: false,
  },
  vhod: z.object({
    oseba: z.string().max(80).nullable(),
    od: z.string().trim().min(1).max(60),
    do: z.string().max(60).nullable(),
    ura_od: z.string().max(40).nullable(),
    ura_do: z.string().max(40).nullable(),
    razlog: z.string().max(200).nullable(),
  }),
  async izvedi(p, o) {
    const od = datumIzParametra(p.od, o.danes);
    if (!od) return { sporocilo: `Datuma »${p.od}« ne razumem.` };
    const doo = p.do ? datumIzParametra(p.do, o.danes) : od;
    if (!doo || doo < od) return { sporocilo: `Do kdaj? Datuma »${p.do}« ne razumem.` };
    const uraOd = p.ura_od ? uraIzParametra(p.ura_od) : null;
    const uraDo = p.ura_do ? uraIzParametra(p.ura_do) : null;
    if ((p.ura_od && !uraOd) || (p.ura_do && !uraDo)) return { sporocilo: 'Ure ne razumem.' };
    if (uraOd && uraDo && vMinute(uraDo) <= vMinute(uraOd)) return { sporocilo: 'Konec mora biti po začetku.' };
    const osebe = await o.podatki.osebe();
    let oseba: OsebaPovzetek | null;
    if (p.oseba) {
      const x = izberiOsebo(p.oseba, osebe);
      if (jeRezultat(x)) return x;
      oseba = x;
    } else {
      oseba = osebe.find((x) => x.id === o.k.osebaId) ?? null;
      if (!oseba) return { sporocilo: 'Za koga vpišem odsotnost?' };
    }
    if ((samoSvojiTermini(o.k) || samoSvojeUrejanje(o.k)) && oseba.id !== o.k.osebaId) {
      return { sporocilo: 'Odsotnost lahko vpišete samo zase.' };
    }
    const delDneva = Boolean(uraOd && uraDo) && od === doo;
    const kdaj = od === doo ? opisDatuma(od, o.danes) : `${opisDatuma(od, o.danes)} do ${opisDatuma(doo, o.danes)}`;
    const polja: Record<string, string> = { oseba: oseba.id, dan: od, do_dan: doo };
    if (delDneva) {
      polja.ura = uraOd!;
      polja.do_ura = uraDo!;
    }
    if (p.razlog) polja.razlog = p.razlog.trim();
    const jaz = oseba.id === o.k.osebaId;
    return {
      sporocilo: `Odsotnost: ${imeOsebe(oseba)}, ${kdaj}${delDneva ? `, ${uraOd}–${uraDo}` : ', cel dan'}. ${SHRANI}`,
      govor: `Odsotnost ${jaz ? 'za vas' : `za ${oseba.ime}`}, ${od === doo ? datumZaGovor(od, o.danes) : `${datumZaGovor(od, o.danes)} do ${datumZaGovor(doo, o.danes)}`}${delDneva ? ` od ${uraZaGovor(uraOd!).replace(/^ob /, '')} do ${uraZaGovor(uraDo!).replace(/^ob /, '')}` : ''}. ${SHRANI}`,
      pojdi: '/koledar?glas=1',
      obrazec: { vrsta: 'odsotnost', polja },
      podatki: { oseba: imeOsebe(oseba), od, do: doo, ura_od: delDneva ? uraOd : null, ura_do: delDneva ? uraDo : null },
    };
  },
};

// ───────────────────────────────────────────────────────────────────────────
type VhodStranka = { ime: string; priimek: string | null; telefon: string | null; email: string | null };

export const novaStranka: BralnoOrodje<VhodStranka> = {
  ime: 'nova_stranka',
  opis: 'Nova stranka: odpre obrazec za novo stranko, izpolnjen z imenom, priimkom ter (če sta povedana) telefonom in e-pošto. Ničesar ne shrani samo.',
  razred: 'branje',
  pravica: 'stranke.ustvarjanje',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      ime: { type: 'string' },
      priimek: { type: ['string', 'null'] },
      telefon: { type: ['string', 'null'], description: 'Samo števke in + , kot je bilo povedano; null, če ni.' },
      email: { type: ['string', 'null'] },
    },
    required: ['ime', 'priimek', 'telefon', 'email'],
    additionalProperties: false,
  },
  vhod: z.object({
    ime: z.string().trim().min(1).max(60),
    priimek: z.string().trim().max(60).nullable(),
    telefon: z.string().trim().max(30).nullable(),
    email: z.string().trim().max(120).nullable(),
  }),
  async izvedi(p, o) {
    const telefon = p.telefon ? p.telefon.replace(/[^\d+]/g, '') : '';
    if (p.telefon && telefon.replace(/\D/g, '').length < 6) return { sporocilo: `Telefonske številke »${p.telefon}« ne razumem.` };
    const email = p.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) ? p.email : '';
    const ime = `${p.ime} ${p.priimek ?? ''}`.trim();
    // Opozori na morebitno dvojnico (isto ime in priimek).
    const izid = poisci(ime, await o.podatki.stranke(), (s) => [s.ime, s.priimek]);
    const obstaja = izid.izid === 'enolicno' && `${izid.najden.ime} ${izid.najden.priimek}`.trim().toLowerCase() === ime.toLowerCase();
    const pozor = obstaja ? ` Pozor: stranka ${ime} že obstaja.` : '';
    const polja: Record<string, string> = { ime: p.ime.trim() };
    if (p.priimek) polja.priimek = p.priimek.trim();
    if (telefon) polja.telefon = telefon;
    if (email) polja.email = email;
    return {
      sporocilo: `Nova stranka: ${ime}${telefon ? `, ${telefon}` : ''}${email ? `, ${email}` : ''}.${pozor} ${SHRANI}`,
      govor: `Nova stranka ${ime}.${pozor} ${SHRANI}`,
      pojdi: '/clients?glas=1',
      obrazec: { vrsta: 'nova_stranka', polja },
      podatki: { ime, ze_obstaja: obstaja },
      ...(telefon || email ? { zasebno: { dnevnik: `Nova stranka: ${ime}${telefon ? ', (telefon)' : ''}${email ? ', (e-pošta)' : ''}.${pozor} ${SHRANI}` } } : {}),
    };
  },
};


// ───────────────────────────────────────────────────────────────────────────
const zodUrediStranko = z.object({
  stranka: z.string().trim().min(1).max(80),
  stranka_id: z.string().regex(ID_STRANKE).nullable(),
  telefon: z.string().trim().max(30).nullable(),
  email: z.string().trim().max(120).nullable(),
  jezik: z.enum(JEZIKI_SPOROCIL).nullable(),
  opombe: opomba,
  interne_opombe: opomba,
});
type VhodUrediStranko = z.infer<typeof zodUrediStranko>;

/**
 * Sprememba podatkov stranke prek obstoječega obrazca stranke: telefon, e-pošta,
 * jezik sporočil, opombe, interne opombe. Marketinške privolitve asistent NE spreminja
 * (polja ni), imena in brisanja tudi ne. Shrani uporabnik.
 */
export const urediStranko: BralnoOrodje<VhodUrediStranko> = {
  ime: 'uredi_stranko',
  opis:
    'Spremeni podatke stranke: telefon, e-pošta, jezik sporočil, opombe in interne opombe ("Ani spremeni telefon na …", "piši ji v angleščini", "v opombe stranke dodaj …"). ' +
    'Odpre obrazec stranke izpolnjen; shrani uporabnik. Podaj samo, kar se spremeni. Marketinške privolitve ne spreminja.',
  razred: 'branje',
  pravica: 'stranke.urejanje',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      stranka: { type: 'string', description: 'Ime stranke, kot je bilo izgovorjeno.' },
      stranka_id: { type: ['string', 'null'], description: 'ID stranke, če je znan (aktivna stranka), sicer null.' },
      telefon: { type: ['string', 'null'], description: 'Nov telefon (števke in +, kot povedano); null = ne spremeni.' },
      email: { type: ['string', 'null'], description: 'Nova e-pošta ("afna" = @, "pika" = .); null = ne spremeni.' },
      jezik: { type: ['string', 'null'], enum: [...JEZIKI_SPOROCIL, null], description: 'Jezik sporočil: slo, eng, de, it ali hr; null = ne spremeni.' },
      opombe: { type: ['string', 'null'], description: 'Besedilo, ki se doda v opombe stranke; null = nič.' },
      interne_opombe: { type: ['string', 'null'], description: 'Besedilo, ki se doda v interne opombe stranke; null = nič.' },
    },
    required: ['stranka', 'stranka_id', 'telefon', 'email', 'jezik', 'opombe', 'interne_opombe'],
    additionalProperties: false,
  },
  vhod: zodUrediStranko,
  async izvedi(p, o) {
    const r = await razresiStranko(p.stranka, p.stranka_id, o);
    if ('odgovor' in r) return r.odgovor;
    const s = r.stranka;
    const ime = `${s.ime} ${s.priimek}`.trim();
    const fokus = { stranka_id: s.id };
    const telefon = p.telefon ? p.telefon.replace(/[^\d+]/g, '') : '';
    if (p.telefon && (telefon.replace(/\D/g, '').length < 6 || !povezavaKontakta('klic', telefon))) {
      return { sporocilo: 'Te telefonske številke ne razumem. Ponovite jo, prosim.', podatki: fokus };
    }
    const email = p.email ? p.email.trim().toLowerCase() : '';
    if (p.email && !povezavaKontakta('pisi', email)) return { sporocilo: 'Tega e-naslova ne razumem. Ponovite ga, prosim.', podatki: fokus };

    const polja: Record<string, string> = { id: s.id };
    const zaslon: string[] = [];
    const govor: string[] = [];
    const dnevnik: string[] = [];
    if (telefon) {
      polja.telefon = telefon;
      zaslon.push(`telefon ${telefonZaZaslon(telefon)}`);
      govor.push(`telefon ${telefonZaGovor(telefon)}`);
      dnevnik.push('(nov telefon)');
    }
    if (email) {
      polja.email = email;
      zaslon.push(`e-pošta ${email}`);
      govor.push(`e-pošta ${emailZaGovor(email)}`);
      dnevnik.push('(nova e-pošta)');
    }
    if (p.jezik) {
      polja.jezik = p.jezik;
      zaslon.push(`jezik ${IME_JEZIKA[p.jezik]}`);
      govor.push(`jezik ${IME_JEZIKA[p.jezik]}`);
      dnevnik.push(`jezik ${IME_JEZIKA[p.jezik]}`);
    }
    if (p.opombe) {
      polja.opombe = p.opombe;
      zaslon.push(`opomba »${p.opombe}«`);
      govor.push(`opomba ${p.opombe}`);
      dnevnik.push('(opomba)');
    }
    if (p.interne_opombe) {
      polja.interne = p.interne_opombe;
      zaslon.push(`interna opomba »${p.interne_opombe}«`);
      govor.push(`interna opomba ${p.interne_opombe}`);
      dnevnik.push('(interna opomba)');
    }
    if (zaslon.length === 0) return { sporocilo: `${ime}: kaj naj spremenim?`, podatki: fokus };
    return {
      sporocilo: `Sprememba stranke ${ime}: ${zaslon.join(', ')}. ${SHRANI}`,
      govor: `${ime}: ${govor.join(', ')}. ${SHRANI}`,
      pojdi: '/clients?glas=1',
      obrazec: { vrsta: 'uredi_stranko', polja },
      podatki: { ...fokus, spremembe: Object.keys(polja).filter((k) => k !== 'id') },
      zasebno: { dnevnik: `Sprememba stranke ${ime}: ${dnevnik.join(', ')}. ${SHRANI}` },
    };
  },
};
