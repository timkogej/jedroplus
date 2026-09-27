// app/api/reminders/test/route.ts
//
// Sends one test message through the real sender, so what you see here is what
// a client would get — the in-browser preview is a different code path and has
// drifted from it before. The message goes to the company's own contact number
// or address, never anywhere else, and it counts against the company's quota
// like any other message. n8n caps it at five per hour.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rateLimit';
import { authenticateRequest, resolveUserCompany } from '@/lib/auth/apiAuth';

const N8N_TEST_WEBHOOK =
  process.env.N8N_TEST_MESSAGE_URL ?? 'https://n8n.jedroplus.com/webhook/test-message';
const N8N_API_KEY = process.env.N8N_WEBHOOK_API_KEY;

const MAX_TEMPLATE = 2000;

export async function POST(request: NextRequest) {
  const { success, reset } = await rateLimit(request, 'auth');
  if (!success) {
    return NextResponse.json(
      {
        ok: false,
        koda: 'prevec_zahtev',
        razlog: 'Preveč zahtev. Počakajte trenutek.',
        retryAfter: Math.ceil((reset - Date.now()) / 1000),
      },
      { status: 429 }
    );
  }

  const auth = await authenticateRequest(request);
  if ('response' in auth) return auth.response;

  const { uuid, textId } = await resolveUserCompany(auth.user.id);
  if (!uuid || !textId) {
    return NextResponse.json(
      { ok: false, koda: 'ni_podjetja', razlog: 'Vaš račun ni povezan s podjetjem.' },
      { status: 403 }
    );
  }

  // Sending costs the company real money, so staff cannot trigger it.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: member } = await admin
    .from('company_members')
    .select('role')
    .eq('user_id', auth.user.id)
    .eq('company_id', uuid)
    .maybeSingle();

  const role = String(member?.role ?? '').toLowerCase();
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json(
      {
        ok: false,
        koda: 'ni_pravic',
        razlog: 'Preizkusno sporočilo lahko pošlje lastnik ali skrbnik.',
      },
      { status: 403 }
    );
  }

  let body: { channel?: unknown; template?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, koda: 'neveljaven_vhod', razlog: 'Neveljavna zahteva.' },
      { status: 400 }
    );
  }

  const channel = String(body.channel ?? '').toLowerCase() === 'sms' ? 'sms' : 'email';
  const template = String(body.template ?? '').trim().slice(0, MAX_TEMPLATE);
  if (!template) {
    return NextResponse.json(
      {
        ok: false,
        koda: 'prazna_predloga',
        razlog: 'Predloga je prazna — najprej vpišite besedilo.',
      },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(N8N_TEST_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(N8N_API_KEY ? { 'X-API-Key': N8N_API_KEY } : {}),
      },
      body: JSON.stringify({ company_id: textId, channel, template }),
      signal: AbortSignal.timeout(30_000),
    });

    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !data) {
      console.error('[reminders/test] n8n returned', res.status);
      return NextResponse.json(
        {
          ok: false,
          koda: 'napaka_streznika',
          razlog: 'Preizkusa ni bilo mogoče poslati. Poskusite čez nekaj minut.',
        },
        { status: 502 }
      );
    }

    // n8n answers 200 even when it declines (no quota, landline, hourly cap);
    // the body carries the reason, so pass it through unchanged.
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error('[reminders/test] delivery error', err);
    return NextResponse.json(
      {
        ok: false,
        koda: 'napaka_streznika',
        razlog: 'Preizkusa ni bilo mogoče poslati. Poskusite čez nekaj minut.',
      },
      { status: 502 }
    );
  }
}
