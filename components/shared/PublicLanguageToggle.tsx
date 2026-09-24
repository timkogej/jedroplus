'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useTransition } from 'react';
import { LOCALE_NAMES, locales, type Locale } from '@/i18n/config';

const LANGUAGES = locales.map((code) => ({ code, label: code.toUpperCase(), name: LOCALE_NAMES[code] }));

/**
 * Language switch for pages before login (login, sign-up, onboarding), where
 * the in-app switcher in the app bar isn't available. Remembers the choice in
 * the NEXT_LOCALE cookie so later visits open in the same language.
 */
export default function PublicLanguageToggle({ className = '' }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const change = (next: Locale) => {
    if (next === locale) return;
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=${60 * 60 * 24 * 365}`;
    startTransition(() => router.replace(pathname, { locale: next }));
  };

  return (
    <div
      role="group"
      aria-label="Jezik / Language / Sprache / Lingua"
      className={`inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-xs font-semibold ${className}`}
    >
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => change(lang.code)}
          disabled={isPending}
          aria-pressed={lang.code === locale}
          title={lang.name}
          className={`rounded-md px-2.5 py-1 transition-colors ${
            lang.code === locale ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
