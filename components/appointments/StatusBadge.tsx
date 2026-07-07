'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'pending'
  | 'completed'
  | 'cancelled'
  | 'no_show';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'gradient';
  weight?: 'normal' | 'medium';
}

// Map various status strings to normalized status
export function normalizeStatus(status: string): AppointmentStatus {
  const normalized = status.toLowerCase().trim();

  if (normalized.includes('confirm') || normalized.includes('potrj')) {
    return 'confirmed';
  }
  if (normalized.includes('complet') || normalized.includes('zakljuc') || normalized.includes('done') || normalized.includes('končan')) {
    return 'completed';
  }
  if (normalized.includes('cancel') || normalized.includes('odpoved') || normalized.includes('preklic')) {
    return 'cancelled';
  }
  if (normalized.includes('pending') || normalized.includes('čakaj') || normalized.includes('cakaj') || normalized.includes('waiting')) {
    return 'pending';
  }
  if (normalized.includes('no_show') || normalized.includes('ni_prisel') || normalized.includes('no show') || normalized.includes('ni prišel')) {
    return 'no_show';
  }

  return 'scheduled';
}

// Get status display config for default variant
// UPDATED: Zaključen = gray, Načrtovan/Potrjen = green
export function getStatusConfig(status: AppointmentStatus): {
  label: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
  gradientClass: string;
} {
  switch (status) {
    case 'confirmed':
      return {
        label: 'Potrjen',
        bgClass: 'bg-gradient-to-r from-green-50 to-emerald-50',
        textClass: 'text-green-700',
        dotClass: 'bg-green-500',
        gradientClass: 'bg-gradient-to-r from-green-500 to-emerald-600',
      };
    case 'pending':
      return {
        label: 'Čakajoč',
        bgClass: 'bg-gradient-to-r from-amber-50 to-orange-50',
        textClass: 'text-amber-700',
        dotClass: 'bg-amber-500',
        gradientClass: 'bg-gradient-to-r from-amber-500 to-orange-600',
      };
    case 'completed':
      return {
        label: 'Zaključen',
        bgClass: 'bg-gray-100',
        textClass: 'text-gray-700',
        dotClass: 'bg-gray-500',
        gradientClass: 'bg-gradient-to-r from-gray-400 to-gray-500',
      };
    case 'cancelled':
      return {
        label: 'Odpovedan',
        bgClass: 'bg-gradient-to-r from-red-50 to-rose-50',
        textClass: 'text-red-700',
        dotClass: 'bg-red-500',
        gradientClass: 'bg-gradient-to-r from-red-500 to-rose-600',
      };
    case 'no_show':
      return {
        label: 'Ni prišel',
        bgClass: 'bg-gradient-to-r from-orange-50 to-amber-50',
        textClass: 'text-orange-700',
        dotClass: 'bg-orange-500',
        gradientClass: 'bg-gradient-to-r from-orange-500 to-amber-600',
      };
    case 'scheduled':
    default:
      return {
        label: 'Načrtovan',
        bgClass: 'bg-gradient-to-r from-green-50 to-emerald-50',
        textClass: 'text-green-700',
        dotClass: 'bg-green-500',
        gradientClass: 'bg-gradient-to-r from-green-500 to-emerald-600',
      };
  }
}

function StatusBadge({ status, size = 'md', variant = 'default', weight = 'medium' }: StatusBadgeProps) {
  const t = useTranslations('appointments');
  const normalizedStatus = normalizeStatus(status);
  const config = getStatusConfig(normalizedStatus);
  const statusLabels: Record<AppointmentStatus, string> = {
    scheduled: t('status.scheduled'),
    confirmed: t('status.confirmed'),
    pending: t('status.pending'),
    completed: t('status.completed'),
    cancelled: t('status.cancelled'),
    no_show: t('status.noShow'),
  };
  const label = statusLabels[normalizedStatus];

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  const dotSizes = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-2.5 w-2.5',
  };
  const weightClass = weight === 'normal' ? 'font-normal' : 'font-medium';

  if (variant === 'gradient') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full ${weightClass} text-white
                   shadow-sm ${sizeClasses[size]} ${config.gradientClass}`}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${weightClass}
                 ${sizeClasses[size]} ${config.bgClass} ${config.textClass}`}
    >
      <span className={`rounded-full ${dotSizes[size]} ${config.dotClass}`} />
      {label}
    </span>
  );
}

export default memo(StatusBadge);
