"use client";

import { motion } from "motion/react";
import { IconProps } from "@phosphor-icons/react";

// Black & White icon color options
type IconColor = 'black' | 'darkGray' | 'mediumGray' | 'slate' | 'lightGray' | 'charcoal';

const ICON_BOX_CLASSES: Record<IconColor, string> = {
  black: 'bg-gray-900',
  darkGray: 'bg-gray-800',
  mediumGray: 'bg-gray-700',
  slate: 'bg-slate-700',
  lightGray: 'bg-gray-600',
  charcoal: 'bg-gray-500',
};

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<IconProps>;
  iconColor?: IconColor;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  /** @deprecated Use iconColor instead */
  gradient?: boolean;
  gradientOutline?: boolean;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'black',
  trend,
  gradient = false,
  gradientOutline = false,
}: MetricCardProps) {
  const content = (
    <div className="relative flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-500">
          {title}
        </p>
        <p className="mt-2 text-3xl font-normal text-gray-900">
          {value}
        </p>
        {subtitle && (
          <p className="mt-1 text-sm text-gray-400">
            {subtitle}
          </p>
        )}
        {trend && (
          <div
            className={`mt-2 inline-flex items-center gap-1 text-sm font-medium ${
              trend.isPositive ? "text-emerald-600" : "text-red-500"
            }`}
          >
            <span>{trend.isPositive ? "↑" : "↓"}</span>
            <span>{Math.abs(trend.value)}%</span>
            <span className="text-gray-400">
              vs prejšnji mesec
            </span>
          </div>
        )}
      </div>

      {/* Icon only - no black circle, just the icon in black */}
      <div className="text-gray-900">
        <Icon
          size={24}
          weight="regular"
        />
      </div>
    </div>
  );

  if (gradientOutline) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl p-[1.3px] bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 overflow-hidden"
      >
        <div className="h-full w-full rounded-[14px] bg-white p-6">
          {content}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl p-6 bg-white border border-gray-100 shadow-sm"
    >
      {content}
    </motion.div>
  );
}
