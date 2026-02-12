'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check } from '@phosphor-icons/react';

const PRESET_COLORS = [
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#6366F1', // Indigo
  '#14B8A6', // Teal
];

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-3 py-2 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
      >
        <div
          className="w-6 h-6 rounded-md shadow-sm"
          style={{ backgroundColor: value }}
        />
        <span className="text-sm text-gray-600">{value.toUpperCase()}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full mt-2 left-0 z-20 bg-white rounded-xl shadow-lg border border-gray-100 p-3"
            >
              <div className="grid grid-cols-4 gap-2 mb-3">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      onChange(color);
                      setIsOpen(false);
                    }}
                    className="w-8 h-8 rounded-lg shadow-sm flex items-center justify-center transition-transform hover:scale-110"
                    style={{ backgroundColor: color }}
                  >
                    {value === color && (
                      <Check className="w-4 h-4 text-white drop-shadow" />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <input
                  type="color"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                />
                <input
                  type="text"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded"
                  placeholder="#000000"
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
