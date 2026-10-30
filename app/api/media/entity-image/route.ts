// app/api/media/entity-image/route.ts
//
// Photo of a service or an employee: upload (POST) and remove (DELETE).
//
// The browser crops and shrinks the photo first (components/media), so what
// arrives here is a small webp/jpeg. The file goes into the public
// `booking-images` bucket and its public URL is written to
// "Storitve".slika_url or "Osebe".slika_url with the service-role client, so
// the browser never needs write access to storage or to those tables.
//
// Allowed: owners and admins, and staff whose role may edit services
// (for service photos) or staff (for staff photos).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, resolveUserCompany } from '@/lib/auth/apiAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const BUCKET = 'booking-images';
const MAX_BYTES = 2 * 1024 * 1024; // the browser sends ~100–300 KB; this is a safety cap
const ALLOWED: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

type Kind = 'service' | 'staff';

const TARGETS: Record<Kind, { table: string; refColumn: string; permissions: string[] }> = {
  service: { table: 'Storitve', refColumn: 'ID storitve', permissions: ['can_edit_services', 'can_create_services'] },
  staff: { table: 'Osebe', refColumn: 'ID osebe', permissions: ['can_edit_staff'] },
};

function adminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type Admin = ReturnType<typeof adminClient>;

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function parseKind(value: unknown): Kind | null {
  return value === 'service' || value === 'staff' ? value : null;
}

/** The user's company, if they may change photos of this kind. */
async function requireEditor(request: NextRequest, kind: Kind) {
  const auth = await authenticateRequest(request);
  if ('response' in auth) return auth;

  const { uuid: companyUuid, textId } = await resolveUserCompany(auth.user.id);
  if (!companyUuid || !textId) return { response: fail('Forbidden', 403) };

  const admin = adminClient();
  const { data: member } = await admin
    .from('company_members')
    .select('role')
    .eq('user_id', auth.user.id)
    .eq('company_id', companyUuid)
    .maybeSingle();

  const role = (member?.role as string | undefined) ?? null;
  let allowed = role === 'owner' || role === 'admin';

  if (!allowed && role === 'staff') {
    const { data: perms } = await admin
      .from('staff_role_permissions')
      .select('*')
      .eq('company_id', companyUuid)
      .maybeSingle();
    const row = (perms ?? {}) as Record<string, unknown>;
    allowed = TARGETS[kind].permissions.some((key) => row[key] === true);
  }

  if (!allowed) return { response: fail('Forbidden', 403) };
  return { textId, admin };
}

/**
 * Finds the row's numeric id inside the company. `id` is the row id; `ref` is
 * the text id ("ID storitve" / "ID osebe"), used right after creating a new
 * service or employee, when the page does not know the row id yet. The row is
 * written by n8n, so a fresh one may take a moment to appear.
 */
async function findRowId(
  admin: Admin,
  kind: Kind,
  textId: string,
  id: string | null,
  ref: string | null
): Promise<number | null> {
  const { table, refColumn } = TARGETS[kind];
  const attempts = id ? 1 : 6;

  for (let attempt = 0; attempt < attempts; attempt++) {
    let query = admin.from(table).select('id').eq('ID podjetja', textId).limit(1);
    if (id) {
      if (!/^\d+$/.test(id)) return null;
      query = query.eq('id', Number(id));
    } else if (ref) {
      query = query.eq(refColumn, ref);
    } else {
      return null;
    }

    const { data } = await query;
    const rowId = (data?.[0] as { id?: number } | undefined)?.id;
    if (rowId != null) return rowId;
    if (attempt < attempts - 1) await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

/** Deletes this row's photos except `keepPath`. */
async function removeOldFiles(admin: Admin, textId: string, kind: Kind, rowId: number, keepPath: string | null) {
  const prefix = `${kind}-${rowId}-`;
  const { data: files } = await admin.storage.from(BUCKET).list(textId, { search: prefix, limit: 100 });
  const stale = (files ?? [])
    .filter((f) => f.name.startsWith(prefix))
    .map((f) => `${textId}/${f.name}`)
    .filter((p) => p !== keepPath);
  if (stale.length > 0) {
    await admin.storage.from(BUCKET).remove(stale);
  }
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const kind = parseKind(form?.get('kind'));
  if (!kind) return fail('kind_required', 400);

  const access = await requireEditor(request, kind);
  if ('response' in access) return access.response;
  const { textId, admin } = access;

  const file = form?.get('file');
  if (!(file instanceof File)) return fail('file_required', 400);

  const ext = ALLOWED[file.type];
  if (!ext) return fail('unsupported_type', 415);
  if (file.size > MAX_BYTES) return fail('too_large', 413);

  const id = typeof form?.get('id') === 'string' ? String(form?.get('id')).trim() || null : null;
  const ref = typeof form?.get('ref') === 'string' ? String(form?.get('ref')).trim() || null : null;

  const rowId = await findRowId(admin, kind, textId, id, ref);
  if (rowId == null) return fail('not_found', 404);

  // The timestamp makes every replacement a new URL, so no cache shows the old photo.
  const path = `${textId}/${kind}-${rowId}-${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true, cacheControl: '31536000' });

  if (uploadError) {
    console.error('[api/media/entity-image] upload failed:', uploadError.message);
    return fail('upload_failed', 502);
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  const url = pub.publicUrl;

  const { error: updateError } = await admin
    .from(TARGETS[kind].table)
    .update({ slika_url: url })
    .eq('id', rowId)
    .eq('ID podjetja', textId);

  if (updateError) {
    console.error('[api/media/entity-image] saving slika_url failed:', updateError.message);
    await admin.storage.from(BUCKET).remove([path]);
    return fail('save_failed', 502);
  }

  await removeOldFiles(admin, textId, kind, rowId, path);

  return NextResponse.json({ ok: true, url });
}

export async function DELETE(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const kind = parseKind(params.get('kind'));
  if (!kind) return fail('kind_required', 400);

  const access = await requireEditor(request, kind);
  if ('response' in access) return access.response;
  const { textId, admin } = access;

  const rowId = await findRowId(admin, kind, textId, params.get('id'), params.get('ref'));
  if (rowId == null) return fail('not_found', 404);

  const { error } = await admin
    .from(TARGETS[kind].table)
    .update({ slika_url: null })
    .eq('id', rowId)
    .eq('ID podjetja', textId);

  if (error) {
    console.error('[api/media/entity-image] clearing slika_url failed:', error.message);
    return fail('save_failed', 502);
  }

  await removeOldFiles(admin, textId, kind, rowId, null);

  return NextResponse.json({ ok: true });
}
