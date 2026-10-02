'use client';

import { memo } from 'react';
import { motion } from 'motion/react';
import {
  Envelope,
  Phone,
  PencilSimple,
  Trash,
  GearSix,
  LinkSimple,
} from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import type { Employee } from '@/types/employees';
import EmployeeAvatar from './EmployeeAvatar';

interface EmployeeCardProps {
  employee: Employee;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onToggleActive: (employee: Employee) => void;
  onSettings?: (employee: Employee) => void;
  onConnect?: (employee: Employee) => void;
  showConnectButton?: boolean;
  index?: number;
  /** If false, hides edit and settings buttons */
  canEdit?: boolean;
  /** If false, hides delete button */
  canDelete?: boolean;
  /** Highlight this card with a gradient border (the user's connected employee) */
  isConnected?: boolean;
}

function EmployeeCard({
  employee,
  onEdit,
  onDelete,
  onToggleActive,
  onSettings,
  onConnect,
  showConnectButton = false,
  index = 0,
  canEdit = true,
  canDelete = true,
  isConnected = false,
}: EmployeeCardProps) {
  const t = useTranslations('staff');
  const fullName = `${employee.ime} ${employee.priimek}`.trim();
  const gradient = employee.barva || 'linear-gradient(135deg, #8B5CF6, #06B6D4)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white p-5 transition-colors ${
        !employee.aktivna ? 'opacity-60' : ''
      }`}
      style={
        isConnected
          ? {
              border: '2px solid transparent',
              background: `linear-gradient(white, white) padding-box, ${gradient} border-box`,
            }
          : { border: '1px solid rgb(243 244 246)' }
      }
    >
      {/* Avatar in ime */}
      <div className="flex items-center gap-3">
        <EmployeeAvatar
          firstName={employee.ime}
          lastName={employee.priimek}
          gradient={employee.barva}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 text-[15px] font-semibold text-gray-900">{fullName}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {employee.pozicija && (
              <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                {employee.pozicija}
              </span>
            )}
            {!employee.aktivna && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {t('card.inactive')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Contact info */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Envelope className="h-4 w-4 flex-shrink-0 text-gray-400" weight="regular" />
          <span className="truncate">{employee.email || '—'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Phone className="h-4 w-4 flex-shrink-0 text-gray-400" weight="regular" />
          <span className={employee.telefon ? 'tnum text-gray-600' : 'text-gray-300'}>
            {employee.telefon || '—'}
          </span>
        </div>
      </div>

      {/* Stats: Danes, Teden, Mesec — lasne črte kot v Applovem Fitnessu */}
      <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-gray-100 bg-gray-100">
        <div className="bg-white px-2 py-2.5 text-center">
          <p className="tnum text-lg font-semibold text-gray-900">{employee.appointments_today || 0}</p>
          <p className="text-xs text-gray-500">{t('card.statsToday')}</p>
        </div>
        <div className="bg-white px-2 py-2.5 text-center">
          <p className="tnum text-lg font-semibold text-gray-900">{employee.appointments_week || 0}</p>
          <p className="text-xs text-gray-500">{t('card.statsWeek')}</p>
        </div>
        <div className="bg-white px-2 py-2.5 text-center">
          <p className="tnum text-lg font-semibold text-gray-900">{employee.appointments_month ?? 0}</p>
          <p className="text-xs text-gray-500">{t('card.statsMonth')}</p>
        </div>
      </div>

      {/* Connect button */}
      {showConnectButton && onConnect && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onConnect(employee); }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-[13px] font-medium text-violet-700 transition-colors hover:bg-violet-100"
        >
          <LinkSimple className="h-3.5 w-3.5" weight="bold" />
          {t('card.connectButton')}
        </button>
      )}

      {/* Prožna vrzel drži akcije poravnane na dnu vseh kartic v mreži. */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
        {/* Toggle active */}
        <button
          type="button"
          onClick={() => onToggleActive(employee)}
          className={`rounded-lg px-2 py-1 text-[13px] font-medium transition-colors ${
            employee.aktivna
              ? 'text-emerald-600 hover:bg-emerald-50'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          {employee.aktivna ? t('card.toggleActive') : t('card.toggleInactive')}
        </button>

        {/* Settings/Edit/Delete buttons */}
        <div className="flex items-center gap-0.5">
          {canEdit && onSettings && (
            <motion.button
              type="button"
              onClick={() => onSettings(employee)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
              title={t('card.tooltipSettings')}
            >
              <GearSix className="h-4 w-4" weight="regular" />
            </motion.button>
          )}
          {canEdit && (
            <motion.button
              type="button"
              onClick={() => onEdit(employee)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
              title={t('card.tooltipEdit')}
            >
              <PencilSimple className="h-4 w-4" weight="regular" />
            </motion.button>
          )}
          {canDelete && (
            <motion.button
              type="button"
              onClick={() => onDelete(employee)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
              title={t('card.tooltipDelete')}
            >
              <Trash className="h-4 w-4" weight="regular" />
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Loading skeleton for EmployeeCard
export function EmployeeCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.03 }}
      className="rounded-2xl border border-gray-100 bg-white p-5"
    >
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 flex-shrink-0 animate-pulse rounded-full bg-gray-100" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="mt-4 h-16 animate-pulse rounded-xl bg-gray-100" />
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
        <div className="h-6 w-20 animate-pulse rounded bg-gray-100" />
        <div className="flex items-center gap-1">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-100" />
        </div>
      </div>
    </motion.div>
  );
}

export default memo(EmployeeCard);
