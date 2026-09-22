'use client';

import { useCallback } from 'react';
import { useLocale } from 'next-intl';
import { formatMoney, formatCount, formatDateShort, formatDateLong } from '@/lib/format';

/** Locale-aware formatters for client components. */
export function useFormat() {
  const locale = useLocale();
  return {
    locale,
    money: useCallback(
      (amount: number | string | null | undefined, opts?: { currency?: string | null; whole?: boolean }) =>
        formatMoney(amount, locale, opts),
      [locale]
    ),
    count: useCallback((value: number) => formatCount(value, locale), [locale]),
    dateShort: useCallback((iso: string | Date | null | undefined) => formatDateShort(iso, locale), [locale]),
    dateLong: useCallback((iso: string | Date | null | undefined) => formatDateLong(iso, locale), [locale]),
  };
}
