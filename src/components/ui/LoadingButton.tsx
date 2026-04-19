'use client';

import * as React from 'react';

export interface LoadingButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** When true: shows an inline spinner, disables the button, prevents double-submit. */
  isLoading: boolean;
  children: React.ReactNode;
}

/**
 * A drop-in button replacement that disables itself and shows an animated spinner
 * while `isLoading` is true.  The label stays visible so the button never resizes.
 *
 * All standard <button> props are forwarded.
 *
 * Usage:
 *   <LoadingButton isLoading={saving} onClick={handleSave} className="...">
 *     Shrani
 *   </LoadingButton>
 */
export function LoadingButton({
  isLoading,
  children,
  disabled,
  className = '',
  ...props
}: LoadingButtonProps) {
  return (
    <button
      {...props}
      disabled={isLoading || disabled}
      className={`inline-flex items-center justify-center gap-2 ${
        isLoading ? 'pointer-events-none opacity-70' : ''
      } ${className}`}
    >
      {isLoading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
