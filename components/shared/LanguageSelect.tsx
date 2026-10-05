'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { CaretDown, Globe } from '@phosphor-icons/react';
import { useRouter, usePathname } from '@/i18n/navigation';
import { LOCALE_NAMES, locales, type Locale } from '@/i18n/config';

type Props = {
  className?: string;
  /** Stretch to the parent's width (e.g. inside the profile menu). */
  fullWidth?: boolean;
  /** Extra work after the switch, e.g. saving the preference. */
  onChanged?: (next: Locale) => void | Promise<void>;
};

/**
 * Compact language picker: shows the current language and opens the list on
 * click. A native <select> sits on top of the styled button, so phones get
 * their own picker and keyboards/screen readers work without extra code.
 * The choice is kept in the NEXT_LOCALE cookie for later visits.
 */
export default function LanguageSelect({ className = '', fullWidth = false, onChanged }: Props) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const change = (next: Locale) => {
    if (next === locale) return;
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=${60 * 60 * 24 * 365}`;
    startTransition(async () => {
      router.replace(pathname, { locale: next });
      await onChanged?.(next);
    });
  };

  return (
    // Outer div takes the caller's placement classes (e.g. "absolute right-4
    // top-4"); the inner one needs `relative` for the invisible <select>.
    <div className={`${fullWidth ? 'w-full' : 'inline-flex'} ${className}`}>
    <div
      className={`relative inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:border-gray-300 focus-within:ring-2 focus-within:ring-violet-200 ${
        fullWidth ? 'w-full' : ''
      } ${isPending ? 'opacity-60' : ''}`}
    >
      <Globe className="h-4 w-4 flex-shrink-0 text-gray-400" weight="regular" aria-hidden="true" />
      <span className="flex-1 truncate">{LOCALE_NAMES[locale]}</span>
      <CaretDown className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" weight="bold" aria-hidden="true" />
      <select
        value={locale}
        onChange={(e) => change(e.target.value as Locale)}
        disabled={isPending}
        aria-label="Jezik / Language / Sprache / Lingua"
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {LOCALE_NAMES[code]}
          </option>
        ))}
      </select>
    </div>
    </div>
  );
}
