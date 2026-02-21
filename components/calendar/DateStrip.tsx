'use client';

import { memo } from 'react';
import { motion } from 'motion/react';
import type { ViewMode } from '@/lib/utils/calendar';
import { DAYS_ABBR, addDays, startOfWeek, isSameDay, isToday } from '@/lib/utils/calendar';

interface DateStripProps {
  currentDate: Date;
  currentView: ViewMode;
  onDateSelect: (date: Date) => void;
}

function DateStrip({ currentDate, currentView, onDateSelect }: DateStripProps) {
  // Show 7 days of the week containing currentDate (Mon–Sun)
  const weekStart = startOfWeek(currentDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // In 2-day view: also highlight the next day (secondary selection)
  const secondaryDate = currentView === '2day' ? addDays(currentDate, 1) : null;

  return (
    <div className="flex items-stretch border-t border-gray-100 bg-white/90">
      {days.map((day) => {
        const isPrimary = isSameDay(day, currentDate);
        const isSecondary = secondaryDate !== null && isSameDay(day, secondaryDate);
        const today = isToday(day);
        const dayOfWeek = day.getDay(); // 0 = Sun, 1 = Mon …

        // Day abbreviation color
        const abbrevColor = isPrimary
          ? 'text-blue-500'
          : isSecondary
            ? 'text-gray-500'
            : today
              ? 'text-blue-400'
              : 'text-gray-400';

        // Number text color
        const numberColor = isPrimary
          ? 'text-white'
          : isSecondary
            ? 'text-[#1A1F36]'
            : today
              ? 'text-blue-500'
              : 'text-[#1A1F36] group-hover:text-blue-500';

        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onDateSelect(day)}
            className="group flex flex-1 flex-col items-center gap-[3px] py-2 transition-colors"
          >
            {/* Day abbreviation */}
            <span className={`text-[9px] font-semibold uppercase tracking-wider transition-colors ${abbrevColor}`}>
              {DAYS_ABBR[dayOfWeek]}
            </span>

            {/* Day number circle */}
            <div className="relative flex h-[30px] w-[30px] items-center justify-center">
              {/* Primary selection – solid blue circle */}
              {isPrimary && (
                <motion.div
                  layoutId="dateStripPrimary"
                  className="absolute inset-0 rounded-full bg-blue-500 shadow-md shadow-blue-200"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              {/* Secondary selection (2-day view) – soft gray circle, iOS style */}
              {isSecondary && !isPrimary && (
                <motion.div
                  layoutId="dateStripSecondary"
                  className="absolute inset-0 rounded-full bg-gray-200"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <span className={`relative z-10 text-[14px] font-semibold leading-none transition-colors ${numberColor}`}>
                {day.getDate()}
              </span>
            </div>

            {/* Today dot – shown only when not primary-selected */}
            <div className="h-[5px] flex items-center justify-center">
              {today && !isPrimary && (
                <span className="h-[4px] w-[4px] rounded-full bg-blue-500" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default memo(DateStrip);
