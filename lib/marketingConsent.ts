// lib/marketingConsent.ts
//
// Who may receive marketing (Komunikacija). Reminders and other service
// messages are not affected. See migration 1790300000.

/** False when the client declined marketing or clicked "unsubscribe". */
export function canReceiveMarketing(row: Record<string, unknown>): boolean {
  if (row.marketing_opt_out_at) return false;
  const consent = row.marketing_consent;
  return !(consent === false || consent === 'false');
}
