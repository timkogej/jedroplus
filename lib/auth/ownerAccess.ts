// lib/auth/ownerAccess.ts
//
// Owner/admin of the caller's company, for routes that write company
// settings with the service role (region, message templates).

import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { authenticateRequest, resolveUserCompany } from './apiAuth';

export function adminClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** `{ textId, admin }` for an owner/admin, or a ready-to-return error response. */
export async function requireOwnerOrAdmin(
  request: NextRequest
): Promise<{ response: NextResponse } | { textId: string; admin: SupabaseClient }> {
  const auth = await authenticateRequest(request);
  if ('response' in auth) return { response: auth.response };

  const { uuid: companyUuid, textId } = await resolveUserCompany(auth.user.id);
  if (!companyUuid || !textId) {
    return { response: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 }) };
  }

  const admin = adminClient();
  const { data: member } = await admin
    .from('company_members')
    .select('role')
    .eq('user_id', auth.user.id)
    .eq('company_id', companyUuid)
    .maybeSingle();

  const role = (member?.role as string | undefined) ?? null;
  if (role !== 'owner' && role !== 'admin') {
    return { response: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 }) };
  }

  return { textId, admin };
}
