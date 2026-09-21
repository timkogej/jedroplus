// app/api/company/join-codes/route.ts
//
// Returns the company's join codes (admin + staff) to owners and admins only.
//
// The codes used to be read straight from the browser (companies table via the
// anon client), which meant any logged-in member — including staff — could
// read the ADMIN code and re-join the company as an admin. Reading them here,
// with the service-role client and an explicit role check, closes that path.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, resolveUserCompany } from '@/lib/auth/apiAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const ALLOWED_ROLES = new Set(['owner', 'admin']);

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
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const admin = adminClient();

  const { data: member } = await admin
    .from('company_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('company_id', companyUuid)
    .maybeSingle();

  const role = (member?.role as string | undefined) ?? null;
  if (!role || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const { data: company, error } = await admin
    .from('companies')
    .select('join_code_admin, join_code_staff')
    .eq('id', companyUuid)
    .maybeSingle();

  if (error || !company) {
    return NextResponse.json({ ok: false, error: 'Company not found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    // Only owners may hand out admin access; admins get the staff code only.
    adminCode: role === 'owner' ? ((company.join_code_admin as string | null) ?? null) : null,
    staffCode: (company.join_code_staff as string | null) ?? null,
  });
}
