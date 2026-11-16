// lib/glas/jeziki/t.ts
//
// Prevajanje besedil Asistent+ po vzoru gettext: ključ je slovensko besedilo, katalog
// jezika ima prevod. Slovenščina vrne ključ (izhod je enak kot pred prevodi).
//
// Predloga:
//   {ime}                       vrednost parametra
//   {oseba:mestnik}             slovenski mestnik ("pri {oseba:mestnik}" → "pri Luki");
//                               v drugih jezikih se modifikator ne uporablja
//   {n|stranka|stranki|stranke|strank}
//                               samo beseda v množinski obliki za število n
//                               (sl 4 oblike, hr 3, en/de/it 2)
//
// Ključi morajo biti dobesedni nizi v jt('…') ali kt('…'): test
// tests/glas/jeziki.test.ts jih poišče v kodi in preveri, da jih ima vsak katalog
// z enakimi parametri.

import { mestnik } from '../govor';
import { oblikaMnozine, trenutniJezik, type Jezik } from './jezik';
import { en } from './katalog/en';
import { de } from './katalog/de';
import { it } from './katalog/it';
import { hr } from './katalog/hr';

export type Katalog = Record<string, string>;
export type Parametri = Record<string, string | number | null | undefined>;

const KATALOGI: Record<Exclude<Jezik, 'sl'>, Katalog> = { en, de, it, hr };

/** Prevod v trenutnem jeziku (glej jezik.ts). */
export function jt(kljuc: string, p?: Parametri): string {
  return prevedi(trenutniJezik(), kljuc, p);
}

/** Označi ključ za kasnejši jt() (npr. v tabelah konstant); vrne ključ nespremenjen. */
export function kt(kljuc: string): string {
  return kljuc;
}

export function prevedi(jezik: Jezik, kljuc: string, p?: Parametri): string {
  const predloga = jezik === 'sl' ? kljuc : (KATALOGI[jezik][kljuc] ?? kljuc);
  return vstavi(jezik === 'sl' || !KATALOGI[jezik][kljuc] ? 'sl' : jezik, predloga, p);
}

const ZNAK = /\{(\w+)(?::(\w+))?((?:\|[^|}]*)+)?\}/g;

function vstavi(jezik: Jezik, predloga: string, p?: Parametri): string {
  if (!predloga.includes('{')) return predloga;
  return predloga.replace(ZNAK, (cel, ime: string, mod: string | undefined, oblike: string | undefined) => {
    if (!p || !(ime in p)) return cel;
    const v = p[ime];
    if (oblike) {
      const f = oblike.slice(1).split('|');
      return f[Math.min(oblikaMnozine(jezik, Number(v)), f.length - 1)] ?? '';
    }
    const s = v == null ? '' : String(v);
    if (mod === 'mestnik' && jezik === 'sl') return mestnik(s);
    return s;
  });
}

/** Imena parametrov v predlogi (za test katalogov). */
export function parametriPredloge(predloga: string): string[] {
  return [...new Set([...predloga.matchAll(ZNAK)].map((m) => m[1]))].sort();
}

export const KATALOGI_ZA_TEST = KATALOGI;

/** "a, b in c" v trenutnem jeziku. */
export function inSeznam(x: string[]): string {
  return x.length > 1 ? jt('{prvi} in {zadnji}', { prvi: x.slice(0, -1).join(', '), zadnji: x.at(-1) }) : (x[0] ?? '');
}
