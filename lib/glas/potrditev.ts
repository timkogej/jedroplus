// lib/glas/potrditev.ts
//
// Žetoni predlogov in kanonični hash parametrov. Žeton (32 naključnih bajtov)
// dobi samo odjemalec; v bazi je le njegov SHA-256. Hash parametrov se preveri
// pred izvedbo, da se ne izvede nekaj drugega, kot je bilo prikazano.

import { createHash, randomBytes } from 'node:crypto';
import { kt } from './jeziki/t';

export function novZeton(): string {
  return randomBytes(32).toString('base64url');
}

export function hashZetona(zeton: string): string {
  return createHash('sha256').update(`glas-zeton:${zeton}`).digest('hex');
}

/** JSON s ključi v abecednem vrstnem redu (enaki parametri → enak hash). */
export function kanonicnoJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(kanonicnoJson).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${kanonicnoJson(o[k])}`)
    .join(',')}}`;
}

export function hashParametrov(orodje: string, parametri: unknown): string {
  return createHash('sha256').update(`${orodje}\n${kanonicnoJson(parametri)}`).digest('hex');
}

export type IzidPotrditve =
  | { ok: true; rezultat: unknown; sporocilo: string; ponovljeno?: boolean }
  | { ok: false; koda: KodaPotrditve; sporocilo: string };

export type KodaPotrditve =
  | 'ni_najden'
  | 'poteklo'
  | 'zavrnjeno'
  | 'izvaja'
  | 'napaka'
  | 'ni_pravice'
  | 'spremenjeno'
  | 'neznano_orodje';

/** Ključi prevodov (jt() ob uporabi v jedru). */
export const SPOROCILA_POTRDITVE: Record<KodaPotrditve, string> = {
  ni_najden: kt('Predloga ni mogoče najti.'),
  poteklo: kt('Predlog je potekel. Ponovite ukaz.'),
  zavrnjeno: kt('Predlog je bil preklican.'),
  izvaja: kt('Predlog se že izvaja.'),
  napaka: kt('Izvedba ni uspela. Nič ni bilo spremenjeno.'),
  ni_pravice: kt('Za to dejanje nimate pravice.'),
  spremenjeno: kt('Predlog ni več veljaven. Ponovite ukaz.'),
  neznano_orodje: kt('To dejanje ni na voljo.'),
};
