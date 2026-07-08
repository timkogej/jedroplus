'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  BellIcon,
  BellSlashIcon,
  BellRingingIcon,
  CheckCircleIcon,
  ClockIcon,
  ArchiveIcon,
  ArrowRightIcon,
  ChecksIcon,
  XCircleIcon,
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { supabase } from '@/lib/supabaseClient';
import { GradientSpinner } from '@/components/ui/GradientSpinner';
import { useTranslations, useLocale } from 'next-intl';

// ============================================================================
// Types
// ============================================================================

interface Notification {
  id: string;
  company_id: string;
  recipient_user_id: string | null;
  created_by_user_id: string | null;
  type: string;
  title: string;
  body: string;
  action_url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  is_archived: boolean;
  archived_at: string | null;
  dedupe_key: string | null;
  expires_at: string | null;
  created_at: string;
}

type FilterId = 'all' | 'unread' | 'reservations' | 'system';

// ============================================================================
// Helpers
// ============================================================================

function isReservationType(type: string): boolean {
  const t = type?.toLowerCase();
  return t === 'appointment_booked' || t === 'appointment_cancelled' || t === 'appointment_updated';
}

function isSystemType(type: string): boolean {
  const t = type?.toLowerCase();
  return t === 'info' || t === 'system' || t === 'success' || t === 'warning' || t === 'error';
}

type TFn = (key: string, values?: Record<string, string | number>) => string;

function formatRelativeTime(dateStr: string, t: TFn, locale: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return t('relativeTime.justNow');
  if (diffMins < 60) return t('relativeTime.minutesAgo', { count: diffMins });
  if (diffHours < 24) return t('relativeTime.hoursAgo', { count: diffHours });
  if (diffDays === 1) return t('relativeTime.yesterday');
  if (diffDays < 7) return t('relativeTime.daysAgo', { count: diffDays });

  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatTime(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(dateStr: string, t: TFn, locale: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const notifDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (notifDate.getTime() === today.getTime()) return t('dateLabel.today');
  if (notifDate.getTime() === yesterday.getTime()) return t('dateLabel.yesterday');

  return date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

function groupNotificationsByDate(notifications: Notification[], t: TFn, locale: string): Record<string, Notification[]> {
  const groups: Record<string, Notification[]> = {};
  for (const n of notifications) {
    const label = formatDateLabel(n.created_at, t, locale);
    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  }
  return groups;
}

// ============================================================================
// Sub-components
// ============================================================================

const DateSeparator = ({ date }: { date: string }) => (
  <p className="mb-2 mt-6 first:mt-0 text-xs font-semibold uppercase tracking-wide text-gray-400">
    {date}
  </p>
);

interface NotificationCardProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onArchive: (id: string) => void;
}

const NotificationCard = ({ notification, onMarkRead, onArchive }: NotificationCardProps) => {
  const router = useRouter();
  const t = useTranslations('notifications');
  const locale = useLocale();
  const isUnread = !notification.is_read;
  const Icon = isUnread ? BellRingingIcon : BellIcon;
  const gradientId = `notification-icon-gradient-${notification.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const isInteractive = isUnread || Boolean(notification.action_url);

  const handleOpen = () => {
    if (!isInteractive) return;
    if (isUnread) onMarkRead(notification.id);
    if (!notification.action_url) return;

    if (/^https?:\/\//.test(notification.action_url)) {
      window.location.assign(notification.action_url);
      return;
    }

    router.push(notification.action_url);
  };

  return (
    <motion.div
      whileHover={isInteractive ? { x: 2 } : undefined}
      role={notification.action_url ? 'link' : isUnread ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      className={[
        'group/notification relative px-5 py-4 transition-colors duration-150',
        isInteractive ? 'cursor-pointer' : 'cursor-default',
        isUnread ? 'bg-white hover:bg-gray-50/90' : 'bg-white hover:bg-gray-50/70',
      ].join(' ')}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        handleOpen();
      }}
    >
      {/* Unread pulsing dot */}
      {isUnread && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-60" />
            <span
              className="relative inline-flex rounded-full h-2.5 w-2.5"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)' }}
            />
          </span>
        </div>
      )}

      <div className="flex items-start gap-3">
        <Icon
          size={24}
          weight="regular"
          color={isUnread ? `url(#${gradientId})` : '#111827'}
          className="mt-0.5 flex-shrink-0"
          aria-hidden="true"
        >
          {isUnread && (
            <defs>
              <linearGradient id={gradientId} x1="32" y1="32" x2="224" y2="224" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="52%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
          )}
        </Icon>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <h3 className={[
              'min-w-0 text-sm font-semibold leading-snug',
              isUnread
                ? 'bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent'
                : 'text-gray-900',
            ].join(' ')}>
              {notification.title}
            </h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isUnread && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)' }}
                />
              )}
              <span className="text-xs whitespace-nowrap text-gray-400">
                {formatRelativeTime(notification.created_at, t as TFn, locale)}
              </span>
            </div>
          </div>

          {/* Time sub-label */}
          <div className="flex items-center gap-1 mt-0.5 mb-2">
            <ClockIcon size={11} className="text-gray-400" />
            <span className="text-[11px] text-gray-400">{formatTime(notification.created_at, locale)}</span>
          </div>

          {/* Body */}
          <p className={`text-sm leading-relaxed ${isUnread ? 'text-gray-700' : 'text-gray-500'}`}>
            {notification.body}
          </p>

          {/* Action row */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div>
              {notification.action_url && (
                <span className="flex items-center gap-1 text-xs font-medium text-gray-500 group-hover/notification:text-gray-900 transition-colors">
                  <ArrowRightIcon size={12} />
                  {t('card.open')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 transition-all duration-150 sm:translate-y-1 sm:opacity-0 sm:group-hover/notification:translate-y-0 sm:group-hover/notification:opacity-100 sm:focus-within:translate-y-0 sm:focus-within:opacity-100">
              {isUnread && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkRead(notification.id);
                  }}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#6D5EF7] hover:bg-gray-100 transition-colors"
                >
                  <CheckCircleIcon size={13} weight="regular" />
                  {t('card.markRead')}
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive(notification.id);
                }}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                <ArchiveIcon size={13} weight="regular" />
                {t('card.archive')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

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
      <main className="min-h-screen bg-[#F7F8FA]">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 py-6 sm:py-8">

          {/* ---------------------------------------------------------------- */}
          {/* Header                                                           */}
          {/* ---------------------------------------------------------------- */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{t('page.title')}</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {t('page.subtitle')}
                </p>
              </div>

              {unreadCount > 0 && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleMarkAllRead}
                  disabled={markingAllRead}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:text-gray-900 disabled:opacity-60 whitespace-nowrap self-start"
                >
                  <ChecksIcon size={18} weight="bold" />
                  {t('page.markAllRead')}
                </motion.button>
              )}
            </div>
          </motion.div>

          {/* ---------------------------------------------------------------- */}
          {/* Filter tabs                                                      */}
          {/* ---------------------------------------------------------------- */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-5"
          >
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-gray-100 bg-white p-1.5 sm:flex sm:items-center sm:overflow-x-auto">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={[
                    'flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all whitespace-nowrap',
                    activeFilter === filter.id
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:text-gray-900',
                  ].join(' ')}
                >
                  {filter.label}
                  {filter.count > 0 && (
                    <span
                      className="px-1.5 py-0.5 text-xs rounded-full font-medium"
                      style={
                        activeFilter === filter.id
                          ? { background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)', color: 'white' }
                          : { background: '#E5E7EB', color: '#6B7280' }
                      }
                    >
                      {filter.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>

          {/* ---------------------------------------------------------------- */}
          {/* Loading                                                          */}
          {/* ---------------------------------------------------------------- */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <GradientSpinner />
              <p className="text-sm text-gray-400">{t('page.loading')}</p>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Error                                                            */}
          {/* ---------------------------------------------------------------- */}
          {error && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-red-200 bg-white p-8 text-center"
            >
              <XCircleIcon className="mx-auto mb-3 h-12 w-12 text-red-400" weight="fill" />
              <h3 className="mb-1 text-base font-semibold text-red-800">{error}</h3>
              <button
                onClick={fetchNotifications}
                className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                {t('page.retry')}
              </button>
            </motion.div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Empty state                                                      */}
          {/* ---------------------------------------------------------------- */}
          {!loading && !error && filteredNotifications.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-gray-100 bg-white px-6 py-16 text-center"
            >
              <BellSlashIcon size={38} className="mx-auto mb-5 text-gray-300" weight="regular" />
              <h3 className="text-base font-semibold text-gray-900 mb-2">{t('page.emptyTitle')}</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                {t('page.emptySubtitle')}
              </p>
            </motion.div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Notification list                                                */}
          {/* ---------------------------------------------------------------- */}
          {!loading && !error && filteredNotifications.length > 0 && (
            <AnimatePresence mode="popLayout">
              <div className="space-y-5">
                {dateGroups.map(([dateLabel, items]) => (
                  <div key={dateLabel}>
                    <DateSeparator date={dateLabel} />
                    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white divide-y divide-gray-100">
                      {items.map((notification, index) => (
                        <motion.div
                          key={notification.id}
                          initial={{ opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 16 }}
                          transition={{ delay: index * 0.04, type: 'spring', stiffness: 300, damping: 28 }}
                        >
                          <NotificationCard
                            notification={notification}
                            onMarkRead={handleMarkRead}
                            onArchive={handleArchive}
                          />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </AnimatePresence>
          )}

        </div>
      </main>
    </ProtectedLayout>
  );
}
