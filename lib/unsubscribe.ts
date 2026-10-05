// lib/unsubscribe.ts  (server only)
//
// Signed unsubscribe links for marketing messages: /unsubscribe/<token>.
// The token names one client ("Stranke".id) and is signed, so nobody can
// unsubscribe someone else by guessing ids.

import { createHash, createHmac, timingSafeEqual } from 'crypto';

function secret(): string | null {
  if (process.env.UNSUBSCRIBE_SECRET) return process.env.UNSUBSCRIBE_SECRET;
  // Works without extra config: a key derived from (never equal to) the service key.
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return service ? createHash('sha256').update(`jedroplus-unsubscribe:${service}`).digest('hex') : null;
}

function sign(clientId: string, key: string): string {
  return createHmac('sha256', key).update(`unsubscribe:${clientId}`).digest('base64url').slice(0, 32);
}

export function createUnsubscribeToken(clientId: string | number): string | null {
  const key = secret();
  const id = String(clientId);
  if (!key || !/^\d+$/.test(id)) return null;
  return `${id}.${sign(id, key)}`;
}

/** The client id the token was made for, or null if it is not genuine. */
export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  const key = secret();
  if (!key || !token) return null;
  const match = /^(\d+)\.([A-Za-z0-9_-]{32})$/.exec(token);
  if (!match) return null;
  const expected = Buffer.from(sign(match[1], key));
  const given = Buffer.from(match[2]);
  return expected.length === given.length && timingSafeEqual(expected, given) ? match[1] : null;
}

export function unsubscribeUrl(origin: string, clientId: string | number): string | null {
  const token = createUnsubscribeToken(clientId);
  return token ? `${origin.replace(/\/$/, '')}/unsubscribe/${token}` : null;
}
