// lib/glas/orodja/zapolnitev.ts
//
// Zapolnitev luknje 4a: »Ana je odpovedala jutri ob desetih, kdo bi lahko prišel?«
// (docs/glasovni-asistent-dodatne-funkcije-nacrt.md, §4a)
//
// kandidati_za_luknjo (branje): 3–5 strank z razlogom in gumbom Pokliči.
// ponudi_prosti_termin (sporočilo): SMS o prostem terminu SAMO stranki z
//   marketing_consent = true (Timova odločitev O9), brez popusta in cen, s potrditvijo.
// Ponudba prestavitve kasnejšega termina gre prek sporoci_stranki (sporočilo o
// njenem terminu = storitveno, ne marketing).
//
// Model dobi samo imena in razloge; telefon gre samo v gumb na zaslonu.

import { z } from 'zod';
import { samoSvojiTermini } from '../pravice';
import { dodajDni, izMinut, opisDatuma, vMinute } from '../razresevanje/datumi';
import { prosteLuknje, razcleniUrnik, urnikOsebe } from '../razresevanje/urnik';
import { datumZaGovor, povezavaKontakta, razponZaGovor } from '../govor';
import { zJezikom } from '../jeziki/jezik';
import { inSeznam, jt } from '../jeziki/t';
import type { AkcijaStranke, OsebaPovzetek, Predogled, RezultatOrodja, TerminPovzetek } from '../tipi';
import { NAJVEC_EMAIL, NAJVEC_SMS, ocistiSms, preveriBesedilo, skritEmail, skritTelefon, zPodpisom } from '../sporocila/besedilo';
import type { Kanal } from '../sporocila/tipi';
import { DNI_NAPREJ, DNI_NAZAJ, izberiKandidate, NAJVEC_KANDIDATOV, type Kandidat, type Luknja } from '../zapolnitev/kandidati';
import { cap } from './branje';
import { samoSvojeUrejanje, uraIzParametra } from './obrazci';
import { dan, izberiOsebe } from './pregled';
import { imeJezika, izidPosiljanja, jezikStranke, omejitevSporocil, zavrnitevBesedila } from './sporocila';
import { ID_STRANKE, razresiStranko, terminJeStranke } from './stranke';
import type { BralnoOrodje, OkoljeOrodja, PisalnoOrodje } from './tipi';

const aktiven = (t: TerminPovzetek) => t.status !== 'cancelled' && t.status !== 'no_show';
const imeOsebe = (p: OsebaPovzetek) => `${p.ime} ${p.priimek}`.trim();
const JEZIKI = ['sl', 'en', 'de', 'it', 'hr'] as const;
/** Najkrajša luknja, ki jo štejemo. */
const NAJMANJ_MIN = 15;

type NajdenaLuknja = { luknja: Luknja; oseba: OsebaPovzetek };
type VhodLuknje = {
  datum: string | null;
  ura: string | null;
  oseba: string | null;
  trajanje_min: number | null;
  /** Luknja ob terminu stranke: »v sredo pred Anjo Novak«. */
  ob_stranki?: string | null;
  glede?: 'pred' | 'po' | null;
};

/** Proste luknje osebe na dan (od zdaj naprej, če je danes). */
async function luknjeOseb(o: OkoljeOrodja, datum: string, osebe: OsebaPovzetek[]) {
  const [urnikSurov, termini, odsotnosti] = await Promise.all([o.podatki.urnikPodjetja(), o.podatki.termini(datum, datum), o.podatki.odsotnosti(datum, datum)]);
  const urnikPodjetja = razcleniUrnik(urnikSurov);
  const odMinute = datum === o.danes ? vMinute(o.uraZdaj) : 0;
  return osebe.map((p) => ({
    p,
    luknje: prosteLuknje({
      osebaId: p.id, urnik: urnikOsebe(p, urnikPodjetja), datum, odMinute, najmanjMin: NAJMANJ_MIN,
      termini: termini.filter(aktiven), odsotnosti, casovniPas: o.k.casovniPas,
    }),
  }));
}

/**
 * Luknja iz izraza uporabnika: dan, ura (lahko null) in oseba (lahko null).
 * Zaposleni s "samo svoji" vidi samo svojo luknjo.
 */
async function najdiLuknjo(
  o: OkoljeOrodja,
  p: VhodLuknje
): Promise<NajdenaLuknja | RezultatOrodja> {
  if (p.ob_stranki) return luknjaObStranki(o, p);
  const d = dan(p.datum, o);
  if (typeof d !== 'string') return d;
  if (d < o.danes) return { sporocilo: jt('Luknje iščem samo za danes in naprej.') };
  const ura = p.ura ? uraIzParametra(p.ura) : null;
  if (p.ura && !ura) return { sporocilo: jt('Ure »{ura}« ne razumem.', { ura: p.ura }) };
  if (ura && d === o.danes && vMinute(ura) < vMinute(o.uraZdaj) - 15) return { sporocilo: jt('Ta čas je danes že mimo.') };

  let izbrane = izberiOsebe(p.oseba, await o.podatki.osebe(), o);
  if (!Array.isArray(izbrane)) return izbrane;
  if (!p.oseba && samoSvojiTermini(o.k)) {
    if (!o.k.osebaId) return { sporocilo: jt('Vaš račun ni povezan z zaposlenim, zato ne vidim vaših terminov.') };
    izbrane = izbrane.filter((x) => x.id === o.k.osebaId);
  }
  const vse = await luknjeOseb(o, d, izbrane);
  const kdaj = datumZaGovor(d, o.danes);

  let zadetki: { p: OsebaPovzetek; od: number; do: number }[];
  if (ura) {
    const u = vMinute(ura);
    zadetki = vse.flatMap((x) => x.luknje.filter(([a, b]) => a <= u && u < b).map(([, b]) => ({ p: x.p, od: u, do: b })));
    if (zadetki.length === 0) {
      return {
        sporocilo: izbrane.length === 1
          ? jt('{kdaj} ob {ura} {oseba} nima proste luknje. Če je stranka odpovedala, najprej odpovejte termin v koledarju.', { kdaj: cap(kdaj), ura, oseba: izbrane[0].ime })
          : jt('{kdaj} ob {ura} ni proste luknje. Če je stranka odpovedala, najprej odpovejte termin v koledarju.', { kdaj: cap(kdaj), ura }),
      };
    }
  } else {
    zadetki = vse.flatMap((x) => x.luknje.filter(([a, b]) => b - a >= 30).map(([a, b]) => ({ p: x.p, od: a, do: b })));
    if (zadetki.length === 0) return { sporocilo: jt('{kdaj} ni prostih lukenj.', { kdaj: cap(kdaj) }) };
  }
  // Zaposlenega določi asistent sam (Tim, 16. 11.): po zaposlenem nikoli ne sprašuje.
  // Zaposleni: njegova luknja. Lastnik/admin: iščemo pri vseh, prednost imajo prave luknje
  // (oseba ima ta dan termine) pred povsem prostim dnem.
  const jaz = zadetki.filter((z) => z.p.id === o.k.osebaId);
  if (zadetki.length > 1 && o.k.vloga === 'staff' && jaz.length > 0) zadetki = jaz;
  if (zadetki.length > 1 && !p.oseba) {
    const zTermini = new Set((await o.podatki.termini(d, d)).filter(aktiven).map((t) => t.osebaId));
    const prave = zadetki.filter((z) => zTermini.has(z.p.id));
    if (prave.length > 0) zadetki = prave;
  }
  // Z uro: najožja luknja (odpovedan termin med drugimi), brez vprašanja.
  if (zadetki.length > 1 && ura) zadetki = [[...zadetki].sort((a, b) => a.do - a.od - (b.do - b.od))[0]];
  if (zadetki.length > 1) {
    // Brez ure: vprašamo samo za čas; oseba je del možnosti, ne vprašanje.
    const vec = new Set(zadetki.map((z) => z.p.id)).size > 1;
    zadetki.sort((a, b) => a.od - b.od);
    return {
      sporocilo: jt('Ob kateri uri je luknja {kdaj}?', { kdaj }),
      vprasanje: {
        besedilo: jt('Ob kateri uri?'),
        moznosti: zadetki.slice(0, 6).map((z) => ({ id: `${z.p.id}@${izMinut(z.od)}`, oznaka: `${vec ? `${imeOsebe(z.p)}, ` : ''}${izMinut(z.od)}–${izMinut(z.do)}` })),
      },
    };
  }
  const z0 = zadetki[0];
  const doo = p.trajanje_min ? Math.min(z0.do, z0.od + p.trajanje_min) : z0.do;
  return { luknja: { datum: d, osebaId: z0.p.id, od: z0.od, do: doo }, oseba: z0.p };
}

function razlog(k: Kandidat, o: OkoljeOrodja, oseba: string): string {
  if (k.termin) {
    return jt('ima termin {datum} ob {ura}{storitev}', { datum: opisDatuma(k.termin.datum, o.danes), ura: k.termin.zacetek, storitev: k.termin.storitev ? ` (${k.termin.storitev})` : '' });
  }
  if (k.ritem) {
    return jt('{storitev} na približno {n} dni, zadnjič pred {m} dnevi', { storitev: k.ritem.storitev, n: k.ritem.razmikDni, m: k.ritem.odZadnjegaDni });
  }
  return jt('{n}-krat v zadnjem letu pri {oseba:mestnik} ob tem času', { n: k.navada?.obiskov ?? 0, oseba });
}

/**
 * Luknja tik pred ali po terminu stranke (»v sredo pred Anjo Novak«): termin stranke
 * na ta dan (ali prvi naslednji), luknja pri isti osebi, ki se konča ob začetku termina
 * (pred) oziroma začne ob koncu (po).
 */
async function luknjaObStranki(o: OkoljeOrodja, p: VhodLuknje): Promise<NajdenaLuknja | RezultatOrodja> {
  const r = await razresiStranko(p.ob_stranki ?? '', null, o);
  if ('odgovor' in r) return r.odgovor;
  const s = r.stranka;
  const ime = `${s.ime} ${s.priimek}`.trim();
  const d = p.datum ? dan(p.datum, o) : null;
  if (d !== null && typeof d !== 'string') return d;
  const od = d ?? o.danes;
  const termini = (await o.podatki.termini(od, d ?? dodajDni(o.danes, 14)))
    .filter((t) => terminJeStranke(t, s) && aktiven(t) && t.status !== 'completed')
    .filter((t) => !samoSvojiTermini(o.k) || t.osebaId === o.k.osebaId)
    .sort((a, b) => a.datum.localeCompare(b.datum) || vMinute(a.zacetek) - vMinute(b.zacetek));
  const t = termini[0];
  if (!t) return { sporocilo: d ? jt('{ime} nima termina {datum}.', { ime, datum: opisDatuma(d, o.danes) }) : jt('{ime} nima prihodnjega termina.', { ime }) };
  const oseba = (await o.podatki.osebe()).find((x) => x.id === t.osebaId);
  if (!oseba) return { sporocilo: jt('Ne vem, pri kom je termin {ime}.', { ime }) };
  const [x] = await luknjeOseb(o, t.datum, [oseba]);
  const zacetek = vMinute(t.zacetek);
  const konec = t.konec ? vMinute(t.konec) : zacetek;
  const glede = p.glede ?? 'pred';
  const najdena = x.luknje.find(([a, b]) => (glede === 'pred' ? Math.abs(b - zacetek) <= 5 : Math.abs(a - konec) <= 5));
  const kdaj = jt('{datum} ob {ura}', { datum: opisDatuma(t.datum, o.danes), ura: t.zacetek });
  if (!najdena) {
    return {
      sporocilo: glede === 'pred'
        ? jt('Pred terminom {ime} ({kdaj}) ni proste luknje.', { ime, kdaj })
        : jt('Po terminu {ime} ({kdaj}) ni proste luknje.', { ime, kdaj }),
    };
  }
  const [a, b] = najdena;
  const dolzina = p.trajanje_min ?? null;
  // Pred terminom: luknja se konča ob začetku termina, zato pri omejeni dolžini štejemo nazaj.
  const luknja = glede === 'pred'
    ? { datum: t.datum, osebaId: oseba.id, od: dolzina ? Math.max(a, b - dolzina) : a, do: b }
    : { datum: t.datum, osebaId: oseba.id, od: a, do: dolzina ? Math.min(b, a + dolzina) : b };
  return { luknja, oseba };
}

// ───────────────────────────────────────────────────────────────────────────
export const kandidatiZaLuknjo: BralnoOrodje<VhodLuknje> = {
  ime: 'kandidati_za_luknjo',
  opis:
    'Kdo bi lahko prišel v prosti čas (luknjo): "Ana je odpovedala jutri ob desetih, kdo bi lahko prišel?", "danes imam luknjo ob dvanajstih, koga naj pokličem?", "kdo bi vzel prosto uro pri Tini v petek?". ' +
    'Vrne do 5 strank z razlogom (kasnejši termin, ki bi ga prestavili; na vrsti po svojem ritmu; hodi k tej osebi ob tem času) in gumbe za klic. Termin mora biti v koledarju že odpovedan.',
  razred: 'branje',
  pravica: 'termini.branje',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      datum: { type: ['string', 'null'], description: 'Izraz uporabnika ali YYYY-MM-DD; null = danes.' },
      ura: { type: ['string', 'null'], description: 'Začetek luknje (HH:MM ali izraz); null = uporabnik ni povedal.' },
      oseba: { type: ['string', 'null'], description: 'Ime zaposlenega; null = ni povedal.' },
      trajanje_min: { type: ['integer', 'null'], description: 'Dolžina v minutah, če jo je povedal; sicer null (do konca luknje).' },
      ob_stranki: { type: ['string', 'null'], description: 'Luknja ob terminu stranke ("pred Anjo Novak", "po Mateji"): ime stranke; potem ura in oseba nista potrebni. Sicer null.' },
      glede: { type: ['string', 'null'], enum: ['pred', 'po', null], description: '"pred" ali "po" terminu stranke iz ob_stranki; sicer null.' },
    },
    required: ['datum', 'ura', 'oseba', 'trajanje_min', 'ob_stranki', 'glede'],
    additionalProperties: false,
  },
  vhod: z.object({
    datum: z.string().max(60).nullable(),
    ura: z.string().max(40).nullable(),
    oseba: z.string().max(80).nullable(),
    trajanje_min: z.number().int().min(10).max(600).nullable(),
    ob_stranki: z.string().max(80).nullable().optional(),
    glede: z.enum(['pred', 'po']).nullable().optional(),
  }),
  async izvedi(p, o) {
    const n = await najdiLuknjo(o, p);
    if (!('luknja' in n)) return n;
    const { luknja: l, oseba } = n;
    const [stranke, storitve, vsi] = await Promise.all([
      o.podatki.stranke(),
      o.podatki.storitve(),
      o.podatki.zgodovinaTerminov(dodajDni(o.danes, -DNI_NAZAJ), dodajDni(o.danes, DNI_NAPREJ)),
    ]);
    // Zaposleni s "samo svoji" iz zgodovine vidi samo svoje termine.
    const termini = samoSvojiTermini(o.k) ? vsi.filter((t) => t.osebaId === o.k.osebaId) : vsi;
    const kandidati = izberiKandidate({
      luknja: l, termini, oseba, storitve, danes: o.danes,
      stranke: new Map(stranke.map((s) => [s.id, `${s.ime} ${s.priimek}`.trim()])),
    });

    // Samo stranke s telefonom (klic je glavno dejanje); kartica gre z uporabnikovo sejo.
    const izbrani: { k: Kandidat; telefon: string; sms: boolean }[] = [];
    for (const k of kandidati) {
      if (izbrani.length >= NAJVEC_KANDIDATOV) break;
      const kartica = await o.podatki.podrobnostiStranke(k.idStranke, o.danes);
      if (!kartica?.telefon) continue;
      // Prestavitev njenega termina je storitveno sporočilo; ponudba prostega termina samo s privolitvijo.
      izbrani.push({ k, telefon: kartica.telefon, sms: k.skupina === 'kasnejsi_termin' || kartica.marketing === true });
    }

    const kdaj = datumZaGovor(l.datum, o.danes);
    const okno = `${izMinut(l.od)}–${izMinut(l.do)}`;
    // oseba_id: za fokus naslednjega ukaza (»pošlji vsem«), ne za prikaz.
    const luknjaZaLlm = { datum: l.datum, od: izMinut(l.od), do: izMinut(l.do), oseba: imeOsebe(oseba), oseba_id: oseba.id };
    if (izbrani.length === 0) {
      return {
        sporocilo: jt('Za {kdaj} {okno} pri {oseba:mestnik} ne najdem dobrih kandidatov.', { kdaj, okno, oseba: oseba.ime }),
        govor: jt('Za {kdaj} {razpon} pri {oseba:mestnik} ne najdem dobrih kandidatov.', { kdaj, razpon: razponZaGovor(izMinut(l.od), izMinut(l.do)), oseba: oseba.ime }),
        podatki: { luknja: luknjaZaLlm, kandidati: [] },
      };
    }

    const vrstice = izbrani.map(({ k }) => `• ${k.ime} — ${razlog(k, o, oseba.ime)}`);
    const prvaPrestavitev = izbrani.find((x) => x.k.skupina === 'kasnejsi_termin')?.k;
    const prestavitev = izbrani.filter((x) => x.k.skupina === 'kasnejsi_termin').map((x) => x.k.ime);
    const ponudba = izbrani.filter((x) => x.k.skupina !== 'kasnejsi_termin' && x.sms).map((x) => x.k.ime);
    const opombe: string[] = [];
    if (prestavitev.length) opombe.push(jt('Predlog za prestavitev termina lahko pošljem: {imena}.', { imena: inSeznam(prestavitev) }));
    if (ponudba.length) opombe.push(jt('Prosti termin po SMS lahko ponudim samo strankam s privolitvijo: {imena}.', { imena: inSeznam(ponudba) }));
    const imena = izbrani.map((x) => x.k.ime.split(' ')[0]);
    const govorPrestavitev = prestavitev.length
      ? ` ${jt('{ime} ima kasnejši termin. Recite »pošlji ji predlog«, če ji pošljem predlog za prestavitev.', { ime: prestavitev[0].split(' ')[0] })}`
      : '';
    const akcije: AkcijaStranke[] = [];
    for (const x of izbrani) {
      const href = povezavaKontakta('klic', x.telefon);
      if (href) akcije.push({ vrsta: 'klic', href, oznaka: x.k.ime });
    }
    return {
      sporocilo: [jt('Kandidati za {kdaj} {okno} pri {oseba:mestnik}:', { kdaj, okno, oseba: oseba.ime }), ...vrstice, ...opombe].join('\n'),
      govor: `${jt('Predlagam {imena}. Razlogi in gumbi za klic so na zaslonu.', { imena: inSeznam(imena) })}${govorPrestavitev}`,
      podatki: {
        luknja: luknjaZaLlm,
        // Fokus: »pošlji ji predlog« se nanaša na prvo stranko s kasnejšim terminom.
        ...(prvaPrestavitev?.termin ? { stranka_id: prvaPrestavitev.idStranke, termin_id: prvaPrestavitev.termin.id, termin_datum: prvaPrestavitev.termin.datum } : {}),
        kandidati: izbrani.map(({ k, sms }) => ({
          stranka_id: k.idStranke,
          ime: k.ime,
          skupina: k.skupina,
          razlog: razlog(k, o, oseba.ime),
          ...(k.termin ? { termin_id: k.termin.id, termin_datum: k.termin.datum } : {}),
          // kasnejsi_termin → sporoci_stranki (prestavitev); ostali → ponudi_prosti_termin samo, če true.
          sms_dovoljen: sms,
        })),
      },
      akcije,
    };
  },
};

// ───────────────────────────────────────────────────────────────────────────
const vhodPonudbe = z.object({
  stranka: z.string().trim().min(1).max(80),
  stranka_id: z.string().regex(ID_STRANKE).nullable(),
  datum: z.string().max(60),
  ura: z.string().max(40),
  oseba: z.string().max(80).nullable(),
  besedilo: z.string().trim().min(1).max(NAJVEC_EMAIL),
  jezik_besedila: z.enum(JEZIKI),
  podpis: z.boolean(),
});
type VhodPonudbe = z.infer<typeof vhodPonudbe>;

const shranjenaPonudba = z.object({
  idStranke: z.string().regex(ID_STRANKE),
  imeStranke: z.string().max(160),
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ura: z.string().regex(/^\d{2}:\d{2}$/),
  osebaId: z.string().min(1).max(64),
  kanal: z.enum(['sms', 'email']),
  besedilo: z.string().min(1).max(NAJVEC_EMAIL + 200),
  zadeva: z.string().max(120).nullable(),
  jezik: z.enum(JEZIKI),
});

/** Ali je ob uri pri osebi še prosto (vsaj 15 min). */
async function seProsto(o: OkoljeOrodja, datum: string, ura: string, oseba: OsebaPovzetek): Promise<boolean> {
  const [x] = await luknjeOseb(o, datum, [oseba]);
  const u = vMinute(ura);
  return x.luknje.some(([a, b]) => a <= u && u + NAJMANJ_MIN <= b);
}

const brezPrivolitve = (ime: string) => jt('{ime} nima privolitve za obvestila o ponudbah, zato ji prostega termina ne pošljem. Lahko jo pokličete.', { ime });

export const ponudiProstiTermin: PisalnoOrodje<VhodPonudbe> = {
  ime: 'ponudi_prosti_termin',
  opis:
    'Pošlje stranki SMS (brez telefona e-pošto), da je prost termin (dan, ura, oseba) — SAMO stranki s privolitvijo (sms_dovoljen iz kandidati_za_luknjo, ki nima termina). ' +
    'Besedilo napiši sam v jeziku stranke: kratko, vljudno, vikanje, dan in ura, prošnja, naj pokliče ali odgovori; brez popusta, cen, povezav, telefonskih številk in podpisa. ' +
    'Za stranko s kasnejšim terminom uporabi sporoci_stranki (predlog za prestavitev njenega termina). Pošlje se šele po potrditvi.',
  razred: 'sporocila',
  pravica: 'sporocila.stranke',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      stranka: { type: 'string', description: 'Ime stranke.' },
      stranka_id: { type: ['string', 'null'], description: 'stranka_id iz kandidati_za_luknjo, sicer null.' },
      datum: { type: 'string', description: 'Dan prostega termina (YYYY-MM-DD ali izraz).' },
      ura: { type: 'string', description: 'Ura prostega termina (HH:MM).' },
      oseba: { type: ['string', 'null'], description: 'Zaposleni, pri katerem je prosto; null = iz luknje.' },
      besedilo: { type: 'string', description: 'Besedilo (en SMS, do ~120 znakov), brez podpisa.' },
      jezik_besedila: { type: 'string', enum: [...JEZIKI], description: 'Jezik besedila.' },
      podpis: { type: 'boolean', description: 'true = doda ime salona (privzeto); false samo pri "brez podpisa".' },
    },
    required: ['stranka', 'stranka_id', 'datum', 'ura', 'oseba', 'besedilo', 'jezik_besedila', 'podpis'],
    additionalProperties: false,
  },
  vhod: vhodPonudbe,
  shranjeno: shranjenaPonudba as unknown as z.ZodType<Record<string, unknown>>,

  async predogled(p, o): Promise<Predogled | RezultatOrodja> {
    if (!o.sporocila) return { sporocilo: jt('Pošiljanje sporočil ni nastavljeno.') };
    const r = await razresiStranko(p.stranka, p.stranka_id, o);
    if ('odgovor' in r) return r.odgovor;
    const s = r.stranka;
    const ime = `${s.ime} ${s.priimek}`.trim();
    const kartica = await o.podatki.podrobnostiStranke(s.id, o.danes);
    if (kartica?.marketing !== true) return { sporocilo: brezPrivolitve(ime) };

    const n = await najdiLuknjo(o, { datum: p.datum, ura: p.ura, oseba: p.oseba, trajanje_min: null });
    if (!('luknja' in n)) return n;
    const { luknja: l, oseba } = n;
    if (samoSvojeUrejanje(o.k) && oseba.id !== o.k.osebaId) return { sporocilo: jt('Prosti termin lahko ponudite samo v svojem urniku.') };
    const ura = izMinut(l.od);

    const kanal: Kanal | null = kartica.telefon ? 'sms' : kartica.email ? 'email' : null;
    if (!kanal) return { sporocilo: jt('{ime} nima telefona ne e-pošte, zato sporočila ne morem poslati.', { ime }) };
    const jezik = jezikStranke(kartica.jezik);
    if (p.jezik_besedila !== jezik) {
      return { sporocilo: jt('Stranka prejema sporočila v jeziku: {jezik}. Napiši besedilo v tem jeziku in pokliči ponudi_prosti_termin znova.', { jezik: imeJezika(jezik) }) };
    }
    const zavrnjeno = zavrnitevBesedila(p.besedilo);
    if (zavrnjeno) return zavrnjeno;

    const podpis = p.podpis ? await o.podatki.imePodjetja() : '';
    let besedilo: string;
    let zadeva: string | null = null;
    if (kanal === 'sms') {
      besedilo = ocistiSms(zPodpisom(p.besedilo, podpis));
      if (besedilo.length > NAJVEC_SMS) {
        return { sporocilo: jt('Besedilo je predolgo za en SMS ({n} znakov s podpisom, največ {m}). Skrajšaj ga in pokliči ponudi_prosti_termin znova.', { n: besedilo.length, m: NAJVEC_SMS }) };
      }
    } else {
      besedilo = zPodpisom(p.besedilo, podpis);
      zadeva = zJezikom(jezik, () => jt('Prost termin'));
    }
    return {
      povzetek: kanal === 'sms' ? jt('SMS za {ime}: »{besedilo}«', { ime, besedilo }) : jt('E-pošta za {ime}: »{besedilo}«', { ime, besedilo }),
      parametri: { idStranke: s.id, imeStranke: ime, datum: l.datum, ura, osebaId: oseba.id, kanal, besedilo, zadeva, jezik },
      podrobnosti: [
        { oznaka: jt('Prejemnik'), vrednost: `${ime}, ${kanal === 'sms' ? skritTelefon(kartica.telefon!) : skritEmail(kartica.email!)}` },
        { oznaka: jt('Prost termin'), vrednost: `${jt('{datum} ob {ura}', { datum: opisDatuma(l.datum, o.danes), ura })}, ${oseba.ime}` },
        { oznaka: jt('Kanal'), vrednost: kanal === 'sms' ? `SMS · ${besedilo.length}/${NAJVEC_SMS}` : jt('e-pošta (ni telefona)') },
        { oznaka: jt('Privolitev'), vrednost: jt('da') },
      ],
      sporocil: 1,
    };
  },

  async potrdi(parametri, o) {
    const p = shranjenaPonudba.parse(parametri);
    const ni = (sporocilo: string): RezultatOrodja => ({ sporocilo, neuspeh: true });
    if (!o.sporocila) return ni(jt('Pošiljanje sporočil ni nastavljeno. Sporočilo ni bilo poslano.'));

    // Vse znova z uporabnikovo sejo: stranka, privolitev, prost čas, pravica, kontakt.
    const s = await o.podatki.stranka(p.idStranke);
    if (!s) return ni(jt('Stranke ni več mogoče najti. Sporočilo ni bilo poslano.'));
    const kartica = await o.podatki.podrobnostiStranke(p.idStranke, o.danes);
    if (kartica?.marketing !== true) return ni(`${brezPrivolitve(p.imeStranke)} ${jt('Sporočilo ni bilo poslano.')}`);
    const oseba = (await o.podatki.osebe()).find((x) => x.id === p.osebaId && x.aktivna);
    if (!oseba) return ni(jt('Zaposlenega ni več. Sporočilo ni bilo poslano.'));
    if (samoSvojeUrejanje(o.k) && oseba.id !== o.k.osebaId) return ni(jt('Prosti termin lahko ponudite samo v svojem urniku.'));
    if (samoSvojiTermini(o.k) && oseba.id !== o.k.osebaId) return ni(jt('Prosti termin lahko ponudite samo v svojem urniku.'));
    if (p.datum < o.danes || !(await seProsto(o, p.datum, p.ura, oseba))) return ni(jt('Ta čas ni več prost. Sporočilo ni bilo poslano.'));
    if (preveriBesedilo(p.besedilo)) return ni(jt('Sporočilo ne sme vsebovati ponudb, cen ali povezav. Ni poslano.'));
    const prejemnik = p.kanal === 'sms' ? kartica.telefon : kartica.email;
    if (!prejemnik) return ni(jt('Kontakta stranke ni več. Sporočilo ni bilo poslano.'));

    const rez = await o.sporocila.rezerviraj({
      podjetje: o.k.podjetje, userId: o.k.userId, ukazId: o.ukazId, idStranke: p.idStranke, idTermina: null, kanal: p.kanal, dolzina: p.besedilo.length,
    });
    if (!rez.ok) return ni(omejitevSporocil(rez.koda));
    const izid = await o.sporocila.poslji({
      id: rez.id, podjetje: o.k.podjetje, kanal: p.kanal, prejemnik, besedilo: p.besedilo, zadeva: p.zadeva,
      imeSalona: await o.podatki.imePodjetja(), jezik: p.jezik, idStranke: p.idStranke, idTermina: null,
    });
    return izidPosiljanja(izid, p.kanal, { sporocilo_id: rez.id, stranka_id: p.idStranke, kanal: p.kanal });
  },
};
