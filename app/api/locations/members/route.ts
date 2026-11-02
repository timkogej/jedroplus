// app/api/locations/members/route.ts
//
// Which locations a team member may use. Only the owner changes this.
//
//   GET                                  -> { access: { [userId]: locationId[] } }
//                                           members missing from the map see every location
//   PUT { user_id, locations: string[] } -> sets the member's locations
//
// A member with no rows in Clani_Lokacije sees every location (the default, and
// the only case for a single-location company). Choosing every active location
// is therefore stored as "no rows", so a location added later is included
// automatically. The owner always sees every location and cannot be limited.
// The database (jp_ima_dostop_do_lokacije) and /api/webhook enforce the choice.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, resolveUserCompany } from '@/lib/auth/apiAuth';
import { adminClient } from '@/lib/auth/ownerAccess';

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

/** The company (uuid and text id) if the caller is its owner, else a response. */
async function requireOwner(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('response' in auth) return { response: auth.response };
  const { uuid, textId } = await resolveUserCompany(auth.user.id);
  if (!uuid || !textId) return { response: fail('Forbidden', 403) };

  const admin = adminClient();
  const { data: member } = await admin
    .from('company_members').select('role')
    .eq('user_id', auth.user.id).eq('company_id', uuid).maybeSingle();
  if (member?.role !== 'owner') return { response: fail('Forbidden', 403) };
  return { uuid, textId, admin };
}

export async function GET(request: NextRequest) {
  const access = await requireOwner(request);
  if ('response' in access) return access.response;
  const { uuid, admin } = access;

  const { data, error } = await admin
    .from('Clani_Lokacije').select('user_id, lokacija_id').eq('company_id', uuid);
  if (error) {
    console.error('[api/locations/members] read failed:', error.message);
    return fail('read_failed', 502);
  }
  const map: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const userId = String(row.user_id);
    (map[userId] ??= []).push(String(row.lokacija_id));
  }
  return NextResponse.json({ ok: true, access: map });
}

export async function PUT(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { user_id?: unknown; locations?: unknown } | null;
  const userId = typeof body?.user_id === 'string' ? body.user_id : null;
  if (!body || !userId || !Array.isArray(body.locations)) return fail('invalid_body', 400);
  const wanted = Array.from(new Set(body.locations.filter((v): v is string => typeof v === 'string')));
  if (wanted.length === 0) return fail('no_location', 400);

  const access = await requireOwner(request);
  if ('response' in access) return access.response;
  const { uuid, textId, admin } = access;

  const { data: target } = await admin
    .from('company_members').select('role')
    .eq('user_id', userId).eq('company_id', uuid).maybeSingle();
  if (!target) return fail('not_found', 404);
  if (target.role === 'owner') return fail('owner_not_limited', 400);

  const { data: activeRows } = await admin
    .from('Lokacije').select('id').eq('ID podjetja', textId).eq('status', 'active');
  const active = (activeRows ?? []).map((l) => String(l.id));
  if (!wanted.every((id) => active.includes(id))) return fail('invalid_location', 400);

  const { error: delError } = await admin
    .from('Clani_Lokacije').delete().eq('company_id', uuid).eq('user_id', userId);
  if (delError) {
    console.error('[api/locations/members] delete failed:', delError.message);
    return fail('save_failed', 502);
  }

  const everywhere = wanted.length === active.length;
  if (!everywhere) {
    const rows = wanted.map((lokacija_id) => ({ company_id: uuid, user_id: userId, lokacija_id }));
    const { error } = await admin.from('Clani_Lokacije').insert(rows);
    if (error) {
      console.error('[api/locations/members] insert failed:', error.message);
      return fail('save_failed', 502);
    }
  }
  return NextResponse.json({ ok: true });
}
