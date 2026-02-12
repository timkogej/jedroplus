'use client';

import { memo } from 'react';
import { motion } from 'motion/react';

// Black & White icon color options
export type IconColor = 'black' | 'darkGray' | 'mediumGray' | 'slate' | 'lightGray' | 'charcoal' | 'lightBox' | 'whiteBox';

// Map icon color to Tailwind classes
const ICON_BOX_CLASSES: Record<IconColor, string> = {
  black: 'bg-gray-900 text-white',
  darkGray: 'bg-gray-800 text-white',
  mediumGray: 'bg-gray-700 text-white',
  slate: 'bg-slate-700 text-white',
  lightGray: 'bg-gray-600 text-white',
  charcoal: 'bg-gray-500 text-white',
  lightBox: 'bg-gray-100 text-gray-900',
  whiteBox: 'bg-white border-2 border-gray-300 text-gray-900',
};

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  iconColor?: IconColor;
  /** @deprecated Use iconColor instead */
  gradient?: string;
  delay?: number;
  change?: number;
  changeLabel?: string;
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  iconColor = 'black',
  gradient,
  delay = 0,
  change,
  changeLabel,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1, duration: 0.3 }}
      className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 transition-all
                 hover:shadow-md hover:ring-gray-200"
    >
      <div className="flex items-start justify-between mb-4">
        {/* Icon only - no black circle, just the icon in black */}
        <div className="text-gray-900">
          {icon}
        </div>

        {/* Change indicator */}
        {change !== undefined && (
          <span
            className={`px-2 py-1 text-xs font-semibold rounded-full flex items-center gap-1
                       ${change >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
          >
            {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay * 0.1 + 0.2 }}
        className="text-3xl font-bold text-[#1A1F36] mb-1"
      >
        {value}
      </motion.div>

      <div className="text-sm font-medium text-gray-600">{title}</div>

      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}

      {changeLabel && change !== undefined && (
        <div className="text-xs text-gray-500 mt-2">{changeLabel}</div>
      )}
    </motion.div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
      <div className="h-12 w-12 rounded-xl bg-gray-200 animate-pulse mb-4" />
      <div className="h-8 w-20 rounded-lg bg-gray-200 animate-pulse mb-2" />
      <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
    </div>
  );
}

export default memo(StatCard);
