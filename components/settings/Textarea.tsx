'use client';

import { forwardRef } from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className = '', ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`
          w-full resize-none rounded-lg border bg-white px-3 py-2.5 text-base text-gray-900 sm:py-2 sm:text-sm
          transition-colors duration-150 placeholder:text-gray-400 focus:outline-none
          disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500
          ${error
            ? 'border-red-300 focus:border-red-500 focus:ring-[3px] focus:ring-red-500/25'
            : 'border-gray-200 focus:border-[#7C78FA] focus:ring-[3px] focus:ring-[#7C78FA]/25'
          }
          ${className}
        `}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
