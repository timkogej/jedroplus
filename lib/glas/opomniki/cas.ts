// lib/glas/opomniki/cas.ts
//
// Lokalni čas v pasu podjetja → trenutek (UTC). Poletni/zimski čas: odmik pasu
// izračunamo za ta trenutek (dva koraka zadoščata tudi ob prehodu).

import { zdajVPasu } from '../razresevanje/datumi';

/** Del dneva brez ure (Timova odločitev O8): asistent vedno pove točen čas. */
export const DELI_DNEVA = { zjutraj: '09:00', dopoldne: '10:00', popoldne: '14:00', zvecer: '18:00' } as const;
export type DelDneva = keyof typeof DELI_DNEVA;

function minutOdUtc(ms: number, pas: string): number {
  const l = zdajVPasu(new Date(ms), pas);
  const [y, m, d] = l.datum.split('-').map(Number);
  const [h, mi] = l.ura.split(':').map(Number);
  return Math.round((Date.UTC(y, m - 1, d, h, mi) - Math.floor(ms / 60_000) * 60_000) / 60_000);
}

/** "2026-11-15" + "09:00" v pasu → Date. */
export function casVPasu(datum: string, ura: string, pas: string): Date {
  const [y, m, d] = datum.split('-').map(Number);
  const [h, mi] = ura.split(':').map(Number);
  const lokalno = Date.UTC(y, m - 1, d, h, mi);
  let ms = lokalno - minutOdUtc(lokalno, pas) * 60_000;
  ms = lokalno - minutOdUtc(ms, pas) * 60_000;
  return new Date(ms);
}
