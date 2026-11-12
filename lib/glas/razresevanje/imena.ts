// lib/glas/razresevanje/imena.ts
//
// Fuzzy ujemanje imen po prepisu govora. STT pri slovenskih imenih in
// sklanjatvah ("za Ano", "k Anji", "Novakovi") ni zanesljiv, zato:
//   1. vsako besedo poizvedbe in kandidata razstavimo na možne osnove
//      (odrez sklonskih končnic), brez šumnikov;
//   2. primerjamo osnove z Jaro-Winklerjem;
//   3. ocena kandidata = povprečje najboljših ujemanj besed poizvedbe.
// Pravilo: pri več podobno dobrih kandidatih NE ugibamo — izid je 'vec' in
// asistent vpraša.

import { osnove, kljuc } from './besedilo';

const POLNILA = new Set([
  'za', 'k', 'h', 'pri', 'od', 'na', 's', 'z', 'in', 'gospa', 'gospod', 'go', 'g',
  'stranka', 'stranki', 'stranko', 'stranke', 'gospe', 'gospodu', 'gospo',
]);

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const razdalja = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const zadA = new Array<boolean>(a.length).fill(false);
  const zadB = new Array<boolean>(b.length).fill(false);
  let ujemanj = 0;
  for (let i = 0; i < a.length; i++) {
    const od = Math.max(0, i - razdalja);
    const doo = Math.min(i + razdalja + 1, b.length);
    for (let j = od; j < doo; j++) {
      if (zadB[j] || a[i] !== b[j]) continue;
      zadA[i] = zadB[j] = true;
      ujemanj++;
      break;
    }
  }
  if (ujemanj === 0) return 0;
  let k = 0;
  let premikov = 0;
  for (let i = 0; i < a.length; i++) {
    if (!zadA[i]) continue;
    while (!zadB[k]) k++;
    if (a[i] !== b[k]) premikov++;
    k++;
  }
  const m = ujemanj;
  const jaro = (m / a.length + m / b.length + (m - premikov / 2) / m) / 3;
  let predpona = 0;
  while (predpona < 4 && a[predpona] && a[predpona] === b[predpona]) predpona++;
  return jaro + predpona * 0.1 * (1 - jaro);
}

/** Podobnost dveh besed ob upoštevanju sklanjatev (0–1). */
export function podobnostBesed(a: string, b: string): number {
  if (kljuc(a) === kljuc(b)) return 1;
  let najboljse = 0;
  for (const oa of osnove(a)) {
    for (const ob of osnove(b)) {
      if (oa.length < 2 || ob.length < 2) continue;
      if (oa === ob) return 0.99;
      najboljse = Math.max(najboljse, jaroWinkler(oa, ob));
    }
  }
  return najboljse;
}

export function besedePoizvedbe(poizvedba: string): string[] {
  return poizvedba
    .split(/[\s,.;:!?()-]+/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0 && !POLNILA.has(kljuc(b)));
}

export interface Kandidat<T> {
  vrednost: T;
  ocena: number;
}

export type IzidIskanja<T> =
  | { izid: 'enolicno'; najden: T; ocena: number; kandidati: Kandidat<T>[] }
  | { izid: 'vec'; kandidati: Kandidat<T>[] }
  | { izid: 'nic'; kandidati: Kandidat<T>[] };

export interface MejeIskanja {
  /** Najmanjša ocena za samodejno izbiro. */
  enolicno: number;
  /** Potrebna razlika do drugega kandidata. */
  razlika: number;
  /** Najmanjša ocena, da kandidata sploh predlagamo. */
  predlog: number;
  najvec: number;
}

export const PRIVZETE_MEJE: MejeIskanja = { enolicno: 0.9, razlika: 0.06, predlog: 0.8, najvec: 5 };

/** Oceni vse kandidate glede na poizvedbo in vrni izid. */
export function poisci<T>(
  poizvedba: string,
  kandidati: T[],
  besedeKandidata: (k: T) => string[],
  meje: MejeIskanja = PRIVZETE_MEJE
): IzidIskanja<T> {
  const besede = besedePoizvedbe(poizvedba);
  if (besede.length === 0) return { izid: 'nic', kandidati: [] };

  const ocenjeni: Kandidat<T>[] = [];
  for (const k of kandidati) {
    const kb = besedeKandidata(k).flatMap((s) => s.split(/[\s-]+/)).filter(Boolean);
    if (kb.length === 0) continue;
    let vsota = 0;
    for (const b of besede) {
      let naj = 0;
      for (const c of kb) naj = Math.max(naj, podobnostBesed(b, c));
      vsota += naj;
    }
    ocenjeni.push({ vrednost: k, ocena: vsota / besede.length });
  }
  ocenjeni.sort((a, b) => b.ocena - a.ocena);

  const prvi = ocenjeni[0];
  if (!prvi || prvi.ocena < meje.predlog) return { izid: 'nic', kandidati: [] };

  const blizu = ocenjeni
    .filter((k) => k.ocena >= meje.predlog && k.ocena >= prvi.ocena - 0.1)
    .slice(0, meje.najvec);
  const drugi = ocenjeni[1];
  if (prvi.ocena >= meje.enolicno && (!drugi || prvi.ocena - drugi.ocena >= meje.razlika)) {
    return { izid: 'enolicno', najden: prvi.vrednost, ocena: prvi.ocena, kandidati: blizu };
  }
  return { izid: 'vec', kandidati: blizu };
}
