// lib/glas/zapolnitev/kandidati.ts
//
// Zapolnitev luknje 4a (docs/glasovni-asistent-dodatne-funkcije-nacrt.md, §4):
// kdo bi lahko prišel v prosti čas. Čista funkcija nad termini, ki jih je
// uporabnik smel prebrati (RLS); brez dostopa do baze.
//
// Skupine (po prednosti):
//   1. kasnejši_termin — ima kasnejši termin pri isti osebi v 30 dneh, ki gre v luknjo
//      (ponudba prestavitve njenega termina = storitveno sporočilo);
//   2. zapadla — po svojem ritmu (mediana razmika med obiski iste storitve, vsaj 3
//      obiski) je zdaj na vrsti: 1,0–1,5 × razmik, brez prihodnjega termina;
//   3. navada — vsaj 2-krat v letu pri tej osebi ob tem delu dneva, brez prihodnjega termina.
// Izločeni: termin, ki se prekriva z luknjo; ≥ 2 neprihoda v zadnjem letu; izbrisane stranke.

import { dodajDni, razlikaDni, vMinute } from '../razresevanje/datumi';
import type { OsebaPovzetek, StoritevPovzetek, TerminPovzetek } from '../tipi';

export type Skupina = 'kasnejsi_termin' | 'zapadla' | 'navada';

export interface Kandidat {
  idStranke: string;
  ime: string;
  skupina: Skupina;
  /** kasnejsi_termin: termin, ki bi ga prestavili. */
  termin?: { id: string; datum: string; zacetek: string; storitev: string };
  /** zapadla: storitev, razmik (dni) in koliko dni od zadnjega obiska. */
  ritem?: { storitev: string; razmikDni: number; odZadnjegaDni: number };
  /** navada: kolikokrat v letu pri tej osebi ob tem času. */
  navada?: { obiskov: number };
}

export interface Luknja {
  datum: string;
  osebaId: string;
  /** Minute od polnoči. */
  od: number;
  do: number;
}

export const DNI_NAPREJ = 30;
/** Za ritem in navado: toliko dni nazaj. */
export const DNI_NAZAJ = 548;
export const NAJVEC_KANDIDATOV = 5;
const OKNO_NAVADE_MIN = 90;

const aktiven = (t: TerminPovzetek) => t.status === 'scheduled' || t.status === 'confirmed';
const obisk = (t: TerminPovzetek) => t.status !== 'cancelled' && t.status !== 'no_show';
const trajanje = (t: TerminPovzetek) => Math.max(0, vMinute(t.konec ?? t.zacetek) - vMinute(t.zacetek));
const enako = (a: string, b: string) => a.trim().toLocaleLowerCase('sl') === b.trim().toLocaleLowerCase('sl');

function mediana(x: number[]): number {
  const s = [...x].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/**
 * Kandidati za luknjo, urejeni po prednosti (največ `najvec`, privzeto 3 × NAJVEC, da
 * klicatelj lahko izloči stranke brez telefona in jih še vedno ima dovolj).
 */
export function izberiKandidate(i: {
  luknja: Luknja;
  /** Termini od danes − DNI_NAZAJ do danes + DNI_NAPREJ (neizbrisani). */
  termini: TerminPovzetek[];
  /** Neizbrisane stranke (ID → ime). */
  stranke: Map<string, string>;
  storitve: StoritevPovzetek[];
  oseba: OsebaPovzetek;
  danes: string;
  najvec?: number;
}): Kandidat[] {
  const { luknja: l, termini, stranke, danes } = i;
  const dolzina = l.do - l.od;
  const doNaprej = dodajDni(danes, DNI_NAPREJ);
  const leto = dodajDni(danes, -365);
  const veljavna = (id: string | null): id is string => Boolean(id && stranke.has(id));

  // Izločitve
  const izlocene = new Set<string>();
  const neprihodi = new Map<string, number>();
  for (const t of termini) {
    if (!veljavna(t.idStranke)) continue;
    if (t.status === 'no_show' && t.datum >= leto) neprihodi.set(t.idStranke, (neprihodi.get(t.idStranke) ?? 0) + 1);
    // Na dan luknje že ima termin, ki se prekriva (pri komerkoli).
    if (aktiven(t) && t.datum === l.datum) {
      const a = vMinute(t.zacetek);
      const b = vMinute(t.konec ?? t.zacetek) || a + 1;
      if (a < l.do && b > l.od) izlocene.add(t.idStranke);
    }
  }
  for (const [id, n] of neprihodi) if (n >= 2) izlocene.add(id);

  const sPrihodnjim = new Set(termini.filter((t) => aktiven(t) && t.datum >= danes && veljavna(t.idStranke)).map((t) => t.idStranke!));
  const ime = (id: string) => stranke.get(id) ?? '';

  // 1. Kasnejši termin pri isti osebi, ki gre v luknjo.
  const g1: Kandidat[] = [];
  const kasnejsi = termini
    .filter((t) => aktiven(t) && t.osebaId === l.osebaId && veljavna(t.idStranke) && !izlocene.has(t.idStranke))
    .filter((t) => (t.datum > l.datum || (t.datum === l.datum && vMinute(t.zacetek) >= l.do)) && t.datum <= doNaprej)
    .filter((t) => trajanje(t) > 0 && trajanje(t) <= dolzina)
    .sort((a, b) => a.datum.localeCompare(b.datum) || vMinute(a.zacetek) - vMinute(b.zacetek));
  for (const t of kasnejsi) {
    if (g1.some((k) => k.idStranke === t.idStranke)) continue;
    g1.push({ idStranke: t.idStranke!, ime: ime(t.idStranke!), skupina: 'kasnejsi_termin', termin: { id: t.id, datum: t.datum, zacetek: t.zacetek, storitev: t.storitev } });
  }

  // Pretekli obiski (vsi neizbrisani, ne samo zaključeni), brez strank s prihodnjim terminom.
  const pretekli = termini.filter((t) => t.datum < danes && obisk(t) && veljavna(t.idStranke) && !izlocene.has(t.idStranke) && !sPrihodnjim.has(t.idStranke));

  // 2. Zapadle po ritmu.
  const zaOsebo = (naziv: string) => {
    const s = i.storitve.find((x) => enako(x.naziv, naziv));
    if (!s) return { gre: true };
    const zna = i.oseba.opravljaVse || i.oseba.storitve.length === 0 || i.oseba.storitve.includes(s.id);
    return { gre: zna && (s.trajanjeMin <= 0 || s.trajanjeMin <= dolzina) };
  };
  const poStranki = new Map<string, Map<string, string[]>>();
  for (const t of pretekli) {
    if (!t.storitev) continue;
    const kljuc = t.storitev.trim().toLocaleLowerCase('sl');
    const m = poStranki.get(t.idStranke!) ?? new Map<string, string[]>();
    m.set(kljuc, [...(m.get(kljuc) ?? []), t.datum]);
    poStranki.set(t.idStranke!, m);
  }
  const g2: (Kandidat & { r: number })[] = [];
  for (const [id, storitve] of poStranki) {
    let najboljsi: (Kandidat & { r: number }) | null = null;
    for (const [, datumi] of storitve) {
      const d = [...new Set(datumi)].sort();
      if (d.length < 3) continue;
      const razmik = mediana(d.slice(1).map((x, j) => razlikaDni(d[j], x)));
      if (razmik < 7) continue;
      const od = razlikaDni(d[d.length - 1], l.datum);
      const r = od / razmik;
      if (r < 1 || r > 1.5) continue;
      const naziv = pretekli.find((t) => t.idStranke === id && t.datum === d[d.length - 1])?.storitev ?? '';
      if (!zaOsebo(naziv).gre) continue;
      if (!najboljsi || r > najboljsi.r) {
        najboljsi = { idStranke: id, ime: ime(id), skupina: 'zapadla', ritem: { storitev: naziv, razmikDni: razmik, odZadnjegaDni: od }, r };
      }
    }
    if (najboljsi) g2.push(najboljsi);
  }
  g2.sort((a, b) => b.r - a.r || a.ime.localeCompare(b.ime, 'sl'));

  // 3. Navada: pri tej osebi ob tem delu dneva.
  const stevec = new Map<string, number>();
  for (const t of pretekli) {
    if (t.osebaId !== l.osebaId || t.datum < leto) continue;
    if (Math.abs(vMinute(t.zacetek) - l.od) > OKNO_NAVADE_MIN) continue;
    stevec.set(t.idStranke!, (stevec.get(t.idStranke!) ?? 0) + 1);
  }
  const g3: Kandidat[] = [...stevec]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || ime(a[0]).localeCompare(ime(b[0]), 'sl'))
    .map(([id, n]) => ({ idStranke: id, ime: ime(id), skupina: 'navada' as const, navada: { obiskov: n } }));

  // Mešanica: najprej do 2 iz vsake skupine, nato dopolni po prednosti.
  const najvec = i.najvec ?? NAJVEC_KANDIDATOV * 3;
  const izbrani: Kandidat[] = [];
  const dodaj = (k: Kandidat) => {
    if (izbrani.length < najvec && !izbrani.some((x) => x.idStranke === k.idStranke)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { r, ...brez } = k as Kandidat & { r?: number };
      izbrani.push(brez);
    }
  };
  for (const g of [g1, g2, g3]) g.slice(0, 2).forEach(dodaj);
  for (const g of [g1, g2, g3]) g.forEach(dodaj);
  return izbrani;
}
