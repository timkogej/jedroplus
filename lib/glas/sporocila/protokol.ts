// lib/glas/sporocila/protokol.ts
//
// Dogovor z n8n tokom glas-sporocilo: podpis zahtevka in branje odgovora (čiste funkcije).

import { createHmac } from 'node:crypto';
import type { IzidPosiljanja } from './tipi';

/** Podpis kot pri booking-v2 in Receptionist+: HMAC-SHA256("<ts>." + surovo telo), hex. */
export function podpisi(skrivnost: string, ts: string, telo: string): string {
  return createHmac('sha256', skrivnost).update(`${ts}.${telo}`).digest('hex');
}

/** Odgovor n8n → izid. Neznan odgovor = napaka (ni poslano po vednosti strežnika). */
export function izidIzOdgovora(o: unknown): IzidPosiljanja {
  const r = (o ?? {}) as { success?: unknown; error?: unknown };
  if (r.success === true) return { status: 'poslano' };
  const napaka = typeof r.error === 'string' ? r.error.slice(0, 60) : 'neznan_odgovor';
  if (napaka === 'quota_exceeded') return { status: 'kvota', razlog: napaka };
  if (napaka === 'blocked_country') return { status: 'blokirano', razlog: napaka };
  return { status: 'napaka', razlog: napaka };
}
