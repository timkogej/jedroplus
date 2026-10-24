/**
 * Ustvari VAPID ključe in skrivnost za push obvestila.
 *
 *   node scripts/generate-vapid-keys.mjs
 *
 * Izpis prilepi v Vercel → Settings → Environment Variables (Production in
 * Preview). PUSH_WEBHOOK_SECRET vpiši tudi v Supabase Vault (glej migracijo
 * 1792700000_push_subscriptions.sql). Ključev ne menjaj brez potrebe: z novimi
 * ključi morajo vse naprave obvestila vklopiti znova.
 */
import crypto from 'node:crypto';

const ecdh = crypto.createECDH('prime256v1');
ecdh.generateKeys();

console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${ecdh.getPublicKey().toString('base64url')}`);
console.log(`VAPID_PRIVATE_KEY=${ecdh.getPrivateKey().toString('base64url')}`);
console.log('VAPID_SUBJECT=mailto:info@jedroplus.com');
console.log(`PUSH_WEBHOOK_SECRET=${crypto.randomBytes(32).toString('base64url')}`);
