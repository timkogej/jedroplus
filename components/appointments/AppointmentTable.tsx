'use client';

import { memo, useState, useMemo, useId } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'motion/react';
import {
  Eye,
  PencilSimple,
  Trash,
  CaretUp,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretDoubleLeft,
  CaretDoubleRight,
  CalendarBlank,
  User,
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

type SortField = 'datum' | 'cas_zacetek' | 'stranka_ime' | 'storitev' | 'zaposleni' | 'status';
type SortDirection = 'asc' | 'desc';

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

// Format date for display
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('sl-SI', {
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
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      aria-hidden="true"
      focusable="false"
    >
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

// Skeleton loader component
function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-slate-50">
              {[...Array(7)].map((_, i) => (
                <th key={i} className="px-4 py-4">
                  <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {[...Array(8)].map((_, rowIndex) => (
              <tr key={rowIndex}>
                {[...Array(7)].map((_, colIndex) => (
                  <td key={colIndex} className="px-4 py-4">
                    <div
                      className="h-4 animate-pulse rounded bg-gray-100"
                      style={{
                        width: colIndex === 2 ? '120px' : colIndex === 6 ? '80px' : '60px',
                        animationDelay: `${(rowIndex * 7 + colIndex) * 50}ms`,
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  const [sortField, setSortField] = useState<SortField>('datum');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [openActionsMenu, setOpenActionsMenu] = useState<string | null>(null);
  const itemsPerPage = 20;

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // Sort appointments
  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'datum':
          aValue = new Date(a.datum).getTime();
          bValue = new Date(b.datum).getTime();
          break;
        case 'cas_zacetek':
          aValue = a.cas_zacetek || '';
          bValue = b.cas_zacetek || '';
          break;
        case 'stranka_ime':
          aValue = (a.stranka_ime || '').toLowerCase();
          bValue = (b.stranka_ime || '').toLowerCase();
          break;
        case 'storitev':
          aValue = (a.storitev?.naziv || '').toLowerCase();
          bValue = (b.storitev?.naziv || '').toLowerCase();
          break;
        case 'zaposleni':
          aValue = `${a.zaposleni?.ime || ''} ${a.zaposleni?.priimek || ''}`.toLowerCase();
          bValue = `${b.zaposleni?.ime || ''} ${b.zaposleni?.priimek || ''}`.toLowerCase();
          break;
        case 'status':
          aValue = (a.status || '').toLowerCase();
          bValue = (b.status || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [appointments, sortField, sortDirection]);

  // Paginate
  const totalPages = Math.ceil(sortedAppointments.length / itemsPerPage);
  const paginatedAppointments = sortedAppointments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Sort header component
  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className="group flex items-center gap-1.5 text-left font-semibold transition-colors hover:text-[#1A1F36]"
    >
      {children}
      <span
        className={`transition-all ${
          sortField === field ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
        }`}
      >
        {sortField === field && sortDirection === 'asc' ? (
          <CaretUp className="h-3.5 w-3.5" weight="bold" />
        ) : (
          <CaretDown className="h-3.5 w-3.5" weight="bold" />
        )}
      </span>
    </button>
  );

  if (isLoading) {
    return <TableSkeleton />;
  }

  if (appointments.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-white p-12 shadow-sm ring-1 ring-gray-100"
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-100 to-slate-100">
            <CalendarBlank className="h-8 w-8 text-gray-400" weight="regular" />
          </div>
          <h3 className="mb-1 text-lg font-semibold text-[#1A1F36]">{t('table.empty.title')}</h3>
          <p className="text-sm text-gray-500">
            {t('table.empty.message')}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100"
    >
      {/* Table */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-slate-50">
              <th className="px-4 py-3.5 text-left text-[11px] uppercase tracking-wider text-gray-500">
                <SortHeader field="datum">{t('table.headers.date')}</SortHeader>
              </th>
              <th className="px-4 py-3.5 text-left text-[11px] uppercase tracking-wider text-gray-500">
                <SortHeader field="cas_zacetek">{t('table.headers.time')}</SortHeader>
              </th>
              <th className="px-4 py-3.5 text-left text-[11px] uppercase tracking-wider text-gray-500">
                <SortHeader field="stranka_ime">{t('table.headers.client')}</SortHeader>
              </th>
              <th className="px-4 py-3.5 text-left text-[11px] uppercase tracking-wider text-gray-500">
                <SortHeader field="storitev">{t('table.headers.service')}</SortHeader>
              </th>
              <th className="px-4 py-3.5 text-left text-[11px] uppercase tracking-wider text-gray-500">
                <SortHeader field="zaposleni">{t('table.headers.employee')}</SortHeader>
              </th>
              <th className="px-4 py-3.5 text-left text-[11px] uppercase tracking-wider text-gray-500">
                <SortHeader field="status">{t('table.headers.status')}</SortHeader>
              </th>
              <th className="px-4 py-3.5 text-right text-[11px] uppercase tracking-wider text-gray-500">
                {t('table.headers.actions')}
              </th>
            </tr>
          </thead>
            <motion.tbody
              key={currentPage}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="divide-y divide-gray-50"
            >
              {paginatedAppointments.map((appointment, idx) => {
                const isCancelled = normalizeStatus(appointment.status || '') === 'cancelled';
                return (
                <tr
                  key={`apt-${idx}-${appointment.id}`}
                  className={`group transition-colors hover:bg-gradient-to-r hover:from-gray-50/50 hover:to-transparent${isCancelled ? ' opacity-60' : ''}`}
                >
                  {/* Date */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="flex-shrink-0">
                        <GradientCalendarIcon size={16} />
                      </span>
                      <span className={`text-sm font-medium text-[#1A1F36] whitespace-nowrap${isCancelled ? ' line-through' : ''}`}>
                        {formatDate(appointment.datum)}
                      </span>
                    </div>
                  </td>

                  {/* Time */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 flex-shrink-0 text-gray-400 mt-0.5" weight="regular" />
                      <div className="text-sm text-gray-600">
                        <span className="whitespace-nowrap">{formatTime(appointment.cas_zacetek)}</span>
                        {appointment.cas_konec && (
                          <>
                            <span className="hidden sm:inline text-gray-400"> - {formatTime(appointment.cas_konec)}</span>
                            <span className="block sm:hidden text-gray-400">{formatTime(appointment.cas_konec)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Client - Gradient text initials, no circle */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      {/* Gradient text initials - no circle */}
                      <span
                        className="text-lg font-bold flex-shrink-0"
                        style={{
                          backgroundImage: 'linear-gradient(135deg, #7C75FC 0%, #44D0C6 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >
                        {getInitials(appointment.stranka_ime || '')}
                      </span>
                      <span className={`text-sm font-medium text-[#1A1F36]${isCancelled ? ' line-through' : ''}`}>
                        {appointment.stranka_ime || '-'}
                      </span>
                    </div>
                  </td>

                  {/* Service */}
                  <td className="px-4 py-3.5">
                    {(() => {
                      const hasService2 = !!appointment.storitev_id_2;
                      const hasService3 = !!appointment.storitev_id_3;
                      const additionalServicesCount = (hasService2 ? 1 : 0) + (hasService3 ? 1 : 0);

                      return (
                        <div className="flex items-center gap-2">
                          {appointment.storitev?.barva && (
                            <span className="flex-shrink-0">
                              <ServiceColorDot
                                gradient={appointment.storitev.barva}
                                size="md"
                                className="ring-2 ring-white"
                              />
                            </span>
                          )}
                          <span className={`text-sm text-gray-600${isCancelled ? ' line-through' : ''}`}>
                            {appointment.storitev?.naziv || '-'}
                          </span>
                          {additionalServicesCount > 0 && (
                            <span
                              className="text-sm font-bold flex-shrink-0"
                              style={{
                                backgroundImage: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                              }}
                            >
                              +{additionalServicesCount}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>

                  {/* Employee - gradient text initials, no circle */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      {appointment.zaposleni ? (
                        <>
                          <div
                            className="flex h-10 w-10 items-center justify-center text-lg font-bold flex-shrink-0"
                            style={{
                              backgroundImage: appointment.zaposleni.barva || 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                            }}
                          >
                            {appointment.zaposleni.initials}
                          </div>
                          <span className="text-sm text-gray-600">
                            {appointment.zaposleni.ime} {appointment.zaposleni.priimek}
                          </span>
                        </>
                      ) : (
                        <>
                          <div
                            className="flex h-10 w-10 items-center justify-center text-lg font-bold flex-shrink-0"
                            style={{
                              backgroundImage: 'linear-gradient(90deg, #9CA3AF 0%, #6B7280 100%)',
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                            }}
                          >
                            ?
                          </div>
                          <span className="text-sm text-gray-600">-</span>
                        </>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5">
                    <StatusBadge status={appointment.status || 'scheduled'} size="sm" />
                  </td>

                  {/* Actions - Always visible */}
                  <td className="px-4 py-3.5">
                    {(() => {
                      const canEdit = canEditAppointment ? canEditAppointment(appointment) : true;
                      return (
                        <div className="flex items-center justify-end gap-0.5 flex-nowrap">
                          {/* Complete - only show if not already completed/cancelled/no_show and user can edit */}
                          {canEdit && onComplete && !['completed', 'zaključen', 'Zaključen', 'cancelled', 'Odpovedan', 'no_show', 'Ni prišel'].includes(String(appointment.status)) && (
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
                            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-violet-50 hover:text-violet-600"
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
                              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
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
                                onClick={() => setOpenActionsMenu(openActionsMenu === appointment.id ? null : appointment.id)}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                                title={t('table.actions.moreOptions')}
                              >
                                <DotsThreeVertical className="h-4 w-4" weight="bold" />
                              </motion.button>

                              {/* Dropdown Menu */}
                              <AnimatePresence>
                                {openActionsMenu === appointment.id && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-gray-200"
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
                    })()}
                  </td>
                </tr>
              );
              })}
            </motion.tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3.5">
          {/* X–Y od Z: hidden on mobile */}
          <p className="hidden sm:block text-sm text-gray-500">
            <span className="font-medium text-[#1A1F36]">
              {(currentPage - 1) * itemsPerPage + 1}
            </span>{' '}
            –{' '}
            <span className="font-medium text-[#1A1F36]">
              {Math.min(currentPage * itemsPerPage, sortedAppointments.length)}
            </span>{' '}
            {t('table.pagination.of')}{' '}
            <span className="font-medium text-[#1A1F36]">{sortedAppointments.length}</span>
          </p>
          {/* On mobile the counter is hidden; flex layout stays consistent */}
          <div className="sm:hidden" />

          <div className="flex items-center gap-1">
            {/* First page */}
            <motion.button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              whileHover={{ scale: currentPage === 1 ? 1 : 1.05 }}
              whileTap={{ scale: currentPage === 1 ? 1 : 0.95 }}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100
                         hover:text-[#1A1F36] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CaretDoubleLeft className="h-4 w-4" weight="bold" />
            </motion.button>

            {/* Previous page */}
            <motion.button
              type="button"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              whileHover={{ scale: currentPage === 1 ? 1 : 1.05 }}
              whileTap={{ scale: currentPage === 1 ? 1 : 0.95 }}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100
                         hover:text-[#1A1F36] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CaretLeft className="h-4 w-4" weight="bold" />
            </motion.button>

            {/* Page numbers with ellipsis for large page counts */}
            <div className="flex items-center gap-1 px-1">
              {(() => {
                const pages: (number | 'ellipsis-left' | 'ellipsis-right')[] = [];
                if (totalPages <= 5) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  // Always show first page
                  pages.push(1);
                  if (currentPage > 3) pages.push('ellipsis-left');
                  // Show pages around current
                  const start = Math.max(2, currentPage - 1);
                  const end = Math.min(totalPages - 1, currentPage + 1);
                  for (let i = start; i <= end; i++) pages.push(i);
                  if (currentPage < totalPages - 2) pages.push('ellipsis-right');
                  // Always show last page
                  pages.push(totalPages);
                }
                return pages.map((p, idx) => {
                  if (p === 'ellipsis-left' || p === 'ellipsis-right') {
                    return (
                      <span key={`${p}-${idx}`} className="flex h-8 w-6 items-end justify-center pb-0.5 text-gray-400 text-sm select-none">
                        …
                      </span>
                    );
                  }
                  return (
                    <motion.button
                      key={p}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-all ${
                        currentPage === p
                          ? 'bg-black text-white shadow-md'
                          : 'text-gray-500 hover:bg-gray-100 hover:text-[#1A1F36]'
                      }`}
                    >
                      {p}
                    </motion.button>
                  );
                });
              })()}
            </div>

            {/* Next page */}
            <motion.button
              type="button"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              whileHover={{ scale: currentPage === totalPages ? 1 : 1.05 }}
              whileTap={{ scale: currentPage === totalPages ? 1 : 0.95 }}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100
                         hover:text-[#1A1F36] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CaretRight className="h-4 w-4" weight="bold" />
            </motion.button>

            {/* Last page */}
            <motion.button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              whileHover={{ scale: currentPage === totalPages ? 1 : 1.05 }}
              whileTap={{ scale: currentPage === totalPages ? 1 : 0.95 }}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100
                         hover:text-[#1A1F36] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CaretDoubleRight className="h-4 w-4" weight="bold" />
            </motion.button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default memo(AppointmentTable);
