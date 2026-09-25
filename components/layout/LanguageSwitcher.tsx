'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCompany } from '@/app/company-context';
import type { Locale } from '@/i18n/config';
import LanguageSelect from '@/components/shared/LanguageSelect';

export function LanguageSwitcher() {
  const { companyId } = useCompany();

  // Also remember the choice for the company (best-effort).
  const savePreference = useCallback(
    async (next: Locale) => {
      if (!companyId) return;
      try {
        await createClient()
          .from('Podatki podjetij')
          .update({ preferred_language: next })
          .eq('ID Podjetja', companyId);
      } catch (e) {
        console.warn('Failed to save language preference:', e);
      }
    },
    [companyId]
  );

  return (
    <div className="px-4 py-2">
      <LanguageSelect fullWidth onChanged={savePreference} />
    </div>
  );
}
