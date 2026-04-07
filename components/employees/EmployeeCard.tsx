'use client';

import { memo } from 'react';
import { motion } from 'motion/react';
import {
  Envelope,
  Phone,
  Briefcase,
  PencilSimple,
  Trash,
  ToggleLeft,
  ToggleRight,
  GearSix,
  LinkSimple,
} from '@phosphor-icons/react';
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
  const fullName = `${employee.ime} ${employee.priimek}`.trim();
  const gradient = employee.barva || 'linear-gradient(135deg, #8B5CF6, #06B6D4)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.12)' }}
      className={`group relative overflow-hidden rounded-2xl bg-white shadow-sm transition-all ${!employee.aktivna ? 'opacity-60' : ''}`}
      style={isConnected ? {
        border: '2px solid transparent',
        background: `linear-gradient(white, white) padding-box, ${gradient} border-box`,
      } : {
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        border: '1px solid rgb(243 244 246)',
      }}
    >
      {/* Content */}
      <div className="p-5">
        {/* Avatar and name section */}
        <div className="flex flex-col items-center text-center">
          {/* Large avatar */}
          <EmployeeAvatar
            firstName={employee.ime}
            lastName={employee.priimek}
            gradient={employee.barva}
            size="2xl"
          />

          {/* Name */}
          <h3 className="mt-4 text-lg font-semibold text-[#1A1F36] line-clamp-1">
            {fullName}
          </h3>

          {/* Position badge — always reserve space so card height stays consistent */}
          <div className="mt-2 h-[26px] flex items-center justify-center">
            {employee.pozicija ? (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
                <Briefcase className="h-3 w-3" weight="regular" />
                {employee.pozicija}
              </div>
            ) : !employee.aktivna ? (
              <div className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                Neaktiven
              </div>
            ) : null}
          </div>

          {/* Inactive badge when pozicija is also set */}
          {employee.pozicija && !employee.aktivna && (
            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              Neaktiven
            </div>
          )}
        </div>

        {/* Contact info — always reserve two rows for consistent card height */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Envelope className="h-4 w-4 flex-shrink-0 text-gray-400" weight="regular" />
            <span className="truncate">{employee.email || '—'}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 flex-shrink-0 text-gray-400" weight="regular" />
            <span className={employee.telefon ? 'text-gray-600' : 'text-gray-300'}>
              {employee.telefon || '—'}
            </span>
          </div>
        </div>

        {/* Stats: Danes, Teden, Mesec */}
        <div className="mt-4 flex items-center justify-center gap-4 border-t border-gray-100 pt-4">
          <div className="text-center">
            <p className="text-lg font-bold text-[#1A1F36]">{employee.appointments_today || 0}</p>
            <p className="text-xs text-gray-500">Danes</p>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="text-center">
            <p className="text-lg font-bold text-[#1A1F36]">{employee.appointments_week || 0}</p>
            <p className="text-xs text-gray-500">Teden</p>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="text-center">
            <p className="text-lg font-bold text-[#1A1F36]">{employee.appointments_month || employee.total_appointments || 0}</p>
            <p className="text-xs text-gray-500">Mesec</p>
          </div>
        </div>

        {/* Connect button */}
        {showConnectButton && onConnect && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onConnect(employee); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500/10 to-cyan-500/10 px-3 py-2 text-xs font-medium text-violet-700 ring-1 ring-violet-200 transition-colors hover:from-violet-500/20 hover:to-cyan-500/20 hover:ring-violet-300"
            >
              <LinkSimple className="h-3.5 w-3.5" weight="bold" />
              Poveži moj račun s to osebo
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
          {/* Toggle active */}
          <motion.button
            type="button"
            onClick={() => onToggleActive(employee)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors
                       ${employee.aktivna
                         ? 'text-emerald-600 hover:bg-emerald-50'
                         : 'text-gray-500 hover:bg-gray-100'
                       }`}
          >
            {employee.aktivna ? (
              <>
                <ToggleRight className="h-4 w-4" weight="fill" />
                Aktiven
              </>
            ) : (
              <>
                <ToggleLeft className="h-4 w-4" weight="regular" />
                Neaktiven
              </>
            )}
          </motion.button>

          {/* Settings/Edit/Delete buttons */}
          <div className="flex items-center gap-1">
            {canEdit && onSettings && (
              <motion.button
                type="button"
                onClick={() => onSettings(employee)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-violet-50 hover:text-violet-600"
                title="Nastavitve urnika in storitev"
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
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-pink-50 hover:text-pink-600"
                title="Uredi podatke"
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
                title="Izbriši"
              >
                <Trash className="h-4 w-4" weight="regular" />
              </motion.button>
            )}
          </div>
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
      transition={{ delay: index * 0.05 }}
      className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100"
    >
      <div className="p-5">
        {/* Avatar skeleton */}
        <div className="flex flex-col items-center">
          <div className="h-28 w-28 animate-pulse rounded-full bg-gray-200" />
          <div className="mt-4 h-6 w-32 animate-pulse rounded-lg bg-gray-200" />
          <div className="mt-2 h-5 w-20 animate-pulse rounded-full bg-gray-200" />
        </div>

        {/* Contact info skeleton */}
        <div className="mt-4 space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
        </div>

        {/* Stats skeleton */}
        <div className="mt-4 flex items-center justify-center gap-4 border-t border-gray-100 pt-4">
          <div className="text-center">
            <div className="mx-auto h-6 w-8 animate-pulse rounded bg-gray-200" />
            <div className="mx-auto mt-1 h-3 w-12 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="text-center">
            <div className="mx-auto h-6 w-8 animate-pulse rounded bg-gray-200" />
            <div className="mx-auto mt-1 h-3 w-12 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="text-center">
            <div className="mx-auto h-6 w-8 animate-pulse rounded bg-gray-200" />
            <div className="mx-auto mt-1 h-3 w-12 animate-pulse rounded bg-gray-200" />
          </div>
        </div>

        {/* Actions skeleton */}
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
          <div className="h-8 w-20 animate-pulse rounded-lg bg-gray-200" />
          <div className="flex items-center gap-1">
            <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-200" />
            <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-200" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default memo(EmployeeCard);
