// app/api/push/notify/route.ts
//
// Kliče ga trigger jp_push_on_notification (pg_net) ob vsakem novem zapisu v
// notifications. Zaščiten s skupno skrivnostjo PUSH_WEBHOOK_SECRET (glava
// x-jedro-push-secret). Telo nosi samo id; vsebino preberemo iz baze, zato
// klicatelj ne more podtakniti svojega besedila.

import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { deliverNotification } from '@/lib/push/deliver.server';
import { isPushConfigured } from '@/lib/push/webPush.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secretMatches(given: string | null): boolean {
  const expected = process.env.PUSH_WEBHOOK_SECRET?.trim();
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!secretMatches(request.headers.get('x-jedro-push-secret'))) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json({ ok: false, error: 'push_not_configured' }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { notification_id?: unknown; record?: { id?: unknown } } | null;
  // notification_id iz našega triggerja; record.id, če Tim namesto njega
  // nastavi Supabase Database Webhook.
  const id = String(body?.notification_id ?? body?.record?.id ?? '');
  if (!UUID.test(id)) {
    return NextResponse.json({ ok: false, error: 'notification_id required' }, { status: 400 });
  }

  try {
    const result = await deliverNotification(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[api/push/notify]', err);
    return NextResponse.json({ ok: false, error: 'delivery_failed' }, { status: 500 });
  }
}
