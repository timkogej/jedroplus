// app/api/appointments/bulk-complete/route.ts
//
// Closes past appointments that were never closed, in one step and WITHOUT
// sending anything to clients.
//
// Why a route and not a loop in the browser: closing through n8n one appointment
// at a time runs the whole follow-up workflow per row (and the webhook is rate
// limited to 50 calls / 10 s), so a salon with a thousand old open appointments
// could not clear them. Here the status is written directly, so no follow-up
// message can go out — which is what we want for old history.
//
// Appointments that ended TODAY are handled by the caller through the normal
// ZAKLJUCITEV_TERMINA event when the owner wants those clients thanked.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireCompanyAccess, resolveUserCompany } from '@/lib/auth/apiAuth';

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

// Same set the Termini page treats as "still open". pending_payment is NOT
// here: an unpaid online booking must not be closed as if it had happened.
const OPEN_STATUSES = ['scheduled', 'confirmed', 'pending', 'načrtovan', 'potrjen'];
const CHUNK = 100;

/** Salon wall-clock "now": Datum and Čas are stored as local time, the server runs in UTC. */
function salonNow(): { dateStr: string; timeStr: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Ljubljana',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return { dateStr: `${get('year')}-${get('month')}-${get('day')}`, timeStr: `${get('hour')}:${get('minute')}` };
}

type Row = Record<string, unknown>;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    companyId?: string;
    dryRun?: boolean;
    includeToday?: boolean;
  } | null;
  const companyId = body?.companyId?.trim() ?? '';

  const access = await requireCompanyAccess(request, companyId);
  if ('response' in access) return access.response;

  // Only owners and admins may close the whole backlog.
  const db = admin();
  const { uuid } = await resolveUserCompany(access.user.id);
  const { data: member } = await db
    .from('company_members')
    .select('role')
    .eq('user_id', access.user.id)
    .eq('company_id', uuid ?? '')
    .maybeSingle();
  if (member?.role !== 'owner' && member?.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  // Page through the company's open appointments.
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('Termini')
      .select('id, Datum, "Čas", Konec, Status, belezi_termin')
      .eq('ID podjetja', companyId)
      .is('deleted_at', null)
      .range(from, from + 999);
    if (error) {
      console.error('[bulk-complete] load failed:', error.message);
      return NextResponse.json({ ok: false, error: 'Load failed' }, { status: 500 });
    }
    rows.push(...((data as Row[] | null) ?? []));
    if (!data || data.length < 1000) break;
  }

  const { dateStr: today, timeStr: now } = salonNow();
  const ids: Array<string | number> = [];
  let endedToday = 0;
  for (const row of rows) {
    const status = String(row.Status ?? '').toLowerCase().trim();
    if (!OPEN_STATUSES.includes(status)) continue;
    if (row.belezi_termin === false) continue; // placeholder slots are not real visits

    const datum = String(row.Datum ?? '').slice(0, 10);
    if (!datum) continue;

    if (datum < today) {
      ids.push(row.id as string | number);
    } else if (datum === today) {
      const end = String(row.Konec ?? row['Čas'] ?? '').slice(0, 5);
      if (end && end <= now) {
        endedToday += 1;
        if (body?.includeToday) ids.push(row.id as string | number);
      }
    }
  }

  if (body?.dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      beforeToday: ids.length - (body.includeToday ? endedToday : 0),
      endedToday,
    });
  }

  let completed = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    // Re-check the status in the write, so an appointment closed or cancelled
    // since we read it is not overwritten.
    const { data, error } = await db
      .from('Termini')
      .update({ Status: 'completed' })
      .eq('ID podjetja', companyId)
      .in('id', chunk)
      .in('Status', OPEN_STATUSES)
      .select('id');
    if (error) {
      console.error('[bulk-complete] update failed:', error.message);
      return NextResponse.json({ ok: false, error: 'Update failed', completed }, { status: 500 });
    }
    completed += data?.length ?? 0;
  }

  return NextResponse.json({ ok: true, completed, endedToday });
}
