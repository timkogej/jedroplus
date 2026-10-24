import { NextRequest, NextResponse } from 'next/server';
import { announcementAdmin, requireAnnouncementPublisher } from '@/lib/portalAnnouncementsServer';
import { selectPortalEmailRecipientIds, type PortalEmailRecipientRow } from '@/lib/portalAnnouncementRecipients';

export const maxDuration = 60;
const EMAIL_ENDPOINT = 'https://n8n.jedroplus.com/webhook/communication/send';

type Announcement = { id: string; title: string; audience: string; recipient_email: string | null; status: string; email_status: string };

async function getAnnouncement(db: ReturnType<typeof announcementAdmin>, companyId: string, id: string) {
  const { data, error } = await db.from('portal_announcements')
    .select('id,title,audience,recipient_email,status,email_status')
    .eq('company_id', companyId).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Announcement | null;
}

async function getRecipients(db: ReturnType<typeof announcementAdmin>, companyId: string, item: Announcement) {
  let query = db.from('Stranke')
    .select('id,"Email stranke",marketing_consent,marketing_opt_out_at', { count: 'exact' })
    .eq('ID Podjetja', companyId)
    .not('Email stranke', 'is', null);
  if (item.audience === 'customer' && item.recipient_email) {
    query = query.ilike('Email stranke', item.recipient_email.replace(/[\\%_]/g, '\\$&'));
  }
  const { data, count, error } = await query.range(0, 1999);
  if (error) throw error;
  if ((count ?? 0) > 2000) throw new Error('too_many_recipients');
  return { ids: selectPortalEmailRecipientIds((data ?? []) as PortalEmailRecipientRow[], item.recipient_email), total: count ?? 0 };
}

function validId(id: unknown): id is string {
  return typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);
}

export async function GET(request: NextRequest) {
  const access = await requireAnnouncementPublisher(request);
  if ('response' in access) return access.response;
  const id = request.nextUrl.searchParams.get('id');
  if (!validId(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  try {
    const item = await getAnnouncement(access.db, access.companyId, id);
    if (!item || item.status !== 'published') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const recipients = await getRecipients(access.db, access.companyId, item);
    return NextResponse.json({ ok: true, eligible: recipients.ids.length, total: recipients.total, email_status: item.email_status }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message === 'too_many_recipients') {
      return NextResponse.json({ error: 'Too many recipients for one email batch' }, { status: 413 });
    }
    return NextResponse.json({ error: 'Could not check recipients' }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const access = await requireAnnouncementPublisher(request);
  if ('response' in access) return access.response;
  const body = await request.json().catch(() => null);
  const id = body?.id;
  if (!validId(id) || body?.confirm !== true || !Number.isSafeInteger(body?.expected_count) || body.expected_count < 1) {
    return NextResponse.json({ error: 'Explicit confirmation required' }, { status: 400 });
  }
  const key = process.env.N8N_WEBHOOK_API_KEY;
  if (!key) return NextResponse.json({ error: 'Email service unavailable' }, { status: 503 });
  try {
    const item = await getAnnouncement(access.db, access.companyId, id);
    if (!item || item.status !== 'published') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (item.email_status !== 'not_requested') return NextResponse.json({ error: 'Email already attempted' }, { status: 409 });
    const recipients = await getRecipients(access.db, access.companyId, item);
    if (!recipients.ids.length) return NextResponse.json({ error: 'No eligible email recipients' }, { status: 409 });
    if (recipients.ids.length !== body.expected_count) {
      return NextResponse.json({ error: 'Recipient count changed; review again' }, { status: 409 });
    }
    const { data: company } = await access.db.from('Podatki podjetij').select('slug')
      .eq('ID Podjetja', access.companyId).maybeSingle();
    const slug = company?.slug;
    if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) {
      return NextResponse.json({ error: 'No portal link' }, { status: 409 });
    }
    const portalBase = (process.env.CUSTOMER_PORTAL_BASE_URL ?? 'https://portal.jedroplus.com').replace(/\/$/, '');
    const portalLink = `${portalBase}/manage/${slug}`;
    const { data: claimed, error: claimError } = await access.db.from('portal_announcements').update({
      email_status: 'sending', email_attempted_at: new Date().toISOString(),
    }).eq('company_id', access.companyId).eq('id', id).eq('status', 'published')
      .eq('email_status', 'not_requested').select('id').maybeSingle();
    if (claimError || !claimed) return NextResponse.json({ error: 'Email already attempted' }, { status: 409 });

    let emailStatus: 'sent' | 'partial' | 'failed' | 'uncertain' = 'uncertain';
    let result: Record<string, number> = { requested: recipients.ids.length, sent: 0, skipped: 0 };
    try {
      const payload = {
        event: 'POSLJI_SPOROCILO', entity: 'communication', company_id: access.companyId,
        user_id: access.userId, actor: access.userId, timestamp: new Date().toISOString(),
        data: {
          company_id: access.companyId, subject: item.title,
          message: `Novo obvestilo v vašem portalu:\n\n${item.title}\n\nPreberite ga tukaj: ${portalLink}`,
          client_ids: recipients.ids,
        },
      };
      const response = await fetch(EMAIL_ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(45000),
      });
      const data = await response.json().catch(() => null) as { ok?: boolean; totals?: { requested?: number; sent?: number; skipped?: number } } | null;
      if (response.ok && data?.ok !== false && data?.totals && Number.isFinite(data.totals.sent)) {
        result = {
          requested: recipients.ids.length,
          sent: Math.max(0, Number(data.totals.sent)),
          skipped: Math.max(0, Number(data.totals.skipped ?? 0)),
        };
        emailStatus = result.sent === recipients.ids.length ? 'sent' : result.sent > 0 ? 'partial' : 'failed';
      } else if (!response.ok || data?.ok === false) {
        emailStatus = 'failed';
      }
    } catch {
      // A timeout may still mean the remote system accepted the batch. Never
      // silently retry it and risk sending duplicate email to customers.
      emailStatus = 'uncertain';
    }
    const { error: saveError } = await access.db.from('portal_announcements').update({
      email_status: emailStatus, email_result: result, updated_at: new Date().toISOString(),
    }).eq('company_id', access.companyId).eq('id', id).eq('email_status', 'sending');
    if (saveError) return NextResponse.json({ error: 'Email status could not be saved' }, { status: 502 });
    return NextResponse.json({ ok: true, email_status: emailStatus, totals: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'too_many_recipients') {
      return NextResponse.json({ error: 'Too many recipients for one email batch' }, { status: 413 });
    }
    return NextResponse.json({ error: 'Could not send email' }, { status: 502 });
  }
}
