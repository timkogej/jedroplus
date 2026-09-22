// lib/format.ts
//
// Money and dates the way people read them in their language:
// sl → "60,00 €", "22. sep. 2026"; en → "€60.00", "22 Sept 2026".
// Use these instead of `toFixed(2) + ' €'` so every screen agrees.

const INTL_LOCALE: Record<string, string> = { sl: 'sl-SI', en: 'en-GB' };

export function intlLocale(locale: string | undefined): string {
  return INTL_LOCALE[locale ?? 'sl'] ?? locale ?? 'sl-SI';
}

const moneyCache = new Map<string, Intl.NumberFormat>();

/**
 * Formats an amount of money. `whole: true` drops ",00" for round amounts
 * (plan prices: "19 €"), but keeps cents when there are any ("4,50 €").
 */
export function formatMoney(
  amount: number | string | null | undefined,
  locale = 'sl',
  { currency = 'EUR', whole = false }: { currency?: string | null; whole?: boolean } = {}
): string {
  const value = typeof amount === 'string' ? Number(amount) : amount ?? 0;
  const safe = Number.isFinite(value) ? (value as number) : 0;
  const code = (currency || 'EUR').trim().toUpperCase();
  const dropCents = whole && Number.isInteger(safe);
  const key = `${locale}|${code}|${dropCents}`;
  let fmt = moneyCache.get(key);
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat(intlLocale(locale), {
        style: 'currency',
        currency: code,
        minimumFractionDigits: dropCents ? 0 : 2,
        maximumFractionDigits: dropCents ? 0 : 2,
      });
    } catch {
      // unknown currency code — fall back to euro
      fmt = new Intl.NumberFormat(intlLocale(locale), { style: 'currency', currency: 'EUR' });
    }
    moneyCache.set(key, fmt);
  }
  return fmt.format(safe);
}

/** Whole-number counts with the locale's thousands separator ("1.000"). */
export function formatCount(value: number, locale = 'sl'): string {
  return value.toLocaleString(intlLocale(locale));
}

/** "22. 9. 2026" (sl) / "22/09/2026" (en). */
export function formatDateShort(iso: string | Date | null | undefined, locale = 'sl'): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'numeric', year: 'numeric' });
}

/** "22. september 2026" (sl) / "22 September 2026" (en). */
export function formatDateLong(iso: string | Date | null | undefined, locale = 'sl'): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Notification texts come from the backend with raw ISO dates
 * ("Termin 2026-09-28 ob 10:00:00"). Show them the way people write them.
 */
export function humanizeDates(text: string | null | undefined, locale = 'sl'): string {
  if (!text) return '';
  return text
    .replace(/\b(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?\b/g, (match, y, m, d, hh, mm) => {
      const date = new Date(Number(y), Number(m) - 1, Number(d));
      if (Number.isNaN(date.getTime())) return match;
      const day = date.toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'numeric', year: 'numeric' });
      return hh ? `${day} ${hh}:${mm}` : day;
    })
    .replace(/\b(\d{1,2}):(\d{2}):\d{2}\b/g, '$1:$2');
}
