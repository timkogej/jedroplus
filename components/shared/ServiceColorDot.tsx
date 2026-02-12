'use client';

import { memo } from 'react';

interface ServiceColorDotProps {
  /** CSS gradient string or hex color from database */
  gradient: string;
  /** Size of the dot */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Additional CSS classes */
  className?: string;
}

const sizeClasses = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
  xl: 'w-5 h-5',
};

/**
 * Reusable gradient/color dot for displaying service colors.
 * Handles both CSS gradient strings and hex colors from the database.
 */
function ServiceColorDot({ gradient, size = 'md', className = '' }: ServiceColorDotProps) {
  // Determine the background style
  const getBackground = () => {
    // If it's already a gradient CSS string, use it directly
    if (gradient.includes('gradient') || gradient.includes('linear') || gradient.includes('radial')) {
      return gradient;
    }
    // If it's a hex color, create a subtle gradient from it
    if (gradient.startsWith('#')) {
      const hex = gradient.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 100;
      const g = parseInt(hex.substring(2, 4), 16) || 100;
      const b = parseInt(hex.substring(4, 6), 16) || 240;
      const lighterR = Math.min(255, r + 30);
      const lighterG = Math.min(255, g + 30);
      const lighterB = Math.min(255, b + 30);
      return `linear-gradient(135deg, rgb(${lighterR}, ${lighterG}, ${lighterB}) 0%, ${gradient} 100%)`;
    }
    // Fallback to the value as-is
    return gradient;
  };

  return (
    <div
      className={`rounded-full shadow-sm flex-shrink-0 ${sizeClasses[size]} ${className}`}
      style={{ background: getBackground() }}
      aria-hidden="true"
    />
  );
}

export default memo(ServiceColorDot);
