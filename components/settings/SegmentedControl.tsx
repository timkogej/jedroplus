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

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  return (
    <div className="inline-flex rounded-lg bg-gray-100 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`
            relative px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200
            ${value === option.value
              ? 'text-gray-900'
              : 'text-gray-600 hover:text-gray-900'
            }
          `}
        >
          {value === option.value && (
            <motion.div
              layoutId="segmented-bg"
              className="absolute inset-0 bg-white rounded-md shadow-sm"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
