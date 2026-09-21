import { defineRouting } from 'next-intl/routing';
import { locales, defaultLocale, localePrefix } from './config';

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix,
  // Jedroplus is Slovenian-first: many Slovenian users run English browsers,
  // so don't guess from Accept-Language. English stays one click away
  // (PublicLanguageToggle / app bar), and the choice is kept in NEXT_LOCALE.
  localeDetection: false,
});
