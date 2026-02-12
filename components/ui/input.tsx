'use client';

import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={`flex h-10 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#1A1F36]/30 focus:outline-none focus:ring-2 focus:ring-[#1A1F36]/10 disabled:cursor-not-allowed disabled:opacity-50 transition-all ${className}`}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
