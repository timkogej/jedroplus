// app/api/company/auto-complete/route.ts
//
// The company's "close appointments automatically N hours after they end"
// setting. Written here rather than through the n8n settings event so the
// workflow does not need to know about the column.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, resolveUserCompany } from '@/lib/auth/apiAuth';

const ALLOWED_HOURS = [0, 1, 2, 4];

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolve(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('response' in auth) return auth;
  const { uuid, textId } = await resolveUserCompany(auth.user.id);
  if (!uuid || !textId) {
    return { response: NextResponse.json({ ok: false, error: 'no_company' }, { status: 403 }) };
  }
  const { data: member } = await admin()
    .from('company_members')
    .select('role')
    .eq('user_id', auth.user.id)
    .eq('company_id', uuid)
    .maybeSingle();
  return { textId, role: (member?.role as string | undefined) ?? 'staff' };
}

export async function GET(request: NextRequest) {
  const ctx = await resolve(request);
  if ('response' in ctx) return ctx.response;

  const { data, error } = await admin()
    .from('Podatki podjetij')
    .select('samodejni_zakljucek_ur')
    .eq('ID Podjetja', ctx.textId)
    .maybeSingle();

  // Column missing (migration not run yet) reads as "off".
  const hours = error ? 0 : Number(data?.samodejni_zakljucek_ur ?? 0);
  return NextResponse.json({ ok: true, hours: ALLOWED_HOURS.includes(hours) ? hours : 0 });
}

export async function PATCH(request: NextRequest) {
  const ctx = await resolve(request);
  if ('response' in ctx) return ctx.response;
  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { hours?: unknown };
  const hours = Number(body.hours);
  if (!ALLOWED_HOURS.includes(hours)) {
    return NextResponse.json({ ok: false, error: 'invalid_hours' }, { status: 400 });
  }

  const { error } = await admin()
    .from('Podatki podjetij')
    .update({ samodejni_zakljucek_ur: hours })
    .eq('ID Podjetja', ctx.textId);
  if (error) {
    console.error('[api/company/auto-complete]', error.message);
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, hours });
}
