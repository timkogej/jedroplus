// app/api/cron/auto-complete/route.ts
//
// Runner for "close appointments automatically N hours after they end".
// Meant to be called every 15–30 minutes: `Authorization: Bearer $CRON_SECRET`
// (what Vercel Cron sends) or `X-API-Key: $N8N_WEBHOOK_API_KEY` (what n8n sends).
//
// A due appointment is closed through the SAME event as a manual click
// (ZAKLJUCITEV_TERMINA on main_povezava), so n8n sets the status and sends the
// after-appointment message by its usual rules (channel, template, and
// po_terminu_max_dni). Nothing is written to Termini from here.
//
// Guard rails:
//  - Only companies that switched it on (samodejni_zakljucek_ur > 0).
//  - Only appointments that ended between N hours and 48 hours ago. An older
//    backlog is never touched here — that is what the "Zaključi vse" button is
//    for — so switching the setting on cannot mass-close history.
//  - Open statuses only; pending_payment and non-recorded slots are skipped.
//  - Appointments without a client id are skipped: the workflow looks the client
//    up first and would stop before closing, so they would be retried for 48 h.
//  - A cap per run, a pause between calls, and the run stops after repeated
//    failures so a sick n8n is not hammered. Whatever was not closed is simply
//    picked up next run.
//  - n8n acknowledges the webhook before the workflow finishes, so "sent" below
//    means accepted by n8n. An appointment that was not really closed is still
//    open and is retried by the next run; the workflow ignores already closed
//    ones, so a retry cannot send the message twice.
//  - ?dryRun=1 lists what would be closed and calls nothing.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';

const N8N_URL = process.env.N8N_MAIN_WEBHOOK_URL || 'https://n8n.jedroplus.com/webhook/main_povezava';
const OPEN_STATUSES = ['scheduled', 'confirmed', 'pending', 'načrtovan', 'potrjen'];
const MAX_AGE_HOURS = 48;
const MAX_PER_RUN = 30;
const MAX_FAILURES = 3;
// n8n answers the webhook immediately and works in the background, so calls
// made back to back would start dozens of executions at once on a small server.
const PAUSE_MS = 800;

// 30 calls plus pauses is well past the 10 s default.
export const maxDuration = 60;

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

type Row = Record<string, unknown>;

/** "YYYY-MM-DD HH:MM" in salon time for a moment `hoursAgo` hours back. */
function salonStamp(hoursAgo: number): string {
  const at = new Date(Date.now() - hoursAgo * 3600_000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Ljubljana',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

function sameSecret(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  // Two ways in: Vercel Cron / curl with the bearer CRON_SECRET, or n8n with the
  // same X-API-Key it already uses for main_povezava (so its existing credential
  // can be reused and no second secret has to be copied around).
  const cronSecret = process.env.CRON_SECRET;
  const n8nKey = process.env.N8N_WEBHOOK_API_KEY;
  if (!cronSecret && !n8nKey) {
    return NextResponse.json({ ok: false, error: 'No secret configured' }, { status: 503 });
  }
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  const authorized =
    sameSecret(bearer, cronSecret) || sameSecret(request.headers.get('x-api-key'), n8nKey);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1';
  const db = admin();

  const { data: companies, error: companiesError } = await db
    .from('Podatki podjetij')
    .select('"ID Podjetja", samodejni_zakljucek_ur')
    .gt('samodejni_zakljucek_ur', 0);
  if (companiesError) {
    // Most likely the migration has not been run yet: nothing to do.
    return NextResponse.json({ ok: true, skipped: 'setting not available', detail: companiesError.message });
  }

  const report: Array<{ company: string; hours: number; due: number; sent: number; failed: number }> = [];
  let processed = 0;
  let failures = 0;
  const apiKey = process.env.N8N_WEBHOOK_API_KEY;

  outer: for (const company of (companies as Row[] | null) ?? []) {
    const companyId = String(company['ID Podjetja']);
    const hours = Number(company.samodejni_zakljucek_ur);
    const dueBy = salonStamp(hours);
    const notOlderThan = salonStamp(MAX_AGE_HOURS);

    // Narrow by date first; the exact hour check is done on the combined stamp.
    const { data: rows, error } = await db
      .from('Termini')
      .select('id, "ID stranke", Datum, "Čas", Konec, Status, belezi_termin')
      .eq('ID podjetja', companyId)
      .is('deleted_at', null)
      .gte('Datum', notOlderThan.slice(0, 10))
      .lte('Datum', dueBy.slice(0, 10));
    if (error) {
      console.error('[cron/auto-complete] load failed:', companyId, error.message);
      continue;
    }

    const due = ((rows as Row[] | null) ?? []).filter((row) => {
      const status = String(row.Status ?? '').toLowerCase().trim();
      if (!OPEN_STATUSES.includes(status)) return false;
      if (row.belezi_termin === false) return false;
      const datum = String(row.Datum ?? '').slice(0, 10);
      const end = String(row.Konec ?? row['Čas'] ?? '').slice(0, 5);
      if (!datum || !end) return false;
      if (!String(row['ID stranke'] ?? '').trim()) return false;
      const stamp = `${datum} ${end}`;
      return stamp <= dueBy && stamp >= notOlderThan;
    });

    const entry = { company: companyId, hours, due: due.length, sent: 0, failed: 0 };
    report.push(entry);
    if (dryRun) continue;

    for (const row of due) {
      if (processed >= MAX_PER_RUN || failures >= MAX_FAILURES) break outer;
      if (processed > 0) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
      processed += 1;
      try {
        const response = await fetch(N8N_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { 'X-API-Key': apiKey } : {}),
          },
          body: JSON.stringify({
            event: 'ZAKLJUCITEV_TERMINA',
            entity: 'appointments',
            company_id: companyId,
            actor: 'sistem',
            timestamp: new Date().toISOString(),
            meta: { app: 'Integrate', version: '1.0' },
            data: {
              company_id: companyId,
              user_id: 'sistem',
              podatkiTermina: {
                id: row.id,
                stranka_id: row['ID stranke'] ?? null,
                // The workflow copies this into "Opombe po" (notes written at completion),
                // so the booking's own notes must not be passed here.
                opombe: null,
                completion_notes: null,
              },
            },
          }),
        });
        if (!response.ok) throw new Error(`n8n ${response.status}`);
        entry.sent += 1;
        failures = 0;
      } catch (err) {
        entry.failed += 1;
        failures += 1;
        console.error('[cron/auto-complete] close failed:', companyId, row.id, err);
      }
    }
  }

  return NextResponse.json({ ok: true, dryRun, processed, stoppedEarly: failures >= MAX_FAILURES, report });
}
