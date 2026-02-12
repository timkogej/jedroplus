'use client';

import { memo } from 'react';
import { motion } from 'motion/react';
import type { ViewMode } from '@/lib/utils/calendar';

interface ViewToggleProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

const views: { mode: ViewMode; label: string }[] = [
  { mode: 'day', label: 'Dan' },
  { mode: 'week', label: 'Teden' },
  { mode: 'month', label: 'Mesec' },
];

function ViewToggle({ currentView, onViewChange }: ViewToggleProps) {
  return (
    <div className="relative inline-flex rounded-xl bg-[#F7F8FA] p-1">
      {views.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onViewChange(mode)}
          className={`relative z-10 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200
                     ${currentView === mode
                       ? 'text-[#1A1F36]'
                       : 'text-gray-500 hover:text-[#1A1F36]'
                     }`}
        >
          {currentView === mode && (
            <motion.div
              layoutId="viewToggleIndicator"
              className="absolute inset-0 rounded-lg bg-white shadow-sm"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
            />
          )}
          <span className="relative z-10">{label}</span>
        </button>
      ))}
    </div>
  );
}

export default memo(ViewToggle);
