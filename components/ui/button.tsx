'use client';

import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

    const variants = {
      default: 'bg-[#1A1F36] text-white hover:bg-[#1A1F36]/90 focus-visible:ring-[#1A1F36]',
      outline: 'border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 text-gray-700',
      ghost: 'hover:bg-gray-100 text-gray-700',
      destructive: 'bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500',
    };

    const sizes = {
      default: 'h-10 px-4 py-2',
      sm: 'h-9 rounded-lg px-3',
      lg: 'h-11 rounded-xl px-8',
      icon: 'h-10 w-10',
    };

    return (
      <button
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
