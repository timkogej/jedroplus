'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCompany } from '@/app/company-context';

const LANGUAGES = [
  { code: 'sl', label: 'Slovenščina' },
  { code: 'en', label: 'English' },
] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { companyId } = useCompany();
  const [isPending, startTransition] = useTransition();

  const handleChange = (newLocale: string) => {
    if (newLocale === locale) return;

    startTransition(async () => {
      // 1. Update URL with new locale
      router.replace(pathname, { locale: newLocale as 'sl' | 'en' });

      // 2. Set cookie for anonymous future visits
      document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=${60 * 60 * 24 * 365}`;

      // 3. Save to Supabase for logged-in users (best-effort)
      try {
        const supabase = createClient();
        if (companyId) {
          await supabase
            .from('Podatki podjetij')
            .update({ preferred_language: newLocale })
            .eq('company_id', companyId);
        }
      } catch (e) {
        console.warn('Failed to save language preference:', e);
      }
    });
  };

  return (
    <div className="px-3 py-2">
      <div className="text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">
        Jezik / Language
      </div>
      <div className="flex flex-col gap-0.5">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleChange(lang.code)}
            disabled={isPending || lang.code === locale}
            className={`text-left px-2 py-1.5 rounded-lg text-sm transition-colors ${
              lang.code === locale
                ? 'bg-violet-50 text-violet-700 font-medium cursor-default'
                : 'hover:bg-gray-50 text-gray-700 cursor-pointer'
            } disabled:opacity-60`}
          >
            {lang.label}
            {lang.code === locale && (
              <span className="ml-2 text-xs text-violet-500">✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
