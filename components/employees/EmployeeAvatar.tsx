'use client';

import { memo } from 'react';
import { getDefaultGradient, isValidGradient } from '@/lib/constants/gradients';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface EmployeeAvatarProps {
  firstName: string;
  lastName: string;
  gradient: string; // Full CSS gradient string from "Barva" column
  size?: AvatarSize;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-20 h-20 text-xl',
  '2xl': 'w-28 h-28 text-3xl',
};

function EmployeeAvatar({
  firstName,
  lastName,
  gradient,
  size = 'md',
  className = '',
}: EmployeeAvatarProps) {
  const firstInitial = firstName?.[0]?.toUpperCase() || '';
  const lastInitial = lastName?.[0]?.toUpperCase() || '';
  const initials = `${firstInitial}${lastInitial}` || '?';

  // Use provided gradient or fall back to default
  const gradientStyle = isValidGradient(gradient) ? gradient : getDefaultGradient();

  return (
    <div
      className={`rounded-full flex items-center justify-center select-none flex-shrink-0 ${sizeClasses[size]} ${className}`}
      style={{
        backgroundColor: 'white',
        boxShadow: '0 0 0 2px transparent',
        border: '2px solid transparent',
        outline: '2px solid transparent',
        position: 'relative',
      }}
    >
      {/* Gradient border ring */}
      <div
        style={{
          position: 'absolute',
          inset: -2,
          borderRadius: '9999px',
          background: gradientStyle,
          zIndex: 0,
        }}
      />
      {/* White inner circle */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '9999px',
          background: 'white',
          zIndex: 1,
        }}
      />
      {/* Gradient initials */}
      <span
        className="font-bold relative"
        style={{
          backgroundImage: gradientStyle,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          zIndex: 2,
        }}
      >
        {initials}
      </span>
    </div>
  );
}

export default memo(EmployeeAvatar);
