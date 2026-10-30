export type PortalEmailRecipientRow = {
  id: number;
  'Email stranke': string | null;
  marketing_consent: boolean | null;
  marketing_opt_out_at: string | null;
};

/** The email channel is explicitly optional and only reaches consenting customers. */
export function selectPortalEmailRecipientIds(rows: PortalEmailRecipientRow[], targetEmail: string | null): number[] {
  const byEmail = new Map<string, PortalEmailRecipientRow[]>();
  for (const row of rows) {
    const email = String(row['Email stranke'] ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (targetEmail && email !== targetEmail)) continue;
    const group = byEmail.get(email) ?? [];
    group.push(row);
    byEmail.set(email, group);
  }
  const ids: number[] = [];
  for (const group of byEmail.values()) {
    // One mailbox may appear in multiple customer rows. Any opt-out or missing
    // consent wins over another row's consent for that same mailbox.
    if (group.some((row) => row.marketing_consent !== true || row.marketing_opt_out_at)) continue;
    const id = group.find((row) => Number.isSafeInteger(row.id))?.id;
    if (id !== undefined) ids.push(id);
  }
  return ids;
}
