// app/api/push/test/route.ts
//
// "Pošlji testno obvestilo": pošlje push samo na napravo, s katere je bil
// gumb pritisnjen (endpoint iz telesa, ki mora pripadati klicatelju).

import { NextRequest, NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import { deliverToSubscriptions, pushAdmin, type PushSubscriptionRow } from '@/lib/push/deliver.server';
import { isPushConfigured } from '@/lib/push/webPush.server';
import { rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOCALES = ['sl', 'en', 'de', 'hr', 'it'] as const;

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('response' in auth) return auth.response;
  if (!isPushConfigured()) {
    return NextResponse.json({ ok: false, error: 'push_not_configured' }, { status: 503 });
  }

  // 20 na minuto na IP — testni gumb ni za vrtenje.
  const limit = await rateLimit(request, 'ai');
  if (!limit.success) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });

  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
  if (!endpoint) return NextResponse.json({ ok: false, error: 'endpoint required' }, { status: 400 });

  const admin = pushAdmin();
  const { data: sub } = await admin
    .from('push_subscriptions')
    .select('id, user_id, company_id, endpoint, p256dh, auth, locale, failure_count')
    .eq('endpoint', endpoint)
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (!sub) return NextResponse.json({ ok: false, error: 'not_subscribed' }, { status: 404 });

  const row = sub as PushSubscriptionRow;
  const locale = (LOCALES as readonly string[]).includes(row.locale ?? '') ? (row.locale as string) : 'sl';
  const t = await getTranslations({ locale, namespace: 'pwa' });

  const summary = await deliverToSubscriptions(admin, [row], () => ({
    title: t('push.testTitle'),
    body: t('push.testBody'),
    url: '/obvestila',
    tag: 'jedro-test',
    type: 'info',
    timestamp: Date.now(),
  }), { urgency: 'high', ttl: 60 * 10 });

  const result = summary.results[0];
  if (!result?.ok) {
    return NextResponse.json(
      { ok: false, error: result?.gone ? 'subscription_gone' : 'send_failed', status: result?.status ?? 0 },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
