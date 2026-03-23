'use client';

import { memo } from 'react';
import { motion } from 'motion/react';
import {
  Clock,
  CurrencyEur,
  CalendarBlank,
  Folder,
  PencilSimple,
  Trash,
  ToggleLeft,
  ToggleRight,
} from '@phosphor-icons/react';
import { SERVICE_CATEGORIES } from '@/types/services';
import type { Service } from '@/types/services';
import { isGradient, DEFAULT_SERVICE_GRADIENT, getGradientStartColor } from '@/lib/constants/serviceGradients';

interface ServiceCardProps {
  service: Service;
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
  onToggleActive: (service: Service) => void;
  index?: number;
  canEdit?: boolean;
  canDelete?: boolean;
}

function ServiceCard({
  service,
  onEdit,
  onDelete,
  onToggleActive,
  index = 0,
  canEdit = true,
  canDelete = true,
}: ServiceCardProps) {
  // Handle both gradient strings and legacy hex colors
  const displayGradient = isGradient(service.barva)
    ? service.barva
    : DEFAULT_SERVICE_GRADIENT;
  const indicatorColor = getGradientStartColor(displayGradient);

  const categoryLabel = service.kategorija
    ? SERVICE_CATEGORIES.find((c) => c.value === service.kategorija)?.label || service.kategorija
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: service.aktivna ? 1 : 0.6, y: 0 }}
      transition={{
        opacity: { duration: 0.15 },
        y: { delay: index * 0.05, duration: 0.3 },
      }}
      whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.12)' }}
      className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100"
    >
      {/* Color gradient header */}
      <div
        className="relative h-16 w-full"
        style={{ background: displayGradient }}
      >
        {/* Active/Inactive badge */}
        {!service.aktivna && (
          <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-gray-600 shadow-sm">
            Neaktivna
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Service name */}
        <h3 className="text-lg font-semibold text-[#1A1F36] line-clamp-1">
          {service.naziv}
        </h3>

        {/* Category badge */}
        {categoryLabel && (
          <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600">
            <Folder className="h-3 w-3" weight="fill" />
            {categoryLabel}
          </div>
        )}

        {/* Duration and price row */}
        <div className="mt-2 flex items-center gap-3 text-sm text-gray-600">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-gray-400" weight="regular" />
            <span>{service.trajanje} min</span>
          </div>
          {service.cena !== null && (
            <>
              <span className="text-gray-300">|</span>
              <div className="flex items-center gap-1">
                <CurrencyEur className="h-4 w-4 text-gray-400" weight="regular" />
                <span className="font-medium">{service.cena.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        {/* Appointment count */}
        <div className="mt-3 flex items-center gap-1.5 text-sm text-gray-500">
          <CalendarBlank className="h-4 w-4 text-gray-400" weight="regular" />
          <span>{service.appointment_count || 0}</span>
        </div>

        {/* Description preview */}
        {service.opis && (
          <p className="mt-2 text-xs text-gray-400 line-clamp-2">
            {service.opis}
          </p>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
          {/* Toggle active */}
          <motion.button
            type="button"
            onClick={() => onToggleActive(service)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors
                       ${service.aktivna
                         ? 'text-emerald-600 hover:bg-emerald-50'
                         : 'text-gray-500 hover:bg-gray-100'
                       }`}
          >
            {service.aktivna ? (
              <>
                <ToggleRight className="h-4 w-4" weight="fill" />
                Aktivna
              </>
            ) : (
              <>
                <ToggleLeft className="h-4 w-4" weight="regular" />
                Neaktivna
              </>
            )}
          </motion.button>

          {/* Edit/Delete buttons */}
          <div className="flex items-center gap-1">
            {canEdit && (
              <motion.button
                type="button"
                onClick={() => onEdit(service)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-violet-50 hover:text-violet-600"
              >
                <PencilSimple className="h-4 w-4" weight="regular" />
              </motion.button>
            )}
            {canDelete && (
              <motion.button
                type="button"
                onClick={() => onDelete(service)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
              >
                <Trash className="h-4 w-4" weight="regular" />
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Color indicator line at bottom */}
      <div
        className="absolute bottom-0 left-0 h-1 w-full"
        style={{ background: displayGradient }}
      />
    </motion.div>
  );
}

// Loading skeleton for ServiceCard
export function ServiceCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100"
    >
      {/* Header skeleton */}
      <div className="h-16 w-full animate-pulse bg-gray-200" />

      {/* Content skeleton */}
      <div className="p-4">
        <div className="h-6 w-3/4 animate-pulse rounded-lg bg-gray-200" />
        <div className="mt-3 flex items-center gap-3">
          <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="mt-3 h-4 w-24 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
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

export default memo(ServiceCard);
