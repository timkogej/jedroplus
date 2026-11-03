// app/api/locations/assign/route.ts
//
// Which locations a team member works at / where a service is offered.
// Called by the staff and service forms after the row itself has been saved
// (by n8n), so a fresh row may take a moment to appear — same approach as
// app/api/media/entity-image.
//
//   GET ?kind=staff|service&id=rowId   -> { locations: string[] } (active ids)
//   PUT { kind: 'staff' | 'service', id?: rowId, ref?: "ID osebe"/"ID storitve",
//         locations: string[] }
//
// staff:   Osebe_Lokacije holds exactly the chosen locations (at least one).
// service: Storitve_Lokacije holds the chosen locations, or nothing when all
//          active locations are chosen (no rows = offered everywhere, so a
//          location added later includes the service automatically).

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, resolveUserCompany } from '@/lib/auth/apiAuth';
import { adminClient } from '@/lib/auth/ownerAccess';

type Kind = 'staff' | 'service';

const TARGETS: Record<Kind, {
  table: string; refColumn: string; link: string; permissions: string[];
}> = {
  staff: { table: 'Osebe', refColumn: 'ID osebe', link: 'Osebe_Lokacije', permissions: ['can_edit_staff'] },
  service: {
    table: 'Storitve', refColumn: 'ID storitve', link: 'Storitve_Lokacije',
    permissions: ['can_edit_services', 'can_create_services'],
  },
};

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

type Admin = ReturnType<typeof adminClient>;

/** The caller's company if they may edit this kind of row, else a response. */
async function authorize(request: NextRequest, kind: Kind, write: boolean) {
  const auth = await authenticateRequest(request);
  if ('response' in auth) return { response: auth.response };
  const { uuid: companyUuid, textId } = await resolveUserCompany(auth.user.id);
  if (!companyUuid || !textId) return { response: fail('Forbidden', 403) };

  const admin = adminClient();
  const { data: member } = await admin
    .from('company_members').select('role')
    .eq('user_id', auth.user.id).eq('company_id', companyUuid).maybeSingle();
  const role = (member?.role as string | undefined) ?? null;
  if (!role) return { response: fail('Forbidden', 403) };
  if (!write) return { textId, admin };

  let allowed = role === 'owner' || role === 'admin';
  if (!allowed && role === 'staff') {
    const { data: perms } = await admin
      .from('staff_role_permissions').select('*').eq('company_id', companyUuid).maybeSingle();
    const row = (perms ?? {}) as Record<string, unknown>;
    allowed = TARGETS[kind].permissions.some((key) => row[key] === true);
  }
  return allowed ? { textId, admin } : { response: fail('Forbidden', 403) };
}

/**
 * "ID osebe" / "ID storitve" of a row. `id` is what the forms hold: usually the
 * row id, but a form may also hold the text id itself, so both are tried (the
 * text id first, which is unambiguous). `ref` is the text id of a row n8n has
 * just written, so it is retried until the row appears.
 */
async function findEntityId(
  admin: Admin, kind: Kind, textId: string, id: unknown, ref: unknown
): Promise<string | null> {
  const target = TARGETS[kind];
  const idText = (typeof id === 'string' || typeof id === 'number') && String(id).trim() ? String(id).trim() : null;
  const refText = typeof ref === 'string' && ref.trim() ? ref.trim() : null;
  if (!idText && !refText) return null;

  const lookup = async (column: string, value: string | number): Promise<string | null> => {
    // The column name has a space; postgrest-js drops unquoted spaces from select().
    const { data } = await admin.from(target.table).select(`"${target.refColumn}"`)
      .eq('ID podjetja', textId).eq(column, value).limit(1);
    const found = (data?.[0] as unknown as Record<string, unknown> | undefined)?.[target.refColumn];
    return typeof found === 'string' ? found : null;
  };

  if (idText) {
    const byText = await lookup(target.refColumn, idText);
    if (byText) return byText;
    if (/^\d+$/.test(idText)) {
      const byRow = await lookup('id', Number(idText));
      if (byRow) return byRow;
    }
    if (!refText) return null;
  }
  for (let attempt = 0; attempt < 6; attempt++) {
    const found = await lookup(target.refColumn, refText as string);
    if (found) return found;
    if (attempt < 5) await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

async function activeLocationIds(admin: Admin, textId: string): Promise<string[]> {
  const { data } = await admin.from('Lokacije').select('id').eq('ID podjetja', textId).eq('status', 'active');
  return (data ?? []).map((l) => String(l.id));
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const kind = params.get('kind') === 'staff' ? 'staff' : params.get('kind') === 'service' ? 'service' : null;
  if (!kind) return fail('invalid_body', 400);
  const access = await authorize(request, kind, false);
  if ('response' in access) return access.response;
  const { textId, admin } = access;

  const entityId = await findEntityId(admin, kind, textId, params.get('id'), null);
  if (!entityId) return fail('not_found', 404);

  const active = await activeLocationIds(admin, textId);
  const { data } = await admin
    .from(TARGETS[kind].link).select('lokacija_id')
    .eq('ID podjetja', textId).eq(TARGETS[kind].refColumn, entityId);
  const linked = (data ?? []).map((r) => String(r.lokacija_id)).filter((id) => active.includes(id));
  // A service without rows is offered everywhere.
  const locations = kind === 'service' && linked.length === 0 ? active : linked;
  return NextResponse.json({ ok: true, locations });
}

export async function PUT(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    kind?: unknown; id?: unknown; ref?: unknown; locations?: unknown;
  } | null;
  const kind = body?.kind === 'staff' || body?.kind === 'service' ? body.kind : null;
  if (!body || !kind || !Array.isArray(body.locations)) return fail('invalid_body', 400);
  const wanted = Array.from(new Set(body.locations.filter((v): v is string => typeof v === 'string')));
  if (wanted.length === 0) return fail('no_location', 400);

  const access = await authorize(request, kind, true);
  if ('response' in access) return access.response;
  const { textId, admin } = access;
  const target = TARGETS[kind];

  const active = await activeLocationIds(admin, textId);
  if (!wanted.every((id) => active.includes(id))) return fail('invalid_location', 400);

  const entityId = await findEntityId(admin, kind, textId, body.id, body.ref);
  if (!entityId) return fail('not_found', 404);

  const idColumn = target.refColumn;
  const { error: delError } = await admin
    .from(target.link).delete().eq('ID podjetja', textId).eq(idColumn, entityId);
  if (delError) {
    console.error('[api/locations/assign] delete failed:', delError.message);
    return fail('save_failed', 502);
  }

  // A service offered at every active location is stored as "no rows".
  const everywhere = kind === 'service' && wanted.length === active.length;
  if (!everywhere) {
    const rows = wanted.map((lokacija_id) => ({ 'ID podjetja': textId, [idColumn]: entityId, lokacija_id }));
    const { error } = await admin.from(target.link).insert(rows);
    if (error) {
      console.error('[api/locations/assign] insert failed:', error.message);
      return fail('save_failed', 502);
    }
  }
  return NextResponse.json({ ok: true });
}
