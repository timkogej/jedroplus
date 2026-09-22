// lib/team/invite.ts
//
// Team invites without a new email service: the owner shares a link that
// already carries the join code (and optionally the staff card to link), so
// the invitee never types a code. The invite survives the sign-up email
// round-trip because it is stored in the new user's metadata, not only in
// this browser — confirming on a phone still lands them in the right company.

export interface PendingInvite {
  code: string;
  /** Osebe row id to link the new login to (optional). */
  personId?: string;
  /** Company name, for display only. */
  companyName?: string;
}

const STORAGE_KEY = 'jedroplus_pending_invite';

export function buildInviteUrl(origin: string, locale: string, invite: PendingInvite): string {
  const params = new URLSearchParams({ code: invite.code });
  if (invite.personId) params.set('p', invite.personId);
  if (invite.companyName) params.set('c', invite.companyName);
  return `${origin}/${locale}/onboarding/join?${params.toString()}`;
}

export function readInviteFromUrl(search: string): PendingInvite | null {
  const params = new URLSearchParams(search);
  const code = params.get('code')?.trim().toUpperCase();
  if (!code || !/^[A-Z0-9]{4,12}$/.test(code)) return null;
  const personId = params.get('p')?.trim() || undefined;
  const companyName = params.get('c')?.trim().slice(0, 80) || undefined;
  return { code, personId, companyName };
}

export function savePendingInvite(invite: PendingInvite) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invite));
  } catch {
    // ignore — metadata carries it across devices anyway
  }
}

export function loadPendingInvite(): PendingInvite | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingInvite) : null;
  } catch {
    return null;
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Invite as stored in auth user_metadata at sign-up. */
export function inviteFromMetadata(meta: Record<string, unknown> | null | undefined): PendingInvite | null {
  const code = typeof meta?.pending_join_code === 'string' ? meta.pending_join_code : '';
  if (!code) return null;
  return {
    code,
    personId: typeof meta?.pending_person_id === 'string' ? meta.pending_person_id : undefined,
    companyName: typeof meta?.pending_company_name === 'string' ? meta.pending_company_name : undefined,
  };
}

export function inviteToMetadata(invite: PendingInvite | null): Record<string, string> {
  if (!invite) return {};
  return {
    pending_join_code: invite.code,
    ...(invite.personId ? { pending_person_id: invite.personId } : {}),
    ...(invite.companyName ? { pending_company_name: invite.companyName } : {}),
  };
}

export function joinPath(invite: PendingInvite): string {
  const params = new URLSearchParams({ code: invite.code });
  if (invite.personId) params.set('p', invite.personId);
  if (invite.companyName) params.set('c', invite.companyName);
  return `/onboarding/join?${params.toString()}`;
}
