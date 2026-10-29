// Dates on request cards and in the confirm sheet, in the app's language:
// "sre., 4. nov. – sob., 7. nov." instead of "2026-11-04 – 2026-11-07".

import { intlLocale } from '@/lib/format';

function toDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export function formatRequestRange(from: string, to: string, locale: string): string {
  const a = toDate(from);
  const b = toDate(to);
  if (!a) return from || '';
  const fmt = new Intl.DateTimeFormat(intlLocale(locale), { weekday: 'short', day: 'numeric', month: 'short' });
  if (!b || a.getTime() === b.getTime()) return fmt.format(a);
  return fmt.formatRange(a, b);
}

export function formatRequestDay(iso: string, locale: string): string {
  const d = toDate(iso);
  if (!d) return iso;
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
}
