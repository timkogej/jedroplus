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
import { imaPravico, samoSvojiTermini } from '../pravice';
import { dodajDni, opisDatuma, razberiUro, vMinute } from '../razresevanje/datumi';
import { poisci } from '../razresevanje/imena';
import { prosteLuknje, razcleniUrnik, urnikOsebe } from '../razresevanje/urnik';
import { datumZaGovor, emailZaGovor, povezavaKontakta, razponZaGovor, telefonZaGovor, telefonZaZaslon, uraZaGovor } from '../govor';
import type { Kontekst, LokacijaPovzetek, OsebaPovzetek, RezultatOrodja, StoritevPovzetek, TerminPovzetek } from '../tipi';
import { datumIzParametra } from './branje';
import { razresiStranko, terminJeStranke, vzorcniTermin, ID_STRANKE } from './stranke';
import type { BralnoOrodje, OkoljeOrodja } from './tipi';
import { inSeznam, jt, kt } from '../jeziki/t';

/** Na koncu odgovora, ko je obrazec izpolnjen: asistent vpraša, uporabnik reče "ja" (= gumb Shrani). */
const SHRANI = kt('Shranim?');
const MANJKA: Record<'dan' | 'uro' | 'storitev', string> = { dan: kt('dan'), uro: kt('uro'), storitev: kt('storitev') };

/** Kar manjka, vpraša kratko, kot receptorka ("Za kdaj?"), namesto navodila za obrazec. */
export function vprasajZaManjkajoce(manjka: readonly ('dan' | 'uro' | 'storitev')[]): string {
  const dan = manjka.includes('dan');
  const ura = manjka.includes('uro');
  const storitev = manjka.includes('storitev');
  const kdaj = dan && ura ? 'kdaj' : dan ? 'dan' : ura ? 'ura' : '';
  if (kdaj && storitev) {
    return kdaj === 'kdaj' ? jt('Za kdaj in katera storitev?') : kdaj === 'dan' ? jt('Kateri dan in katera storitev?') : jt('Ob kateri uri in katera storitev?');
  }
  if (kdaj) return kdaj === 'kdaj' ? jt('Za kdaj?') : kdaj === 'dan' ? jt('Kateri dan?') : jt('Ob kateri uri?');
  return storitev ? jt('Katera storitev?') : jt(SHRANI);
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
  if (izid.izid === 'nic') return { sporocilo: jt('Storitve »{storitev}« ne najdem.', { storitev: ime }) };
  if (izid.izid === 'vec') {
    return {
      sporocilo: `${jt('Katero storitev?')} ${izid.kandidati.map((k) => k.vrednost.naziv).join(', ')}.`,
      vprasanje: { besedilo: jt('Katero storitev?'), moznosti: izid.kandidati.map((k) => ({ id: k.vrednost.id, oznaka: k.vrednost.naziv })) },
    };
  }
  return izid.najden;
}

export function izberiOsebo(ime: string, osebe: OsebaPovzetek[]): OsebaPovzetek | RezultatOrodja {
  const poId = osebe.find((p) => p.id === ime.trim() && p.aktivna);
  if (poId) return poId;
  const izid = poisci(ime, osebe.filter((p) => p.aktivna), (p) => [p.ime, p.priimek]);
  if (izid.izid === 'nic') return { sporocilo: jt('Zaposlenega »{oseba}« ne najdem.', { oseba: ime }) };
  if (izid.izid === 'vec') {
    return {
      sporocilo: `${jt('Koga imate v mislih?')} ${izid.kandidati.map((k) => imeOsebe(k.vrednost)).join(', ')}.`,
      vprasanje: { besedilo: jt('Katerega zaposlenega?'), moznosti: izid.kandidati.map((k) => ({ id: k.vrednost.id, oznaka: imeOsebe(k.vrednost) })) },
    };
  }
  return izid.najden;
}

export const jeRezultat = (x: unknown): x is RezultatOrodja => typeof (x as RezultatOrodja)?.sporocilo === 'string';

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
    sporocilo: `${oseba ? jt('Na kateri lokaciji ({oseba})?', { oseba: oseba.ime }) : jt('Na kateri lokaciji?')} ${mozne.map((l) => l.naziv).join(` ${jt('ali')} `)}.`,
    govor: jt('Na kateri lokaciji, {moznosti}?', { moznosti: mozne.map((l) => l.naziv).join(` ${jt('ali')} `) }),
    vprasanje: { besedilo: jt('Na kateri lokaciji?'), moznosti: mozne.map((l) => ({ id: l.id, oznaka: l.naziv })) },
  });

  if (izgovorjena?.trim()) {
    let l = L.seznam.find((x) => x.id === izgovorjena.trim()) ?? null;
    if (!l) {
      const izid = poisci(izgovorjena, L.seznam, (x) => [x.naziv]);
      if (izid.izid === 'nic') return { sporocilo: jt('Lokacije »{lokacija}« ne najdem. Lokacije: {lokacije}.', { lokacija: izgovorjena, lokacije: L.seznam.map((x) => x.naziv).join(', ') }) };
      if (izid.izid === 'vec') return vprasaj(izid.kandidati.map((k) => k.vrednost));
      l = izid.najden;
    }
    if (!delaTam(l)) {
      const kje = L.seznam.filter(delaTam).map((x) => x.naziv).join(', ');
      return {
        sporocilo: kje
          ? jt('{oseba} na lokaciji {lokacija} ne dela (dela: {kje}).', { oseba: oseba!.ime, lokacija: l.naziv, kje })
          : jt('{oseba} na lokaciji {lokacija} ne dela.', { oseba: oseba!.ime, lokacija: l.naziv }),
      };
    }
    if (!naVoljo(l)) return { sporocilo: jt('{storitev} na lokaciji {lokacija} ni na voljo.', { storitev: storitev!.naziv, lokacija: l.naziv }) };
    return l;
  }

  const mozne = L.seznam.filter((l) => delaTam(l) && naVoljo(l));
  if (mozne.length === 1) return mozne[0];
  if (mozne.length === 0) {
    return oseba && storitev ? { sporocilo: jt('{oseba} ne dela na nobeni lokaciji, kjer je {storitev}.', { oseba: oseba.ime, storitev: storitev.naziv }) } : null;
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
  if (prekriva) return jt('Pozor: {oseba} ima takrat že termin ({termin}).', { oseba: oseba.ime, termin: `${prekriva.zacetek}${prekriva.stranka ? `, ${prekriva.stranka}` : ''}` });
  return jt('Pozor: pri {oseba:mestnik} takrat ni delovnega časa ali je vpisana odsotnost.', { oseba: oseba.ime });
}

function govorPozor(pozor: string | null): string {
  return pozor ? ` ${pozor.replace(/\([^)]*\)/g, '').replace(/\s+\./g, '.').trim()}` : '';
}

/** Jeziki sporočil (kode, kot jih hrani baza in bere n8n). */
export const JEZIKI_SPOROCIL = ['slo', 'eng', 'de', 'it', 'hr'] as const;
const IME_JEZIKA: Record<(typeof JEZIKI_SPOROCIL)[number], string> = {
  slo: kt('slovenščina'), eng: kt('angleščina'), de: kt('nemščina'), it: kt('italijanščina'), hr: kt('hrvaščina'),
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
  kot_zadnjic?: boolean | null;
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
      kot_zadnjic: { type: ['boolean', 'null'], description: 'true za "isto kot zadnjič", "kot prejšnjič", "enako kot danes", "ponovi termin": storitev, zaposleni in lokacija iz današnjega ali zadnjega termina stranke (kar uporabnik pove posebej, ima prednost).' },
    },
    required: ['stranka', 'stranka_id', 'storitev', 'oseba', 'datum', 'ura', 'lokacija', 'dodaj_storitve', 'jezik', 'opombe', 'interne_opombe', 'kot_zadnjic'],
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
    kot_zadnjic: z.boolean().nullable().optional(),
  }),
  async izvedi(p, o) {
    const r = await razresiStranko(p.stranka, p.stranka_id, o);
    if ('odgovor' in r) {
      if (!r.odgovor.vprasanje) {
        return { ...r.odgovor, sporocilo: `${r.odgovor.sporocilo} ${jt('Če je nova, recite »dodaj novo stranko {ime}«.', { ime: p.stranka })}` };
      }
      return r.odgovor;
    }
    const s = r.stranka;
    const datum = p.datum ? datumIzParametra(p.datum, o.danes) : null;
    if (p.datum && !datum) return { sporocilo: jt('Datuma »{datum}« ne razumem.', { datum: p.datum }) };
    if (datum && datum < o.danes) return { sporocilo: jt('Termina za nazaj ne vpisujem.') };
    const ura = p.ura ? uraIzParametra(p.ura) : null;
    if (p.ura && !ura) return { sporocilo: jt('Ure »{ura}« ne razumem.', { ura: p.ura }) };

    const [storitve, osebe, zadnji] = await Promise.all([
      o.podatki.storitve(),
      o.podatki.osebe(),
      p.kot_zadnjic ? vzorcniTermin(o, s) : Promise.resolve(null),
    ]);
    let storitev: StoritevPovzetek | null = null;
    // Neznana storitev ne ustavi obrazca: uporabnik jo izbere sam (več možnosti pa vpraša).
    let neznanaStoritev: string | null = null;
    // "Isto kot zadnjič": storitev in zaposleni iz zadnjega termina, če nista povedana posebej.
    const izZadnjega = { storitev: false, oseba: false };
    if (!p.storitev && zadnji?.storitev) {
      const x = izberiStoritev(zadnji.storitev.split(/[,+]/)[0].trim(), storitve);
      if (!jeRezultat(x)) {
        storitev = x;
        izZadnjega.storitev = true;
      }
    }
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
      if (samoSvojiTermini(o.k) && oseba.id !== o.k.osebaId) return { sporocilo: jt('Vpisujete lahko samo svoje termine.') };
    } else if (zadnji?.osebaId && osebe.some((x) => x.id === zadnji.osebaId && x.aktivna) && (!samoSvojiTermini(o.k) || zadnji.osebaId === o.k.osebaId)) {
      oseba = osebe.find((x) => x.id === zadnji.osebaId) ?? null;
      izZadnjega.oseba = true;
    } else if (o.k.osebaId) {
      oseba = osebe.find((x) => x.id === o.k.osebaId) ?? null;
    }
    if (oseba && storitev && !oseba.opravljaVse && !oseba.storitve.includes(storitev.id)) {
      return { sporocilo: jt('{oseba} ne opravlja storitve {storitev}.', { oseba: oseba.ime, storitev: storitev.naziv }) };
    }
    const dodatne = dodatneStoritve(p.dodaj_storitve, storitve);
    if (jeRezultat(dodatne)) return dodatne;
    // Lokacija zadnjega termina, če zaposleni tam še dela (sicer kot brez nje).
    let lokacija = await lokacijaTermina(o, oseba, storitev, p.lokacija ?? zadnji?.lokacijaId ?? null);
    if (jeRezultat(lokacija) && !p.lokacija && zadnji?.lokacijaId) lokacija = await lokacijaTermina(o, oseba, storitev, null);
    if (jeRezultat(lokacija)) return lokacija;

    const pozor = oseba && datum && ura ? await opozoriloZaCas(o, oseba, datum, ura, storitev?.trajanjeMin ?? 60) : null;
    const ime = `${s.ime} ${s.priimek}`.trim();
    const deli = [
      ime,
      datum ? opisDatuma(datum, o.danes) : null,
      ura ? jt('ob {ura}', { ura }) : null,
      storitev?.naziv ?? null,
      dodatne.length ? jt('še {storitve}', { storitve: inSeznam(dodatne.map((x) => x.naziv)) }) : null,
      oseba && (p.oseba || izZadnjega.oseba) ? jt('pri {oseba:mestnik}', { oseba: oseba.ime }) : null,
      lokacija ? jt('lokacija {lokacija}', { lokacija: lokacija.naziv }) : null,
      p.jezik ? jt('jezik {jezik}', { jezik: jt(IME_JEZIKA[p.jezik]) }) : null,
      p.opombe ? jt('opomba »{opomba}«', { opomba: p.opombe }) : null,
      p.interne_opombe ? jt('interna opomba »{opomba}«', { opomba: p.interne_opombe }) : null,
    ].filter(Boolean);
    const manjka = [!datum && 'dan', !ura && 'uro', !storitev && 'storitev'].filter(Boolean) as ('dan' | 'uro' | 'storitev')[];
    const neznana = `${neznanaStoritev ? ` ${jt('Storitve »{storitev}« ne najdem.', { storitev: neznanaStoritev })}` : ''}${p.kot_zadnjic && !zadnji ? ` ${jt('Prejšnjega termina nima.')}` : ''}`;
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
      dodatne.length ? jt('še {storitve}', { storitve: inSeznam(dodatne.map((x) => x.naziv)) }) : '',
      p.jezik ? jt('jezik {jezik}', { jezik: jt(IME_JEZIKA[p.jezik]) }) : '',
      p.opombe || p.interne_opombe ? jt('z opombo') : '',
    ].filter(Boolean);
    return {
      sporocilo: `${jt('Nov termin: {podrobnosti}.', { podrobnosti: deli.join(', ') })}${pozor ? ` ${pozor}` : ''}${neznana}${manjka.length ? ` ${jt('Manjka še: {kaj}.', { kaj: manjka.map((x) => jt(MANJKA[x])).join(', ') })}` : ` ${jt(SHRANI)}`}`,
      govor: `${ime}${datum ? `, ${datumZaGovor(datum, o.danes)}` : ''}${ura ? ` ${uraZaGovor(ura)}` : ''}${storitev ? `, ${storitev.naziv}` : ''}${dodatek.length ? `, ${dodatek.join(', ')}` : ''}${oseba && (p.oseba || izZadnjega.oseba) ? `, ${jt('pri {oseba:mestnik}', { oseba: oseba.ime })}` : ''}.${govorPozor(pozor)}${neznana} ${vprasanje}`,
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
  if (p.datum_zdaj && !dan) return { odgovor: { sporocilo: jt('Datuma »{datum}« ne razumem.', { datum: p.datum_zdaj }) } };
  const od = dan ?? (odDanes ? o.danes : dodajDni(o.danes, -1));
  const doo = dan ?? dodajDni(o.danes, 120);
  let termini = (await o.podatki.termini(od, doo))
    .filter((t) => terminJeStranke(t, s) && aktiven(t))
    .sort((a, b) => a.datum.localeCompare(b.datum) || vMinute(a.zacetek) - vMinute(b.zacetek));
  if (p.termin_id) termini = termini.filter((t) => t.id === p.termin_id);
  if (termini.length === 0) {
    return { odgovor: { sporocilo: dan ? jt('{ime} nima termina {datum}.', { ime, datum: opisDatuma(dan, o.danes) }) : jt('{ime} nima prihodnjega termina.', { ime }) } };
  }
  if (termini.length > 1) {
    return {
      odgovor: {
        sporocilo: jt('{ime} ima več terminov. Katerega?', { ime }),
        podatki: { stranka_id: s.id },
        vprasanje: {
          besedilo: jt('Kateri termin?'),
          moznosti: termini.slice(0, 5).map((t) => ({ id: t.id, oznaka: `${jt('{datum} ob {ura}', { datum: opisDatuma(t.datum, o.danes), ura: t.zacetek })}${t.storitev ? `, ${t.storitev}` : ''}` })),
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
    if (p.nov_datum && !nov) return { sporocilo: jt('Datuma »{datum}« ne razumem.', { datum: p.nov_datum }) };
    const ura = p.nova_ura ? uraIzParametra(p.nova_ura) : null;
    if (p.nova_ura && !ura) return { sporocilo: jt('Ure »{ura}« ne razumem.', { ura: p.nova_ura }) };
    const izbran = await izberiTermin(o, p, true);
    if ('odgovor' in izbran) return izbran.odgovor;
    const { termin: t, ime } = izbran;
    if (samoSvojeUrejanje(o.k) && t.osebaId !== o.k.osebaId) return { sporocilo: jt('Urejate lahko samo svoje termine.') };
    // Brez novega časa: termin je najden in postane aktiven, zato "na ponedeljek" v naslednji izjavi ve, kaj prestavljamo.
    if (!p.nov_datum && !p.nova_ura) {
      return {
        sporocilo: jt('{ime}, {datum} ob {ura}. Na kdaj naj ga prestavim?', { ime, datum: opisDatuma(t.datum, o.danes), ura: t.zacetek }),
        govor: jt('{ime}, {datum} {ura}. Na kdaj?', { ime, datum: datumZaGovor(t.datum, o.danes), ura: uraZaGovor(t.zacetek) }),
        podatki: { termin_id: t.id, termin_datum: t.datum, stranka_id: t.idStranke },
      };
    }
    const datum = nov ?? t.datum;
    const zacetek = ura ?? t.zacetek;
    if (datum < o.danes) return { sporocilo: jt('Termina ne prestavljam v preteklost.') };
    const trajanje = t.konec ? Math.max(5, vMinute(t.konec) - vMinute(t.zacetek)) : 60;
    const oseba = t.osebaId ? (await o.podatki.osebe()).find((x) => x.id === t.osebaId) ?? null : null;
    const pozor = oseba ? await opozoriloZaCas(o, oseba, datum, zacetek, trajanje, t.id) : null;
    return {
      sporocilo: `${jt('Prestavitev: {ime}, {prej} → {potem}.', { ime, prej: jt('{datum} ob {ura}', { datum: opisDatuma(t.datum, o.danes), ura: t.zacetek }), potem: jt('{datum} ob {ura}', { datum: opisDatuma(datum, o.danes), ura: zacetek }) })}${pozor ? ` ${pozor}` : ''} ${jt(SHRANI)}`,
      govor: `${jt('{ime}, nov čas {datum} {ura}.', { ime, datum: datumZaGovor(datum, o.danes), ura: uraZaGovor(zacetek) })}${govorPozor(pozor)} ${jt(SHRANI)}`,
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
    if (p.nov_datum && !nov) return { sporocilo: jt('Datuma »{datum}« ne razumem.', { datum: p.nov_datum }) };
    const ura = p.nova_ura ? uraIzParametra(p.nova_ura) : null;
    if (p.nova_ura && !ura) return { sporocilo: jt('Ure »{ura}« ne razumem.', { ura: p.nova_ura }) };
    const izbran = await izberiTermin(o, p, true);
    if ('odgovor' in izbran) return izbran.odgovor;
    const { termin: t, ime } = izbran;
    if (samoSvojeUrejanje(o.k) && t.osebaId !== o.k.osebaId) return { sporocilo: jt('Urejate lahko samo svoje termine.') };
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
      if (samoSvojeUrejanje(o.k) && oseba.id !== o.k.osebaId) return { sporocilo: jt('Termin lahko dodelite samo sebi.'), podatki: fokus };
    }
    const sedanjaOseba = oseba ?? osebe.find((x) => x.id === t.osebaId) ?? null;
    const sedanjaStoritev = storitev ?? storitve.find((x) => x.naziv === t.storitev) ?? null;
    if (sedanjaOseba && sedanjaStoritev && (oseba || storitev) && !sedanjaOseba.opravljaVse && !sedanjaOseba.storitve.includes(sedanjaStoritev.id)) {
      return { sporocilo: jt('{oseba} ne opravlja storitve {storitev}.', { oseba: sedanjaOseba.ime, storitev: sedanjaStoritev.naziv }), podatki: fokus };
    }
    const lokacija = p.lokacija ? await lokacijaTermina(o, sedanjaOseba, sedanjaStoritev, p.lokacija) : null;
    if (jeRezultat(lokacija)) return { ...lokacija, podatki: fokus };

    const datum = nov ?? t.datum;
    const zacetek = ura ?? t.zacetek;
    if ((nov || ura) && datum < o.danes) return { sporocilo: jt('Termina ne prestavljam v preteklost.'), podatki: fokus };
    const trajanje = t.konec ? Math.max(5, vMinute(t.konec) - vMinute(t.zacetek)) : 60;
    const pozor = (nov || ura || oseba) && sedanjaOseba ? await opozoriloZaCas(o, sedanjaOseba, datum, zacetek, trajanje, t.id) : null;

    const zaslon: string[] = [];
    const govor: string[] = [];
    const polja: Record<string, string> = { idt: t.id, dan_prej: t.datum };
    if (storitev) {
      polja.storitev = storitev.id;
      zaslon.push(jt('storitev {storitev}', { storitev: storitev.naziv }));
    }
    dodatne.forEach((x, i) => {
      polja[`dodaj${i + 1}`] = x.id;
    });
    if (dodatne.length) zaslon.push(jt('dodana storitev {storitve}', { storitve: inSeznam(dodatne.map((x) => x.naziv)) }));
    if (oseba) {
      polja.oseba = oseba.id;
      zaslon.push(jt('pri {oseba:mestnik}', { oseba: oseba.ime }));
    }
    if (p.jezik) {
      polja.jezik = p.jezik;
      zaslon.push(jt('jezik {jezik}', { jezik: jt(IME_JEZIKA[p.jezik]) }));
    }
    if (p.opombe) {
      polja.opombe = p.opombe;
      zaslon.push(jt('opomba »{opomba}«', { opomba: p.opombe }));
    }
    if (p.interne_opombe) {
      polja.interne = p.interne_opombe;
      zaslon.push(jt('interna opomba »{opomba}«', { opomba: p.interne_opombe }));
    }
    if (lokacija) {
      polja.lokacija = lokacija.id;
      zaslon.push(jt('lokacija {lokacija}', { lokacija: lokacija.naziv }));
    }
    const novCas = nov || ura ? jt('nov čas {datum} ob {ura}', { datum: opisDatuma(datum, o.danes), ura: zacetek }) : null;
    if (novCas) {
      polja.dan = datum;
      polja.ura = zacetek;
      zaslon.push(novCas);
      govor.push(jt('nov čas {datum} {ura}', { datum: datumZaGovor(datum, o.danes), ura: uraZaGovor(zacetek) }));
    }
    const kdaj = jt('{datum} ob {ura}', { datum: opisDatuma(t.datum, o.danes), ura: t.zacetek });
    if (zaslon.length === 0) {
      return {
        sporocilo: jt('{ime}, {kdaj}. Kaj naj spremenim?', { ime, kdaj }),
        govor: jt('{ime}, {kdaj}. Kaj naj spremenim?', { ime, kdaj: `${datumZaGovor(t.datum, o.danes)} ${uraZaGovor(t.zacetek)}` }),
        podatki: fokus,
      };
    }
    const brezCasa = zaslon.filter((x) => x !== novCas).map((x) => x.replace(/[»«]/g, ''));
    return {
      sporocilo: `${jt('Sprememba termina: {ime}, {kdaj} → {spremembe}.', { ime, kdaj, spremembe: zaslon.join(', ') })}${pozor ? ` ${pozor}` : ''} ${jt(SHRANI)}`,
      govor: `${ime}: ${[...brezCasa, ...govor].join(', ')}.${govorPozor(pozor)} ${jt(SHRANI)}`,
      pojdi: '/koledar?glas=1',
      obrazec: { vrsta: 'uredi_termin', polja },
      podatki: { ...fokus, spremembe: Object.keys(polja).filter((k) => k !== 'idt' && k !== 'dan_prej'), pozor },
    };
  },
};

// ───────────────────────────────────────────────────────────────────────────
/** Gumbi v koledarju (ključi prevodov; prevod se mora ujemati z gumbom v vmesniku). */
const AKCIJE = { ni_prisla: kt('Ni prišla'), zakljuci: kt('Zaključi'), odpovej: kt('Odpovej') } as const;
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
    if (samoSvojeUrejanje(o.k) && t.osebaId !== o.k.osebaId) return { sporocilo: jt('Urejate lahko samo svoje termine.') };
    return {
      // List termina sam vpraša »Odpovem?« / »Zaključim?«; »ja« pritisne isti gumb (uporabnik potrdi).
      sporocilo:
        jt('Termin {ime}, {kdaj}.', { ime, kdaj: jt('{datum} ob {ura}', { datum: opisDatuma(t.datum, o.danes), ura: t.zacetek }) }) +
        // Po odpovedi lahko stranko obvesti (sporoci_stranki preveri, da je termin res odpovedan v bazi).
        (p.akcija === 'odpovej' && o.sporocila && imaPravico(o.k, 'sporocila.stranke') ? ` ${jt('Ko odpoveste, recite »obvesti stranko«.')}` : ''),
      govor: jt('{ime}, {kdaj}.', { ime, kdaj: `${datumZaGovor(t.datum, o.danes)} ${uraZaGovor(t.zacetek)}` }),
      // Obstoječa povezava koledarja (obvestila): skoči na dan in odpre termin. ID termina ni oseben podatek.
      pojdi: `/koledar?termin=${encodeURIComponent(t.id)}&datum=${t.datum}&glas_akcija=${p.akcija}`,
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
    if (!od) return { sporocilo: jt('Datuma »{datum}« ne razumem.', { datum: p.od }) };
    const doo = p.do ? datumIzParametra(p.do, o.danes) : od;
    if (!doo || doo < od) return { sporocilo: jt('Do kdaj? Datuma »{datum}« ne razumem.', { datum: p.do }) };
    const uraOd = p.ura_od ? uraIzParametra(p.ura_od) : null;
    const uraDo = p.ura_do ? uraIzParametra(p.ura_do) : null;
    if ((p.ura_od && !uraOd) || (p.ura_do && !uraDo)) return { sporocilo: jt('Ure ne razumem.') };
    if (uraOd && uraDo && vMinute(uraDo) <= vMinute(uraOd)) return { sporocilo: jt('Konec mora biti po začetku.') };
    const osebe = await o.podatki.osebe();
    let oseba: OsebaPovzetek | null;
    if (p.oseba) {
      const x = izberiOsebo(p.oseba, osebe);
      if (jeRezultat(x)) return x;
      oseba = x;
    } else {
      oseba = osebe.find((x) => x.id === o.k.osebaId) ?? null;
      if (!oseba) return { sporocilo: jt('Za koga vpišem odsotnost?') };
    }
    if ((samoSvojiTermini(o.k) || samoSvojeUrejanje(o.k)) && oseba.id !== o.k.osebaId) {
      return { sporocilo: jt('Odsotnost lahko vpišete samo zase.') };
    }
    const delDneva = Boolean(uraOd && uraDo) && od === doo;
    const kdaj = od === doo ? opisDatuma(od, o.danes) : jt('{od} do {do}', { od: opisDatuma(od, o.danes), do: opisDatuma(doo, o.danes) });
    const polja: Record<string, string> = { oseba: oseba.id, dan: od, do_dan: doo };
    if (delDneva) {
      polja.ura = uraOd!;
      polja.do_ura = uraDo!;
    }
    if (p.razlog) polja.razlog = p.razlog.trim();
    const jaz = oseba.id === o.k.osebaId;
    return {
      sporocilo: `${jt('Odsotnost: {oseba}, {kdaj}', { oseba: imeOsebe(oseba), kdaj })}${delDneva ? `, ${uraOd}–${uraDo}` : `, ${jt('cel dan')}`}. ${jt(SHRANI)}`,
      govor: `${jaz ? jt('Odsotnost za vas') : jt('Odsotnost za {oseba}', { oseba: oseba.ime })}, ${od === doo ? datumZaGovor(od, o.danes) : jt('{od} do {do}', { od: datumZaGovor(od, o.danes), do: datumZaGovor(doo, o.danes) })}${delDneva ? ` ${razponZaGovor(uraOd!, uraDo!)}` : ''}. ${jt(SHRANI)}`,
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
    if (p.telefon && telefon.replace(/\D/g, '').length < 6) return { sporocilo: jt('Telefonske številke »{telefon}« ne razumem.', { telefon: p.telefon }) };
    const email = p.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) ? p.email : '';
    const ime = `${p.ime} ${p.priimek ?? ''}`.trim();
    // Opozori na morebitno dvojnico (isto ime in priimek).
    const izid = poisci(ime, await o.podatki.stranke(), (s) => [s.ime, s.priimek]);
    const obstaja = izid.izid === 'enolicno' && `${izid.najden.ime} ${izid.najden.priimek}`.trim().toLowerCase() === ime.toLowerCase();
    const pozor = obstaja ? ` ${jt('Pozor: stranka {ime} že obstaja.', { ime })}` : '';
    const polja: Record<string, string> = { ime: p.ime.trim() };
    if (p.priimek) polja.priimek = p.priimek.trim();
    if (telefon) polja.telefon = telefon;
    if (email) polja.email = email;
    return {
      sporocilo: `${jt('Nova stranka: {ime}', { ime })}${telefon ? `, ${telefon}` : ''}${email ? `, ${email}` : ''}.${pozor} ${jt(SHRANI)}`,
      govor: `${jt('Nova stranka {ime}.', { ime })}${pozor} ${jt(SHRANI)}`,
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
      return { sporocilo: jt('Te telefonske številke ne razumem. Ponovite jo, prosim.'), podatki: fokus };
    }
    const email = p.email ? p.email.trim().toLowerCase() : '';
    if (p.email && !povezavaKontakta('pisi', email)) return { sporocilo: jt('Tega e-naslova ne razumem. Ponovite ga, prosim.'), podatki: fokus };

    const polja: Record<string, string> = { id: s.id };
    const zaslon: string[] = [];
    const govor: string[] = [];
    const dnevnik: string[] = [];
    if (telefon) {
      polja.telefon = telefon;
      zaslon.push(jt('telefon {telefon}', { telefon: telefonZaZaslon(telefon) }));
      govor.push(jt('telefon {telefon}', { telefon: telefonZaGovor(telefon) }));
      dnevnik.push('(nov telefon)');
    }
    if (email) {
      polja.email = email;
      zaslon.push(jt('e-pošta {email}', { email }));
      govor.push(jt('e-pošta {email}', { email: emailZaGovor(email) }));
      dnevnik.push('(nova e-pošta)');
    }
    if (p.jezik) {
      polja.jezik = p.jezik;
      zaslon.push(jt('jezik {jezik}', { jezik: jt(IME_JEZIKA[p.jezik]) }));
      govor.push(jt('jezik {jezik}', { jezik: jt(IME_JEZIKA[p.jezik]) }));
      dnevnik.push(`jezik ${IME_JEZIKA[p.jezik]}`);
    }
    if (p.opombe) {
      polja.opombe = p.opombe;
      zaslon.push(jt('opomba »{opomba}«', { opomba: p.opombe }));
      govor.push(jt('opomba {opomba}', { opomba: p.opombe }));
      dnevnik.push('(opomba)');
    }
    if (p.interne_opombe) {
      polja.interne = p.interne_opombe;
      zaslon.push(jt('interna opomba »{opomba}«', { opomba: p.interne_opombe }));
      govor.push(jt('interna opomba {opomba}', { opomba: p.interne_opombe }));
      dnevnik.push('(interna opomba)');
    }
    if (zaslon.length === 0) return { sporocilo: jt('{ime}: kaj naj spremenim?', { ime }), podatki: fokus };
    return {
      sporocilo: `${jt('Sprememba stranke {ime}: {spremembe}.', { ime, spremembe: zaslon.join(', ') })} ${jt(SHRANI)}`,
      govor: `${ime}: ${govor.join(', ')}. ${jt(SHRANI)}`,
      pojdi: '/clients?glas=1',
      obrazec: { vrsta: 'uredi_stranko', polja },
      podatki: { ...fokus, spremembe: Object.keys(polja).filter((k) => k !== 'id') },
      zasebno: { dnevnik: `Sprememba stranke ${ime}: ${dnevnik.join(', ')}. ${SHRANI}` },
    };
  },
};
