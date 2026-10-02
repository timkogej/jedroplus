'use client';

import { motion } from 'motion/react';
import NextLink from 'next/link';
import { ArrowSquareOut, Check, Copy, Lock } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import type { BookingDesign } from '@/lib/reservations/bookingDesigns';

interface DesignCardProps {
  design: BookingDesign;
  /** Zaklenjena kartica nikoli ne pokaže povezave. */
  locked?: boolean;
  isCopied: boolean;
  onCopy: (url: string, id: number) => void;
  /** Prazen niz pomeni, da povezava za ta dizajn ni nastavljena. */
  designUrl: string;
}

/**
 * Kartica ene rezervacijske strani.
 *
 * Kvadratni predogled nosi barve in pisave same rezervacijske strani, zato se
 * njegovi slogi ne poenotujejo z aplikacijo — to je vzorec tega, kar bo videla
 * stranka. Poenoten je samo okvir okoli njega.
 */
export function DesignCard({ design, locked = false, isCopied, onCopy, designUrl }: DesignCardProps) {
  const t = useTranslations('reservations');
  const designName = t(`designs.${design.designKey}.name`);
  const url = locked ? '' : designUrl;

  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      className="group flex h-full w-[260px] flex-none flex-col rounded-2xl border border-gray-100 bg-white p-3 transition-colors hover:bg-gray-50/60 md:w-full md:p-4"
    >
      <div
        className="relative aspect-square overflow-hidden rounded-lg border p-4 sm:p-5"
        style={design.squareStyle}
      >
        {design.designKey === 'seasonal' && (
          <>
            <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[#FACC15] shadow-[0_0_36px_rgba(250,204,21,0.5)] sm:-right-7 sm:-top-7 sm:h-24 sm:w-24 sm:shadow-[0_0_44px_rgba(250,204,21,0.52)]" />
            <div className="pointer-events-none absolute right-3 top-3 h-10 w-10 rounded-full border border-yellow-300/60 sm:right-4 sm:top-4 sm:h-12 sm:w-12" />
          </>
        )}
        <div className="relative z-10 flex h-full flex-col justify-between">
          <div className="flex items-center">
            <span
              className="flex h-7 min-w-7 items-center justify-center rounded-md border px-2 text-[11px] font-semibold"
              style={design.badgeStyle}
            >
              {String(design.id).padStart(2, '0')}
            </span>
          </div>

          <div>
            <div className="mb-3 h-px w-16 sm:mb-5 sm:w-20" style={design.dividerStyle} />
            <h3 className="text-xl leading-tight sm:text-2xl" style={design.titleStyle}>
              {designName}
            </h3>
            <p className="mt-1.5 text-xs font-medium leading-5 sm:mt-2 sm:text-sm" style={design.subtitleStyle}>
              {t(`designs.${design.designKey}.subtitle`)}
            </p>
            <p
              className="mt-3 text-xs leading-5 sm:mt-4 sm:text-sm sm:leading-6"
              style={{
                ...design.bodyStyle,
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 4,
                overflow: 'hidden',
              }}
            >
              {t(`designs.${design.designKey}.description`)}
            </p>
          </div>
        </div>
      </div>

      {locked ? (
        <div className="mt-4">
          <NextLink
            href="/nastavitve/paketi#razpolozljivi-paketi"
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-900 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            <Lock className="h-4 w-4" weight="bold" aria-hidden="true" />
            {t('premiumSection.upgrade')}
          </NextLink>
        </div>
      ) : (
      <div className="mt-4 grid grid-cols-[1fr_40px] gap-2">
        <motion.button
          whileHover={url ? { scale: 1.01 } : undefined}
          whileTap={url ? { scale: 0.99 } : undefined}
          onClick={() => onCopy(url, design.id)}
          disabled={!url}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isCopied ? (
            <>
              <Check className="h-4 w-4 text-green-500" weight="bold" />
              <span className="text-green-600">{t('designs.copied')}</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 text-gray-500" weight="regular" />
              <span>{t('designs.copy')}</span>
            </>
          )}
        </motion.button>
        <motion.button
          whileHover={url ? { scale: 1.03 } : undefined}
          whileTap={url ? { scale: 0.97 } : undefined}
          onClick={() => window.open(url, '_blank')}
          disabled={!url}
          aria-label={`${designName} ${t('designs.bookingLinkLabel')}`}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          style={{ background: design.accent }}
        >
          <ArrowSquareOut className="h-4 w-4" weight="bold" />
        </motion.button>
      </div>
      )}
    </motion.article>
  );
}

export default DesignCard;
