'use client';

import { motion } from 'motion/react';

interface Option {
  value: string;
  label: string;
}

interface SegmentedControlProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}

/**
 * iOS segmentirani preklopnik: sivo korito, izbrani segment je bela ploščica
 * z lasnim robom in tesno senco, ki se ob menjavi premakne, ne pojavi.
 */
export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  return (
    <div className="inline-flex rounded-[9px] bg-gray-100 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`
            relative rounded-[7px] px-3.5 py-1.5 text-sm font-medium transition-colors duration-200
            ${value === option.value ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'}
          `}
        >
          {value === option.value && (
            <motion.div
              layoutId="segmented-bg"
              className="absolute inset-0 rounded-[7px] border border-black/[0.04] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
              transition={{ type: 'spring', stiffness: 450, damping: 35 }}
            />
          )}
          <span className="relative z-10">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
