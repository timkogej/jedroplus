// lib/glas/jeziki/jezik.ts
//
// Jezik pogovora Asistent+ za trenutni ukaz. Strežnik ga nastavi enkrat na vhodu
// (jedro: obdelajUkaz, potrdiPredlog, zavrniPredlog) z AsyncLocalStorage, zato
// orodjem in pomočnikom (datumi, ure, telefon) jezika ni treba podajati ročno.
// Brez nastavljenega jezika (testi, stari klici) velja slovenščina.
// Samo strežnik: odjemalec ima svoj jezik v seji (lib/glas/odjemalec/jezikOdjemalca.ts).

import { AsyncLocalStorage } from 'node:async_hooks';
import type { JezikAsistenta } from '../paket';

export type Jezik = JezikAsistenta;

const shramba = new AsyncLocalStorage<Jezik>();

export function trenutniJezik(): Jezik {
  return shramba.getStore() ?? 'sl';
}

/** Izvede `fn` v izbranem jeziku (vse asinhrone veje dedujejo jezik). */
export function zJezikom<T>(jezik: Jezik | null | undefined, fn: () => T): T {
  return shramba.run(jezik ?? 'sl', fn);
}

/**
 * Indeks množinske oblike: sl ima 4 (1, 2, 3–4, 5+ po zadnjih dveh števkah),
 * hr 3 (1, 2–4, 5+ po pravilih CLDR), en/de/it 2 (1, ostalo).
 */
export function oblikaMnozine(jezik: Jezik, n: number): number {
  const a = Math.abs(Math.trunc(n));
  if (jezik === 'sl') {
    const s = a % 100;
    return s === 1 ? 0 : s === 2 ? 1 : s === 3 || s === 4 ? 2 : 3;
  }
  if (jezik === 'hr') {
    const d = a % 10;
    const s = a % 100;
    if (d === 1 && s !== 11) return 0;
    if (d >= 2 && d <= 4 && (s < 12 || s > 14)) return 1;
    return 2;
  }
  return a === 1 ? 0 : 1;
}

/** Ime jezika v slovenščini (za sistemski poziv) in v lastnem jeziku. */
export const IME_JEZIKA: Record<Jezik, { sl: string; lastno: string }> = {
  sl: { sl: 'slovenščina', lastno: 'slovenščina' },
  en: { sl: 'angleščina', lastno: 'English' },
  de: { sl: 'nemščina', lastno: 'Deutsch' },
  it: { sl: 'italijanščina', lastno: 'italiano' },
  hr: { sl: 'hrvaščina', lastno: 'hrvatski' },
};
