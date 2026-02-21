'use client';

import { memo } from 'react';
import { motion } from 'motion/react';
import type { ViewMode } from '@/lib/utils/calendar';

interface ViewToggleProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  isMobile?: boolean;
}

const desktopViews: { mode: ViewMode; label: string }[] = [
  { mode: 'day', label: 'Dan' },
  { mode: 'week', label: 'Teden' },
  { mode: 'month', label: 'Mesec' },
];

const mobileViews: { mode: ViewMode; label: string }[] = [
  { mode: 'day', label: 'Dan' },
  { mode: '2day', label: '2 dni' },
  { mode: 'month', label: 'Mesec' },
];

function ViewToggle({ currentView, onViewChange, isMobile = false }: ViewToggleProps) {
  const views = isMobile ? mobileViews : desktopViews;

  return (
    <div className="relative inline-flex rounded-[10px] bg-black/[0.07] p-[3px] gap-0">
      {views.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onViewChange(mode)}
          className={`relative z-10 rounded-[8px] px-2.5 py-[5px] text-[11px] font-medium transition-colors duration-150 select-none
                     md:px-3 md:py-[6px] md:text-[12px]
                     ${currentView === mode
                       ? 'text-[#1A1F36]'
                       : 'text-[#6B7280] hover:text-[#374151]'
                     }`}
        >
          {currentView === mode && (
            <motion.div
              layoutId="viewToggleIndicator"
              className="absolute inset-0 rounded-[8px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.13),0_0.5px_1.5px_rgba(0,0,0,0.07)]"
              transition={{ type: 'spring', bounce: 0.18, duration: 0.32 }}
            />
          )}
          <span className="relative z-10 whitespace-nowrap">{label}</span>
        </button>
      ))}
    </div>
  );
}

export default memo(ViewToggle);
