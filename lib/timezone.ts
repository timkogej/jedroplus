// lib/timezone.ts
//
// "Today" and "now" in the company's time zone, not the machine's.
//
// Appointments are stored as wall-clock date + time ("Datum" + "Čas") in the
// company's time zone. The server (Vercel) runs in UTC, so `new Date()` there
// is up to two hours behind a Slovenian salon — between midnight and 2:00 the
// dashboard used to show yesterday as "today". Use these helpers wherever a
// date string is compared with "Datum".

import { DEFAULT_COUNTRY, isValidTimeZone } from './region';

export const DEFAULT_TIME_ZONE = DEFAULT_COUNTRY.timezone;

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let fmt = partsCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    partsCache.set(timeZone, fmt);
  }
  return fmt;
}

function safeZone(timeZone: string | null | undefined): string {
  return isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
}

/**
 * A Date whose local fields (getFullYear, getHours, … and date-fns `format`)
 * read as the wall clock in `timeZone`. Only for calendar maths and
 * formatting — don't send its timestamp anywhere.
 */
export function zonedNow(timeZone: string | null | undefined, at: Date = new Date()): Date {
  const parts: Record<string, number> = {};
  for (const p of formatterFor(safeZone(timeZone)).formatToParts(at)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

/** "yyyy-MM-dd" for today in `timeZone`. */
export function todayInTimeZone(timeZone: string | null | undefined, at: Date = new Date()): string {
  const d = zonedNow(timeZone, at);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
