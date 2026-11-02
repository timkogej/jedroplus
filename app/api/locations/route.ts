// app/api/locations/route.ts
//
// Company locations ("Lokacije"). Owners and admins only; written with the
// service-role client, same as the other company-settings routes.
//
//   GET    list the company's locations plus the limit (plan + purchased)
//   POST   create a location (the database trigger enforces the limit)
//   PATCH  edit fields, or { id, action: 'archive' | 'restore' | 'make_main' }
//
// Rules:
//  - The main location cannot be archived (switch the main one first).
//  - A location with upcoming appointments cannot be archived.
//  - Archived locations stay in the database; nothing is ever deleted.

import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/auth/ownerAccess';
import { locationFromRow, type LocationInput } from '@/types/locations';

const LIMIT_ERROR_CODE = 'P0001';

function str(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed.slice(0, max);
}

/** Validates the editable fields; returns the column update or an error code. */
function parseInput(body: LocationInput): { update: Record<string, unknown> } | { error: string } {
  const update: Record<string, unknown> = {};

  const naziv = str(body.naziv, 120);
  if (body.naziv !== undefined) {
    if (!naziv) return { error: 'invalid_name' };
    update.naziv = naziv;
  }
  for (const key of ['naslov', 'telefon', 'email', 'povezava_ocena'] as const) {
    if (body[key] !== undefined) {
      const v = str(body[key], key === 'povezava_ocena' ? 500 : 200);
      update[key] = v ?? null;
    }
  }
  if (body.urnik !== undefined) {
    if (body.urnik === null || body.urnik === '') {
      update.urnik = null;
    } else {
      try {
        const parsed = typeof body.urnik === 'string' ? JSON.parse(body.urnik) : null;
        if (!parsed || typeof parsed !== 'object') return { error: 'invalid_schedule' };
        update.urnik = JSON.stringify(parsed);
      } catch {
        return { error: 'invalid_schedule' };
      }
    }
  }
  if (body.cas_poti_min !== undefined) {
    const n = Number(body.cas_poti_min);
    if (!Number.isInteger(n) || n < 0 || n > 240) return { error: 'invalid_travel_time' };
    update.cas_poti_min = n;
  }
  if (body.zaporedje !== undefined) {
    const n = Number(body.zaporedje);
    if (!Number.isInteger(n) || n < 0 || n > 1000) return { error: 'invalid_order' };
    update.zaporedje = n;
  }
  return { update };
}

export async function GET(request: NextRequest) {
  const access = await requireOwnerOrAdmin(request);
  if ('response' in access) return access.response;
  const { textId, admin } = access;

  const [{ data, error }, { data: max }] = await Promise.all([
    admin.from('Lokacije').select('*').eq('ID podjetja', textId)
      .order('je_glavna', { ascending: false }).order('zaporedje').order('created_at'),
    admin.rpc('jp_max_lokacij', { p_company: textId }),
  ]);
  if (error) {
    console.error('[api/locations] list failed:', error.message);
    return NextResponse.json({ ok: false, error: 'load_failed' }, { status: 502 });
  }

  const locations = (data ?? []).map(locationFromRow);
  return NextResponse.json({
    ok: true,
    locations,
    max: typeof max === 'number' ? max : 1,
    active: locations.filter((l) => l.status === 'active').length,
  });
}

export async function POST(request: NextRequest) {
  const access = await requireOwnerOrAdmin(request);
  if ('response' in access) return access.response;
  const { textId, admin } = access;

  const body = (await request.json().catch(() => null)) as LocationInput | null;
  if (!body || typeof body !== 'object' || !str(body.naziv, 120)) {
    return NextResponse.json({ ok: false, error: 'invalid_name' }, { status: 400 });
  }
  const parsed = parseInput(body);
  if ('error' in parsed) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

  const { data, error } = await admin
    .from('Lokacije')
    .insert({ ...parsed.update, 'ID podjetja': textId })
    .select('*')
    .single();

  if (error) {
    if (error.code === LIMIT_ERROR_CODE) {
      return NextResponse.json({ ok: false, error: 'limit_reached' }, { status: 409 });
    }
    console.error('[api/locations] create failed:', error.message);
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, location: locationFromRow(data) });
}

type PatchBody = LocationInput & { id?: unknown; action?: unknown };

export async function PATCH(request: NextRequest) {
  const access = await requireOwnerOrAdmin(request);
  if ('response' in access) return access.response;
  const { textId, admin } = access;

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body || typeof body !== 'object' || typeof body.id !== 'string') {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const { data: current } = await admin
    .from('Lokacije').select('*').eq('id', body.id).eq('ID podjetja', textId).maybeSingle();
  if (!current) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  const action = body.action;

  if (action === 'make_main') {
    const { error } = await admin.rpc('jp_nastavi_glavno_lokacijo', {
      p_company: textId, p_lokacija: body.id,
    });
    if (error) {
      console.error('[api/locations] make_main failed:', error.message);
      return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'archive') {
    if (current.je_glavna) {
      return NextResponse.json({ ok: false, error: 'main_cannot_be_archived' }, { status: 409 });
    }
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await admin
      .from('Termini')
      .select('id', { count: 'exact', head: true })
      .eq('ID podjetja', textId)
      .eq('lokacija_id', body.id)
      .gte('Datum', today)
      .is('deleted_at', null)
      .not('Status', 'in', '(cancelled,completed,no_show)');
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { ok: false, error: 'has_upcoming_appointments', count },
        { status: 409 }
      );
    }
    const { error } = await admin
      .from('Lokacije').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', body.id);
    if (error) {
      console.error('[api/locations] archive failed:', error.message);
      return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'restore') {
    const { error } = await admin
      .from('Lokacije').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', body.id);
    if (error) {
      if (error.code === LIMIT_ERROR_CODE) {
        return NextResponse.json({ ok: false, error: 'limit_reached' }, { status: 409 });
      }
      console.error('[api/locations] restore failed:', error.message);
      return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action !== undefined) {
    return NextResponse.json({ ok: false, error: 'invalid_action' }, { status: 400 });
  }

  const parsed = parseInput(body);
  if ('error' in parsed) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  if (Object.keys(parsed.update).length === 0) {
    return NextResponse.json({ ok: false, error: 'nothing_to_update' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('Lokacije')
    .update({ ...parsed.update, updated_at: new Date().toISOString() })
    .eq('id', body.id)
    .select('*')
    .single();
  if (error) {
    console.error('[api/locations] update failed:', error.message);
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, location: locationFromRow(data) });
}
