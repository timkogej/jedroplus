// app/api/receptionistplus/credits/route.ts
//
// Current credit balance + recent transaction history for the logged-in
// user's company. Same company_slug resolution pattern as the other
// ReceptionistPlus routes.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, resolveUserCompany } from '@/lib/auth/apiAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const RECENT_LIMIT = 10;

function adminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: NextRequest) {
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

  const [{ data: balanceRow, error: balanceError }, { data: transactions, error: txError }] = await Promise.all([
    admin.from('receptionist_credits').select('balance_credits').eq('company_slug', companySlug).maybeSingle(),
    admin
      .from('receptionist_credit_transactions')
      .select('id, delta_credits, balance_after, type, note, created_at')
      .eq('company_slug', companySlug)
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT),
  ]);

  if (balanceError || txError) {
    return NextResponse.json({ ok: false, error: 'Napaka pri branju kreditov' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    companyUuid,
    balance: Number(balanceRow?.balance_credits ?? 0),
    transactions: transactions ?? [],
  });
}
