// lib/receptionistPlusStripe.ts
//
// Stripe client + credit pack config for ReceptionistPlus one-time credit
// purchases. Deliberately separate from the subscription/plans Stripe flow
// (which is handled entirely by n8n) and from POS — this is a standalone
// one-time-payment product line.

import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = new Stripe(secretKey ?? '', {
  apiVersion: '2026-07-29.dahlia',
});

export type ReceptionistPlusPackKey = 'zagon' | 'standard' | 'profi';

export const RECEPTIONISTPLUS_PACKS: Record<
  ReceptionistPlusPackKey,
  { label: string; credits: number; priceId: string | undefined }
> = {
  zagon: {
    label: 'Zagon',
    credits: 100,
    priceId: process.env.STRIPE_RECEPTIONISTPLUS_ZAGON_PRICE_ID,
  },
  standard: {
    label: 'Standard',
    credits: 300,
    priceId: process.env.STRIPE_RECEPTIONISTPLUS_STANDARD_PRICE_ID,
  },
  profi: {
    label: 'Profi',
    credits: 750,
    priceId: process.env.STRIPE_RECEPTIONISTPLUS_PROFI_PRICE_ID,
  },
};

/** Reverse lookup used by the webhook handler: Stripe Price ID -> credit amount. */
export function creditsForPriceId(priceId: string | null | undefined): number | null {
  if (!priceId) return null;
  for (const pack of Object.values(RECEPTIONISTPLUS_PACKS)) {
    if (pack.priceId === priceId) return pack.credits;
  }
  return null;
}
