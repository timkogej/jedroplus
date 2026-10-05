// lib/legal/facts.ts
//
// Facts the legal documents repeat. Change them here, not in the texts.

export const LEGAL_FACTS = {
  provider: 'Sonja Žužek s.p.',
  address: 'Prešernova cesta 21A, 1234 Mengeš',
  registrationNumber: '9323228000',
  representative: 'Tim Kogej',
  email: 'tim.kogej@jedroplus.com',
  product: 'Jedro+',
  /** ISO date the current version takes effect. */
  effectiveDate: '2026-09-24',
  version: '2026-09-24',
  /** Retention, in days, as promised in the texts. */
  callRetentionDays: 90,
  deletionAfterEndDays: 90,
  smsLogRetentionMonths: 12,
} as const;

/**
 * False until a lawyer has reviewed the texts; the pages then show a
 * "draft" banner. Flip to true after the review.
 */
export const LEGAL_REVIEWED = false;

/** Version stored with the owner's acceptance at sign-up. */
export const TERMS_VERSION = LEGAL_FACTS.version;
