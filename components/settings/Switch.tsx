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
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 focus-visible:ring-offset-2
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${checked ? 'bg-[#0a0a0a]' : 'bg-gray-200 hover:bg-gray-300'}
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
