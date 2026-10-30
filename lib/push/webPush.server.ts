// lib/push/webPush.server.ts
//
// Web Push brez zunanje knjižnice: šifriranje vsebine po RFC 8291
// (aes128gcm) in podpis VAPID po RFC 8292, oboje z vgrajenim node:crypto.
// Deluje z vsemi push storitvami (Chrome/Edge/Android → FCM, Firefox →
// Mozilla autopush, Safari/iOS → Apple web push).
//
// Ključi pridejo iz env:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY  65 bajtov, base64url (nestisnjena točka P-256)
//   VAPID_PRIVATE_KEY             32 bajtov, base64url
//   VAPID_SUBJECT                 mailto:… ali https://… (Apple ga zahteva)
// Ustvariš jih z `node scripts/generate-vapid-keys.mjs`.

import 'server-only';
import crypto from 'node:crypto';

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface SendOptions {
  /** Koliko sekund naj push storitev hrani sporočilo, če je naprava brez povezave. */
  ttl?: number;
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
  /** Novo sporočilo z isto temo nadomesti še nedostavljeno staro. */
  topic?: string;
}

export interface SendResult {
  ok: boolean;
  status: number;
  /** Naročnina ne obstaja več (404/410) — vrstico je treba izbrisati. */
  gone: boolean;
  error?: string;
}

const RECORD_SIZE = 4096;
// Push storitve sprejmejo največ 4096 bajtov šifrirane vsebine.
export const MAX_PAYLOAD_BYTES = 3800;

function vapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:info@jedroplus.com';
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export function isPushConfigured(): boolean {
  return vapidConfig() !== null;
}

let cachedSigningKey: { pem: string; key: crypto.KeyObject } | null = null;

function signingKey(publicKeyB64: string, privateKeyB64: string): crypto.KeyObject {
  const cacheId = `${publicKeyB64}.${privateKeyB64}`;
  if (cachedSigningKey?.pem === cacheId) return cachedSigningKey.key;
  const pub = Buffer.from(publicKeyB64, 'base64url');
  if (pub.length !== 65 || pub[0] !== 0x04) throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not a P-256 public key');
  const key = crypto.createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      d: privateKeyB64,
      x: pub.subarray(1, 33).toString('base64url'),
      y: pub.subarray(33, 65).toString('base64url'),
    },
    format: 'jwk',
  });
  cachedSigningKey = { pem: cacheId, key };
  return key;
}

/** `Authorization: vapid t=…, k=…` za dani endpoint (RFC 8292). */
function vapidAuthorization(endpoint: string): string {
  const cfg = vapidConfig();
  if (!cfg) throw new Error('VAPID keys are not configured');
  const audience = new URL(endpoint).origin;
  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).toString('base64url');
  const claims = Buffer.from(
    JSON.stringify({
      aud: audience,
      // Največ 24 ur; Apple zavrne daljše.
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
      sub: cfg.subject,
    }),
  ).toString('base64url');
  const unsigned = `${header}.${claims}`;
  const signature = crypto
    .sign('sha256', Buffer.from(unsigned), { key: signingKey(cfg.publicKey, cfg.privateKey), dsaEncoding: 'ieee-p1363' })
    .toString('base64url');
  return `vapid t=${unsigned}.${signature}, k=${cfg.publicKey}`;
}

function hkdf(ikm: Buffer, salt: Buffer, info: Buffer, length: number): Buffer {
  return Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, length));
}

/** Šifrira vsebino za eno naročnino (RFC 8291, en sam zapis aes128gcm). */
export function encryptPayload(target: Pick<PushTarget, 'p256dh' | 'auth'>, payload: Buffer): Buffer {
  const uaPublic = Buffer.from(target.p256dh, 'base64url');
  const authSecret = Buffer.from(target.auth, 'base64url');
  if (uaPublic.length !== 65) throw new Error('invalid p256dh');
  if (authSecret.length < 16) throw new Error('invalid auth secret');

  const ecdh = crypto.createECDH('prime256v1');
  const asPublic = ecdh.generateKeys();
  const sharedSecret = ecdh.computeSecret(uaPublic);
  const salt = crypto.randomBytes(16);

  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = hkdf(sharedSecret, authSecret, keyInfo, 32);
  const cek = hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);

  // 0x02 = zadnji (in edini) zapis, brez dodatnega polnila.
  const plaintext = Buffer.concat([payload, Buffer.from([0x02])]);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.alloc(16 + 4 + 1);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, ciphertext]);
}

/** Pošlje eno push sporočilo. Nikoli ne vrže napake — vrne rezultat. */
export async function sendPush(target: PushTarget, data: unknown, options: SendOptions = {}): Promise<SendResult> {
  try {
    const payload = Buffer.from(JSON.stringify(data), 'utf8');
    if (payload.length > MAX_PAYLOAD_BYTES) {
      return { ok: false, status: 0, gone: false, error: 'payload_too_large' };
    }
    const body = encryptPayload(target, payload);
    const headers: Record<string, string> = {
      Authorization: vapidAuthorization(target.endpoint),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(options.ttl ?? 24 * 60 * 60),
      Urgency: options.urgency ?? 'normal',
    };
    if (options.topic) headers.Topic = options.topic.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    let res: Response;
    try {
      res = await fetch(target.endpoint, { method: 'POST', headers, body: new Uint8Array(body), signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (res.ok) return { ok: true, status: res.status, gone: false };
    const text = await res.text().catch(() => '');
    return {
      ok: false,
      status: res.status,
      gone: res.status === 404 || res.status === 410,
      error: text.slice(0, 300) || res.statusText,
    };
  } catch (err) {
    return { ok: false, status: 0, gone: false, error: err instanceof Error ? err.message : String(err) };
  }
}
