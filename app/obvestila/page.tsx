'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
  BellIcon,
  BellRingingIcon,
  CheckCircleIcon,
  ClockIcon,
  InfoIcon,
  WarningIcon,
  XCircleIcon,
  ArchiveIcon,
  ArrowRightIcon,
  ChecksIcon,
  CalendarBlankIcon,
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { supabase } from '@/lib/supabaseClient';

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

// ============================================================================
// Helpers
// ============================================================================

function getNotificationIcon(type: string) {
  switch (type?.toLowerCase()) {
    case 'info':
      return InfoIcon;
    case 'success':
      return CheckCircleIcon;
    case 'warning':
      return WarningIcon;
    case 'error':
      return XCircleIcon;
    case 'reminder':
      return BellRingingIcon;
    case 'appointment':
      return CalendarBlankIcon;
    default:
      return BellIcon;
  }
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
  const date = new Date(dateStr);
  return date.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
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
// Component
// ============================================================================

export default function ObvestilaPage() {
  const router = useRouter();
  const { companyUuid, loading: companyLoading } = useCompany();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);

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
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching notifications:', fetchError);
        setError('Napaka pri nalaganju obvestil');
        return;
      }

      const list = data || [];
      setNotifications(list);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Napaka pri nalaganju obvestil');
    } finally {
      setLoading(false);
    }
  }, [companyUuid]);

  useEffect(() => {
    if (companyUuid) {
      fetchNotifications();
    }
  }, [companyUuid, fetchNotifications]);

  // Mark single notification as read
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

  // Mark all as read
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
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read_at: n.read_at ?? new Date().toISOString() })));
    }
    setMarkingAllRead(false);
  }, [companyUuid]);

  // Archive notification
  const handleArchive = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      setNotifications((prev) => {
        const updated = prev.filter((n) => n.id !== id);
        return updated;
      });
    }
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const grouped = groupNotificationsByDate(notifications);
  const dateGroups = Object.entries(grouped);

  if (companyLoading || !companyUuid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <ProtectedLayout>
      <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-slate-50">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">

          {/* ---------------------------------------------------------------- */}
          {/* Header                                                           */}
          {/* ---------------------------------------------------------------- */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">Obvestila</h1>
                  {unreadCount > 0 && (
                    <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-2 text-xs font-bold text-white shadow-sm">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Preglejte sporočila o rezervacijah, terminih in obvestilih vašega podjetja.
                </p>
              </div>

              {unreadCount > 0 && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleMarkAllRead}
                  disabled={markingAllRead}
                  className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-60"
                >
                  <ChecksIcon className="h-4 w-4" weight="bold" />
                  Označi vse kot prebrano
                </motion.button>
              )}
            </div>
          </motion.div>

          {/* ---------------------------------------------------------------- */}
          {/* Loading                                                          */}
          {/* ---------------------------------------------------------------- */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
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
          {!loading && !error && notifications.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white py-20 text-center shadow-sm"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-100 to-slate-100">
                <BellIcon className="h-8 w-8 text-gray-300" weight="fill" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700">Ni obvestil</h3>
              <p className="mt-1 max-w-xs text-sm text-gray-400">
                Ko boste prejeli obvestila, se bodo prikazala tukaj.
              </p>
            </motion.div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Notification list (grouped by date)                             */}
          {/* ---------------------------------------------------------------- */}
          {!loading && !error && notifications.length > 0 && (
            <div className="space-y-6">
              <AnimatePresence mode="popLayout">
                {dateGroups.map(([dateLabel, items]) => (
                  <div key={dateLabel}>
                    {/* Date separator */}
                    <div className="mb-3 flex items-center gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        {dateLabel}
                      </span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    {/* Cards */}
                    <div className="space-y-2">
                      {items.map((notification, index) => {
                        const Icon = getNotificationIcon(notification.type);
                        const isUnread = !notification.is_read;

                        const CardContent = (
                          <motion.div
                            key={notification.id}
                            layout
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -40, height: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className={[
                              'group relative flex items-start gap-3 rounded-2xl border px-4 py-3 transition-all duration-200',
                              isUnread
                                ? 'border-violet-100 bg-white shadow-sm hover:shadow-md hover:border-violet-200'
                                : 'border-gray-100 bg-white/60 hover:bg-white hover:shadow-sm',
                            ].join(' ')}
                            onClick={() => {
                              if (isUnread) handleMarkRead(notification.id);
                            }}
                          >
                            {/* Unread bar — gradient violet→blue→cyan */}
                            {isUnread && (
                              <div
                                className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
                                style={{ background: 'linear-gradient(to bottom, #7C3AED, #3B82F6, #06B6D4)' }}
                              />
                            )}

                            {/* Icon — no background circle, just the icon */}
                            <div className="flex-shrink-0 mt-0.5">
                              <Icon
                                className={isUnread ? 'h-5 w-5' : 'h-5 w-5 text-gray-400'}
                                weight="fill"
                                style={isUnread ? { color: '#7C3AED' } : undefined}
                              />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-0.5">
                                <h3
                                  className={[
                                    'text-sm leading-snug truncate',
                                    isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-600',
                                  ].join(' ')}
                                >
                                  {notification.title}
                                </h3>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {isUnread && (
                                    <span className="h-2 w-2 rounded-full bg-violet-500 ring-2 ring-white" />
                                  )}
                                  <span className="text-xs text-gray-400 whitespace-nowrap">
                                    {formatRelativeTime(notification.created_at)}
                                  </span>
                                </div>
                              </div>

                              {/* Time */}
                              <div className="flex items-center gap-1 mb-2">
                                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                  <ClockIcon className="h-3 w-3" />
                                  {formatTime(notification.created_at)}
                                </span>
                              </div>

                              {/* Body */}
                              <p
                                className={[
                                  'text-sm leading-relaxed',
                                  isUnread ? 'text-gray-700' : 'text-gray-500',
                                ].join(' ')}
                              >
                                {notification.body}
                              </p>

                              {/* Action row */}
                              <div className="mt-3 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  {notification.action_url && (
                                    <span className="flex items-center gap-1 text-xs font-medium text-violet-600">
                                      <ArrowRightIcon className="h-3 w-3" />
                                      Odpri
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {isUnread && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMarkRead(notification.id);
                                      }}
                                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                      title="Označi kot prebrano"
                                    >
                                      <CheckCircleIcon className="h-3.5 w-3.5" />
                                      Prebrano
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleArchive(notification.id);
                                    }}
                                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                    title="Arhiviraj"
                                  >
                                    <ArchiveIcon className="h-3.5 w-3.5" />
                                    Arhiviraj
                                  </button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );

                        // Wrap in Link if action_url exists
                        if (notification.action_url) {
                          return (
                            <Link
                              key={notification.id}
                              href={notification.action_url}
                              className="block"
                              onClick={() => {
                                if (isUnread) handleMarkRead(notification.id);
                              }}
                            >
                              {CardContent}
                            </Link>
                          );
                        }

                        return <div key={notification.id}>{CardContent}</div>;
                      })}
                    </div>
                  </div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>
    </ProtectedLayout>
  );
}
