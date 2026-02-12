'use client';

import { CaretDown } from '@phosphor-icons/react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}

export function Select({ value, onChange, options, placeholder, disabled = false }: SelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`
          w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg
          appearance-none bg-white
          focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-20 focus:border-purple-500
          transition-colors duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer'}
        `}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <CaretDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}
