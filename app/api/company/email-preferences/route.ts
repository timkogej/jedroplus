// app/api/company/email-preferences/route.ts
//
// Which emails the company wants from us. Transactional mail (quota, payments,
// invites) is not on this list: it always goes out.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, resolveUserCompany } from '@/lib/auth/apiAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function admin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function companyOf(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('response' in auth) return auth;
  const { textId } = await resolveUserCompany(auth.user.id);
  if (!textId) {
    return { response: NextResponse.json({ ok: false, error: 'no_company' }, { status: 403 }) };
  }
  return { textId };
}

export async function GET(request: NextRequest) {
  const company = await companyOf(request);
  if ('response' in company) return company.response;

  const { data } = await admin()
    .from('email_preferences')
    .select('lifecycle_opt_in, marketing_opt_in')
    .eq('company_id', company.textId)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    lifecycle_opt_in: data?.lifecycle_opt_in ?? true,
    marketing_opt_in: data?.marketing_opt_in ?? false,
  });
}

export async function PATCH(request: NextRequest) {
  const company = await companyOf(request);
  if ('response' in company) return company.response;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = { company_id: company.textId, updated_at: new Date().toISOString() };
  if (typeof body.lifecycle_opt_in === 'boolean') patch.lifecycle_opt_in = body.lifecycle_opt_in;
  if (typeof body.marketing_opt_in === 'boolean') patch.marketing_opt_in = body.marketing_opt_in;

  const { error } = await admin().from('email_preferences').upsert(patch, { onConflict: 'company_id' });
  if (error) {
    console.error('[api/company/email-preferences]', error.message);
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
