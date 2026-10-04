'use client';

import { memo, useId, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { intlLocale } from '@/lib/format';
import { motion, AnimatePresence } from 'motion/react';
import {
  Eye,
  PencilSimple,
  Trash,
  CalendarBlank,
  Clock,
  CheckCircle,
  DotsThreeVertical,
  UserMinus,
  XCircle,
} from '@phosphor-icons/react';
import type { AppointmentWithDetails } from '@/types/appointments';
import { normalizeStatus } from './StatusBadge';
import StatusBadge from './StatusBadge';
import ServiceColorDot from '@/components/shared/ServiceColorDot';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';

interface AppointmentTableProps {
  appointments: AppointmentWithDetails[];
  onEdit: (appointment: AppointmentWithDetails) => void;
  onDelete: (appointment: AppointmentWithDetails) => void;
  onView: (appointment: AppointmentWithDetails) => void;
  onComplete?: (appointment: AppointmentWithDetails) => void;
  onNoShow?: (appointment: AppointmentWithDetails) => void;
  onCancel?: (appointment: AppointmentWithDetails) => void;
  isLoading?: boolean;
  /** Per-appointment edit access: if provided and returns false, hides edit/complete/noshow/cancel for that row */
  canEditAppointment?: (appointment: AppointmentWithDetails) => boolean;
  /** If false, hides the delete button for all rows */
  canDeleteAppointment?: boolean;
}

/** Stanja, po katerih termina ni več mogoče zaključiti. */
const CLOSED_STATUSES = [
  'completed', 'zaključen', 'Zaključen',
  'cancelled', 'Odpovedan',
  'no_show', 'Ni prišel',
];

// Format date for display
function formatDate(dateStr: string, locale: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(intlLocale(locale), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// Format time for display
function formatTime(timeStr: string): string {
  if (!timeStr) return '-';
  // Handle various time formats
  if (timeStr.includes('T')) {
    // ISO format
    const date = new Date(timeStr);
    return date.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
  }
  // HH:mm format
  return timeStr.substring(0, 5);
}

/** Krajši zapis za mobilni seznam: "3. 10." brez leta. */
function formatDateShort(dateStr: string, locale: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'numeric' });
  } catch {
    return dateStr;
  }
}

// Get initials from name
function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return '?';
}

const CALENDAR_ICON_PATH =
  'M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Z';

function GradientCalendarIcon({ size = 16 }: { size?: number }) {
  const gradientId = useId();

  return (
    <svg width={size} height={size} viewBox="0 0 256 256" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <path d={CALENDAR_ICON_PATH} fill={`url(#${gradientId})`} />
    </svg>
  );
}

/** Gradientne začetnice stranke — brez kroga okoli. */
function ClientInitials({ name }: { name: string }) {
  return (
    <span
      className="flex-shrink-0 text-lg font-bold"
      style={{
        backgroundImage: 'linear-gradient(135deg, #7C75FC 0%, #44D0C6 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}
    >
      {getInitials(name)}
    </span>
  );
}

/** Koliko dodatnih storitev in dodatkov visi na terminu. */
function extraServiceCount(a: AppointmentWithDetails): number {
  return (a.storitev_id_2 ? 1 : 0) + (a.storitev_id_3 ? 1 : 0) + (a.add_on_naziv ? 1 : 0);
}

function ServiceCell({ appointment, struck }: { appointment: AppointmentWithDetails; struck: boolean }) {
  const extra = extraServiceCount(appointment);
  return (
    <div className="flex items-center gap-2">
      {appointment.storitev?.barva && (
        <span className="flex-shrink-0">
          <ServiceColorDot gradient={appointment.storitev.barva} size="md" className="ring-2 ring-white" />
        </span>
      )}
      <span className={`text-sm text-gray-600${struck ? ' line-through' : ''}`}>
        {appointment.storitev?.naziv || '-'}
      </span>
      {extra > 0 && (
        <span
          className="flex-shrink-0 text-sm font-bold"
          style={{
            backgroundImage: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

function AppointmentTable({
  appointments,
  onEdit,
  onDelete,
  onView,
  onComplete,
  onNoShow,
  onCancel,
  isLoading = false,
  canEditAppointment,
  canDeleteAppointment = true,
}: AppointmentTableProps) {
  const t = useTranslations('appointments');
  const locale = useLocale();
  const [openActionsMenu, setOpenActionsMenu] = useState<string | null>(null);

  const renderActions = (appointment: AppointmentWithDetails) => {
    const canEdit = canEditAppointment ? canEditAppointment(appointment) : true;
    return (
      <div className="flex flex-nowrap items-center justify-end gap-0.5">
        {/* Complete - only show if not already completed/cancelled/no_show and user can edit */}
        {canEdit && onComplete && !CLOSED_STATUSES.includes(String(appointment.status)) && (
          <motion.button
            type="button"
            onClick={() => onComplete(appointment)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
            title={t('table.actions.complete')}
          >
            <CheckCircle className="h-4 w-4" weight="regular" />
          </motion.button>
        )}
        {/* View */}
        <motion.button
          type="button"
          onClick={() => onView(appointment)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
          title={t('table.actions.view')}
        >
          <Eye className="h-4 w-4" weight="regular" />
        </motion.button>
        {/* Edit */}
        {canEdit && (
          <motion.button
            type="button"
            onClick={() => onEdit(appointment)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
            title={t('table.actions.edit')}
          >
            <PencilSimple className="h-4 w-4" weight="regular" />
          </motion.button>
        )}
        {/* Actions Menu (No Show, Cancel, Delete) — only when at least one action is available */}
        {(canEdit || canDeleteAppointment) && (
          <div className="relative">
            <motion.button
              type="button"
              onClick={() =>
                setOpenActionsMenu(openActionsMenu === appointment.id ? null : appointment.id)
              }
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              title={t('table.actions.moreOptions')}
            >
              <DotsThreeVertical className="h-4 w-4" weight="bold" />
            </motion.button>

            <AnimatePresence>
              {openActionsMenu === appointment.id && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-xl border border-gray-100 bg-white/90 py-1 shadow-lg backdrop-blur-xl backdrop-saturate-150"
                >
                  {/* No Show */}
                  {canEdit && onNoShow && (
                    <button
                      type="button"
                      onClick={() => {
                        onNoShow(appointment);
                        setOpenActionsMenu(null);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-amber-50 hover:text-amber-700"
                    >
                      <UserMinus className="h-4 w-4" weight="regular" />
                      No Show
                    </button>
                  )}
                  {/* Cancel */}
                  {canEdit && onCancel && (
                    <button
                      type="button"
                      onClick={() => {
                        onCancel(appointment);
                        setOpenActionsMenu(null);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-orange-50 hover:text-orange-700"
                    >
                      <XCircle className="h-4 w-4" weight="regular" />
                      {t('table.actions.cancel')}
                    </button>
                  )}
                  {/* Delete */}
                  {canDeleteAppointment && (
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(appointment);
                        setOpenActionsMenu(null);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash className="h-4 w-4" weight="regular" />
                      {t('table.actions.delete')}
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  };

  const columns: DataTableColumn<AppointmentWithDetails>[] = useMemo(
    () => [
      {
        id: 'datum',
        header: t('table.headers.date'),
        sortValue: (a) => new Date(a.datum).getTime(),
        cell: (a) => {
          const struck = normalizeStatus(a.status || '') === 'cancelled';
          return (
            <div className="flex items-center gap-2">
              <span className="flex-shrink-0">
                <GradientCalendarIcon size={16} />
              </span>
              <span
                className={`tnum whitespace-nowrap text-sm font-medium text-gray-900${struck ? ' line-through' : ''}`}
              >
                {formatDate(a.datum, locale)}
              </span>
            </div>
          );
        },
      },
      {
        id: 'cas_zacetek',
        header: t('table.headers.time'),
        sortValue: (a) => a.cas_zacetek || '',
        cell: (a) => (
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" weight="regular" />
            <div className="tnum whitespace-nowrap text-sm text-gray-600">
              <span>{formatTime(a.cas_zacetek)}</span>
              {a.cas_konec && <span className="text-gray-400"> – {formatTime(a.cas_konec)}</span>}
            </div>
          </div>
        ),
      },
      {
        id: 'stranka_ime',
        header: t('table.headers.client'),
        sortValue: (a) => (a.stranka_ime || '').toLowerCase(),
        cell: (a) => {
          const struck = normalizeStatus(a.status || '') === 'cancelled';
          return (
            <div className="flex items-center gap-3">
              <ClientInitials name={a.stranka_ime || ''} />
              <span className={`text-sm font-medium text-gray-900${struck ? ' line-through' : ''}`}>
                {a.stranka_ime || '-'}
              </span>
            </div>
          );
        },
      },
      {
        id: 'storitev',
        header: t('table.headers.service'),
        sortValue: (a) => (a.storitev?.naziv || '').toLowerCase(),
        cell: (a) => (
          <ServiceCell appointment={a} struck={normalizeStatus(a.status || '') === 'cancelled'} />
        ),
      },
      {
        id: 'zaposleni',
        header: t('table.headers.employee'),
        sortValue: (a) =>
          `${a.zaposleni?.ime || ''} ${a.zaposleni?.priimek || ''}`.toLowerCase(),
        cell: (a) => (
          <div className="flex items-center gap-3">
            {/* Gradientne začetnice zaposlenega — brez kroga okoli */}
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center text-lg font-bold"
              style={{
                backgroundImage:
                  a.zaposleni?.barva ||
                  (a.zaposleni
                    ? 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)'
                    : 'linear-gradient(90deg, #9CA3AF 0%, #6B7280 100%)'),
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {a.zaposleni ? a.zaposleni.initials : '?'}
            </div>
            <span className="text-sm text-gray-600">
              {a.zaposleni ? `${a.zaposleni.ime} ${a.zaposleni.priimek}` : '-'}
            </span>
          </div>
        ),
      },
      {
        id: 'status',
        header: t('table.headers.status'),
        sortValue: (a) => (a.status || '').toLowerCase(),
        cell: (a) => <StatusBadge status={a.status || 'scheduled'} size="sm" />,
      },
      {
        id: 'actions',
        header: t('table.headers.actions'),
        align: 'right',
        cell: (a) => renderActions(a),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, openActionsMenu, canEditAppointment, canDeleteAppointment, onView, onEdit, onDelete, onComplete, onNoShow, onCancel],
  );

  return (
    <DataTable<AppointmentWithDetails>
      rows={appointments}
      columns={columns}
      rowKey={(a, index) => `apt-${index}-${a.id}`}
      isLoading={isLoading}
      pageSize={20}
      defaultSort={{ columnId: 'datum', direction: 'desc' }}
      ofLabel={t('table.pagination.of')}
      rowClassName={(a) =>
        normalizeStatus(a.status || '') === 'cancelled' ? 'opacity-60' : ''
      }
      empty={
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-gray-100 bg-white p-12"
        >
          <div className="flex flex-col items-center justify-center text-center">
            <CalendarBlank className="mb-3 h-7 w-7 text-gray-300" weight="regular" />
            <h3 className="mb-1 text-base font-semibold text-gray-900">{t('table.empty.title')}</h3>
            <p className="text-sm text-gray-500">{t('table.empty.message')}</p>
          </div>
        </motion.div>
      }
      mobile={{
        leading: (a) => <ClientInitials name={a.stranka_ime || ''} />,
        title: (a) => a.stranka_ime || '-',
        subtitle: (a) => (
          <span className="tnum">
            {formatDateShort(a.datum, locale)} · {formatTime(a.cas_zacetek)}
            {a.cas_konec ? `–${formatTime(a.cas_konec)}` : ''}
          </span>
        ),
        meta: (a) => (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={a.status || 'scheduled'} size="sm" />
            <ServiceCell appointment={a} struck={false} />
          </div>
        ),
        trailing: (a) => renderActions(a),
      }}
    />
  );
}

export default memo(AppointmentTable);
