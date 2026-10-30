// lib/push/deliver.server.ts
//
// Pošlje en zapis iz `notifications` kot push vsem napravam, ki ga smejo
// prejeti:
//   - recipient_user_id nastavljen → samo naprave tega uporabnika,
//   - recipient_user_id prazen    → naprave vseh članov podjetja.
// Tako velja ista izbira prejemnikov, kot jo naredi pisalec (npr. n8n
// Booking upošteva "booking_notify_target", Receptionist+ pa lastnike in
// administratorje). Naprave uporabnika, ki ni več član podjetja, preskočimo.

import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { humanizeDates } from '@/lib/format';
import { safeNotificationHref } from '@/lib/notifications/href';
import { sendPush, type SendResult } from '@/lib/push/webPush.server';

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  company_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: string | null;
  failure_count: number;
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
  type: string;
  notificationId?: string;
  badgeCount?: number;
  timestamp: number;
  requireInteraction?: boolean;
}

// Po toliko zaporednih neuspehih (ne 404/410) naročnino opustimo.
const MAX_FAILURES = 10;

export function pushAdmin(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+\n/g, '\n').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Pošlje sporočilo na naštete naprave in pospravi neveljavne naročnine. */
export async function deliverToSubscriptions(
  admin: SupabaseClient,
  subs: PushSubscriptionRow[],
  build: (sub: PushSubscriptionRow) => PushMessage,
  options: { urgency?: 'normal' | 'high'; ttl?: number } = {},
) {
  const results = await Promise.all(
    subs.map(async (sub) => ({
      sub,
      result: await sendPush(sub, build(sub), { urgency: options.urgency, ttl: options.ttl }),
    })),
  );

  const now = new Date().toISOString();
  const goneIds = results
    .filter(({ sub, result }) => result.gone || (!result.ok && sub.failure_count + 1 >= MAX_FAILURES))
    .map(({ sub }) => sub.id);
  const okIds = results.filter(({ result }) => result.ok).map(({ sub }) => sub.id);
  const failed = results.filter(({ sub, result }) => !result.ok && !goneIds.includes(sub.id));

  await Promise.all([
    goneIds.length ? admin.from('push_subscriptions').delete().in('id', goneIds) : null,
    okIds.length
      ? admin.from('push_subscriptions').update({ last_success_at: now, failure_count: 0 }).in('id', okIds)
      : null,
    ...failed.map(({ sub }) =>
      admin.from('push_subscriptions').update({ failure_count: sub.failure_count + 1 }).eq('id', sub.id),
    ),
  ]);

  for (const { sub, result } of results) {
    if (!result.ok) {
      console.warn('[push] send failed', { sub: sub.id, status: result.status, gone: result.gone, error: result.error });
    }
  }

  return {
    sent: okIds.length,
    removed: goneIds.length,
    failed: failed.length,
    results: results.map(({ sub, result }): { id: string } & SendResult => ({ id: sub.id, ...result })),
  };
}

const HIGH_URGENCY_TYPES = new Set(['appointment_booked', 'appointment_cancelled', 'appointment_updated', 'booking_request']);

/** Pošlje push za en zapis iz notifications (po id). */
export async function deliverNotification(notificationId: string) {
  const admin = pushAdmin();

  const { data: n, error } = await admin
    .from('notifications')
    .select('id, company_id, recipient_user_id, type, title, body, action_url, entity_type, entity_id, metadata, is_read, is_archived, expires_at, created_at')
    .eq('id', notificationId)
    .maybeSingle();
  if (error) throw new Error(`load notification: ${error.message}`);
  if (!n) return { skipped: 'not_found' as const };
  if (n.is_archived || n.is_read) return { skipped: 'already_handled' as const };
  if (n.expires_at && new Date(n.expires_at).getTime() < Date.now()) return { skipped: 'expired' as const };

  let query = admin
    .from('push_subscriptions')
    .select('id, user_id, company_id, endpoint, p256dh, auth, locale, failure_count')
    .eq('company_id', n.company_id);
  if (n.recipient_user_id) query = query.eq('user_id', n.recipient_user_id);
  const { data: subs, error: subsError } = await query;
  if (subsError) throw new Error(`load subscriptions: ${subsError.message}`);
  if (!subs?.length) return { skipped: 'no_devices' as const };

  const { data: members } = await admin
    .from('company_members')
    .select('user_id')
    .eq('company_id', n.company_id);
  const memberIds = new Set((members ?? []).map((m) => m.user_id as string));
  const allowed = (subs as PushSubscriptionRow[]).filter((s) => memberIds.has(s.user_id));
  if (!allowed.length) return { skipped: 'no_members' as const };

  // Številka na ikoni aplikacije = neprebrana obvestila, kot v aplikaciji.
  const { count: unread } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', n.company_id)
    .eq('is_read', false)
    .eq('is_archived', false);

  const url = safeNotificationHref(n);
  const type = String(n.type ?? 'info');
  const summary = await deliverToSubscriptions(
    admin,
    allowed,
    (sub) => {
      const locale = sub.locale ?? 'sl';
      return {
        title: clip(humanizeDates(String(n.title ?? 'Jedro+'), locale), 120),
        body: clip(humanizeDates(String(n.body ?? ''), locale), 600),
        url,
        tag: `n-${n.id}`,
        type,
        notificationId: String(n.id),
        badgeCount: unread ?? undefined,
        timestamp: new Date(n.created_at ?? Date.now()).getTime(),
        // Klic, ki čaka na povratni klic, naj ostane na zaslonu, dokler ga lastnik ne vidi.
        requireInteraction: n.entity_type === 'receptionist_call',
      };
    },
    {
      urgency: HIGH_URGENCY_TYPES.has(type) || n.entity_type === 'receptionist_call' ? 'high' : 'normal',
      ttl: 24 * 60 * 60,
    },
  );
  return { ...summary, results: undefined };
}
