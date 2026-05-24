'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
  BellIcon,
  BellSlashIcon,
  BellRingingIcon,
  CheckCircleIcon,
  ClockIcon,
  GearSixIcon,
  ChatTeardropTextIcon,
  WarningCircleIcon,
  ArchiveIcon,
  ArrowRightIcon,
  ChecksIcon,
  CalendarPlusIcon,
  XCircleIcon,
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { supabase } from '@/lib/supabaseClient';
import { GradientSpinner } from '@/components/ui/GradientSpinner';

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

function getTypeConfig(type: string) {
  switch (type?.toLowerCase()) {
    case 'appointment':
      return {
        Icon: CalendarPlusIcon,
        gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
        bgLight: 'bg-purple-50',
        iconColor: 'text-purple-600',
      };
    case 'reminder':
      return {
        Icon: BellRingingIcon,
        gradient: 'linear-gradient(135deg, #3B82F6, #2563EB)',
        bgLight: 'bg-blue-50',
        iconColor: 'text-blue-600',
      };
    case 'success':
      return {
        Icon: CheckCircleIcon,
        gradient: 'linear-gradient(135deg, #06B6D4, #0891B2)',
        bgLight: 'bg-cyan-50',
        iconColor: 'text-cyan-600',
      };
    case 'warning':
      return {
        Icon: WarningCircleIcon,
        gradient: 'linear-gradient(135deg, #F59E0B, #D97706)',
        bgLight: 'bg-amber-50',
        iconColor: 'text-amber-600',
      };
    case 'error':
      return {
        Icon: XCircleIcon,
        gradient: 'linear-gradient(135deg, #EF4444, #DC2626)',
        bgLight: 'bg-red-50',
        iconColor: 'text-red-600',
      };
    case 'message':
      return {
        Icon: ChatTeardropTextIcon,
        gradient: 'linear-gradient(135deg, #06B6D4, #0D9488)',
        bgLight: 'bg-cyan-50',
        iconColor: 'text-cyan-600',
      };
    case 'system':
    case 'info':
      return {
        Icon: GearSixIcon,
        gradient: 'linear-gradient(135deg, #6B7280, #4B5563)',
        bgLight: 'bg-gray-50',
        iconColor: 'text-gray-600',
      };
    default:
      return {
        Icon: BellIcon,
        gradient: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)',
        bgLight: 'bg-purple-50',
        iconColor: 'text-purple-600',
      };
  }
}

function isReservationType(type: string): boolean {
  const t = type?.toLowerCase();
  return t === 'appointment_booked' || t === 'appointment_cancelled' || t === 'appointment_updated';
}

function isSystemType(type: string): boolean {
  const t = type?.toLowerCase();
  return t === 'info' || t === 'system' || t === 'success' || t === 'warning' || t === 'error';
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Pravkar';
  if (diffMins < 60) return `Pred ${diffMins} min`;
  if (diffHours < 24) return `Pred ${diffHours} h`;
  if (diffDays === 1) return 'Včeraj';
  if (diffDays < 7) return `Pred ${diffDays} dni`;

  return date.toLocaleDateString('sl-SI', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const notifDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (notifDate.getTime() === today.getTime()) return 'Danes';
  if (notifDate.getTime() === yesterday.getTime()) return 'Včeraj';

  return date.toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long' });
}

function groupNotificationsByDate(notifications: Notification[]): Record<string, Notification[]> {
  const groups: Record<string, Notification[]> = {};
  for (const n of notifications) {
    const label = formatDateLabel(n.created_at);
    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  }
  return groups;
}

// ============================================================================
// Sub-components
// ============================================================================

const DateSeparator = ({ date }: { date: string }) => (
  <div className="flex items-center gap-4 my-6 first:mt-0">
    <div className="h-px flex-1 bg-gray-200" />
    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
      {date}
    </span>
    <div className="h-px flex-1 bg-gray-200" />
  </div>
);

interface NotificationCardProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onArchive: (id: string) => void;
}

const NotificationCard = ({ notification, onMarkRead, onArchive }: NotificationCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const isUnread = !notification.is_read;

  const cardContent = (
    <motion.div
      whileHover={{ scale: 1.003 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={[
        'relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer',
        isUnread
          ? 'border-purple-100 hover:border-purple-200 hover:shadow-md'
          : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm',
      ].join(' ')}
      style={isUnread ? {
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.04), rgba(6, 182, 212, 0.04))',
      } : undefined}
      onClick={() => {
        if (isUnread) onMarkRead(notification.id);
      }}
    >
      {/* Unread pulsing dot */}
      {isUnread && (
        <div className="absolute -left-1 top-1/2 -translate-y-1/2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-60" />
            <span
              className="relative inline-flex rounded-full h-2.5 w-2.5"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)' }}
            />
          </span>
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Bell icon — gradient bg + white bell when unread, gray bg + black bell when read */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={isUnread
            ? { background: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)' }
            : { background: '#F3F4F6', border: '1.5px solid #E5E7EB' }
          }
        >
          {isUnread ? (
            <BellRingingIcon size={22} weight="fill" className="text-white" />
          ) : (
            <BellIcon size={22} weight="fill" className="text-gray-900" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <h3 className={`font-semibold text-sm leading-snug ${isUnread ? 'text-gray-900' : 'text-gray-600'}`}>
              {notification.title}
            </h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isUnread && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)' }}
                />
              )}
              <span className={`text-xs whitespace-nowrap ${isUnread ? 'text-gray-500' : 'text-gray-400'}`}>
                {formatRelativeTime(notification.created_at)}
              </span>
            </div>
          </div>

          {/* Time sub-label */}
          <div className="flex items-center gap-1 mt-0.5 mb-2">
            <ClockIcon size={11} className="text-gray-400" />
            <span className="text-[11px] text-gray-400">{formatTime(notification.created_at)}</span>
          </div>

          {/* Body */}
          <p className={`text-sm leading-relaxed ${isUnread ? 'text-gray-700' : 'text-gray-400'}`}>
            {notification.body}
          </p>

          {/* Action row */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div>
              {notification.action_url && (
                <span className="flex items-center gap-1 text-xs font-medium text-purple-600">
                  <ArrowRightIcon size={12} />
                  Odpri
                </span>
              )}
            </div>

            <motion.div
              initial={false}
              animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 4 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1"
            >
              {isUnread && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkRead(notification.id);
                  }}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 transition-colors"
                >
                  <CheckCircleIcon size={13} weight="fill" />
                  Prebrano
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive(notification.id);
                }}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                <ArchiveIcon size={13} weight="fill" />
                Arhiviraj
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  if (notification.action_url) {
    return (
      <Link
        href={notification.action_url}
        className="block"
        onClick={() => {
          if (isUnread) onMarkRead(notification.id);
        }}
      >
        {cardContent}
      </Link>
    );
  }

  return cardContent;
};

// ============================================================================
// Main page
// ============================================================================

export default function ObvestilaPage() {
  const router = useRouter();
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
        setError('Prišlo je do napake pri nalaganju obvestil');
        return;
      }

      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Prišlo je do napake pri nalaganju obvestil');
    } finally {
      setLoading(false);
    }
  }, [companyUuid]);

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

  const grouped = useMemo(() => groupNotificationsByDate(filteredNotifications), [filteredNotifications]);
  const dateGroups = Object.entries(grouped);

  const filters: { id: FilterId; label: string; count: number }[] = [
    { id: 'all', label: 'Vse', count: 0 },
    { id: 'unread', label: 'Neprebrane', count: unreadCount },
    { id: 'reservations', label: 'Rezervacije', count: reservationCount },
    { id: 'system', label: 'Sistem', count: systemCount },
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
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">

          {/* ---------------------------------------------------------------- */}
          {/* Header                                                           */}
          {/* ---------------------------------------------------------------- */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Obvestila</h1>
                <p className="text-gray-500 text-sm">
                  Preglejte sporočila o rezervacijah, terminih in obvestilih vašega podjetja.
                </p>
              </div>

              {unreadCount > 0 && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleMarkAllRead}
                  disabled={markingAllRead}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-xl transition-all disabled:opacity-60 whitespace-nowrap self-start"
                >
                  <ChecksIcon size={18} weight="bold" />
                  Označi vse kot prebrano
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
            className="mb-6"
          >
            <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl w-fit overflow-x-auto">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={[
                    'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                    activeFilter === filter.id
                      ? 'bg-white text-gray-900 shadow-sm'
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
              <p className="text-sm text-gray-400">Nalaganje obvestil...</p>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Error                                                            */}
          {/* ---------------------------------------------------------------- */}
          {error && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center"
            >
              <XCircleIcon className="mx-auto mb-3 h-12 w-12 text-red-400" weight="fill" />
              <h3 className="mb-1 text-base font-semibold text-red-800">{error}</h3>
              <button
                onClick={fetchNotifications}
                className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                Poskusi znova
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
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div
                className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(6, 182, 212, 0.1))' }}
              >
                <BellSlashIcon size={36} className="text-gray-400" weight="fill" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Ni novih obvestil</h3>
              <p className="text-gray-500 max-w-sm">
                Ko boste prejeli nova obvestila o rezervacijah ali pomembnih dogodkih, se bodo prikazala tukaj.
              </p>
            </motion.div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Notification list                                                */}
          {/* ---------------------------------------------------------------- */}
          {!loading && !error && filteredNotifications.length > 0 && (
            <AnimatePresence mode="popLayout">
              <div>
                {dateGroups.map(([dateLabel, items]) => (
                  <div key={dateLabel}>
                    <DateSeparator date={dateLabel} />
                    <div className="space-y-3 pl-3">
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
