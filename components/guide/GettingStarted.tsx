'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle, Circle, ArrowRight, X } from '@phosphor-icons/react';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { useRolePermissions } from '@/app/role-permission-context';
import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';
import { getCompanyColumnForTable } from '@/lib/companyScope';
import { TABLES } from '@/lib/data';
import { getGuideState, hideChecklist, onGuideChange } from '@/lib/guide/progress';
import { loadSeedPlan, isSetupReady } from '@/lib/onboarding/firstRunSeed';
import { useOptionalTour } from './TourProvider';

// Accounts with this many appointments are past "getting started".
const NEW_ACCOUNT_APPOINTMENT_LIMIT = 10;

type ItemKey = 'appointment' | 'client' | 'hours' | 'team' | 'reminders' | 'tour';

interface Counts {
  appointments: number;
  clients: number;
  staff: number;
}

async function countRows(table: string, companyId: string): Promise<number> {
  try {
    const column = await getCompanyColumnForTable(table, companyId);
    const { count } = await supabaseReadOnly
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq(column, companyId);
    return count ?? 0;
  } catch {
    return 0;
  }
}

interface GettingStartedProps {
  /** Opens the dashboard's "new appointment" modal. */
  onCreateAppointment: () => void;
  /** Bump to re-count (e.g. after an appointment is saved). */
  refreshKey?: number;
}

/**
 * "Getting started" checklist for new accounts. Items tick themselves off
 * from real data (appointments, clients, staff) or from pages the owner has
 * opened (working hours, reminders), and the dashboard tour starts once.
 */
export default function GettingStarted({ onCreateAppointment, refreshKey = 0 }: GettingStartedProps) {
  const t = useTranslations('dashboard.gettingStarted');
  const { companyId, companyUuid } = useCompany();
  const { user } = useAuth();
  const { role } = useRolePermissions();
  const tour = useOptionalTour();

  const [counts, setCounts] = useState<Counts | null>(null);
  const [guide, setGuide] = useState(() => getGuideState(user?.id));

  useEffect(() => {
    setGuide(getGuideState(user?.id));
    return onGuideChange(() => setGuide(getGuideState(user?.id)));
  }, [user?.id]);

  const load = useCallback(async () => {
    if (!companyId) return;
    const [appointments, clients, staff] = await Promise.all([
      countRows(TABLES.bookings, companyId),
      countRows(TABLES.clients, companyId),
      countRows(TABLES.staff, companyId),
    ]);
    setCounts({ appointments, clients, staff });
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const isManager = role === 'owner' || role === 'admin';
  const visible =
    isManager &&
    counts !== null &&
    counts.appointments < NEW_ACCOUNT_APPOINTMENT_LIMIT &&
    !guide.checklistHidden;

  const done: Record<ItemKey, boolean> = {
    appointment: (counts?.appointments ?? 0) > 0,
    client: (counts?.clients ?? 0) > 0,
    hours: Boolean(guide.visited.workingHours),
    team: (counts?.staff ?? 0) >= 2 || Boolean(guide.visited.team),
    reminders: Boolean(guide.visited.reminders),
    tour: Boolean(guide.tours.dashboard),
  };
  const items: ItemKey[] = ['tour', 'appointment', 'client', 'hours', 'reminders', 'team'];
  const completed = items.filter((k) => done[k]).length;
  const allDone = completed === items.length;

  // Start the dashboard tour once for new accounts — but not on top of the
  // first-run setup card or an open modal.
  useEffect(() => {
    if (!visible || done.tour || !tour) return;
    if (loadSeedPlan(companyUuid) || isSetupReady(companyUuid)) return;
    const timer = window.setTimeout(() => {
      if (document.querySelector('[role="dialog"]')) return;
      tour.startTourOnce('dashboard');
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [visible, done.tour, tour, companyUuid]);

  if (!visible || allDone) return null;

  const action = (key: ItemKey) => {
    switch (key) {
      case 'tour':
        return { onClick: () => tour?.startTour('dashboard') };
      case 'appointment':
        return { onClick: onCreateAppointment };
      case 'client':
        return { href: '/clients' };
      case 'hours':
        return { href: '/nastavitve/podjetje' };
      case 'reminders':
        return { href: '/reminders' };
      case 'team':
        return { href: '/staff' };
    }
  };

  return (
    <section
      data-tour="getting-started"
      aria-labelledby="getting-started-title"
      className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="getting-started-title" className="text-lg font-semibold text-gray-900">
            {t('title')}
          </h2>
          <p className="mt-1 text-sm text-gray-500">{t('subtitle', { done: completed, total: items.length })}</p>
        </div>
        <button
          type="button"
          onClick={() => hideChecklist(user?.id)}
          aria-label={t('hide')}
          title={t('hide')}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <X size={16} weight="bold" />
        </button>
      </div>

      <div
        className="mt-4 h-1.5 overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={completed}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-500"
          style={{ width: `${(completed / items.length) * 100}%` }}
        />
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((key) => {
          const isDone = done[key];
          const act = action(key);
          const content = (
            <>
              {isDone ? (
                <CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-emerald-500" aria-hidden="true" />
              ) : (
                <Circle size={20} weight="regular" className="mt-0.5 shrink-0 text-gray-300" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-medium ${isDone ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                  {t(`items.${key}.title`)}
                </span>
                {!isDone && <span className="mt-0.5 block text-xs text-gray-500">{t(`items.${key}.body`)}</span>}
              </span>
              {!isDone && <ArrowRight size={16} className="mt-0.5 shrink-0 text-gray-400" aria-hidden="true" />}
            </>
          );
          const className =
            'flex w-full items-start gap-3 rounded-xl border border-gray-100 px-3.5 py-3 text-left transition-colors ' +
            (isDone ? 'bg-gray-50/60' : 'hover:border-gray-200 hover:bg-gray-50');

          return (
            <li key={key}>
              {isDone ? (
                <div className={className}>{content}</div>
              ) : act?.href ? (
                <Link href={act.href} className={className}>
                  {content}
                </Link>
              ) : (
                <button type="button" onClick={act?.onClick} className={className}>
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
