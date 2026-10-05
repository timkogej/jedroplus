'use client';

import LanguageSelect from './LanguageSelect';

/**
 * Language picker for pages before login (login, sign-up, onboarding) and the
 * general settings page. Remembers the choice in the NEXT_LOCALE cookie so
 * later visits open in the same language.
 */
export default function PublicLanguageToggle({ className = '' }: { className?: string }) {
  return <LanguageSelect className={className} />;
}
