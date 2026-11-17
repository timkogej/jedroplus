// lib/glas/orodja/branje.ts
//
// Bralna orodja: izvedejo se takoj, brez potrditve. Vsa branja gredo prek
// PodatkiSalona z uporabnikovo sejo (RLS: podjetje + lokacije); "samo svoji
// termini" za zaposlene preverimo tukaj, ker ga RLS ne pozna.

import { z } from 'zod';
import { samoSvojiTermini } from '../pravice';
import { opisDatuma, razberiDatum, razberiDatumTuj, dodajDni, danVTednu, vMinute } from '../razresevanje/datumi';
import { brezSumnikov } from '../razresevanje/besedilo';
import { poisci } from '../razresevanje/imena';
import { prviProstiTermin, razcleniUrnik } from '../razresevanje/urnik';
import type { TerminPovzetek } from '../tipi';
import { danZaGovor, datumZaGovor, NAJVEC_NA_GLAS, uraZaGovor } from '../govor';
import { oznakaStranke, razresiStranko, terminiStrank, zadnjiInNaslednji, ID_STRANKE } from './stranke';
import type { BralnoOrodje, OkoljeOrodja } from './tipi';
import { jt } from '../jeziki/t';

const besedilo = (najvec: number) => z.string().trim().min(1).max(najvec);

/** Datum iz LLM: ISO "2026-11-14" ali slovenski izraz ("jutri", "v petek"). */
export function datumIzParametra(v: string | null | undefined, danes: string): string | null {
  if (!v) return null;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return razberiDatum(s, danes)?.datum ?? razberiDatumTuj(s, danes);
}

function odprt(t: TerminPovzetek) {
  return t.status !== 'cancelled';
}

export type KljucObdobja = 'ta_teden' | 'naslednji_teden' | 'ta_mesec' | 'naslednji_mesec';

/**
 * Obdobje namesto dneva (Tim, 17. 11.: »koliko terminov imamo v tem tednu« → »ne razumem«).
 * Teden = ponedeljek–nedelja, mesec = koledarski. Vsi jeziki asistenta.
 */
export function obdobjeIzIzraza(v: string | null | undefined, danes: string): { od: string; do: string; kljuc: KljucObdobja } | null {
  if (!v) return null;
  const b = brezSumnikov(v).toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  const pon = dodajDni(danes, -danVTednu(danes));
  const [y, m] = danes.split('-').map(Number);
  const mesec = (yy: number, mm: number) => {
    const od = `${yy}-${String(mm).padStart(2, '0')}-01`;
    const nasl = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, '0')}-01`;
    return { od, do: dodajDni(nasl, -1) };
  };
  if (/\b(naslednj|prihodnj|sledec|sljedec|iduc)\w* (teden|tednu|tjedan|tjednu)\b|\bnext week\b|\bnachste[nr]? woche\b|\bnaechste[nr]? woche\b|\bprossima settimana\b|\bsettimana prossima\b/.test(b)) {
    return { od: dodajDni(pon, 7), do: dodajDni(pon, 13), kljuc: 'naslednji_teden' };
  }
  if (/\b(naslednj|prihodnj|sljedec|iduc)\w* (mesec|mesecu|mjesec|mjesecu)\b|\bnext month\b|\bnachste[nr]? monat\b|\bnaechste[nr]? monat\b|\bprossimo mese\b|\bmese prossimo\b/.test(b)) {
    return { ...mesec(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1), kljuc: 'naslednji_mesec' };
  }
  if (/^(teden|tedna|tednu)$|\b(ta|tem|tega|ves|cel|celi|celem|v tem|ovaj|ovom|cijeli) ?(teden|tednu|tedna|tjedan|tjednu)\b|\bthis week\b|\bdiese[nr]? woche\b|\bquesta settimana\b/.test(b)) {
    return { od: pon, do: dodajDni(pon, 6), kljuc: 'ta_teden' };
  }
  if (/^(mesec|mesecu)$|\b(ta|tem|tega|ves|cel|celi|celem|ovaj|ovom|cijeli) ?(mesec|mesecu|meseca|mjesec|mjesecu)\b|\bthis month\b|\bdiese[nr]? monat\b|\bquesto mese\b/.test(b)) {
    return { ...mesec(y, m), kljuc: 'ta_mesec' };
  }
  return null;
}

const IME_OBDOBJA: Record<KljucObdobja, () => string> = {
  ta_teden: () => jt('Ta teden'),
  naslednji_teden: () => jt('Naslednji teden'),
  ta_mesec: () => jt('Ta mesec'),
  naslednji_mesec: () => jt('Naslednji mesec'),
};

/** Največ toliko vrstic na kartici obdobja (ostalo je v koledarju). */
const NAJVEC_VRSTIC_OBDOBJA = 60;

async function koledarObdobje(
  obd: { od: string; do: string; kljuc: KljucObdobja },
  svoji: boolean,
  o: OkoljeOrodja
) {
  const ime = IME_OBDOBJA[obd.kljuc]();
  const vsi = (await o.podatki.termini(obd.od, obd.do)).filter(odprt);
  const izbrani = (svoji && o.k.osebaId ? vsi.filter((t) => t.osebaId === o.k.osebaId) : vsi).sort(
    (a, b) => (a.datum === b.datum ? vMinute(a.zacetek) - vMinute(b.zacetek) : a.datum < b.datum ? -1 : 1)
  );
  const n = izbrani.length;
  const podatki = { od: obd.od, do: obd.do, stevilo: n };
  if (n === 0) {
    return { sporocilo: jt('{obdobje}: ni terminov.', { obdobje: ime }), govor: jt('{obdobje} ni terminov.', { obdobje: ime }), podatki };
  }
  const poDnevih = new Map<string, TerminPovzetek[]>();
  for (const t of izbrani) poDnevih.set(t.datum, [...(poDnevih.get(t.datum) ?? []), t]);
  const glava = jt('{obdobje}: {n} {n|termin|termina|termini|terminov}.', { obdobje: ime, n });
  const uvod = svoji
    ? jt('{obdobje} imate {n} {n|termin|termina|termine|terminov}.', { obdobje: ime, n })
    : jt('{obdobje} je {n} {n|termin|termina|termini|terminov}.', { obdobje: ime, n });
  // Teden: po dnevih na glas (»danes 2, jutri 1, v petek 4«); mesec samo skupaj (dni je preveč).
  const dnevi = [...poDnevih.entries()];
  const poDnevihGovor = !obd.kljuc.endsWith('teden')
    ? ` ${jt('Po dnevih so na zaslonu.')}`
    : dnevi.length === 1
      ? ` ${cap(danZaGovor(dnevi[0][0]))}.`
      : ` ${cap(dnevi.map(([d, ts]) => `${danZaGovor(d)} ${ts.length}`).join(', '))}.`;
  // Mesec: vedno z datumom (dva »ponedeljka« v istem seznamu ne smeta biti enaka).
  const oznakaDne = (d: string) => {
    const opis = cap(opisDatuma(d, o.danes));
    if (obd.kljuc.endsWith('teden') || /\d/.test(opis)) return opis;
    const [, mm, dd] = d.split('-').map(Number);
    return `${opis} (${dd}. ${mm}.)`;
  };
  let ostane = NAJVEC_VRSTIC_OBDOBJA;
  const skupine = dnevi.map(([d, ts]) => {
    const pokazi = ts.slice(0, Math.max(0, ostane));
    ostane -= pokazi.length;
    return {
      naslov: `${oznakaDne(d)} · ${ts.length}`,
      vrstice: pokazi.map((t) => ({
        cas: `${t.zacetek}${t.konec ? `–${t.konec}` : ''}`,
        glavno: t.stranka || jt('stranka'),
        drugo: [t.storitev, !svoji ? t.oseba : null].filter(Boolean).join(' · ') || undefined,
      })),
      se: ts.length > pokazi.length ? ts.length - pokazi.length : undefined,
    };
  });
  return {
    sporocilo: `${glava}\n${dnevi.map(([d, ts]) => `${oznakaDne(d)}: ${ts.length}`).join('\n')}`,
    prikaz: { naslov: glava.replace(/\.$/, ''), skupine: skupine.filter((g) => g.vrstice.length > 0) },
    govor: `${uvod}${poDnevihGovor}`,
    podatki,
  };
}

// ───────────────────────────────────────────────────────────────────────────
export const iskanjeStranke: BralnoOrodje<{ ime: string }> = {
  ime: 'iskanje_stranke',
  opis: 'Poišče stranko po imenu in/ali priimku (dovoli sklone, napake prepisa). Vrne do 5 kandidatov z naslednjim in zadnjim terminom iz koledarja. Samo za iskanje: za sporočilo, opomnik ali termin takoj pokliči ustrezno orodje, ki termin poišče samo.',
  razred: 'branje',
  koncno: false,
  pravica: 'stranke.branje',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: { ime: { type: 'string', description: 'Ime in/ali priimek, kot ga je uporabnik izgovoril.' } },
    required: ['ime'],
    additionalProperties: false,
  },
  vhod: z.object({ ime: besedilo(80) }),
  async izvedi({ ime }, o) {
    const vse = await o.podatki.stranke();
    const izid = poisci(ime, vse, (s) => [s.ime, s.priimek]);
    if (izid.izid === 'nic') return { sporocilo: jt('Stranke »{ime}« ne najdem.', { ime }), podatki: [] };
    const najdene = izid.izid === 'enolicno' ? [izid.najden] : izid.kandidati.map((k) => k.vrednost);
    // Termini iz koledarja (ne »Zadnja interakcija«): model iz tega ve, ali ima stranka termin.
    const termini = await terminiStrank(o, najdene);
    const terminZaModel = (t: TerminPovzetek | null | undefined) =>
      t ? { termin_id: t.id, datum: t.datum, ura: t.zacetek, storitev: t.storitev, status: t.status } : null;
    const seznam = najdene.map((s) => ({
      id: s.id,
      ime: s.ime,
      priimek: s.priimek,
      naslednji_termin: terminZaModel(termini.get(s.id)?.naslednji),
      zadnji_termin: terminZaModel(termini.get(s.id)?.zadnji),
    }));
    if (izid.izid === 'enolicno') {
      o.razresena = izid.najden.id;
      return { sporocilo: jt('Najdena: {stranka}.', { stranka: oznakaStranke(izid.najden, o.danes, termini.get(izid.najden.id)) }), podatki: seznam };
    }
    return {
      sporocilo: jt('Več strank ustreza »{ime}«.', { ime }),
      podatki: seznam,
      vprasanje: {
        besedilo: jt('Katero stranko?'),
        moznosti: najdene.map((s) => ({ id: s.id, oznaka: oznakaStranke(s, o.danes, termini.get(s.id)) })),
      },
    };
  },
};

// ───────────────────────────────────────────────────────────────────────────
export const zadnjiObisk: BralnoOrodje<{ stranka: string; stranka_id: string | null }> = {
  ime: 'zadnji_obisk',
  opis: 'Kdaj je bila stranka zadnjič in kdaj pride naslednjič.',
  razred: 'branje',
  pravica: 'stranke.branje',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      stranka: { type: 'string', description: 'Ime stranke, kot je bilo izgovorjeno.' },
      stranka_id: { type: ['string', 'null'], description: 'ID stranke, če je že znan iz prejšnjega iskanja, sicer null.' },
    },
    required: ['stranka', 'stranka_id'],
    additionalProperties: false,
  },
  vhod: z.object({ stranka: besedilo(80), stranka_id: z.string().regex(ID_STRANKE).nullable() }),
  async izvedi({ stranka, stranka_id }, o) {
    const r = await razresiStranko(stranka, stranka_id, o);
    if ('odgovor' in r) return r.odgovor;
    const s = r.stranka;
    // Po trenutni uri: današnji termin, ki je že minil, je zadnji (ne »naslednjič danes«).
    const { zadnji, naslednji } = await zadnjiInNaslednji(o, s);
    const ime = `${s.ime} ${s.priimek}`.trim();
    // Brez glagola v pretekliku (»je bila«): spola stranke ne poznamo (Tim, 16. 11.: »Damjan je bila«).
    const danes = (t: { datum: string }) => t.datum === o.danes;
    const deli: string[] = [];
    if (zadnji) {
      deli.push(danes(zadnji)
        ? jt('{ime}: zadnji obisk danes ob {ura} ({storitev}).', { ime, ura: zadnji.zacetek, storitev: zadnji.storitev || jt('termin') })
        : jt('{ime}: zadnji obisk {datum} ({storitev}).', { ime, datum: opisDatuma(zadnji.datum, o.danes), storitev: zadnji.storitev || jt('termin') }));
    } else if (s.zadnjaInterakcija) deli.push(jt('{ime}: zadnja interakcija {datum}.', { ime, datum: opisDatuma(s.zadnjaInterakcija, o.danes) }));
    else deli.push(jt('{ime} še nima preteklega termina.', { ime }));
    deli.push(naslednji
      ? jt('Naslednji termin: {datum} ob {ura}.', { datum: opisDatuma(naslednji.datum, o.danes), ura: naslednji.zacetek })
      : jt('Naslednjega termina še ni.'));
    const govor: string[] = [];
    if (zadnji) {
      const storitev = zadnji.storitev ? `, ${zadnji.storitev}` : '';
      govor.push(danes(zadnji)
        ? `${jt('{ime}, zadnji obisk danes {ura}', { ime, ura: uraZaGovor(zadnji.zacetek) })}${storitev}.`
        : `${jt('{ime}, zadnji obisk {datum}', { ime, datum: datumZaGovor(zadnji.datum, o.danes) })}${storitev}.`);
    } else if (s.zadnjaInterakcija) govor.push(jt('{ime} še nima termina, zadnja interakcija je bila {datum}.', { ime, datum: datumZaGovor(s.zadnjaInterakcija, o.danes) }));
    else govor.push(jt('{ime} še nima preteklega termina.', { ime }));
    govor.push(naslednji
      ? jt('Naslednji termin je {datum} {ura}.', { datum: datumZaGovor(naslednji.datum, o.danes), ura: uraZaGovor(naslednji.zacetek) })
      : jt('Naslednjega termina še ni.'));
    return {
      sporocilo: deli.join(' '),
      govor: govor.join(' '),
      podatki: {
        stranka_id: s.id,
        // Naslednji termin postane aktiven ("prestavi ga", "spremeni jezik termina").
        ...(naslednji ? { termin_id: naslednji.id, termin_datum: naslednji.datum } : {}),
        zadnji: zadnji ? { datum: zadnji.datum, storitev: zadnji.storitev } : null,
        naslednji: naslednji ? { datum: naslednji.datum, ura: naslednji.zacetek, storitev: naslednji.storitev } : null,
      },
    };
  },
};

// ───────────────────────────────────────────────────────────────────────────
export const koledarDan: BralnoOrodje<{ datum: string | null; samo_moji: boolean | null }> = {
  ime: 'koledar_dan',
  opis: 'Termini za en dan ("kaj imam jutri") ali obdobje ("koliko terminov imamo ta teden", "naslednji teden", "ta mesec"). Datum kot ISO ali izraz ("jutri", "v petek", "ta teden").',
  razred: 'branje',
  pravica: 'termini.branje',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      datum: { type: ['string', 'null'], description: 'Izraz uporabnika ali YYYY-MM-DD; obdobje dobesedno ("ta teden", "naslednji teden", "ta mesec"); null = danes.' },
      samo_moji: { type: ['boolean', 'null'], description: 'true = samo termini uporabnika ("kaj imam"), false = vsi; null = privzeto.' },
    },
    required: ['datum', 'samo_moji'],
    additionalProperties: false,
  },
  vhod: z.object({ datum: z.string().max(60).nullable(), samo_moji: z.boolean().nullable() }),
  async izvedi({ datum, samo_moji }, o) {
    // Obdobje pred dnevom: »naslednji teden« bi sicer postal ponedeljek naslednjega tedna.
    const obdobje = obdobjeIzIzraza(datum, o.danes);
    const dan = obdobje ? null : datumIzParametra(datum, o.danes) ?? (datum ? null : o.danes);
    if (obdobje) {
      const vsiliSvoje = samoSvojiTermini(o.k);
      if (vsiliSvoje && !o.k.osebaId) return { sporocilo: jt('Vaš račun ni povezan z zaposlenim, zato ne vidim vaših terminov.') };
      return koledarObdobje(obdobje, Boolean(o.k.osebaId) && (vsiliSvoje || (samo_moji ?? true)), o);
    }
    if (!dan) return { sporocilo: jt('Datuma »{datum}« ne razumem. Povejte npr. »jutri«, »v petek« ali »ta teden«.', { datum }) };
    // Zaposleni s pravico "samo svoji" vidi samo svoje, ne glede na želje LLM.
    const vsiliSvoje = samoSvojiTermini(o.k);
    if (vsiliSvoje && !o.k.osebaId) {
      return { sporocilo: jt('Vaš račun ni povezan z zaposlenim, zato ne vidim vaših terminov.') };
    }
    // Brez povezane osebe "svojih" ni — pokažemo vse, ki jih uporabnik sme videti.
    const svoji = Boolean(o.k.osebaId) && (vsiliSvoje || (samo_moji ?? true));
    const vsi = (await o.podatki.termini(dan, dan)).filter(odprt);
    const izbrani = (svoji && o.k.osebaId ? vsi.filter((t) => t.osebaId === o.k.osebaId) : vsi).sort(
      (a, b) => vMinute(a.zacetek) - vMinute(b.zacetek)
    );
    const opis = opisDatuma(dan, o.danes);
    if (izbrani.length === 0) {
      return { sporocilo: jt('{datum}: ni terminov.', { datum: cap(opis) }), govor: jt('{datum} ni terminov.', { datum: cap(datumZaGovor(dan, o.danes)) }), podatki: { datum: dan, termini: [] } };
    }
    const vrstice = izbrani.map(
      (t) => `${t.zacetek}${t.konec ? `–${t.konec}` : ''} ${t.stranka || jt('stranka')}${t.storitev ? `, ${t.storitev}` : ''}${!svoji && t.oseba ? ` (${t.oseba})` : ''}`
    );
    const n = izbrani.length;
    const vrsticaGovor = (t: TerminPovzetek) => `${cap(uraZaGovor(t.zacetek))} ${t.stranka || jt('stranka')}${t.storitev ? `, ${t.storitev}` : ''}${!svoji && t.oseba ? `, ${t.oseba}` : ''}.`;
    // Danes: kar je že končano, je v pretekliku (Tim, 16. 11.: ob 19h »danes imate termin ob 11h«).
    const konec = (t: TerminPovzetek) => vMinute(t.konec || t.zacetek);
    const minuli = dan === o.danes ? izbrani.filter((t) => konec(t) <= vMinute(o.uraZdaj)) : dan < o.danes ? izbrani : [];
    const prihodnji = izbrani.filter((t) => !minuli.includes(t));
    const dGovor = cap(datumZaGovor(dan, o.danes));
    let govor: string;
    if (minuli.length === 0) {
      const naGlas = izbrani.slice(0, NAJVEC_NA_GLAS).map(vrsticaGovor);
      const ostali = n - naGlas.length;
      govor = `${svoji ? jt('{datum} imate {n} {n|termin|termina|termine|terminov}.', { datum: dGovor, n }) : jt('{datum} je {n} {n|termin|termina|termine|terminov}.', { datum: dGovor, n })} ${naGlas.join(' ')}${ostali > 0 ? ` ${jt('In še {n} {n|termin|termina|termini|terminov}, ki so na zaslonu.', { n: ostali })}` : ''}`;
    } else {
      const m = minuli.length;
      const glavaMinulih = svoji
        ? jt('{datum} ste imeli {n} {n|termin|termina|termine|terminov}.', { datum: dGovor, n: m })
        : jt('{datum} {n|je bil|sta bila|so bili|je bilo} {n} {n|termin|termina|termini|terminov}.', { datum: dGovor, n: m });
      const naGlasMinuli = minuli.slice(0, NAJVEC_NA_GLAS).map(vrsticaGovor);
      const naGlasNaprej = prihodnji.slice(0, Math.max(0, NAJVEC_NA_GLAS - naGlasMinuli.length)).map(vrsticaGovor);
      const ostali = n - naGlasMinuli.length - naGlasNaprej.length;
      const naprej = prihodnji.length
        ? ` ${jt('Še na vrsti {n|je|sta|so|je} {n} {n|termin|termina|termini|terminov}.', { n: prihodnji.length })} ${naGlasNaprej.join(' ')}`
        : ` ${svoji ? jt('Drugih terminov danes nimate.') : jt('Drugih terminov danes ni.')}`;
      govor = `${glavaMinulih} ${naGlasMinuli.join(' ')}${dan === o.danes ? naprej : ''}${ostali > 0 ? ` ${jt('In še {n} {n|termin|termina|termini|terminov}, ki so na zaslonu.', { n: ostali })}` : ''}`;
    }
    const glava = jt('{datum}: {n} {n|termin|termina|termini|terminov}.', { datum: cap(opis), n });
    const zeMimo = dan === o.danes && minuli.length ? ` ${jt('Že mimo: {n}.', { n: minuli.length })}` : '';
    return {
      sporocilo: `${glava}${zeMimo}\n${vrstice.join('\n')}`,
      prikaz: {
        naslov: glava.replace(/\.$/, ''),
        skupine: [{ vrstice: izbrani.map((t) => ({ cas: `${t.zacetek}${t.konec ? `–${t.konec}` : ''}`, glavno: t.stranka || jt('stranka'), drugo: [t.storitev, !svoji ? t.oseba : null, dan === o.danes && minuli.includes(t) ? jt('mimo') : null].filter(Boolean).join(' · ') || undefined })) }],
      },
      govor,
      podatki: {
        datum: dan,
        termini: izbrani.map((t) => ({ id: t.id, od: t.zacetek, do: t.konec, stranka: t.stranka, storitev: t.storitev, oseba: t.oseba })),
      },
    };
  },
};

// ───────────────────────────────────────────────────────────────────────────
export const prviProsti: BralnoOrodje<{ storitev: string | null; oseba: string | null; od: string | null }> = {
  ime: 'prvi_prosti_termin',
  opis: 'Najzgodnejši prosti termin (okviren, ne upošteva resursov). Neobvezno za storitev, zaposlenega in od datuma.',
  razred: 'branje',
  pravica: 'termini.branje',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      storitev: { type: ['string', 'null'], description: 'Ime storitve, npr. "barvanje"; null = 60 minut.' },
      oseba: { type: ['string', 'null'], description: 'Ime zaposlenega; null = uporabnik (če je zaposleni) ali kdorkoli.' },
      od: { type: ['string', 'null'], description: 'Od kdaj iskati (izraz ali YYYY-MM-DD); null = od zdaj.' },
    },
    required: ['storitev', 'oseba', 'od'],
    additionalProperties: false,
  },
  vhod: z.object({ storitev: z.string().max(80).nullable(), oseba: z.string().max(80).nullable(), od: z.string().max(60).nullable() }),
  async izvedi({ storitev, oseba, od }, o) {
    const [storitve, osebe, urnikPodjetjaSurov] = await Promise.all([
      o.podatki.storitve(),
      o.podatki.osebe(),
      o.podatki.urnikPodjetja(),
    ]);
    let trajanje = 60;
    let nazivStoritve: string | null = null;
    let idStoritve: string | null = null;
    if (storitev) {
      const izid = poisci(storitev, storitve.filter((s) => s.aktivna), (s) => [s.naziv]);
      if (izid.izid === 'nic') return { sporocilo: jt('Storitve »{storitev}« ne najdem.', { storitev }) };
      if (izid.izid === 'vec') {
        return {
          sporocilo: `${jt('Katero storitev?')} ${izid.kandidati.map((k) => k.vrednost.naziv).join(', ')}.`,
          vprasanje: { besedilo: jt('Katero storitev?'), moznosti: izid.kandidati.map((k) => ({ id: k.vrednost.id, oznaka: k.vrednost.naziv })) },
        };
      }
      trajanje = izid.najden.trajanjeMin || 60;
      nazivStoritve = izid.najden.naziv;
      idStoritve = izid.najden.id;
    }

    let kandidati = osebe.filter((p) => p.aktivna);
    if (oseba) {
      const izid = poisci(oseba, kandidati, (p) => [p.ime, p.priimek]);
      if (izid.izid !== 'enolicno') return { sporocilo: jt('Zaposlenega »{oseba}« ne najdem enolično.', { oseba }) };
      kandidati = [izid.najden];
    } else if (samoSvojiTermini(o.k) || o.k.osebaId) {
      const jaz = kandidati.find((p) => p.id === o.k.osebaId);
      if (jaz) kandidati = [jaz];
      else if (samoSvojiTermini(o.k)) return { sporocilo: jt('Vaš račun ni povezan z zaposlenim.') };
    }
    if (idStoritve) kandidati = kandidati.filter((p) => p.opravljaVse || p.storitve.includes(idStoritve!));
    if (kandidati.length === 0) return { sporocilo: jt('Nihče od zaposlenih ne opravlja te storitve.') };

    const zacetek = datumIzParametra(od, o.danes) ?? o.danes;
    const DNI = 14;
    const doDatuma = dodajDni(zacetek, DNI);
    const [termini, odsotnosti] = await Promise.all([
      o.podatki.termini(zacetek, doDatuma),
      o.podatki.odsotnosti(zacetek, doDatuma),
    ]);
    const urnikPodjetja = razcleniUrnik(urnikPodjetjaSurov);
    const prost = prviProstiTermin({
      odDatuma: zacetek,
      odUre: zacetek === o.danes ? o.uraZdaj : null,
      dni: DNI,
      trajanjeMin: trajanje,
      osebe: kandidati.map((p) => ({
        id: p.id,
        urnik: p.imaUrnikPodjetja ? urnikPodjetja : (razcleniUrnik(p.urnik) ?? urnikPodjetja),
      })),
      termini,
      odsotnosti,
      casovniPas: o.k.casovniPas,
    });
    if (!prost) {
      return {
        sporocilo: nazivStoritve
          ? jt('V naslednjih {dni} dneh ni prostega termina za {storitev}.', { dni: DNI, storitev: nazivStoritve })
          : jt('V naslednjih {dni} dneh ni prostega termina.', { dni: DNI }),
      };
    }
    const p = osebe.find((x) => x.id === prost.osebaId);
    return {
      sporocilo: `${nazivStoritve ? jt('Prvi prosti termin za {storitev} ({min} min)', { storitev: nazivStoritve, min: trajanje }) : jt('Prvi prosti termin')}: ${jt('{datum} ob {ura}', { datum: opisDatuma(prost.datum, o.danes), ura: prost.zacetek })}${p && kandidati.length > 1 ? `, ${p.ime}` : ''}. ${jt('Okvirno — resursi niso upoštevani.')}`,
      govor: `${nazivStoritve ? jt('Prvi prosti termin za {storitev} je {datum} {ura}', { storitev: nazivStoritve, datum: datumZaGovor(prost.datum, o.danes), ura: uraZaGovor(prost.zacetek) }) : jt('Prvi prosti termin je {datum} {ura}', { datum: datumZaGovor(prost.datum, o.danes), ura: uraZaGovor(prost.zacetek) })}${p && kandidati.length > 1 ? ` ${jt('pri {oseba:mestnik}', { oseba: p.ime })}` : ''}. ${jt('Okvirno, brez resursov.')}`,
      podatki: { ...prost, oseba: p ? `${p.ime} ${p.priimek}`.trim() : null, storitev: nazivStoritve, trajanje },
    };
  },
};

export function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function sklon(n: number, ed: string, dv: string, mn34: string, mn: string) {
  const s = n % 100;
  if (s === 1) return ed;
  if (s === 2) return dv;
  if (s === 3 || s === 4) return mn34;
  return mn;
}

export type { OkoljeOrodja };
