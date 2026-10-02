'use client';

import { memo } from 'react';
import { motion } from 'motion/react';
import {
  PencilSimple,
  Trash,
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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: isActive ? 1 : 0.6, y: 0 }}
      transition={{
        opacity: { duration: 0.15 },
        y: { delay: index * 0.02, duration: 0.28, ease: [0.32, 0.72, 0, 1] },
      }}
      className="group flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-4 transition-colors hover:bg-gray-50/60"
    >
      {/* Barvna ploščica nosi barvo resursa — enako kot pri Storitvah, namesto
          traku čez vrh kartice. */}
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[12px]"
          style={{ background: displayGradient }}
        >
          <Cube className="h-5 w-5 text-white/90" weight="fill" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 text-[15px] font-semibold text-gray-900">{resurs.naziv}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
            <span className="tnum inline-flex items-center gap-1.5">
              <Cube className="h-4 w-4 text-gray-400" weight="regular" />
              {resurs.kolicina === 1
                ? t('card.unit', { count: resurs.kolicina })
                : t('card.units', { count: resurs.kolicina })}
            </span>
            <span className="text-gray-300">·</span>
            <span className="tnum inline-flex items-center gap-1.5">
              <Users className="h-4 w-4 text-gray-400" weight="regular" />
              {t('card.perUnit', { count: resurs.kapaciteta })}
            </span>
          </div>
        </div>
        {!isActive && (
          <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {t('card.inactive')}
          </span>
        )}
      </div>

      {/* Skupna zmogljivost in urnik */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="tnum inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
          {t('card.totalCapacity', { count: skupnaKapaciteta })}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="h-3.5 w-3.5 text-gray-400" weight="regular" />
          {resurs.urnik ? t('card.scheduleSet') : t('card.alwaysAvailable')}
        </span>
      </div>

      {/* Povezane storitve */}
      {resurs.storitve && resurs.storitve.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {resurs.storitve.slice(0, 3).map((s) => {
            const serviceColor = isGradient(s.barva_storitve ?? '') ? s.barva_storitve : undefined;
            return (
              <span
                key={s.id_storitve}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2 py-0.5 text-xs text-gray-600"
              >
                {serviceColor && (
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: serviceColor }} />
                )}
                {s.naziv_storitve ?? s.id_storitve}
              </span>
            );
          })}
          {resurs.storitve.length > 3 && (
            <span className="tnum rounded-full bg-gray-50 px-2 py-0.5 text-xs text-gray-500">
              +{resurs.storitve.length - 3}
            </span>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-400">{t('card.noServices')}</p>
      )}

      {/* Prožna vrzel drži akcije poravnane na dnu vseh kartic v mreži. */}
      <div className="flex-1" />

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={() => onToggleActive(resurs)}
          className={`rounded-lg px-2 py-1 text-[13px] font-medium transition-colors ${
            isActive ? 'text-emerald-600 hover:bg-emerald-50' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          {isActive ? t('card.toggleActive') : t('card.toggleInactive')}
        </button>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onEdit(resurs)}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <PencilSimple className="h-4 w-4" weight="regular" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(resurs)}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <Trash className="h-4 w-4" weight="regular" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function ResursCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-2xl border border-gray-100 bg-white"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 flex-shrink-0 animate-pulse rounded-[12px] bg-gray-100" />
          <div className="h-5 w-3/4 animate-pulse rounded bg-gray-100" />
        </div>
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
