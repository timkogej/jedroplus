// app/api/receptionistplus/calls/route.ts
//
// Paginated receptionist_calls list for the logged-in user's company,
// most recent first. Same company_slug resolution pattern as the other
// ReceptionistPlus routes.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, resolveUserCompany } from '@/lib/auth/apiAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const PAGE_SIZE = 20;

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

  const page = Math.max(0, Number(request.nextUrl.searchParams.get('page') ?? '0') || 0);
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count, error } = await admin
    .from('receptionist_calls')
    .select('id, started_at, ended_at, duration_sec, billed_credits, outcome, transcript, created_termin_id', {
      count: 'exact',
    })
    .eq('company_slug', companySlug)
    .order('started_at', { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json({ ok: false, error: 'Napaka pri branju klicnega dnevnika' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    calls: data ?? [],
    totalCount: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  });
}
