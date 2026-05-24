export const locales = ['sl', 'en'] as const;
// Future locales (uncomment to enable):
// export const locales = ['sl', 'en', 'hr', 'de', 'it'] as const;

export const defaultLocale = 'sl' as const;
export const localePrefix = 'always' as const;

export type Locale = (typeof locales)[number];
