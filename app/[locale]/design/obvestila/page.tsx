'use client';

/**
 * ZAČASNA predogledna stran za redizajn Obvestil.
 *
 * Uporablja pravo vrstico (NotificationCard) in pravo grupiranje po dnevih z
 * izmišljenimi obvestili vseh vrst. Ko je redizajn potrjen, se mapa
 * `design` zbriše.
 */

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChecksIcon } from '@phosphor-icons/react';
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

function ago(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

let seq = 0;
function n(type: string, title: string, body: string, minutesAgo: number, read = false, url: string | null = '/termini'): Notification {
  seq += 1;
  return {
    id: `n${seq}`, company_id: 'c', recipient_user_id: null, created_by_user_id: null,
    type, title, body, action_url: url, entity_type: null, entity_id: null, metadata: null,
    is_read: read, read_at: read ? ago(minutesAgo - 1) : null, is_archived: false, archived_at: null,
    dedupe_key: null, expires_at: null, created_at: ago(minutesAgo),
  };
}

const INITIAL: Notification[] = [
  n('appointment_booked', 'Nova rezervacija: Ana Kovač', 'Klasično striženje, jutri ob 10:00 pri Maji.', 4),
  n('appointment_cancelled', 'Odpoved: Marko Zupan', 'Barvanje in fen, petek ob 14:00. Termin je spet prost.', 38),
  n('warning', 'SMS kvota se bliža koncu', 'Ostalo je še 40 sporočil. Obnovi se 1. 11.', 95, false, '/nastavitve/addoni'),
  n('appointment_updated', 'Prestavljen termin: Luka Horvat', 'Urejanje brade je prestavljeno na sredo ob 9:30.', 180, true),
  n('success', 'Uvoz strank je končan', 'Uvoženih je 48 strank, 2 dvojnika sta bila preskočena.', 60 * 26, true, '/clients'),
  n('appointment_reminder', 'Opomniki za jutri so poslani', '12 strank je prejelo opomnik za jutrišnji termin.', 60 * 27, true, null),
  n('error', 'Pošiljanje e-pošte ni uspelo', 'Sporočilo za Nino Bizjak ni bilo dostavljeno — naslov ne obstaja.', 60 * 50),
  n('info', 'Nove rezervacijske strani', 'Na voljo sta dva nova dizajna rezervacijske strani.', 60 * 72, true, '/rezervacije'),
];

export default function ObvestilaDesignPreview() {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const [notifications, setNotifications] = useState(INITIAL);
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');

  const markRead = (id: string) =>
    setNotifications((p) => p.map((x) => (x.id === id ? { ...x, is_read: true } : x)));
  const archive = (id: string) => setNotifications((p) => p.filter((x) => x.id !== id));

  const unreadCount = notifications.filter((x) => !x.is_read).length;
  const filtered = useMemo(() => {
    switch (activeFilter) {
      case 'unread': return notifications.filter((x) => !x.is_read);
      case 'reservations': return notifications.filter((x) => isReservationType(x.type));
      case 'system': return notifications.filter((x) => isSystemType(x.type));
      default: return notifications;
    }
  }, [notifications, activeFilter]);
  const groups = Object.entries(groupNotificationsByDate(filtered, t as TFn, locale));

  const filters: { id: FilterId; label: string; count: number }[] = [
    { id: 'all', label: t('filters.all'), count: 0 },
    { id: 'unread', label: t('filters.unread'), count: unreadCount },
    { id: 'reservations', label: t('filters.reservations'), count: notifications.filter((x) => isReservationType(x.type) && !x.is_read).length },
    { id: 'system', label: t('filters.system'), count: notifications.filter((x) => isSystemType(x.type)).length },
  ];

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          className="mb-6 flex flex-wrap items-start justify-between gap-4"
        >
          <div>
            <div className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              predogled
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">{t('page.title')}</h1>
            <p className="mt-0.5 text-base text-gray-500">{t('page.subtitle')}</p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => setNotifications((p) => p.map((x) => ({ ...x, is_read: true })))}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100"
            >
              <ChecksIcon size={17} weight="regular" className="text-gray-500" />
              {t('page.markAllRead')}
            </button>
          )}
        </motion.div>

        <div className="mb-6 flex flex-wrap gap-1.5">
          {filters.map((f) => {
            const isActive = activeFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFilter(f.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f.label}
                {f.count > 0 && <span className={`tnum ${isActive ? 'text-white/60' : 'text-gray-400'}`}>{f.count}</span>}
              </button>
            );
          })}
        </div>

        <div className="space-y-6">
          {groups.map(([label, items]) => (
            <section key={label}>
              <DateSeparator date={label} />
              <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
                <AnimatePresence initial={false}>
                  {items.map((x) => (
                    <motion.div
                      key={x.id}
                      layout
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                      className="border-b border-gray-100 last:border-b-0"
                    >
                      <NotificationCard notification={x} onMarkRead={markRead} onArchive={archive} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
