'use client';

import { memo, useId, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'motion/react';
import {
  Eye,
  PencilSimple,
  Trash,
  Envelope,
  Phone,
  CalendarBlank,
} from '@phosphor-icons/react';
import type { Client } from '@/types/clients';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
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

const TYPE_BADGE_CLASS: Record<string, string> = {
  vip: 'bg-amber-50 text-amber-700',
  redna: 'bg-emerald-50 text-emerald-700',
  nova: 'bg-blue-50 text-blue-700',
};

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

  const columns: DataTableColumn<Client>[] = useMemo(() => {
    const typeLabel = (client: Client) => {
      if (client.tip_stranke === 'vip') return t('modal.clientType.vip');
      if (client.tip_stranke === 'redna') return t('modal.clientType.redna');
      if (client.tip_stranke === 'nova') return t('modal.clientType.nova');
      return t('modal.clientType.none');
    };

    return [
      {
        id: 'priimek',
        header: t('table.headers.client'),
        sortValue: (c) => c.priimek.toLowerCase(),
        cell: (c) => (
          <div className="flex items-center gap-3">
            {/* Gradientne začetnice — brez kroga okoli */}
            <ClientInitialsBadge firstName={c.ime} lastName={c.priimek} size="md" variant="text" />
            <p className="truncate text-sm font-medium text-gray-900">
              {c.ime} {c.priimek}
            </p>
          </div>
        ),
      },
      {
        id: 'email',
        header: 'Email',
        sortValue: (c) => c.email.toLowerCase(),
        cell: (c) => (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Envelope className="h-4 w-4 flex-shrink-0 text-gray-400" weight="regular" />
            <span className="truncate">{c.email || '-'}</span>
          </div>
        ),
      },
      {
        id: 'tip_stranke',
        header: t('table.headers.clientType'),
        cell: (c) => (
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
              TYPE_BADGE_CLASS[c.tip_stranke ?? ''] ?? 'bg-gray-100 text-gray-500'
            }`}
          >
            {typeLabel(c)}
          </span>
        ),
      },
      {
        id: 'telefon',
        header: t('table.headers.phone'),
        cell: (c) => (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone className="h-4 w-4 flex-shrink-0 text-gray-400" weight="regular" />
            <span className="tnum whitespace-nowrap">{c.telefon || '-'}</span>
          </div>
        ),
      },
      {
        id: 'appointment_count',
        header: t('table.headers.appointments'),
        sortValue: (c) => c.appointment_count || 0,
        cell: (c) => (
          <div className="flex items-center gap-1.5">
            <GradientCalendarIcon size={16} />
            <span className="tnum text-sm text-gray-900">{c.appointment_count || 0}</span>
          </div>
        ),
      },
      {
        id: 'created_at',
        header: t('table.headers.lastInteraction'),
        sortValue: (c) => new Date(c.created_at || 0).getTime(),
        cell: (c) => (
          <span className="tnum whitespace-nowrap text-sm text-gray-500">
            {c.zadnja_interakcija ? formatDate(c.zadnja_interakcija) : '/'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('table.headers.actions'),
        align: 'right',
        cell: (c) => (
          <Actions
            client={c}
            t={t}
            canViewClient={canViewClient}
            canEditClient={canEditClient}
            canDeleteClient={canDeleteClient}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ),
      },
    ];
  }, [t, canViewClient, canEditClient, canDeleteClient, onView, onEdit, onDelete]);

  return (
    <DataTable<Client>
      rows={clients}
      columns={columns}
      rowKey={(c) => c.id}
      isLoading={isLoading}
      pageSize={20}
      defaultSort={{ columnId: 'priimek', direction: 'asc' }}
      ofLabel={t('table.pagination.of')}
      empty={
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white p-12 text-center">
          <CalendarBlank className="mb-3 h-7 w-7 text-gray-300" weight="regular" />
          <h3 className="mb-1 text-base font-semibold text-gray-900">{t('table.empty.title')}</h3>
          <p className="text-sm text-gray-500">{t('table.empty.message')}</p>
        </div>
      }
      mobile={{
        leading: (c) => (
          <ClientInitialsBadge firstName={c.ime} lastName={c.priimek} size="md" variant="text" />
        ),
        title: (c) => `${c.ime} ${c.priimek}`,
        subtitle: (c) => c.email || c.telefon || '-',
        meta: (c) => (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[13px] text-gray-500">
              <GradientCalendarIcon size={14} />
              <span className="tnum">{c.appointment_count || 0}</span>
            </span>
            {c.telefon && <span className="tnum text-[13px] text-gray-400">{c.telefon}</span>}
          </div>
        ),
        trailing: (c) => (
          <Actions
            client={c}
            t={t}
            canViewClient={canViewClient}
            canEditClient={canEditClient}
            canDeleteClient={canDeleteClient}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ),
      }}
    />
  );
}

/** Ogled / uredi / izbriši — ista trojica v tabeli in v mobilnem seznamu. */
function Actions({
  client,
  t,
  canViewClient,
  canEditClient,
  canDeleteClient,
  onView,
  onEdit,
  onDelete,
}: {
  client: Client;
  t: ReturnType<typeof useTranslations<'clients'>>;
  canViewClient: boolean;
  canEditClient: boolean;
  canDeleteClient: boolean;
  onView: (client: Client) => void;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      {canViewClient && (
        <motion.button
          type="button"
          onClick={() => onView(client)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
          title={t('table.actions.view')}
        >
          <Eye className="h-4 w-4" weight="regular" />
        </motion.button>
      )}
      {canEditClient && (
        <motion.button
          type="button"
          onClick={() => onEdit(client)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
          title={t('table.actions.edit')}
        >
          <PencilSimple className="h-4 w-4" weight="regular" />
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
          <Trash className="h-4 w-4" weight="regular" />
        </motion.button>
      )}
    </div>
  );
}

export default memo(ClientTable);
