'use client';

import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  prefix?: string;
  suffix?: string;
  error?: boolean;
}

// Applovo polje: 8 px radij, lasni rob, ob fokusu obroč v barvi znamke zunaj
// roba. Enak obroč uporabljajo vsa polja v nastavitvah, da fokus povsod
// pomeni isto.
const base =
  'w-full rounded-lg border bg-white px-3 py-2 text-base text-gray-900 sm:py-1.5 sm:text-sm ' +
  'transition-colors duration-150 placeholder:text-gray-400 focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500';

const tone = (error?: boolean) =>
  error
    ? 'border-red-300 focus:border-red-500 focus:ring-[3px] focus:ring-red-500/25'
    : 'border-gray-200 focus:border-[#7C78FA] focus:ring-[3px] focus:ring-[#7C78FA]/25';

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ prefix, suffix, error, className = '', ...props }, ref) => {
    if (prefix || suffix) {
      return (
        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            className={`${base} ${tone(error)} ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-16' : ''} ${className}`}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              {suffix}
            </span>
          )}
        </div>
      );
    }

    return <input ref={ref} className={`${base} ${tone(error)} ${className}`} {...props} />;
  }
);

Input.displayName = 'Input';
