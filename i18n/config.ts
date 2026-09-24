export const locales = ['sl', 'en', 'de'] as const;
// Next: 'hr', 'it' (messages/<locale>/*.json must be complete first).

/** Names in their own language, for the language switchers. */
export const LOCALE_NAMES: Record<(typeof locales)[number], string> = {
  sl: 'Slovenščina',
  en: 'English',
  de: 'Deutsch',
};

/** "/de/koledar" → "/koledar"; paths without a locale prefix are returned as is. */
export function stripLocalePrefix(pathname: string): string {
  const match = pathname.match(new RegExp(`^/(${locales.join('|')})(?=/|$)`));
  return match ? pathname.slice(match[0].length) || '/' : pathname;
}

export const defaultLocale = 'sl' as const;
export const localePrefix = 'always' as const;

export type Locale = (typeof locales)[number];
