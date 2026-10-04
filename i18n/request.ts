import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import { fullLocales } from './config';

type Messages = Record<string, unknown>;

/** Globoko združi prevode: manjkajoči ključi ostanejo iz `base`. */
function mergeMessages(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const prev = out[key];
    out[key] =
      value && typeof value === 'object' && !Array.isArray(value) && prev && typeof prev === 'object'
        ? mergeMessages(prev as Messages, value as Messages)
        : value;
  }
  return out;
}

/** Imenski prostori, ki so prevedeni tudi v hr/de/it. */
const PARTIAL_NAMESPACES = ['common', 'auth'] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }
  // Delno prevedeni jeziki naložijo osnovo iz angleščine.
  const base = (fullLocales as readonly string[]).includes(locale) ? locale : 'en';

  const [
    common, auth, onboarding, dashboard, appointments,
    clients, services, staff, analytics, communication,
    notifications, reminders, lostLeads, reservations,
    promotions, billing, settings, layout, resursi,
    zahteveTermini,
  ] = await Promise.all([
    import(`../messages/${base}/common.json`).then(m => m.default),
    import(`../messages/${base}/auth.json`).then(m => m.default),
    import(`../messages/${base}/onboarding.json`).then(m => m.default),
    import(`../messages/${base}/dashboard.json`).then(m => m.default),
    import(`../messages/${base}/appointments.json`).then(m => m.default),
    import(`../messages/${base}/clients.json`).then(m => m.default),
    import(`../messages/${base}/services.json`).then(m => m.default),
    import(`../messages/${base}/staff.json`).then(m => m.default),
    import(`../messages/${base}/analytics.json`).then(m => m.default),
    import(`../messages/${base}/communication.json`).then(m => m.default),
    import(`../messages/${base}/notifications.json`).then(m => m.default),
    import(`../messages/${base}/reminders.json`).then(m => m.default),
    import(`../messages/${base}/lost-leads.json`).then(m => m.default),
    import(`../messages/${base}/reservations.json`).then(m => m.default),
    import(`../messages/${base}/promotions.json`).then(m => m.default),
    import(`../messages/${base}/billing.json`).then(m => m.default),
    import(`../messages/${base}/settings.json`).then(m => m.default),
    import(`../messages/${base}/layout.json`).then(m => m.default),
    import(`../messages/${base}/resursi.json`).then(m => m.default),
    import(`../messages/${base}/zahteve-termini.json`).then(m => m.default),
  ]);

  // hr/de/it: vse iz angleščine, prevedeni imenski prostori se prekrijejo čez.
  if (!(fullLocales as readonly string[]).includes(locale)) {
    const partial = await Promise.all(
      PARTIAL_NAMESPACES.map((ns) => import(`../messages/${locale}/${ns}.json`).then((m) => m.default as Messages))
    );
    const [commonPartial, authPartial] = partial;
    return {
      locale,
      messages: {
        common: mergeMessages(common, commonPartial), auth: mergeMessages(auth, authPartial),
        onboarding, dashboard, appointments,
        clients, services, staff, analytics, communication,
        notifications, reminders, 'lost-leads': lostLeads, reservations,
        promotions, billing, settings, layout, resursi,
        'zahteve-termini': zahteveTermini,
      },
    };
  }

  return {
    locale,
    messages: {
      common, auth, onboarding, dashboard, appointments,
      clients, services, staff, analytics, communication,
      notifications, reminders, 'lost-leads': lostLeads, reservations,
      promotions, billing, settings, layout, resursi,
      'zahteve-termini': zahteveTermini,
    },
  };
});
