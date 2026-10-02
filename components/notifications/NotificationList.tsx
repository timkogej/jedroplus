'use client';

import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { humanizeDates } from '@/lib/format';
import {
  BellIcon,
  CheckCircleIcon,
  ArchiveIcon,
  CalendarCheckIcon,
  CalendarXIcon,
  CalendarDotsIcon,
  WarningIcon,
  WarningCircleIcon,
  InfoIcon,
  CaretRightIcon,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';

/*
 * Vrstica obvestila in pomožne funkcije za seznam.
 *
 * Ločeno od strani zato, da jih predogled v `app/[locale]/design` uporablja
 * iste, kot jih vidi uporabnik.
 */

// ============================================================================
// Types
// ============================================================================

export interface Notification {
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

export type FilterId = 'all' | 'unread' | 'reservations' | 'system';

// ============================================================================
// Helpers
// ============================================================================

export function isReservationType(type: string): boolean {
  const t = type?.toLowerCase();
  return t === 'appointment_booked' || t === 'appointment_cancelled' || t === 'appointment_updated';
}

export function isSystemType(type: string): boolean {
  const t = type?.toLowerCase();
  return t === 'info' || t === 'system' || t === 'success' || t === 'warning' || t === 'error';
}

/**
 * Ikona in barva po vrsti obvestila — kot ikona aplikacije v Applovem centru
 * obvestil: na prvi pogled veš, ali gre za novo rezervacijo, odpoved ali
 * opozorilo. Doslej je imelo vsako obvestilo isti zvonec.
 */
export function typeIcon(type: string): { Icon: PhosphorIcon; color: string } {
  switch (type?.toLowerCase()) {
    case 'appointment_booked':
    case 'appointment_confirmation':
      return { Icon: CalendarCheckIcon, color: 'text-emerald-500' };
    case 'appointment_cancelled':
      return { Icon: CalendarXIcon, color: 'text-red-500' };
    case 'appointment_updated':
      return { Icon: CalendarDotsIcon, color: 'text-blue-500' };
    case 'appointment_reminder':
    case 'appointment_post':
      return { Icon: BellIcon, color: 'text-[#7C78FA]' };
    case 'success':
      return { Icon: CheckCircleIcon, color: 'text-emerald-500' };
    case 'warning':
      return { Icon: WarningIcon, color: 'text-amber-500' };
    case 'error':
      return { Icon: WarningCircleIcon, color: 'text-red-500' };
    case 'info':
    case 'system':
      return { Icon: InfoIcon, color: 'text-blue-500' };
    default:
      return { Icon: BellIcon, color: 'text-gray-400' };
  }
}

export type TFn = (key: string, values?: Record<string, string | number>) => string;

export function formatRelativeTime(dateStr: string, t: TFn, locale: string): string {
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

export function formatTime(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export function formatDateLabel(dateStr: string, t: TFn, locale: string): string {
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

export function groupNotificationsByDate(notifications: Notification[], t: TFn, locale: string): Record<string, Notification[]> {
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

export const DateSeparator = ({ date }: { date: string }) => (
  <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-gray-500">
    {date}
  </h2>
);

interface NotificationCardProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onArchive: (id: string) => void;
}

export const NotificationCard = ({ notification, onMarkRead, onArchive }: NotificationCardProps) => {
  const router = useRouter();
  const t = useTranslations('notifications');
  const locale = useLocale();
  const isUnread = !notification.is_read;
  const { Icon, color } = typeIcon(notification.type);
  const isInteractive = isUnread || Boolean(notification.action_url);

  // Pod glavo dneva bi bil datum odveč: v zadnji uri relativno ("pred 5
  // min"), sicer ura.
  const ageMs = Date.now() - new Date(notification.created_at).getTime();
  const when = ageMs < 60 * 60 * 1000
    ? formatRelativeTime(notification.created_at, t as TFn, locale)
    : formatTime(notification.created_at, locale);

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
    <div
      role={notification.action_url ? 'link' : isUnread ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      title={notification.action_url ? t('card.open') : undefined}
      className={[
        'group/notification relative flex items-start gap-3 py-3.5 pl-7 pr-4 transition-colors duration-150',
        isInteractive ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default',
      ].join(' ')}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        handleOpen();
      }}
    >
      {/* Ena sama pika za neprebrano, kot v Applovi Pošti. */}
      {isUnread && (
        <span
          className="absolute left-2.5 top-[22px] h-2 w-2 rounded-full bg-[#7C78FA]"
          aria-label={t('filters.unread')}
        />
      )}

      {/* Ikona vrste — brez kroga okoli */}
      <Icon size={22} weight="regular" className={`mt-0.5 flex-shrink-0 ${color}`} aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3
            className={`min-w-0 text-[15px] leading-snug text-gray-900 ${
              isUnread ? 'font-semibold' : 'font-medium'
            }`}
          >
            {humanizeDates(notification.title, locale)}
          </h3>
          {/* Zgoraj desno: ura, ob prehodu pa namesto nje akcije — kot v
              Applovi Pošti. Tako akcije ne zavzamejo vrstice pod besedilom. */}
          <div className="relative flex-shrink-0">
            <span className="tnum flex items-center gap-0.5 whitespace-nowrap pt-0.5 text-[13px] text-gray-400 transition-opacity duration-150 sm:group-hover/notification:opacity-0 sm:group-focus-within/notification:opacity-0">
              {when}
              {notification.action_url && (
                <CaretRightIcon size={13} weight="bold" className="text-gray-300" aria-hidden="true" />
              )}
            </span>
            <div className="absolute -top-1 right-0 hidden items-center gap-0.5 opacity-0 transition-opacity duration-150 sm:flex sm:group-hover/notification:opacity-100 sm:group-focus-within/notification:opacity-100">
              {isUnread && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkRead(notification.id);
                  }}
                  title={t('card.markRead')}
                  aria-label={t('card.markRead')}
                  className="rounded-lg p-1.5 text-[#7C78FA] transition-colors hover:bg-[#7C78FA]/10"
                >
                  <CheckCircleIcon size={18} weight="regular" />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive(notification.id);
                }}
                title={t('card.archive')}
                aria-label={t('card.archive')}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <ArchiveIcon size={18} weight="regular" />
              </button>
            </div>
          </div>
        </div>

        <p className={`mt-0.5 text-sm leading-relaxed ${isUnread ? 'text-gray-600' : 'text-gray-500'}`}>
          {humanizeDates(notification.body, locale)}
        </p>

        {/* Na telefonu ni prehoda z miško, zato so akcije tu vedno vidne */}
        <div className="mt-2 flex items-center gap-1 sm:hidden">
          {isUnread && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead(notification.id);
              }}
              className="-ml-2 flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium text-[#7C78FA] transition-colors hover:bg-[#7C78FA]/10"
            >
              <CheckCircleIcon size={14} weight="regular" />
              {t('card.markRead')}
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onArchive(notification.id);
            }}
            className={`${isUnread ? '' : '-ml-2 '}flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900`}
          >
            <ArchiveIcon size={14} weight="regular" />
            {t('card.archive')}
          </button>
        </div>
      </div>
    </div>
  );
};
