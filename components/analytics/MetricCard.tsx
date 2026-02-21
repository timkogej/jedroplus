'use client';

import { memo, type ReactNode } from 'react';
import { motion } from 'motion/react';

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
        <div className="mb-4 h-4 w-28 animate-pulse rounded bg-gray-200" />
        <div className="flex items-end justify-between">
          <div className="h-8 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-6 w-6 animate-pulse rounded bg-gray-200" />
        </div>
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
      <div className="mb-3 text-sm font-medium text-gray-600">{title}</div>

      <div className="flex items-end justify-between">
        <div className="text-3xl font-bold text-gray-900">{value}</div>
        <div className="flex h-6 w-6 items-center justify-center text-black">{icon}</div>
      </div>

      {subtitle && <div className="mt-1 text-xs text-gray-500">{subtitle}</div>}

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
