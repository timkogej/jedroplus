// A new locale needs a complete messages/<locale>/*.json first
// (check with scripts/check-messages.mjs).
export const locales = ['sl', 'en', 'de', 'hr', 'it'] as const;

/** Names in their own language, for the language switchers. */
export const LOCALE_NAMES: Record<(typeof locales)[number], string> = {
  sl: 'Slovenščina',
  en: 'English',
  de: 'Deutsch',
  hr: 'Hrvatski',
  it: 'Italiano',
};

/** "/de/koledar" → "/koledar"; paths without a locale prefix are returned as is. */
export function stripLocalePrefix(pathname: string): string {
  const match = pathname.match(new RegExp(`^/(${locales.join('|')})(?=/|$)`));
  return match ? pathname.slice(match[0].length) || '/' : pathname;
}

export const defaultLocale = 'sl' as const;
export const localePrefix = 'always' as const;

export type Locale = (typeof locales)[number];
