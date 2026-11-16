// app/api/staff-permissions/privacy/route.ts
//
// Zasebnost za zaposlene (ghost termini, pretekli termini). Samo lastnik.
// Zapiše neposredno v staff_role_permissions (service role), po preverjanju vloge,
// ker teh stolpcev n8n potek NASTAVITVE_STAFF ne pozna.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, resolveUserCompany } from '@/lib/auth/apiAuth';
import { adminClient } from '@/lib/auth/ownerAccess';

export const dynamic = 'force-dynamic';

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('response' in auth) return auth.response;

  const { uuid: companyUuid } = await resolveUserCompany(auth.user.id);
  if (!companyUuid) return fail(403, 'Forbidden');

  const admin = adminClient();
  const { data: member } = await admin
    .from('company_members')
    .select('role')
    .eq('user_id', auth.user.id)
    .eq('company_id', companyUuid)
    .maybeSingle();
  if (member?.role !== 'owner') return fail(403, 'Forbidden');

  let body: { can_view_ghost_termini?: unknown; past_appointments_days?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, 'invalid_json');
  }

  const update: Record<string, boolean | number | null> = {};
  if (body.can_view_ghost_termini !== undefined) {
    if (typeof body.can_view_ghost_termini !== 'boolean') return fail(400, 'invalid');
    update.can_view_ghost_termini = body.can_view_ghost_termini;
  }
  if (body.past_appointments_days !== undefined) {
    const d = body.past_appointments_days;
    // null = vsi pretekli termini, 0 = nobenih, N = zadnjih N dni
    if (d !== null && !(typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 3650)) {
      return fail(400, 'invalid');
    }
    update.past_appointments_days = d as number | null;
  }
  if (Object.keys(update).length === 0) return fail(400, 'invalid');

  const { data, error } = await admin
    .from('staff_role_permissions')
    .update(update)
    .eq('company_id', companyUuid)
    .select('company_id');

  if (error) {
    // 42703 / PGRST204: stolpca še ni (migracija 1793700000 ni pognana).
    const missing = error.code === '42703' || error.code === 'PGRST204';
    return fail(missing ? 503 : 500, missing ? 'migration' : 'write');
  }
  if (!data || data.length === 0) return fail(404, 'no_permissions_row');

  return NextResponse.json({ ok: true });
}
