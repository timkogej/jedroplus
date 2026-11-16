// lib/termini/serija.ts
//
// Ponavljajoči termini (docs/glasovni-asistent-dodatne-funkcije-nacrt.md, §6): datumi
// serije in preverjanje vsakega datuma. Čiste funkcije — uporabljata jih Asistent+
// (pripravi_serijo) in obrazec serije v koledarju (/api/termini/serija/preveri).
//
// Preverjanje je enako kot pri enem terminu v asistentu: delovni čas osebe (ali podjetja),
// odsotnosti in termini te osebe. NE preverja resursov in praznikov (to pove obrazec).

import { dodajDni, izMinut, razlikaDni, vMinute } from '@/lib/glas/razresevanje/datumi';
import { prosteLuknje } from '@/lib/glas/razresevanje/urnik';
import type { OdsotnostPovzetek, TerminPovzetek } from '@/lib/glas/tipi';
import type { IzmenicenUrnik, UrnikData } from '@/types/resursi';

/** Največ terminov v seriji in največ dni od prvega (načrt: 12 terminov ali 12 mesecev). */
export const NAJVEC_TERMINOV = 12;
export const NAJVEC_DNI = 366;
/** Predlog za zaseden datum: isti dan, nato ±1 … ±3 dni. */
const ODMIKI = [0, 1, -1, 2, -2, 3, -3];
const KORAK_MIN = 15;

export interface Ritem {
  /** 1 = vsak teden (»vsak torek«), 6 = vsakih šest tednov. */
  vsakihTednov: number;
  /** Koliko terminov (»osemkrat«); null = do datuma. */
  stevilo: number | null;
  /** Zadnji možen dan (»do konca leta«); null = po številu. */
  doDatuma: string | null;
}

/** Datumi serije od prvega naprej (največ 12 in največ eno leto). */
export function datumiSerije(prvi: string, r: Ritem): string[] {
  const korak = Math.max(1, Math.min(26, Math.round(r.vsakihTednov))) * 7;
  const zadnji = dodajDni(prvi, NAJVEC_DNI);
  const meja = r.doDatuma && r.doDatuma < zadnji ? r.doDatuma : zadnji;
  const n = Math.min(NAJVEC_TERMINOV, r.stevilo ?? NAJVEC_TERMINOV);
  const out: string[] = [];
  for (let d = prvi; out.length < n && d <= meja; d = dodajDni(d, korak)) out.push(d);
  return out;
}

export type RazlogTezave = 'zaseden' | 'ne_dela';

export interface DatumSerije {
  /** Predlagani dan in ura (pri premaknjenem predlog, sicer želeni). */
  datum: string;
  ura: string;
  /** ok = prosto ob želeni uri; premaknjen = predlog drug čas; tezava = ni prostega v ±3 dneh. */
  stanje: 'ok' | 'premaknjen' | 'tezava';
  /** Želeni dan in ura (pri premaknjenem in težavi). */
  zeleno?: { datum: string; ura: string };
  razlog?: RazlogTezave;
  /** Pri zasedenem: kdo ima takrat termin (ura, stranka). */
  zasedenZ?: string;
}

export interface VhodPreverjanja {
  datumi: string[];
  ura: string;
  trajanjeMin: number;
  osebaId: string;
  urnik: UrnikData | IzmenicenUrnik | null;
  termini: TerminPovzetek[];
  odsotnosti: OdsotnostPovzetek[];
  casovniPas: string;
  /** Prej ne predlagaj (danes). */
  odDatuma: string;
  /** Na dan `odDatuma` ne pred to uro. */
  odUre?: string;
}

const aktiven = (t: TerminPovzetek) => t.status !== 'cancelled' && t.status !== 'no_show';

function luknje(i: VhodPreverjanja, datum: string): [number, number][] {
  return prosteLuknje({
    osebaId: i.osebaId, urnik: i.urnik, datum, najmanjMin: 1,
    odMinute: datum === i.odDatuma && i.odUre ? vMinute(i.odUre) : 0,
    termini: i.termini.filter(aktiven), odsotnosti: i.odsotnosti, casovniPas: i.casovniPas,
  });
}

/** Najbližji prost začetek temu času na ta dan (po 15 min) ali null. */
function najblizji(lk: [number, number][], u: number, traj: number): number | null {
  let naj: number | null = null;
  for (const [a, b] of lk) {
    const od = Math.ceil(a / KORAK_MIN) * KORAK_MIN;
    const doo = b - traj;
    if (od > doo) continue;
    const s = Math.min(Math.max(Math.round(u / KORAK_MIN) * KORAK_MIN, od), Math.floor(doo / KORAK_MIN) * KORAK_MIN);
    if (s < od) continue;
    if (naj === null || Math.abs(s - u) < Math.abs(naj - u)) naj = s;
  }
  return naj;
}

/** Vsak datum serije: prosto, predlog (isti dan druga ura, nato ±1–3 dni) ali težava. */
export function preveriSerijo(i: VhodPreverjanja): DatumSerije[] {
  const u = vMinute(i.ura);
  const zasedeni = new Set<string>();
  const out: DatumSerije[] = [];
  for (const datum of i.datumi) {
    const lk = luknje(i, datum);
    if (lk.some(([a, b]) => a <= u && u + i.trajanjeMin <= b) && datum >= i.odDatuma) {
      out.push({ datum, ura: i.ura, stanje: 'ok' });
      zasedeni.add(datum);
      continue;
    }
    const prekriva = i.termini.find(
      (t) => aktiven(t) && t.osebaId === i.osebaId && t.datum === datum &&
        vMinute(t.zacetek) < u + i.trajanjeMin && (t.konec ? vMinute(t.konec) : vMinute(t.zacetek) + 60) > u
    );
    const razlog: RazlogTezave = prekriva ? 'zaseden' : 'ne_dela';
    const zasedenZ = prekriva ? `${prekriva.zacetek}${prekriva.stranka ? `, ${prekriva.stranka}` : ''}` : undefined;
    let predlog: { datum: string; ura: string } | null = null;
    for (const odmik of ODMIKI) {
      const d = dodajDni(datum, odmik);
      if (d < i.odDatuma || (odmik !== 0 && (zasedeni.has(d) || i.datumi.includes(d)))) continue;
      const s = najblizji(luknje(i, d), u, i.trajanjeMin);
      if (s !== null) {
        predlog = { datum: d, ura: izMinut(s) };
        break;
      }
    }
    if (predlog) {
      out.push({ ...predlog, stanje: 'premaknjen', zeleno: { datum, ura: i.ura }, razlog, zasedenZ });
      zasedeni.add(predlog.datum);
    } else {
      out.push({ datum, ura: i.ura, stanje: 'tezava', zeleno: { datum, ura: i.ura }, razlog, zasedenZ });
    }
  }
  return out;
}

/** Koliko dni med prvim in zadnjim (za branje terminov in odsotnosti s strani). */
export function obsegSerije(datumi: string[]): { od: string; doo: string } {
  const od = dodajDni(datumi[0], -3);
  const doo = dodajDni(datumi[datumi.length - 1], 3);
  return razlikaDni(od, doo) >= 0 ? { od, doo } : { od: doo, doo: od };
}
