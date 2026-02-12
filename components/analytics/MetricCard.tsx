'use client';

import { memo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { ArrowUp, ArrowDown } from '@phosphor-icons/react';

// Black & White icon color options
type IconColor = 'black' | 'darkGray' | 'mediumGray' | 'slate' | 'lightGray' | 'charcoal';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: ReactNode;
  iconColor?: IconColor;
  /** @deprecated Use iconColor instead */
  gradient?: string;
  change?: number;
  changeLabel?: string;
  progressBar?: number;
  isLoading?: boolean;
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  gradient,
  change,
  changeLabel,
  progressBar,
  isLoading = false,
}: MetricCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="h-12 w-12 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-6 w-16 animate-pulse rounded-full bg-gray-200" />
        </div>
        <div className="mt-4 h-8 w-24 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-4 w-32 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between">
        {change !== undefined ? (
          <span
            className={`flex h-6 items-center gap-1 rounded-full px-2 text-xs font-semibold ${
              change >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {change >= 0 ? (
              <ArrowUp className="h-3 w-3" weight="bold" />
            ) : (
              <ArrowDown className="h-3 w-3" weight="bold" />
            )}
            {Math.abs(change).toFixed(1)}%
          </span>
        ) : (
          <span className="inline-flex h-6 w-14" aria-hidden="true" />
        )}
        <div className="flex h-6 w-6 items-center justify-center text-black">{icon}</div>
      </div>

      <div className="mb-1 text-3xl font-bold text-gray-900">{value}</div>

      <div className="text-sm font-medium text-gray-600">{title}</div>

      {subtitle && <div className="mt-1 text-xs text-gray-500">{subtitle}</div>}

      {changeLabel && change !== undefined && (
        <div className="mt-2 text-xs text-gray-500">{changeLabel}</div>
      )}

      {/* Progress Bar - now uses gray theme */}
      {progressBar !== undefined && (
        <div className="mt-4">
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-gray-700"
              style={{ width: `${Math.min(progressBar, 100)}%` }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default memo(MetricCard);
