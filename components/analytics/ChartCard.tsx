'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  /** Desno od naslova — npr. skupna vrednost obdobja. */
  aside?: ReactNode;
  isLoading?: boolean;
  /** Prikaže se namesto vsebine, ko ni podatkov. */
  emptyLabel?: string;
  isEmpty?: boolean;
  /** Višina grafa; enaka jo dobi tudi kostur med nalaganjem. */
  height?: number;
  /** Okrogel kostur za tortne grafe. */
  skeletonShape?: 'block' | 'circle';
  className?: string;
  children: ReactNode;
}

/**
 * Enoten okvir za vse grafe v Analitiki.
 *
 * Doslej je vsak graf sam risal glavo, kostur med nalaganjem in prazno
 * stanje — zato so se razlikovali v odmikih, velikosti naslova in višini.
 * Tu je to enkrat.
 */
export function ChartCard({
  title,
  subtitle,
  aside,
  isLoading = false,
  emptyLabel,
  isEmpty = false,
  height = 250,
  skeletonShape = 'block',
  className = '',
  children,
}: ChartCardProps) {
  if (isLoading) {
    return (
      <div className={`rounded-xl border border-gray-100 bg-white p-5 ${className}`}>
        <div className="mb-5">
          <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
          <div className="mt-2 h-3 w-56 animate-pulse rounded bg-gray-100" />
        </div>
        <div
          className={`animate-pulse bg-gray-100 ${
            skeletonShape === 'circle' ? 'mx-auto rounded-full' : 'rounded-lg'
          }`}
          style={
            skeletonShape === 'circle'
              ? { height, width: height }
              : { height }
          }
        />
      </div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      className={`rounded-xl border border-gray-100 bg-white p-5 ${className}`}
    >
      <header className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] text-gray-500">{subtitle}</p>}
        </div>
        {aside && <div className="flex-shrink-0 text-right">{aside}</div>}
      </header>

      {isEmpty ? (
        <div
          className="flex items-center justify-center text-sm text-gray-400"
          style={{ height }}
        >
          {emptyLabel}
        </div>
      ) : (
        children
      )}
    </motion.section>
  );
}

export default ChartCard;
