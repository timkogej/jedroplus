// app/api/team/connect-user/route.ts
//
// Links the signed-in user's login to a staff card (Osebe row) in their own
// company, via the n8n `connect-user` workflow. Replaces direct browser calls
// to n8n so the webhook can require the server-held API key.
//
// Security:
// - The caller must be signed in and belong to the company in the request.
// - user_id is always the caller (never taken from the body): you can only
//   link YOUR login.
// - The staff card must belong to that same company.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rateLimit';
import { requireCompanyAccess, resolveUserCompany } from '@/lib/auth/apiAuth';

const CONNECT_USER_URL = 'https://n8n.jedroplus.com/webhook/connect-user';
const N8N_API_KEY = process.env.N8N_WEBHOOK_API_KEY;

export async function POST(request: NextRequest) {
  const { success } = await rateLimit(request, 'webhook');
  if (!success) {
    return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    person_id?: unknown;
    company_id?: unknown;
    company_uuid?: unknown;
  };
  const companyRef =
    (typeof body.company_uuid === 'string' && body.company_uuid) ||
    (typeof body.company_id === 'string' && body.company_id) ||
    null;
  const personId = body.person_id == null ? '' : String(body.person_id).trim();
  if (!personId) {
    return NextResponse.json({ ok: false, error: 'person_id required' }, { status: 400 });
  }

  const access = await requireCompanyAccess(request, companyRef);
  if ('response' in access) return access.response;

  const { uuid, textId } = await resolveUserCompany(access.user.id);

  // The staff card must be in the caller's company.
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: card } = await admin
    .from('Osebe')
    .select('id, "ID podjetja"')
    .eq('id', personId)
    .maybeSingle();
  const cardCompany = (card as Record<string, unknown> | null)?.['ID podjetja'];
  if (!card || (cardCompany !== textId && cardCompany !== uuid)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const response = await fetch(CONNECT_USER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(N8N_API_KEY ? { 'X-API-Key': N8N_API_KEY } : {}),
    },
    body: JSON.stringify({
      user_id: access.user.id,
      person_id: personId,
      company_id: textId,
      company_uuid: uuid,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(`[api/team/connect-user] n8n returned ${response.status}`);
    return NextResponse.json({ ok: false, error: `Webhook failed: ${response.status}` }, { status: 502 });
  }
  try {
    return NextResponse.json(text ? JSON.parse(text) : { ok: true });
  } catch {
    return NextResponse.json({ ok: true, data: text });
  }
}
