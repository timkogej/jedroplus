'use client';

import { memo } from 'react';
import { motion } from 'motion/react';
import {
  PencilSimple,
  Trash,
  ToggleLeft,
  ToggleRight,
  Calendar,
  Cube,
  Users,
  Clock,
} from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import type { Resurs } from '@/types/resursi';
import { isGradient, DEFAULT_SERVICE_GRADIENT } from '@/lib/constants/serviceGradients';

interface ResursCardProps {
  resurs: Resurs;
  onEdit: (r: Resurs) => void;
  onDelete: (r: Resurs) => void;
  onToggleActive: (r: Resurs) => void;
  index?: number;
}

function ResursCard({ resurs, onEdit, onDelete, onToggleActive, index = 0 }: ResursCardProps) {
  const t = useTranslations('resursi');

  const displayGradient = isGradient(resurs.barva) ? resurs.barva : DEFAULT_SERVICE_GRADIENT;
  const skupnaKapaciteta = resurs.kolicina * resurs.kapaciteta;
  const isActive = resurs.status === 'active';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isActive ? 1 : 0.6, y: 0 }}
      transition={{
        opacity: { duration: 0.15 },
        y: { delay: index * 0.05, duration: 0.3 },
      }}
      whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.12)' }}
      className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100"
    >
      {/* Color gradient header */}
      <div className="relative h-16 w-full" style={{ background: displayGradient }}>
        {!isActive && (
          <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-gray-600 shadow-sm">
            {t('card.inactive')}
          </div>
        )}
        <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
          <Cube className="h-4 w-4 text-white/80" weight="fill" />
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-lg font-normal text-[#1A1F36] line-clamp-1">{resurs.naziv}</h3>

        {/* Capacity info */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
          <div className="flex items-center gap-1.5">
            <Cube className="h-4 w-4 text-gray-400" weight="regular" />
            <span>
              {resurs.kolicina === 1
                ? t('card.unit', { count: resurs.kolicina })
                : t('card.units', { count: resurs.kolicina })}
            </span>
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-gray-400" weight="regular" />
            <span>{t('card.perUnit', { count: resurs.kapaciteta })}</span>
          </div>
        </div>

        {/* Total capacity badge */}
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
          {t('card.totalCapacity', { count: skupnaKapaciteta })}
        </div>

        {/* Schedule indicator */}
        <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="h-3.5 w-3.5 text-gray-400" weight="regular" />
          <span>{resurs.urnik ? t('card.scheduleSet') : t('card.alwaysAvailable')}</span>
        </div>

        {/* Connected services */}
        {resurs.storitve && resurs.storitve.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {resurs.storitve.slice(0, 3).map((s) => (
              <span
                key={s.id_storitve}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                {s.naziv_storitve ?? s.id_storitve}
              </span>
            ))}
            {resurs.storitve.length > 3 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                +{resurs.storitve.length - 3}
              </span>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-gray-400">{t('card.noServices')}</p>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
          <motion.button
            type="button"
            onClick={() => onToggleActive(resurs)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors
                       ${isActive
                         ? 'text-emerald-600 hover:bg-emerald-50'
                         : 'text-gray-500 hover:bg-gray-100'
                       }`}
          >
            {isActive ? (
              <>
                <ToggleRight className="h-4 w-4" weight="fill" />
                {t('card.toggleActive')}
              </>
            ) : (
              <>
                <ToggleLeft className="h-4 w-4" weight="regular" />
                {t('card.toggleInactive')}
              </>
            )}
          </motion.button>

          <div className="flex items-center gap-1">
            <motion.button
              type="button"
              onClick={() => onEdit(resurs)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-violet-50 hover:text-violet-600"
            >
              <PencilSimple className="h-4 w-4" weight="regular" />
            </motion.button>
            <motion.button
              type="button"
              onClick={() => onDelete(resurs)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <Trash className="h-4 w-4" weight="regular" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Color indicator line at bottom */}
      <div className="absolute bottom-0 left-0 h-1 w-full" style={{ background: displayGradient }} />
    </motion.div>
  );
}

export function ResursCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100"
    >
      <div className="h-16 w-full animate-pulse bg-gray-200" />
      <div className="p-4">
        <div className="h-6 w-3/4 animate-pulse rounded-lg bg-gray-200" />
        <div className="mt-3 flex items-center gap-3">
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="mt-2 h-5 w-28 animate-pulse rounded-full bg-gray-200" />
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

export default memo(ResursCard);
