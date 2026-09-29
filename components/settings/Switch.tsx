'use client';

import { motion } from 'motion/react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  variant?: 'default' | 'brand';
}

/**
 * Stikalo v iOS merah: tir 51×31, gumb 27×27, pot 20 px.
 * Barvi ostaneta taki, kot sta bili — spremenjena je samo geometrija in to,
 * da se gumb ob pritisku rahlo raztegne, kot pri Applu.
 */
export function Switch({ checked, onChange, disabled = false, variant = 'default' }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`
        relative inline-flex h-[31px] w-[51px] flex-shrink-0 items-center rounded-full
        transition-colors duration-200 ease-out
        focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#7C78FA]/45 focus-visible:ring-offset-1
        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
        ${checked
          ? variant === 'brand' ? 'bg-[#6D5EF7]' : 'bg-[#0a0a0a]'
          : 'bg-gray-200 hover:bg-gray-300'
        }
      `}
    >
      <motion.span
        initial={false}
        animate={{ x: checked ? 22 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className="inline-block h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.18),0_0_1px_rgba(0,0,0,0.12)]"
      />
    </button>
  );
}
