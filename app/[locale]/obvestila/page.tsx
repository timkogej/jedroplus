'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { BellSlashIcon, ChecksIcon, WarningCircleIcon } from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { supabase } from '@/lib/supabaseClient';
import { GradientSpinner } from '@/components/ui/GradientSpinner';
import { useTranslations, useLocale } from 'next-intl';
import {
  type Notification,
  type FilterId,
  type TFn,
  isReservationType,
  isSystemType,
  groupNotificationsByDate,
  DateSeparator,
  NotificationCard,
} from '@/components/notifications/NotificationList';

// ============================================================================
// Main page
// ============================================================================

export default function ObvestilaPage() {
  const router = useRouter();
  const t = useTranslations('notifications');
  const locale = useLocale();
  const { companyUuid, loading: companyLoading } = useCompany();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');

  // Redirect if no company
  useEffect(() => {
    if (!companyLoading && !companyUuid) {
      router.replace('/onboarding');
    }
  }, [companyUuid, companyLoading, router]);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!companyUuid) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('company_id', companyUuid)
        .neq('is_archived', true)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching notifications:', fetchError);
        setError(t('page.loadError'));
        return;
      }

      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(t('page.loadError'));
    } finally {
      setLoading(false);
    }
  }, [companyUuid, t]);

  useEffect(() => {
    if (companyUuid) fetchNotifications();
  }, [companyUuid, fetchNotifications]);

  const handleMarkRead = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    if (!companyUuid) return;
    setMarkingAllRead(true);
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('company_id', companyUuid)
      .eq('is_read', false)
      .eq('is_archived', false);

    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: n.read_at ?? new Date().toISOString() }))
      );
    }
    setMarkingAllRead(false);
  }, [companyUuid]);

  const handleArchive = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const reservationCount = notifications.filter((n) => isReservationType(n.type) && !n.is_read).length;
  const systemCount = notifications.filter((n) => isSystemType(n.type)).length;

  const filteredNotifications = useMemo(() => {
    switch (activeFilter) {
      case 'unread':
        return notifications.filter((n) => !n.is_read);
      case 'reservations':
        return notifications.filter((n) => isReservationType(n.type));
      case 'system':
        return notifications.filter((n) => isSystemType(n.type));
      default:
        return notifications;
    }
  }, [notifications, activeFilter]);

  const grouped = useMemo(
    () => groupNotificationsByDate(filteredNotifications, t as TFn, locale),
    [filteredNotifications, t, locale]
  );
  const dateGroups = Object.entries(grouped);

  const filters: { id: FilterId; label: string; count: number }[] = [
    { id: 'all', label: t('filters.all'), count: 0 },
    { id: 'unread', label: t('filters.unread'), count: unreadCount },
    { id: 'reservations', label: t('filters.reservations'), count: reservationCount },
    { id: 'system', label: t('filters.system'), count: systemCount },
  ];

  if (companyLoading || !companyUuid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <GradientSpinner />
      </div>
    );
  }

  return (
    <ProtectedLayout>
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">

          {/* Glava */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="mb-6 flex flex-wrap items-start justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">{t('page.title')}</h1>
              <p className="mt-0.5 text-base text-gray-500">{t('page.subtitle')}</p>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markingAllRead}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-60"
              >
                <ChecksIcon size={17} weight="regular" className="text-gray-500" />
                {t('page.markAllRead')}
              </button>
            )}
          </motion.div>

          {/* Filtri — isti gumbi s števili kot v Komunikaciji */}
          <div className="mb-6 flex flex-wrap gap-1.5">
            {filters.map((filter) => {
              const isActive = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                    isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter.label}
                  {filter.count > 0 && (
                    <span className={`tnum ${isActive ? 'text-white/60' : 'text-gray-400'}`}>
                      {filter.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Nalaganje */}
          {loading && (
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white" aria-busy="true">
              <span className="sr-only" role="status">{t('page.loading')}</span>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3 border-b border-gray-100 py-3.5 pl-7 pr-4 last:border-b-0">
                  <div className="h-5 w-5 flex-shrink-0 animate-pulse rounded bg-gray-100" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100" />
                    <div className="h-3 w-4/5 animate-pulse rounded bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Napaka */}
          {error && !loading && (
            <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4">
              <WarningCircleIcon size={20} weight="regular" className="flex-shrink-0 text-red-500" />
              <p className="flex-1 text-sm font-medium text-red-700">{error}</p>
              <button
                type="button"
                onClick={fetchNotifications}
                className="flex-shrink-0 text-sm font-medium text-red-600 hover:text-red-700"
              >
                {t('page.retry')}
              </button>
            </div>
          )}

          {/* Prazno */}
          {!loading && !error && filteredNotifications.length === 0 && (
            <div className="rounded-xl border border-gray-100 bg-white px-6 py-14 text-center">
              <BellSlashIcon size={28} className="mx-auto mb-3 text-gray-300" weight="regular" />
              <h3 className="mb-1 text-base font-semibold text-gray-900">{t('page.emptyTitle')}</h3>
              <p className="mx-auto max-w-sm text-sm text-gray-500">{t('page.emptySubtitle')}</p>
            </div>
          )}

          {/* Seznam po dnevih */}
          {!loading && !error && filteredNotifications.length > 0 && (
            <div className="space-y-6">
              {dateGroups.map(([dateLabel, items]) => (
                <section key={dateLabel}>
                  <DateSeparator date={dateLabel} />
                  <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
                    {/* Arhivirano obvestilo se zloži, namesto da bi izginilo na mah. */}
                    <AnimatePresence initial={false}>
                      {items.map((notification) => (
                        <motion.div
                          key={notification.id}
                          layout
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                          className="border-b border-gray-100 last:border-b-0"
                        >
                          <NotificationCard
                            notification={notification}
                            onMarkRead={handleMarkRead}
                            onArchive={handleArchive}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </section>
              ))}
            </div>
          )}

        </div>
      </main>
    </ProtectedLayout>
  );
}
