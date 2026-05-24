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
  Envelope,
  Phone,
  CalendarBlank,
} from '@phosphor-icons/react';
import type { Client, ClientSortField, SortDirection } from '@/types/clients';
import ClientInitialsBadge from './ClientInitialsBadge';

interface ClientTableProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  onView: (client: Client) => void;
  isLoading?: boolean;
  canViewClient?: boolean;
  canEditClient?: boolean;
  canDeleteClient?: boolean;
}

// Format date for display
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('sl-SI', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
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
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
                    <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
                  </div>
                </td>
                {[...Array(6)].map((_, colIndex) => (
                  <td key={colIndex} className="px-4 py-4">
                    <div
                      className="h-4 animate-pulse rounded bg-gray-100"
                      style={{
                        width: colIndex === 1 ? '140px' : colIndex === 5 ? '80px' : '80px',
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

// Sort icon component
function SortIcon({ field, currentField, direction }: { field: ClientSortField; currentField: ClientSortField; direction: SortDirection }) {
  if (field !== currentField) {
    return <CaretDown className="h-3 w-3 text-gray-300" weight="bold" />;
  }
  return direction === 'asc' ? (
    <CaretUp className="h-3 w-3 text-[#1A1F36]" weight="bold" />
  ) : (
    <CaretDown className="h-3 w-3 text-[#1A1F36]" weight="bold" />
  );
}

function ClientTable({
  clients,
  onEdit,
  onDelete,
  onView,
  isLoading = false,
  canViewClient = true,
  canEditClient = true,
  canDeleteClient = true,
}: ClientTableProps) {
  const t = useTranslations('clients');
  const [sortField, setSortField] = useState<ClientSortField>('priimek');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Handle sort
  const handleSort = (field: ClientSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // Sort clients
  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'ime':
          aValue = a.ime.toLowerCase();
          bValue = b.ime.toLowerCase();
          break;
        case 'priimek':
          aValue = a.priimek.toLowerCase();
          bValue = b.priimek.toLowerCase();
          break;
        case 'email':
          aValue = a.email.toLowerCase();
          bValue = b.email.toLowerCase();
          break;
        case 'created_at':
          aValue = new Date(a.created_at || 0).getTime();
          bValue = new Date(b.created_at || 0).getTime();
          break;
        case 'appointment_count':
          aValue = a.appointment_count || 0;
          bValue = b.appointment_count || 0;
          break;
        default:
          aValue = '';
          bValue = '';
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue, 'sl')
          : bValue.localeCompare(aValue, 'sl');
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      }
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    });
  }, [clients, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedClients.length / itemsPerPage);
  const paginatedClients = sortedClients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Show skeleton during loading
  if (isLoading) {
    return <TableSkeleton />;
  }

  // Empty state
  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-12 shadow-sm ring-1 ring-gray-100">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-pink-100 to-purple-100">
          <CalendarBlank className="h-8 w-8 text-purple-500" weight="duotone" />
        </div>
        <h3 className="text-lg font-semibold text-[#1A1F36]">{t('table.empty.title')}</h3>
        <p className="mt-1 text-sm text-gray-500">
          {t('table.empty.message')}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-slate-50">
              <th className="px-4 py-4 text-left">
                <button
                  type="button"
                  onClick={() => handleSort('priimek')}
                  className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 transition-colors hover:text-[#1A1F36]"
                >
                  {t('table.headers.client')}
                  <SortIcon field="priimek" currentField={sortField} direction={sortDirection} />
                </button>
              </th>
              <th className="px-4 py-4 text-left">
                <button
                  type="button"
                  onClick={() => handleSort('email')}
                  className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 transition-colors hover:text-[#1A1F36]"
                >
                  Email
                  <SortIcon field="email" currentField={sortField} direction={sortDirection} />
                </button>
              </th>
              <th className="px-4 py-4 text-left">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {t('table.headers.phone')}
                </span>
              </th>
              <th className="px-4 py-4 text-left">
                <button
                  type="button"
                  onClick={() => handleSort('appointment_count')}
                  className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 transition-colors hover:text-[#1A1F36]"
                >
                  {t('table.headers.appointments')}
                  <SortIcon field="appointment_count" currentField={sortField} direction={sortDirection} />
                </button>
              </th>
              <th className="px-4 py-4 text-left">
                <button
                  type="button"
                  onClick={() => handleSort('created_at')}
                  className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 transition-colors hover:text-[#1A1F36]"
                >
                  {t('table.headers.lastInteraction')}
                  <SortIcon field="created_at" currentField={sortField} direction={sortDirection} />
                </button>
              </th>
              <th className="px-4 py-4 text-right">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {t('table.headers.actions')}
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            <AnimatePresence mode="popLayout">
              {paginatedClients.map((client, index) => (
                <motion.tr
                  key={client.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.02 }}
                  className="group transition-colors hover:bg-gradient-to-r hover:from-pink-50/30 hover:to-purple-50/30"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* Gradient text initials - no circle */}
                      <ClientInitialsBadge
                        firstName={client.ime}
                        lastName={client.priimek}
                        size="md"
                        variant="text"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[#1A1F36]">
                          {client.ime} {client.priimek}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Envelope className="h-4 w-4 flex-shrink-0 text-gray-400" weight="regular" />
                      <span className="truncate">{client.email || '-'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="h-4 w-4 flex-shrink-0 text-gray-400" weight="regular" />
                      <span>{client.telefon || '-'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {/* COMPACT APPOINTMENTS COUNT - NOT BOLD */}
                    <div className="flex items-center gap-1.5">
                      <GradientCalendarIcon size={16} />
                      <span className="text-sm text-gray-900">
                        {client.appointment_count || 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {/* Zadnja interakcija - show last interaction date from Supabase or "/" if none */}
                    <span className="text-sm text-gray-500">
                      {client.zadnja_interakcija
                        ? formatDate(client.zadnja_interakcija)
                        : '/'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canViewClient && (
                        <motion.button
                          type="button"
                          onClick={() => onView(client)}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                          title={t('table.actions.view')}
                        >
                          <Eye className="h-4 w-4" weight="bold" />
                        </motion.button>
                      )}
                      {canEditClient && (
                        <motion.button
                          type="button"
                          onClick={() => onEdit(client)}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                          title={t('table.actions.edit')}
                        >
                          <PencilSimple className="h-4 w-4" weight="bold" />
                        </motion.button>
                      )}
                      {canDeleteClient && (
                        <motion.button
                          type="button"
                          onClick={() => onDelete(client)}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          title={t('table.actions.delete')}
                        >
                          <Trash className="h-4 w-4" weight="bold" />
                        </motion.button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
          <p className="text-sm text-gray-500">
            <span className="font-medium text-[#1A1F36]">
              {(currentPage - 1) * itemsPerPage + 1}
            </span>{' '}
            –{' '}
            <span className="font-medium text-[#1A1F36]">
              {Math.min(currentPage * itemsPerPage, sortedClients.length)}
            </span>{' '}
            {t('table.pagination.of')} <span className="font-medium text-[#1A1F36]">{sortedClients.length}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#1A1F36] disabled:opacity-30"
            >
              <CaretDoubleLeft className="h-4 w-4" weight="bold" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#1A1F36] disabled:opacity-30"
            >
              <CaretLeft className="h-4 w-4" weight="bold" />
            </button>
            <div className="flex items-center gap-1 px-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all
                               ${currentPage === pageNum
                                 ? 'bg-black text-white shadow-sm'
                                 : 'text-gray-500 hover:bg-gray-100 hover:text-[#1A1F36]'
                               }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#1A1F36] disabled:opacity-30"
            >
              <CaretRight className="h-4 w-4" weight="bold" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#1A1F36] disabled:opacity-30"
            >
              <CaretDoubleRight className="h-4 w-4" weight="bold" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ClientTable);
