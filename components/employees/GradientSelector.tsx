'use client';

import { memo } from 'react';
import { motion } from 'motion/react';
import { Check } from '@phosphor-icons/react';
import { EMPLOYEE_GRADIENTS } from '@/lib/constants/gradients';

interface GradientSelectorProps {
  value: string; // Full CSS gradient string
  onChange: (gradient: string) => void; // Returns full CSS gradient string
  disabled?: boolean;
}

function GradientSelector({ value, onChange, disabled = false }: GradientSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {EMPLOYEE_GRADIENTS.map((gradient) => (
          <motion.button
            key={gradient.id}
            type="button"
            onClick={() => !disabled && onChange(gradient.gradient)}
            disabled={disabled}
            whileHover={{ scale: disabled ? 1 : 1.08 }}
            whileTap={{ scale: disabled ? 1 : 0.95 }}
            className={`
              relative w-14 h-14 rounded-full transition-all
              ${value === gradient.gradient
                ? 'ring-4 ring-white ring-offset-2 ring-offset-gray-900/10 scale-110 shadow-md'
                : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-1'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            style={{
              background: gradient.gradient,
            }}
            title={gradient.name}
          >
            {value === gradient.gradient && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Check className="w-6 h-6 text-white drop-shadow-md" weight="bold" />
              </motion.div>
            )}
          </motion.button>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Ta barva bo uporabljena za začetnice na koledarju in profilih
      </p>
    </div>
  );
}

export default memo(GradientSelector);
