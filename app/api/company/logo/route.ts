// app/api/company/logo/route.ts
//
// Company logo: upload (POST) and remove (DELETE). Owners and admins only.
//
// The file goes into the public `company-logos` bucket and the public URL is
// written to "Podatki podjetij".logo_url with the service-role client, so the
// browser never needs write access to storage or to that table.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, resolveUserCompany } from '@/lib/auth/apiAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const BUCKET = 'company-logos';
const MAX_BYTES = 1024 * 1024; // 1 MB
const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

function adminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Owner/admin of a company, or a ready-to-return error response. */
async function requireOwnerOrAdmin(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('response' in auth) return auth;

  const { uuid: companyUuid, textId } = await resolveUserCompany(auth.user.id);
  if (!companyUuid || !textId) {
    return { response: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 }) };
  }

  const admin = adminClient();
  const { data: member } = await admin
    .from('company_members')
    .select('role')
    .eq('user_id', auth.user.id)
    .eq('company_id', companyUuid)
    .maybeSingle();

  const role = (member?.role as string | undefined) ?? null;
  if (role !== 'owner' && role !== 'admin') {
    return { response: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 }) };
  }

  return { companyUuid, textId, admin };
}

export async function POST(request: NextRequest) {
  const access = await requireOwnerOrAdmin(request);
  if ('response' in access) return access.response;
  const { textId, admin } = access;

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'file_required' }, { status: 400 });
  }

  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ ok: false, error: 'unsupported_type' }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: 'too_large' }, { status: 413 });
  }

  // One file per company; the timestamp busts caches on replacement.
  const path = `${textId}/logo-${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true, cacheControl: '3600' });

  if (uploadError) {
    console.error('[api/company/logo] upload failed:', uploadError.message);
    return NextResponse.json({ ok: false, error: 'upload_failed' }, { status: 502 });
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  const logoUrl = pub.publicUrl;

  const { error: updateError } = await admin
    .from('Podatki podjetij')
    .update({ logo_url: logoUrl })
    .eq('ID Podjetja', textId);

  if (updateError) {
    console.error('[api/company/logo] saving logo_url failed:', updateError.message);
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 502 });
  }

  await removeOldFiles(admin, textId, path);

  return NextResponse.json({ ok: true, url: logoUrl });
}

export async function DELETE(request: NextRequest) {
  const access = await requireOwnerOrAdmin(request);
  if ('response' in access) return access.response;
  const { textId, admin } = access;

  await removeOldFiles(admin, textId, null);

  const { error } = await admin
    .from('Podatki podjetij')
    .update({ logo_url: null })
    .eq('ID Podjetja', textId);

  if (error) {
    console.error('[api/company/logo] clearing logo_url failed:', error.message);
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

/** Deletes every file in the company's folder except `keepPath`. */
async function removeOldFiles(
  admin: ReturnType<typeof adminClient>,
  textId: string,
  keepPath: string | null
) {
  const { data: files } = await admin.storage.from(BUCKET).list(textId);
  const stale = (files ?? [])
    .map((f) => `${textId}/${f.name}`)
    .filter((p) => p !== keepPath);
  if (stale.length > 0) {
    await admin.storage.from(BUCKET).remove(stale);
  }
}
