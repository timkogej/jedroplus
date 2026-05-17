'use client';

import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  prefix?: string;
  suffix?: string;
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ prefix, suffix, error, className = '', ...props }, ref) => {
    const hasAdornment = prefix || suffix;

    if (hasAdornment) {
      return (
        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            className={`
              w-full px-3.5 py-2.5 text-sm text-gray-900 bg-white border rounded-lg
              ${prefix ? 'pl-8' : ''}
              ${suffix ? 'pr-16' : ''}
              ${error
                ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                : 'border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10'
              }
              focus:outline-none
              transition-colors duration-200
              placeholder:text-gray-400
              disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
              ${className}
            `}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              {suffix}
            </span>
          )}
        </div>
      );
    }

    return (
      <input
        ref={ref}
        className={`
          w-full px-3.5 py-2.5 text-sm text-gray-900 bg-white border rounded-lg
          ${error
            ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
            : 'border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10'
          }
          focus:outline-none
          transition-colors duration-200
          placeholder:text-gray-400
          disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
          ${className}
        `}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
