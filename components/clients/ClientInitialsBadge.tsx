'use client';

import { memo } from 'react';

interface ClientInitialsBadgeProps {
  firstName: string;
  lastName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  gradient?: 'pink-purple' | 'blue-violet' | 'emerald-teal' | 'amber-orange' | 'violet-cyan';
  customGradient?: string; // Custom CSS gradient string e.g. "linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)"
  variant?: 'circle' | 'text'; // 'circle' (default) shows circular badge, 'text' shows gradient text only
}

// Generate initials from first and last name
function getInitials(firstName: string, lastName: string): string {
  const first = firstName?.trim().charAt(0) || '';
  const last = lastName?.trim().charAt(0) || '';
  return `${first}${last}`.toUpperCase() || '?';
}

// Gradient color palettes (used when customGradient is not provided)
const gradients = {
  'pink-purple': 'from-violet-500 to-cyan-500',
  'blue-violet': 'from-blue-500 to-violet-600',
  'emerald-teal': 'from-emerald-500 to-teal-600',
  'amber-orange': 'from-amber-500 to-orange-600',
  'violet-cyan': 'from-violet-500 to-cyan-500',
};

// Size classes
const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
};

// Default gradient for fallback
const DEFAULT_GRADIENT = 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)';

// Text size classes for gradient text variant
const textSizes = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-xl',
  xl: 'text-2xl',
};

function ClientInitialsBadge({
  firstName,
  lastName,
  size = 'md',
  gradient = 'pink-purple',
  customGradient,
  variant = 'circle',
}: ClientInitialsBadgeProps) {
  const initials = getInitials(firstName, lastName);

  // NEW: Gradient text variant - no circle, just gradient text
  if (variant === 'text') {
    return (
      <span
        className={`${textSizes[size]} font-bold`}
        style={{
          background: customGradient || 'linear-gradient(135deg, #7C75FC 0%, #50C3D2 50%, #44D0C6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {initials}
      </span>
    );
  }

  // If customGradient is provided, use inline style instead of Tailwind classes
  if (customGradient) {
    return (
      <div
        className={`flex items-center justify-center rounded-full ${sizes[size]}
                    font-semibold text-white shadow-sm`}
        style={{ background: customGradient }}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-br ${gradients[gradient]} ${sizes[size]}
                  font-semibold text-white shadow-sm`}
    >
      {initials}
    </div>
  );
}

export default memo(ClientInitialsBadge);

// Export a helper to get a default gradient
export { DEFAULT_GRADIENT };
