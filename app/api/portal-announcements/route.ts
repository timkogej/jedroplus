import { NextRequest, NextResponse } from 'next/server';
import { ANNOUNCEMENT_BUCKET, announcementAdmin, imageBytes, recipientExists, requireAnnouncementPublisher } from '@/lib/portalAnnouncementsServer';

export const runtime = 'nodejs';

type FormValues = { title: string; body: string; audience: 'all' | 'customer'; recipientEmail: string | null; file: File | null; removeImage: boolean; publish: boolean };

function parseForm(form: FormData): FormValues | null {
  const title = String(form.get('title') ?? '').trim();
  const body = String(form.get('body') ?? '').trim();
  const audience = form.get('audience');
  const email = String(form.get('recipient_email') ?? '').trim().toLowerCase();
  const file = form.get('image');
  if (!title || title.length > 120 || !body || body.length > 5000) return null;
  if (audience !== 'all' && audience !== 'customer') return null;
  if (audience === 'customer' && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) return null;
  if (file !== null && !(file instanceof File)) return null;
  return {
    title, body, audience, recipientEmail: audience === 'customer' ? email : null,
    file: file instanceof File && file.size > 0 ? file : null,
    removeImage: form.get('remove_image') === 'true', publish: form.get('publish') === 'true',
  };
}

async function signedImage(db: ReturnType<typeof announcementAdmin>, path: string | null) {
  if (!path) return null;
  const { data } = await db.storage.from(ANNOUNCEMENT_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function GET(request: NextRequest) {
  const access = await requireAnnouncementPublisher(request);
  if ('response' in access) return access.response;
  const { data, error } = await access.db.from('portal_announcements')
    .select('id,title,body,audience,recipient_email,image_path,status,published_at,created_at,email_status,email_result')
    .eq('company_id', access.companyId).order('created_at', { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: 'Could not load announcements' }, { status: 502 });
  const announcements = await Promise.all((data ?? []).map(async (item) => ({
    ...item, image_url: await signedImage(access.db, item.image_path),
  })));
  return NextResponse.json({ ok: true, announcements }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const access = await requireAnnouncementPublisher(request);
  if ('response' in access) return access.response;
  const form = await request.formData().catch(() => null);
  const values = form && parseForm(form);
  if (!values) return NextResponse.json({ error: 'Invalid announcement' }, { status: 400 });
  try {
    if (values.recipientEmail && !await recipientExists(access.db, access.companyId, values.recipientEmail)) {
      return NextResponse.json({ error: 'Customer email not found' }, { status: 400 });
    }
    let imagePath: string | null = null;
    if (values.file) {
      const image = await imageBytes(values.file);
      if (!image) return NextResponse.json({ error: 'Invalid image' }, { status: 415 });
      imagePath = `${access.companyId}/${crypto.randomUUID()}.${image.extension}`;
      const { error } = await access.db.storage.from(ANNOUNCEMENT_BUCKET)
        .upload(imagePath, image.bytes, { contentType: image.mime, upsert: false });
      if (error) return NextResponse.json({ error: 'Could not upload image' }, { status: 502 });
    }
    const { data, error } = await access.db.from('portal_announcements').insert({
      company_id: access.companyId, created_by: access.userId,
      title: values.title, body: values.body, audience: values.audience,
      recipient_email: values.recipientEmail, image_path: imagePath,
      status: values.publish ? 'published' : 'draft',
      published_at: values.publish ? new Date().toISOString() : null,
    }).select('id').single();
    if (error) {
      if (imagePath) await access.db.storage.from(ANNOUNCEMENT_BUCKET).remove([imagePath]);
      throw error;
    }
    return NextResponse.json({ ok: true, id: data.id });
  } catch {
    return NextResponse.json({ error: 'Could not save announcement' }, { status: 502 });
  }
}

export async function PUT(request: NextRequest) {
  const access = await requireAnnouncementPublisher(request);
  if ('response' in access) return access.response;
  const form = await request.formData().catch(() => null);
  const values = form && parseForm(form);
  const id = form?.get('id');
  if (!values || typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid announcement' }, { status: 400 });
  }
  const { data: existing, error: lookupError } = await access.db.from('portal_announcements')
    .select('id,status,image_path').eq('company_id', access.companyId).eq('id', id).maybeSingle();
  if (lookupError) return NextResponse.json({ error: 'Could not load announcement' }, { status: 502 });
  if (!existing || existing.status !== 'draft') return NextResponse.json({ error: 'Only drafts can be edited' }, { status: 409 });
  try {
    if (values.recipientEmail && !await recipientExists(access.db, access.companyId, values.recipientEmail)) {
      return NextResponse.json({ error: 'Customer email not found' }, { status: 400 });
    }
    let imagePath: string | null = values.removeImage ? null : existing.image_path;
    if (values.file) {
      const image = await imageBytes(values.file);
      if (!image) return NextResponse.json({ error: 'Invalid image' }, { status: 415 });
      imagePath = `${access.companyId}/${crypto.randomUUID()}.${image.extension}`;
      const { error } = await access.db.storage.from(ANNOUNCEMENT_BUCKET)
        .upload(imagePath, image.bytes, { contentType: image.mime, upsert: false });
      if (error) return NextResponse.json({ error: 'Could not upload image' }, { status: 502 });
    }
    const { data: updated, error } = await access.db.from('portal_announcements').update({
      title: values.title, body: values.body, audience: values.audience,
      recipient_email: values.recipientEmail, image_path: imagePath,
      status: values.publish ? 'published' : 'draft',
      published_at: values.publish ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('company_id', access.companyId).eq('id', id).eq('status', 'draft').select('id').maybeSingle();
    if (error || !updated) {
      if (imagePath && imagePath !== existing.image_path) await access.db.storage.from(ANNOUNCEMENT_BUCKET).remove([imagePath]);
      return NextResponse.json({ error: 'Could not update draft' }, { status: 409 });
    }
    if (existing.image_path && existing.image_path !== imagePath) {
      await access.db.storage.from(ANNOUNCEMENT_BUCKET).remove([existing.image_path]);
    }
    return NextResponse.json({ ok: true, id });
  } catch {
    return NextResponse.json({ error: 'Could not update draft' }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requireAnnouncementPublisher(request);
  if ('response' in access) return access.response;
  const body = await request.json().catch(() => null);
  if (typeof body?.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id) || !['publish', 'archive'].includes(body.action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
  const { data: existing, error: lookupError } = await access.db.from('portal_announcements')
    .select('status,recipient_email').eq('company_id', access.companyId).eq('id', body.id).maybeSingle();
  if (lookupError) return NextResponse.json({ error: 'Could not load announcement' }, { status: 502 });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (body.action === 'publish' && existing.status === 'draft') {
    if (existing.recipient_email && !await recipientExists(access.db, access.companyId, existing.recipient_email)) {
      return NextResponse.json({ error: 'Customer email not found' }, { status: 409 });
    }
    const { data: updated, error } = await access.db.from('portal_announcements').update({
      status: 'published', published_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('company_id', access.companyId).eq('id', body.id).eq('status', 'draft').select('id').maybeSingle();
    if (error || !updated) return NextResponse.json({ error: 'Could not publish' }, { status: 409 });
    return NextResponse.json({ ok: true });
  }
  if (body.action === 'archive' && existing.status === 'published') {
    const { data: updated, error } = await access.db.from('portal_announcements').update({
      status: 'archived', updated_at: new Date().toISOString(),
    }).eq('company_id', access.companyId).eq('id', body.id).eq('status', 'published').select('id').maybeSingle();
    if (error || !updated) return NextResponse.json({ error: 'Could not archive' }, { status: 409 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Invalid state' }, { status: 409 });
}

export async function DELETE(request: NextRequest) {
  const access = await requireAnnouncementPublisher(request);
  if ('response' in access) return access.response;
  const id = request.nextUrl.searchParams.get('id');
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const { data, error } = await access.db.from('portal_announcements').delete()
    .eq('company_id', access.companyId).eq('id', id).eq('status', 'draft').select('image_path').maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not delete draft' }, { status: 502 });
  if (!data) return NextResponse.json({ error: 'Only drafts can be deleted' }, { status: 409 });
  if (data.image_path) await access.db.storage.from(ANNOUNCEMENT_BUCKET).remove([data.image_path]);
  return NextResponse.json({ ok: true });
}
