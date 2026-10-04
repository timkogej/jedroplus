export const locales = ['sl', 'en', 'hr', 'de', 'it'] as const;

/**
 * Jeziki, v katere je preveden celoten vmesnik. Ostali (hr, de, it) imajo
 * zaenkrat prevedene le strani pred prijavo (prijava, registracija, geslo);
 * vse drugo zanje pade nazaj na angleščino, proxy pa jih s strani v
 * aplikaciji preusmeri na /en.
 */
export const fullLocales = ['sl', 'en'] as const;

/** Poti (brez jezika), ki so prevedene v vse jezike. */
export const publicAuthPaths = ['/login', '/signup', '/forgot-password', '/auth'] as const;

export const defaultLocale = 'sl' as const;
export const localePrefix = 'always' as const;

export type Locale = (typeof locales)[number];
