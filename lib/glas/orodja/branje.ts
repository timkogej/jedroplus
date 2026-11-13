// lib/glas/orodja/branje.ts
//
// Bralna orodja: izvedejo se takoj, brez potrditve. Vsa branja gredo prek
// PodatkiSalona z uporabnikovo sejo (RLS: podjetje + lokacije); "samo svoji
// termini" za zaposlene preverimo tukaj, ker ga RLS ne pozna.

import { z } from 'zod';
import { samoSvojiTermini } from '../pravice';
import { opisDatuma, razberiDatum, dodajDni, vMinute } from '../razresevanje/datumi';
import { poisci } from '../razresevanje/imena';
import { prviProstiTermin, razcleniUrnik } from '../razresevanje/urnik';
import type { TerminPovzetek } from '../tipi';
import { datumZaGovor, NAJVEC_NA_GLAS, uraZaGovor } from '../govor';
import { oznakaStranke, razresiStranko } from './stranke';
import type { BralnoOrodje, OkoljeOrodja } from './tipi';

const besedilo = (najvec: number) => z.string().trim().min(1).max(najvec);

/** Datum iz LLM: ISO "2026-11-14" ali slovenski izraz ("jutri", "v petek"). */
export function datumIzParametra(v: string | null | undefined, danes: string): string | null {
  if (!v) return null;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return razberiDatum(s, danes)?.datum ?? null;
}

function odprt(t: TerminPovzetek) {
  return t.status !== 'cancelled';
}

// ───────────────────────────────────────────────────────────────────────────
export const iskanjeStranke: BralnoOrodje<{ ime: string }> = {
  ime: 'iskanje_stranke',
  opis: 'Poišče stranko po imenu in/ali priimku (dovoli sklone, napake prepisa). Vrne do 5 kandidatov z ID-jem in zadnjim obiskom.',
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
    if (izid.izid === 'nic') return { sporocilo: `Stranke »${ime}« ne najdem.`, podatki: [] };
    const seznam = izid.kandidati.map((k) => ({
      id: k.vrednost.id,
      ime: k.vrednost.ime,
      priimek: k.vrednost.priimek,
      zadnjic: k.vrednost.zadnjaInterakcija,
    }));
    if (izid.izid === 'enolicno') {
      return { sporocilo: `Najdena: ${oznakaStranke(izid.najden, o.danes)}.`, podatki: seznam.slice(0, 1) };
    }
    return {
      sporocilo: `Več strank ustreza »${ime}«.`,
      podatki: seznam,
      vprasanje: {
        besedilo: 'Katero stranko?',
        moznosti: izid.kandidati.map((k) => ({ id: k.vrednost.id, oznaka: oznakaStranke(k.vrednost, o.danes) })),
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
  vhod: z.object({ stranka: besedilo(80), stranka_id: z.string().regex(/^\d{1,12}$/).nullable() }),
  async izvedi({ stranka, stranka_id }, o) {
    const r = await razresiStranko(stranka, stranka_id, o);
    if ('odgovor' in r) return r.odgovor;
    const s = r.stranka;
    const [zadnji, naslednji] = await Promise.all([
      o.podatki.zadnjiTermin(s.id, o.danes),
      o.podatki.naslednjiTermin(s.id, o.danes),
    ]);
    const ime = `${s.ime} ${s.priimek}`.trim();
    const deli: string[] = [];
    if (zadnji) deli.push(`${ime} je bila zadnjič ${opisDatuma(zadnji.datum, o.danes)} (${zadnji.storitev || 'termin'}).`);
    else if (s.zadnjaInterakcija) deli.push(`${ime}: zadnja interakcija ${opisDatuma(s.zadnjaInterakcija, o.danes)}.`);
    else deli.push(`${ime} še nima preteklega termina.`);
    if (naslednji) deli.push(`Naslednjič: ${opisDatuma(naslednji.datum, o.danes)} ob ${naslednji.zacetek}.`);
    const govor: string[] = [];
    if (zadnji) govor.push(`${ime} je bila zadnjič ${datumZaGovor(zadnji.datum, o.danes)}${zadnji.storitev ? `, ${zadnji.storitev}` : ''}.`);
    else if (s.zadnjaInterakcija) govor.push(`${ime} še nima termina, zadnja interakcija je bila ${datumZaGovor(s.zadnjaInterakcija, o.danes)}.`);
    else govor.push(`${ime} še nima preteklega termina.`);
    if (naslednji) govor.push(`Naslednjič pride ${datumZaGovor(naslednji.datum, o.danes)} ${uraZaGovor(naslednji.zacetek)}.`);
    return {
      sporocilo: deli.join(' '),
      govor: govor.join(' '),
      podatki: {
        stranka_id: s.id,
        zadnji: zadnji ? { datum: zadnji.datum, storitev: zadnji.storitev } : null,
        naslednji: naslednji ? { datum: naslednji.datum, ura: naslednji.zacetek, storitev: naslednji.storitev } : null,
      },
    };
  },
};

// ───────────────────────────────────────────────────────────────────────────
export const koledarDan: BralnoOrodje<{ datum: string | null; samo_moji: boolean | null }> = {
  ime: 'koledar_dan',
  opis: 'Termini za en dan (npr. "kaj imam jutri"). Datum kot ISO ali izraz ("jutri", "v petek").',
  razred: 'branje',
  pravica: 'termini.branje',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      datum: { type: ['string', 'null'], description: 'Izraz uporabnika ali YYYY-MM-DD; null = danes.' },
      samo_moji: { type: ['boolean', 'null'], description: 'true = samo termini uporabnika ("kaj imam"), false = vsi; null = privzeto.' },
    },
    required: ['datum', 'samo_moji'],
    additionalProperties: false,
  },
  vhod: z.object({ datum: z.string().max(60).nullable(), samo_moji: z.boolean().nullable() }),
  async izvedi({ datum, samo_moji }, o) {
    const dan = datumIzParametra(datum, o.danes) ?? (datum ? null : o.danes);
    if (!dan) return { sporocilo: `Datuma »${datum}« ne razumem. Povejte npr. »jutri« ali »v petek«.` };
    // Zaposleni s pravico "samo svoji" vidi samo svoje, ne glede na želje LLM.
    const vsiliSvoje = samoSvojiTermini(o.k);
    if (vsiliSvoje && !o.k.osebaId) {
      return { sporocilo: 'Vaš račun ni povezan z zaposlenim, zato ne vidim vaših terminov.' };
    }
    // Brez povezane osebe "svojih" ni — pokažemo vse, ki jih uporabnik sme videti.
    const svoji = Boolean(o.k.osebaId) && (vsiliSvoje || (samo_moji ?? true));
    const vsi = (await o.podatki.termini(dan, dan)).filter(odprt);
    const izbrani = (svoji && o.k.osebaId ? vsi.filter((t) => t.osebaId === o.k.osebaId) : vsi).sort(
      (a, b) => vMinute(a.zacetek) - vMinute(b.zacetek)
    );
    const opis = opisDatuma(dan, o.danes);
    if (izbrani.length === 0) {
      return { sporocilo: `${cap(opis)}: ni terminov.`, govor: `${cap(datumZaGovor(dan, o.danes))} ni terminov.`, podatki: { datum: dan, termini: [] } };
    }
    const vrstice = izbrani.map(
      (t) => `${t.zacetek}${t.konec ? `–${t.konec}` : ''} ${t.stranka || 'stranka'}${t.storitev ? `, ${t.storitev}` : ''}${!svoji && t.oseba ? ` (${t.oseba})` : ''}`
    );
    const st = `${izbrani.length} ${sklon(izbrani.length, 'termin', 'termina', 'termine', 'terminov')}`;
    const naGlas = izbrani.slice(0, NAJVEC_NA_GLAS).map(
      (t) => `${cap(uraZaGovor(t.zacetek))} ${t.stranka || 'stranka'}${t.storitev ? `, ${t.storitev}` : ''}${!svoji && t.oseba ? `, ${t.oseba}` : ''}.`
    );
    const ostali = izbrani.length - naGlas.length;
    return {
      sporocilo: `${cap(opis)}: ${izbrani.length} ${sklon(izbrani.length, 'termin', 'termina', 'termini', 'terminov')}.\n${vrstice.join('\n')}`,
      govor: `${cap(datumZaGovor(dan, o.danes))} ${svoji ? 'imate' : 'je'} ${st}. ${naGlas.join(' ')}${ostali > 0 ? ` In še ${ostali} ${sklon(ostali, 'termin', 'termina', 'termini', 'terminov')}, ki so na zaslonu.` : ''}`,
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
      if (izid.izid === 'nic') return { sporocilo: `Storitve »${storitev}« ne najdem.` };
      if (izid.izid === 'vec') {
        return {
          sporocilo: `Katero storitev? ${izid.kandidati.map((k) => k.vrednost.naziv).join(', ')}.`,
          vprasanje: { besedilo: 'Katero storitev?', moznosti: izid.kandidati.map((k) => ({ id: k.vrednost.id, oznaka: k.vrednost.naziv })) },
        };
      }
      trajanje = izid.najden.trajanjeMin || 60;
      nazivStoritve = izid.najden.naziv;
      idStoritve = izid.najden.id;
    }

    let kandidati = osebe.filter((p) => p.aktivna);
    if (oseba) {
      const izid = poisci(oseba, kandidati, (p) => [p.ime, p.priimek]);
      if (izid.izid !== 'enolicno') return { sporocilo: `Zaposlenega »${oseba}« ne najdem enolično.` };
      kandidati = [izid.najden];
    } else if (samoSvojiTermini(o.k) || o.k.osebaId) {
      const jaz = kandidati.find((p) => p.id === o.k.osebaId);
      if (jaz) kandidati = [jaz];
      else if (samoSvojiTermini(o.k)) return { sporocilo: 'Vaš račun ni povezan z zaposlenim.' };
    }
    if (idStoritve) kandidati = kandidati.filter((p) => p.opravljaVse || p.storitve.includes(idStoritve!));
    if (kandidati.length === 0) return { sporocilo: 'Nihče od zaposlenih ne opravlja te storitve.' };

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
    if (!prost) return { sporocilo: `V naslednjih ${DNI} dneh ni prostega termina${nazivStoritve ? ` za ${nazivStoritve}` : ''}.` };
    const p = osebe.find((x) => x.id === prost.osebaId);
    return {
      sporocilo: `Prvi prosti termin${nazivStoritve ? ` za ${nazivStoritve} (${trajanje} min)` : ''}: ${opisDatuma(prost.datum, o.danes)} ob ${prost.zacetek}${p && kandidati.length > 1 ? `, ${p.ime}` : ''}. Okvirno — resursi niso upoštevani.`,
      govor: `Prvi prosti termin${nazivStoritve ? ` za ${nazivStoritve}` : ''} je ${datumZaGovor(prost.datum, o.danes)} ${uraZaGovor(prost.zacetek)}${p && kandidati.length > 1 ? ` pri ${p.ime}` : ''}. Okvirno, brez resursov.`,
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
