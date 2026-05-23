import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from './routing';

const namespaces = [
  'common', 'auth', 'onboarding', 'dashboard', 'appointments',
  'clients', 'services', 'staff', 'analytics', 'communication',
  'notifications', 'reminders', 'lost-leads', 'reservations',
  'promotions', 'billing', 'settings', 'layout',
] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages: Record<string, unknown> = {};
  for (const ns of namespaces) {
    messages[ns] = (await import(`../messages/${locale}/${ns}.json`)).default;
  }
  return { locale, messages };
});
