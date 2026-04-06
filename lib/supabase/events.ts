import { supabase } from '@/lib/supabaseClient';
import type { CalendarEvent } from '@/types/events';

// If the 'events' table doesn't exist we skip all future queries to avoid
// repeated 400 errors on every calendar view/date change.
let eventsTableMissing = false;

/**
 * Fetch events from Supabase for the active company within the visible date range.
 *
 * Overlap logic:
 *   - event starts on or before the end of the visible range (event_date <= dateTo)
 *   - AND the event's end date (or event_date for single-day) is on or after the range start (>= dateFrom)
 *
 * Note: We do NOT filter by is_visible or status at DB level because n8n may write
 * those columns with varying formats (null, 'ACTIVE', 1, etc.). We filter in JS instead.
 */
export async function fetchEvents(
  companyId: string,
  dateFrom: string,
  dateTo: string,
): Promise<{ data: CalendarEvent[] | null; error: Error | null }> {
  if (eventsTableMissing) {
    return { data: [], error: null };
  }

  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('company_id', companyId)
      .lte('event_date', dateTo);

    if (error) {
      // Supabase error code 42P01 = table does not exist
      if (error.code === '42P01' || error.message?.includes('relation "events" does not exist')) {
        eventsTableMissing = true;
        return { data: [], error: null };
      }
      console.warn('[fetchEvents] Supabase error:', error.message);
      return { data: null, error: new Error(error.message) };
    }

    const filtered = (data ?? []).filter((row) => {
      // Date overlap: event must reach into visible range
      const endDate: string = (row.end_date as string | null) ?? (row.event_date as string);
      if (endDate < dateFrom) return false;

      // Exclude explicitly hidden events (is_visible === false or 0)
      const vis = row.is_visible;
      if (vis === false || vis === 0 || vis === 'false') return false;

      // Exclude explicitly cancelled/deleted events
      const status = String(row.status ?? '').toLowerCase();
      if (status === 'cancelled' || status === 'deleted' || status === 'inactive') return false;

      return true;
    });

    console.log(`[fetchEvents] company=${companyId} range=${dateFrom}→${dateTo} raw=${data?.length ?? 0} filtered=${filtered.length}`);

    return { data: filtered as CalendarEvent[], error: null };
  } catch (err) {
    console.error('[fetchEvents] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch events'),
    };
  }
}

/**
 * Send an event webhook payload directly to the internal API proxy.
 * Uses the exact payload structure required (all fields top-level).
 */
export async function sendEventWebhook(
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch('/api/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Webhook failed',
    };
  }
}
