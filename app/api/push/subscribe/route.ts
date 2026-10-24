// app/api/push/subscribe/route.ts
//
// POST   — shrani (ali osveži) push naročnino te naprave za prijavljenega uporabnika.
// DELETE — odjavi to napravo.
// GET    — ali je endpoint te naprave shranjen (za stanje stikala v nastavitvah).

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, resolveUserCompany } from '@/lib/auth/apiAuth';
import { pushAdmin } from '@/lib/push/deliver.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const endpointSchema = z
  .string()
  .max(2048)
  .refine((v) => {
    try {
      return new URL(v).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'endpoint must be https');

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: endpointSchema,
    keys: z.object({
      p256dh: z.string().min(80).max(256),
      auth: z.string().min(16).max(64),
    }),
  }),
  platform: z.enum(['ios', 'android', 'desktop', 'other']).optional(),
  browser: z.string().max(40).optional(),
  deviceLabel: z.string().max(120).optional(),
  locale: z.enum(['sl', 'en', 'de', 'hr', 'it']).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('response' in auth) return auth.response;
  const { uuid } = await resolveUserCompany(auth.user.id);
  if (!uuid) return NextResponse.json({ ok: false, error: 'no_company' }, { status: 403 });

  const parsed = subscribeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_subscription' }, { status: 400 });
  const { subscription, platform, browser, deviceLabel, locale } = parsed.data;

  const now = new Date().toISOString();
  // Endpoint je enoličen: če se na isti napravi prijavi nekdo drug, naprava
  // preide nanj — prejšnji uporabnik na njej ne dobiva več obvestil.
  const { error } = await pushAdmin()
    .from('push_subscriptions')
    .upsert(
      {
        user_id: auth.user.id,
        company_id: uuid,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        platform: platform ?? null,
        browser: browser ?? null,
        device_label: deviceLabel ?? null,
        user_agent: request.headers.get('user-agent')?.slice(0, 512) ?? null,
        locale: locale ?? null,
        last_used_at: now,
        failure_count: 0,
      },
      { onConflict: 'endpoint' },
    );
  if (error) {
    console.error('[api/push/subscribe] upsert', error.message);
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('response' in auth) return auth.response;
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  const endpoint = endpointSchema.safeParse(body?.endpoint);
  if (!endpoint.success) return NextResponse.json({ ok: false, error: 'endpoint required' }, { status: 400 });

  const { error } = await pushAdmin()
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint.data)
    .eq('user_id', auth.user.id);
  if (error) {
    console.error('[api/push/subscribe] delete', error.message);
    return NextResponse.json({ ok: false, error: 'delete_failed' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('response' in auth) return auth.response;
  const endpoint = endpointSchema.safeParse(request.nextUrl.searchParams.get('endpoint'));
  if (!endpoint.success) return NextResponse.json({ ok: false, error: 'endpoint required' }, { status: 400 });

  const { data, error } = await pushAdmin()
    .from('push_subscriptions')
    .select('id')
    .eq('endpoint', endpoint.data)
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (error) {
    // Tabela še ne obstaja (migracija ni pognana) → povej to vmesniku.
    const missing = error.code === 'PGRST205' || error.code === '42P01';
    return NextResponse.json({ ok: false, error: missing ? 'not_migrated' : 'load_failed' }, { status: missing ? 503 : 502 });
  }
  return NextResponse.json({ ok: true, registered: Boolean(data) });
}
