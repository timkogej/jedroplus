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
          w-full px-4 py-3 text-sm border rounded-lg resize-none
          ${error
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-200 focus:ring-purple-500 focus:border-purple-500'
          }
          focus:outline-none focus:ring-2 focus:ring-opacity-20
          transition-colors duration-200
          placeholder:text-gray-400
          ${className}
        `}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
