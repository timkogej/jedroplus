'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CaretDown, CaretUp } from '@phosphor-icons/react';
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
  { mode: '2day', label: '3 dni' },
  { mode: 'month', label: 'Mesec' },
];

function ViewToggle({ currentView, onViewChange, isMobile = false }: ViewToggleProps) {
  const views = isMobile ? mobileViews : desktopViews;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLabel = views.find(v => v.mode === currentView)?.label ?? views[0].label;

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  // Mobile: dropdown select button
  if (isMobile) {
    return (
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen(prev => !prev)}
          className="flex items-center gap-1 rounded-[10px] bg-black/[0.07] px-3 py-[5px] text-[11px] font-medium text-[#1A1F36] select-none"
        >
          <span>{currentLabel}</span>
          {dropdownOpen
            ? <CaretUp className="w-3 h-3" weight="bold" />
            : <CaretDown className="w-3 h-3" weight="bold" />
          }
        </button>

        <AnimatePresence>
          {dropdownOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -6 }}
              transition={{ duration: 0.15, type: 'spring', stiffness: 500, damping: 35 }}
              className="absolute right-0 top-full mt-1.5 z-50 min-w-[90px] overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-gray-200"
            >
              {views.map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => { onViewChange(mode); setDropdownOpen(false); }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-[13px] font-medium transition-colors
                    ${currentView === mode
                      ? 'bg-gray-50 text-[#1A1F36] font-semibold'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-[#1A1F36]'
                    }`}
                >
                  <span>{label}</span>
                  {currentView === mode && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Desktop: segmented control (unchanged)
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
