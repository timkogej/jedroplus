import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  const [
    common, auth, onboarding, dashboard, appointments,
    clients, services, staff, analytics, communication,
    notifications, reminders, lostLeads, reservations,
    promotions, billing, settings, layout,
  ] = await Promise.all([
    import(`../messages/${locale}/common.json`).then(m => m.default),
    import(`../messages/${locale}/auth.json`).then(m => m.default),
    import(`../messages/${locale}/onboarding.json`).then(m => m.default),
    import(`../messages/${locale}/dashboard.json`).then(m => m.default),
    import(`../messages/${locale}/appointments.json`).then(m => m.default),
    import(`../messages/${locale}/clients.json`).then(m => m.default),
    import(`../messages/${locale}/services.json`).then(m => m.default),
    import(`../messages/${locale}/staff.json`).then(m => m.default),
    import(`../messages/${locale}/analytics.json`).then(m => m.default),
    import(`../messages/${locale}/communication.json`).then(m => m.default),
    import(`../messages/${locale}/notifications.json`).then(m => m.default),
    import(`../messages/${locale}/reminders.json`).then(m => m.default),
    import(`../messages/${locale}/lost-leads.json`).then(m => m.default),
    import(`../messages/${locale}/reservations.json`).then(m => m.default),
    import(`../messages/${locale}/promotions.json`).then(m => m.default),
    import(`../messages/${locale}/billing.json`).then(m => m.default),
    import(`../messages/${locale}/settings.json`).then(m => m.default),
    import(`../messages/${locale}/layout.json`).then(m => m.default),
  ]);

  return {
    locale,
    messages: {
      common, auth, onboarding, dashboard, appointments,
      clients, services, staff, analytics, communication,
      notifications, reminders, 'lost-leads': lostLeads, reservations,
      promotions, billing, settings, layout,
    },
  };
});
