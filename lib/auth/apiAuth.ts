// lib/auth/apiAuth.ts
//
// Server-side API authentication + authorization helpers for the core app.
//
// Every protected API route must:
//  1. verify the caller is a logged-in user (valid Supabase session), and
//  2. verify that user is actually attached to the company whose data the
//     request touches.
//
// Several routes use the service-role client, which bypasses RLS. Without (2)
// an authenticated user of company A could pass company B's id in the request
// and read/write B's data. These helpers close that hole.
//
// Session source: the core app uses @supabase/ssr COOKIE-based sessions, so we
// read the session from cookies (createServerSupabaseClient). A Bearer token in
// the Authorization header is also accepted as a fallback for callers that send
// one (e.g. billingClient). This mirrors the POS app's requireCompanyAccess
// semantics, adapted to this app's cookie-based auth.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface AuthedUser {
  id: string;
  email: string | null;
}

/** Admin (service-role) client — bypasses RLS. Server-only. */
function adminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Pulls the bearer token from the Authorization header, if present. */
function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get('Authorization');
  if (!header) return null;
  const token = header.replace(/^Bearer\s+/i, '').trim();
  return token || null;
}

/**
 * Validates the request's session. Returns the user on success, or a ready-to
 * return 401 NextResponse on failure.
 *
 * Order: (1) cookie session (the default for this app), (2) Bearer token.
 */
export async function authenticateRequest(
  req: NextRequest
): Promise<{ user: AuthedUser } | { response: NextResponse }> {
  // 1. Cookie-based session (createServerSupabaseClient reads request cookies).
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return { user: { id: user.id, email: user.email ?? null } };
    }
  } catch {
    // fall through to Bearer
  }

  // 2. Bearer token fallback.
  const token = getBearerToken(req);
  if (token) {
    const {
      data: { user },
      error,
    } = await adminClient().auth.getUser(token);
    if (!error && user) {
      return { user: { id: user.id, email: user.email ?? null } };
    }
  }

  return { response: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
}

/**
 * Resolves the identifiers of the company a user belongs to.
 *
 * Returns both the company UUID (companies.id — sent by members/addons routes)
 * and the text business id (companies.company_id — sent by promotions routes),
 * so a caller matching EITHER is authorized.
 *
 * Membership is read from company_members (the RBAC source); if the user has no
 * membership row we fall back to profiles.default_company_id.
 */
export async function resolveUserCompany(
  userId: string
): Promise<{ uuid: string | null; textId: string | null }> {
  const admin = adminClient();

  // company_members.company_id is the company UUID.
  let companyUuid: string | null = null;
  const { data: member } = await admin
    .from('company_members')
    .select('company_id')
    .eq('user_id', userId)
    .maybeSingle();
  companyUuid = (member?.company_id as string | undefined) ?? null;

  // Fallback: profiles.default_company_id (also the company UUID).
  if (!companyUuid) {
    const { data: profile } = await admin
      .from('profiles')
      .select('default_company_id')
      .eq('id', userId)
      .maybeSingle();
    companyUuid = (profile?.default_company_id as string | undefined) ?? null;
  }

  if (!companyUuid) return { uuid: null, textId: null };

  // Map UUID -> text business id (companies.company_id).
  const { data: company } = await admin
    .from('companies')
    .select('company_id')
    .eq('id', companyUuid)
    .maybeSingle();

  return { uuid: companyUuid, textId: (company?.company_id as string | undefined) ?? null };
}

/**
 * Authenticates the request AND checks the caller owns `requestedCompanyId`.
 *
 * `requestedCompanyId` may be either the company UUID or the text business id —
 * the caller is authorized if it matches either identifier of their own company.
 *
 * Returns the user, or a 401/403/400 NextResponse to return immediately.
 */
export async function requireCompanyAccess(
  req: NextRequest,
  requestedCompanyId: string | null | undefined
): Promise<{ user: AuthedUser } | { response: NextResponse }> {
  const auth = await authenticateRequest(req);
  if ('response' in auth) return auth;

  if (!requestedCompanyId) {
    return { response: NextResponse.json({ ok: false, error: 'company_id required' }, { status: 400 }) };
  }

  const { uuid, textId } = await resolveUserCompany(auth.user.id);
  if (!uuid && !textId) {
    return { response: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 }) };
  }

  if (requestedCompanyId !== uuid && requestedCompanyId !== textId) {
    return { response: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 }) };
  }

  return { user: auth.user };
}

/**
 * Authenticates the request AND checks the caller owns the company that the
 * given row belongs to. For id-addressed routes (PUT/DELETE by row id) that do
 * NOT carry a company_id in the request. Mirrors the POS app's
 * requireInvoiceAccess: resolve the owning company from the resource, then check.
 *
 * `table` must expose a `company_id` column (text business id or UUID). The row
 * is located by its `id`.
 */
export async function requireRowCompanyAccess(
  req: NextRequest,
  table: string,
  rowId: string
): Promise<{ user: AuthedUser } | { response: NextResponse }> {
  const auth = await authenticateRequest(req);
  if ('response' in auth) return auth;

  const { data: row } = await adminClient()
    .from(table)
    .select('company_id')
    .eq('id', rowId)
    .maybeSingle();

  if (!row) {
    return { response: NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 }) };
  }

  const rowCompanyId = (row.company_id as string | undefined) ?? null;
  const { uuid, textId } = await resolveUserCompany(auth.user.id);
  if ((!uuid && !textId) || (rowCompanyId !== uuid && rowCompanyId !== textId)) {
    return { response: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 }) };
  }

  return { user: auth.user };
}
