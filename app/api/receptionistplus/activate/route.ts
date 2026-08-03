// app/api/receptionistplus/activate/route.ts
//
// Self-serve activation for ReceptionistPlus. First-ever activation creates
// the receptionist_settings row, seeds a 30-credit free trial, and logs the
// trial_grant transaction. Re-activation (row already exists, e.g. it was
// previously enabled=false) just flips enabled back on — never grants a
// second trial. Same company_slug resolution pattern as the other
// receptionist-plus routes.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, resolveUserCompany } from '@/lib/auth/apiAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TRIAL_CREDITS = 30;

function adminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if ('response' in authResult) return authResult.response;

  const { user } = authResult;
  const { uuid: companyUuid } = await resolveUserCompany(user.id);
  if (!companyUuid) {
    return NextResponse.json({ ok: false, error: 'Company ni najdena' }, { status: 400 });
  }

  const admin = adminClient();

  const { data: company } = await admin.from('companies').select('slug').eq('id', companyUuid).maybeSingle();
  const companySlug = company?.slug as string | undefined;
  if (!companySlug) {
    return NextResponse.json({ ok: false, error: 'Company slug ni najden' }, { status: 400 });
  }

  const { data: existing, error: readError } = await admin
    .from('receptionist_settings')
    .select('company_slug')
    .eq('company_slug', companySlug)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ ok: false, error: 'Napaka pri branju nastavitev' }, { status: 500 });
  }

  if (existing) {
    const { error: updateError } = await admin
      .from('receptionist_settings')
      .update({ enabled: true, updated_at: new Date().toISOString() })
      .eq('company_slug', companySlug);

    if (updateError) {
      return NextResponse.json({ ok: false, error: 'Napaka pri aktivaciji' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, trialGranted: false });
  }

  const { error: insertSettingsError } = await admin.from('receptionist_settings').insert({
    company_slug: companySlug,
    enabled: true,
    low_balance_threshold: 60,
    language: 'sl',
  });

  if (insertSettingsError) {
    return NextResponse.json({ ok: false, error: 'Napaka pri aktivaciji' }, { status: 500 });
  }

  // receptionist_credits/receptionist_credit_transactions may already exist even
  // though receptionist_settings didn't (e.g. it was previously deleted) — never
  // clobber an existing balance or grant a second trial in that case.
  const { data: existingCredits, error: creditsReadError } = await admin
    .from('receptionist_credits')
    .select('company_slug')
    .eq('company_slug', companySlug)
    .maybeSingle();

  if (creditsReadError) {
    return NextResponse.json({ ok: false, error: 'Napaka pri branju kreditov' }, { status: 500 });
  }

  if (existingCredits) {
    return NextResponse.json({ ok: true, trialGranted: false });
  }

  const { error: creditsError } = await admin
    .from('receptionist_credits')
    .insert({ company_slug: companySlug, balance_credits: TRIAL_CREDITS });

  if (creditsError) {
    return NextResponse.json({ ok: false, error: 'Napaka pri dodelitvi preizkusnih kreditov' }, { status: 500 });
  }

  const { error: txError } = await admin.from('receptionist_credit_transactions').insert({
    company_slug: companySlug,
    type: 'trial_grant',
    delta_credits: TRIAL_CREDITS,
    balance_after: TRIAL_CREDITS,
    note: 'Free trial grant',
  });

  if (txError) {
    return NextResponse.json({ ok: false, error: 'Napaka pri beleženju preizkusnih kreditov' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, trialGranted: true });
}
