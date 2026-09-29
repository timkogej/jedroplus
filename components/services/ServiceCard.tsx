'use client';

import { memo } from 'react';
import { motion } from 'motion/react';
import {
  Clock,
  CalendarBlank,
  PencilSimple,
  Trash,
} from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { SERVICE_CATEGORIES } from '@/types/services';
import type { Service } from '@/types/services';
import { isGradient, DEFAULT_SERVICE_GRADIENT } from '@/lib/constants/serviceGradients';
import { useFormat } from '@/hooks/useFormat';

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
  const { money } = useFormat();
  const t = useTranslations('services');

  // Handle both gradient strings and legacy hex colors
  const displayGradient = isGradient(service.barva)
    ? service.barva
    : DEFAULT_SERVICE_GRADIENT;

  const categoryLabel = service.kategorija
    ? SERVICE_CATEGORIES.find((c) => c.value === service.kategorija)?.label || service.kategorija
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: service.aktivna ? 1 : 0.6, y: 0 }}
      transition={{
        opacity: { duration: 0.15 },
        y: { delay: index * 0.02, duration: 0.28, ease: [0.32, 0.72, 0, 1] },
      }}
      className="group flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-4 transition-colors hover:bg-gray-50/60"
    >
      {/* Barvna ploščica nosi barvo storitve — enaka kot prej, le v obliki
          ikone aplikacije namesto traku čez vrh kartice. */}
      <div className="flex items-start gap-3">
        <div
          className="h-11 w-11 flex-shrink-0 rounded-[12px]"
          style={{ background: displayGradient }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 text-[15px] font-semibold text-gray-900">
            {service.naziv}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
            <span className="tnum inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-gray-400" weight="regular" />
              {service.trajanje} min
            </span>
            {service.cena !== null && (
              <>
                <span className="text-gray-300">·</span>
                <span className="tnum font-medium text-gray-900">
                  {money(service.cena, { currency: service.currency })}
                </span>
              </>
            )}
          </div>
        </div>
        {!service.aktivna && (
          <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {t('card.inactive')}
          </span>
        )}
      </div>

      {/* Kategorija in število terminov */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {categoryLabel && (
          <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600">
            {categoryLabel}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
          <CalendarBlank className="h-4 w-4 text-gray-400" weight="regular" />
          <span className="tnum">{service.appointment_count || 0}</span>
        </span>
      </div>

      {/* Description preview */}
      {service.opis && (
        <p className="mt-2 line-clamp-2 text-[13px] text-gray-400">{service.opis}</p>
      )}

      {/* Actions */}
      {/* Prožna vrzel potisne akcije na dno, da so v vseh karticah v mreži
          poravnane, tudi ko so opisi različno dolgi. */}
      <div className="flex-1" />

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
        {/* Toggle active */}
        <button
          type="button"
          onClick={() => onToggleActive(service)}
          className={`rounded-lg px-2 py-1 text-[13px] font-medium transition-colors ${
            service.aktivna
              ? 'text-emerald-600 hover:bg-emerald-50'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          {service.aktivna ? t('card.toggleActive') : t('card.toggleInactive')}
        </button>

        {/* Edit/Delete buttons */}
        <div className="flex items-center gap-0.5">
          {canEdit && (
            <motion.button
              type="button"
              onClick={() => onEdit(service)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
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
    </motion.div>
  );
}

// Loading skeleton for ServiceCard
export function ServiceCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.03 }}
      className="rounded-2xl border border-gray-100 bg-white p-4"
    >
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 flex-shrink-0 animate-pulse rounded-[12px] bg-gray-100" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
      <div className="mt-3 h-5 w-24 animate-pulse rounded-full bg-gray-100" />
      {/* Prožna vrzel potisne akcije na dno, da so v vseh karticah v mreži
          poravnane, tudi ko so opisi različno dolgi. */}
      <div className="flex-1" />

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

export default memo(ServiceCard);
