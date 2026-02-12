'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  BellRinging,
  Check,
  CheckCircle,
  Clock,
  Trash,
  Info,
  Warning,
  XCircle,
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { supabase } from '@/lib/supabaseClient';

interface Notification {
  id: string;
  company_id: string;
  recipient_user_id: string;
  type: string;
  title: string;
  body: string;
  created_at: string;
  read?: boolean;
}

function getNotificationIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'info':
      return Info;
    case 'success':
      return CheckCircle;
    case 'warning':
      return Warning;
    case 'error':
      return XCircle;
    case 'reminder':
      return BellRinging;
    default:
      return Bell;
  }
}

function getNotificationColor(type: string) {
  switch (type.toLowerCase()) {
    case 'info':
      return {
        gradient: 'from-blue-500 to-indigo-500',
        bg: 'border-blue-200 bg-blue-50',
        icon: 'text-blue-600',
      };
    case 'success':
      return {
        gradient: 'from-green-500 to-emerald-500',
        bg: 'border-green-200 bg-green-50',
        icon: 'text-green-600',
      };
    case 'warning':
      return {
        gradient: 'from-orange-500 to-amber-500',
        bg: 'border-orange-200 bg-orange-50',
        icon: 'text-orange-600',
      };
    case 'error':
      return {
        gradient: 'from-red-500 to-rose-500',
        bg: 'border-red-200 bg-red-50',
        icon: 'text-red-600',
      };
    case 'reminder':
      return {
        gradient: 'from-cyan-500 to-blue-500',
        bg: 'border-cyan-200 bg-cyan-50',
        icon: 'text-cyan-600',
      };
    default:
      return {
        gradient: 'from-gray-500 to-slate-500',
        bg: 'border-gray-200 bg-gray-50',
        icon: 'text-gray-600',
      };
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
  if (diffDays < 7) return `Pred ${diffDays} dni`;

  return date.toLocaleDateString('sl-SI', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('sl-SI', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ObvestilaPage() {
  const router = useRouter();
  const { companyId, loading: companyLoading } = useCompany();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch notifications from database
  const fetchNotifications = useCallback(async () => {
    if (!companyId || !user?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch notifications with BOTH company_id AND recipient_user_id conditions
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('company_id', companyId)
        .eq('recipient_user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching notifications:', fetchError);
        setError('Napaka pri nalaganju obvestil');
        return;
      }

      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Napaka pri nalaganju obvestil');
    } finally {
      setLoading(false);
    }
  }, [companyId, user?.id]);

  // Redirect if no company
  useEffect(() => {
    if (!companyLoading && !companyId) {
      router.replace('/onboarding');
    }
  }, [companyId, companyLoading, router]);

  // Fetch notifications when component mounts
  useEffect(() => {
    if (companyId && user?.id) {
      fetchNotifications();
    }
  }, [companyId, user?.id, fetchNotifications]);

  const handleDelete = useCallback(async (notificationId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (deleteError) {
        console.error('Error deleting notification:', deleteError);
        return;
      }

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  }, []);

  if (companyLoading || !companyId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
      </div>
    );
  }

  return (
    <ProtectedLayout>
      <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-slate-50">
        <div className="mx-auto max-w-4xl px-6 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  Obvestila
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                  {notifications.length} {notifications.length === 1 ? 'obvestilo' : 'obvestil'}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-20 bg-white">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center"
            >
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" weight="fill" />
              <h3 className="text-lg font-semibold text-red-800 mb-2">{error}</h3>
              <button
                onClick={fetchNotifications}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Poskusi znova
              </button>
            </motion.div>
          )}

          {/* Notifications List */}
          {!loading && !error && (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {notifications.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-white rounded-2xl border-2 border-gray-200 p-12 text-center"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-slate-100 mx-auto">
                      <Bell className="h-8 w-8 text-gray-400" weight="regular" />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-gray-900">Ni obvestil</h3>
                    <p className="mt-2 text-gray-600">
                      Ko boste prejeli obvestila, se bodo prikazala tukaj
                    </p>
                  </motion.div>
                ) : (
                  notifications.map((notification, index) => {
                    const Icon = getNotificationIcon(notification.type);
                    const colors = getNotificationColor(notification.type);

                    return (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ delay: index * 0.05 }}
                        className={`bg-white rounded-2xl border-2 p-6 transition-all hover:shadow-md ${colors.bg}`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${colors.gradient} shadow-lg`}>
                            <Icon className="h-6 w-6 text-white" weight="fill" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div className="flex-1">
                                <h3 className="font-bold text-lg text-gray-900 mb-1">
                                  {notification.title}
                                </h3>
                                <div className="flex items-center gap-3 text-sm text-gray-600">
                                  <span className="px-2 py-0.5 rounded-full bg-white border text-xs font-medium">
                                    {notification.type}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" weight="regular" />
                                    {formatRelativeTime(notification.created_at)}
                                  </span>
                                </div>
                              </div>

                              {/* Delete Button */}
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleDelete(notification.id)}
                                className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                                title="Izbriši"
                              >
                                <Trash className="w-5 h-5" weight="bold" />
                              </motion.button>
                            </div>

                            {/* Body */}
                            <p className="text-gray-700 whitespace-pre-wrap">
                              {notification.body}
                            </p>

                            {/* Full date */}
                            <p className="text-xs text-gray-500 mt-3">
                              {formatFullDate(notification.created_at)}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>
    </ProtectedLayout>
  );
}
