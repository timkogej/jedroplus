import 'server-only';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';

type Locale = (typeof routing.locales)[number];

// Messages the API sends back to the app, in the signed-in user's language
// (the NEXT_LOCALE cookie the app sets), so an error is not Slovene for everyone.
export async function apiMessages(request: Request) {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)NEXT_LOCALE=([a-z]{2})/);
  const locale: Locale = match && (routing.locales as readonly string[]).includes(match[1])
    ? (match[1] as Locale)
    : routing.defaultLocale;
  return getTranslations({ locale, namespace: 'common.apiErrors' });
}
