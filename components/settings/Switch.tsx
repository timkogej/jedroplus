'use client';

import { motion } from 'motion/react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Switch({ checked, onChange, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${checked
          ? 'bg-gradient-to-r from-purple-500 to-pink-500'
          : 'bg-gray-200 hover:bg-gray-300'
        }
      `}
    >
      <motion.span
        initial={false}
        animate={{ x: checked ? 22 : 4 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="inline-block h-4 w-4 rounded-full bg-white shadow-sm"
      />
    </button>
  );
}
