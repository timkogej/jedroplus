import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { Providers } from './providers';
import common from '@/messages/sl/common.json';
import auth from '@/messages/sl/auth.json';
import onboarding from '@/messages/sl/onboarding.json';
import dashboard from '@/messages/sl/dashboard.json';
import appointments from '@/messages/sl/appointments.json';
import clients from '@/messages/sl/clients.json';
import services from '@/messages/sl/services.json';
import staff from '@/messages/sl/staff.json';
import analytics from '@/messages/sl/analytics.json';
import communication from '@/messages/sl/communication.json';
import notifications from '@/messages/sl/notifications.json';
import reminders from '@/messages/sl/reminders.json';
import lostLeads from '@/messages/sl/lost-leads.json';
import reservations from '@/messages/sl/reservations.json';
import promotions from '@/messages/sl/promotions.json';
import billing from '@/messages/sl/billing.json';
import settings from '@/messages/sl/settings.json';
import layout from '@/messages/sl/layout.json';
import resursi from '@/messages/sl/resursi.json';

const messages = {
  common,
  auth,
  onboarding,
  dashboard,
  appointments,
  clients,
  services,
  staff,
  analytics,
  communication,
  notifications,
  reminders,
  'lost-leads': lostLeads,
  reservations,
  promotions,
  billing,
  settings,
  layout,
  resursi,
};

export function LegacyRouteProviders({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="sl" messages={messages}>
      <Providers>{children}</Providers>
    </NextIntlClientProvider>
  );
}
