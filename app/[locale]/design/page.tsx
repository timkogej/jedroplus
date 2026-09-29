'use client';

/**
 * ZAČASNA predogledna stran za redizajn.
 *
 * Obstaja samo zato, da je dashboard videti brez prijave in brez baze —
 * z izmišljenimi podatki. Ko je redizajn potrjen, se ta mapa zbriše.
 * Ni povezana v navigacijo in ne uporablja ProtectedLayout.
 */

import { motion } from 'motion/react';
import {
  CalendarCheck,
  Clock,
  UsersThree,
  CurrencyCircleDollar,
  Plus,
  UserPlus,
  ArrowRight,
} from '@phosphor-icons/react';
import Link from 'next/link';
import {
  AppointmentListCard,
  TopServicesCard,
  TopEmployeesCard,
  RecentActivityCard,
  WeeklyChart,
  Section,
  MetricGroup,
} from '@/components/dashboard';
import type {
  AppointmentItem,
  TopService,
  TopEmployee,
  RecentActivity,
  WeeklyChartData,
} from '@/lib/dashboard/fetchDashboardData';

const appt = (
  id: string,
  time: string,
  endTime: string,
  clientName: string,
  serviceName: string,
  employeeInitials: string,
  employeeColor: string,
  extra: Partial<AppointmentItem> = {},
): AppointmentItem =>
  ({
    id,
    time,
    endTime,
    clientName,
    serviceName,
    serviceColor: '#8B5CF6',
    employeeInitials,
    employeeColor,
    ...extra,
  }) as AppointmentItem;

const TODAY: AppointmentItem[] = [
  appt('1', '09:00', '09:45', 'Ana Kovač', 'Klasično striženje', 'MN', '#7C78FA', {
    datum: '2026-09-28',
    employeeName: 'Maja Novak',
    clientEmail: 'ana.kovac@example.com',
    clientPhone: '041 234 567',
    status: 'confirmed',
  }),
  appt('2', '10:00', '11:15', 'Marko Zupan', 'Barvanje in fen', 'JK', '#35E3DB', {
    serviceId2: 's2',
    datum: '2026-09-28',
    employeeName: 'Jaka Kos',
    clientEmail: 'marko.zupan@example.com',
    clientPhone: '031 887 210',
    addOnName: 'Nega las',
    addOnDuration: 15,
    addOnServiceColor: '#59AEEA',
    status: 'scheduled',
  }),
  appt('3', '11:30', '12:00', 'Petra Novak', 'Urejanje brade', 'MN', '#7C78FA'),
  appt('4', '13:00', '14:30', 'Luka Horvat', 'Barvanje pramenov', 'TS', '#59AEEA', {
    serviceId2: 's2',
    addOnName: 'Nega',
  }),
  appt('5', '15:00', '15:45', 'Nina Bizjak', 'Klasično striženje', 'JK', '#35E3DB'),
];

const TOMORROW: AppointmentItem[] = [
  appt('6', '08:30', '09:15', 'Tomaž Krajnc', 'Klasično striženje', 'TS', '#59AEEA'),
  appt('7', '10:00', '11:00', 'Sara Vidmar', 'Barvanje', 'MN', '#7C78FA'),
  appt('8', '12:00', '12:30', 'Jure Potočnik', 'Urejanje brade', 'JK', '#35E3DB'),
];

const WEEK: WeeklyChartData[] = [
  { day: 'Pon', date: '2026-09-22', termini: 8 },
  { day: 'Tor', date: '2026-09-23', termini: 12 },
  { day: 'Sre', date: '2026-09-24', termini: 6 },
  { day: 'Čet', date: '2026-09-25', termini: 14 },
  { day: 'Pet', date: '2026-09-26', termini: 17 },
  { day: 'Sob', date: '2026-09-27', termini: 9 },
  { day: 'Ned', date: '2026-09-28', termini: 0 },
];

const SERVICES: TopService[] = [
  { id: '1', name: 'Klasično striženje', color: '#7C78FA', count: 42, percentage: 46 },
  { id: '2', name: 'Barvanje in fen', color: '#35E3DB', count: 28, percentage: 31 },
  { id: '3', name: 'Urejanje brade', color: '#59AEEA', count: 21, percentage: 23 },
];

const EMPLOYEES: TopEmployee[] = [
  { id: '1', name: 'Maja Novak', initials: 'MN', color: '#7C78FA', appointmentCount: 38, percentage: 42 },
  { id: '2', name: 'Jaka Kos', initials: 'JK', color: '#35E3DB', appointmentCount: 31, percentage: 34 },
  { id: '3', name: 'Tina Svet', initials: 'TS', color: '#59AEEA', appointmentCount: 22, percentage: 24 },
];

const ACTIVITY: RecentActivity[] = [
  { id: '1', type: 'booking', description: 'Ana Kovač je rezervirala termin', timestamp: new Date(), timeAgo: 'pred 5 min' },
  { id: '2', type: 'completed', description: 'Marko Zupan — Barvanje in fen', timestamp: new Date(), timeAgo: 'pred 32 min' },
  { id: '3', type: 'client', description: 'Nova stranka: Nina Bizjak', timestamp: new Date(), timeAgo: 'pred 1 h' },
  { id: '4', type: 'cancellation', description: 'Luka Horvat je odpovedal termin', timestamp: new Date(), timeAgo: 'pred 2 h' },
];

export default function DesignPreviewPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Glava strani */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          className="mb-7"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
                Dobro jutro, Tim
              </h1>
              <p className="mt-0.5 text-base text-gray-500">ponedeljek, 28. september</p>
            </div>

            <div className="flex flex-wrap gap-2 sm:gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
              >
                <Plus size={17} weight="bold" />
                <span>Nov termin</span>
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100"
              >
                <UserPlus size={17} weight="regular" className="text-gray-500" />
                <span>Nova stranka</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Povzetek */}
        <div className="mb-10">
          <MetricGroup
            metrics={[
              { label: 'Termini danes', value: 5, caption: '2 še prosta', icon: CalendarCheck },
              { label: 'Aktivni termini', value: 23, caption: 'ta teden', icon: Clock },
              { label: 'Nove stranke', value: 12, caption: 'ta mesec', icon: UsersThree, trend: { value: 18, isPositive: true } },
              { label: 'Prihodek', value: '4.280 €', caption: 'ta mesec', icon: CurrencyCircleDollar, trend: { value: 7, isPositive: true } },
            ]}
          />
        </div>

        {/* Termini */}
        <div className="mb-10 grid grid-cols-1 items-start gap-x-6 gap-y-8 lg:grid-cols-2">
          <Section className="mb-0" title="Danes" subtitle="28. september" actionHref="#" actionLabel="Vsi">
            <AppointmentListCard appointments={TODAY} />
          </Section>
          <Section className="mb-0" title="Jutri" subtitle="29. september" actionHref="#" actionLabel="Vsi">
            <AppointmentListCard appointments={TOMORROW} />
          </Section>
        </div>

        {/* Teden */}
        <Section title="Pregled tedna" subtitle="Termini po dnevih" actionHref="#" actionLabel="Analitika">
          <WeeklyChart data={WEEK} />
        </Section>

        {/* Spodnja vrsta */}
        <div className="grid grid-cols-1 items-start gap-x-6 gap-y-8 lg:grid-cols-3">
          <Section className="mb-0" title="Najbolj iskano" subtitle="Ta mesec">
            <TopServicesCard services={SERVICES} />
          </Section>
          <Section className="mb-0" title="Zaposleni" subtitle="Po številu terminov">
            <TopEmployeesCard employees={EMPLOYEES} />
          </Section>
          <Section className="mb-0" title="Zadnje dogajanje" subtitle="Danes">
            <RecentActivityCard activities={ACTIVITY} />
          </Section>
        </div>

        {/* Noga */}
        <div className="hairline-t mt-12 flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-medium text-gray-900">Kam naprej?</h3>
            <p className="text-sm text-gray-500">Odpri koledar ali poglej podrobno analitiko.</p>
          </div>
          <div className="flex flex-shrink-0 gap-2">
            <Link
              href="#"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
            >
              Koledar
              <ArrowRight size={14} weight="bold" className="text-gray-400" />
            </Link>
            <Link
              href="#"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
            >
              Analitika
              <ArrowRight size={14} weight="bold" className="text-gray-400" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
