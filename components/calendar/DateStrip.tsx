'use client';

import { memo } from 'react';
import { motion } from 'motion/react';
import type { ViewMode } from '@/lib/utils/calendar';
import { DAYS_ABBR, addDays, startOfWeek, isSameDay, isToday } from '@/lib/utils/calendar';
import { useTranslations } from 'next-intl';

interface DateStripProps {
  currentDate: Date;
  currentView: ViewMode;
  onDateSelect: (date: Date) => void;
}

function DateStrip({ currentDate, currentView, onDateSelect }: DateStripProps) {
  const t = useTranslations('common');
  // Sun=0 … Sat=6, matching JS getDay()
  const DAY_LETTER = [
    t('dayLetters.sun'),
    t('dayLetters.mon'),
    t('dayLetters.tue'),
    t('dayLetters.wed'),
    t('dayLetters.thu'),
    t('dayLetters.fri'),
    t('dayLetters.sat'),
  ];
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
        const dayOfWeek = day.getDay();

        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onDateSelect(day)}
            className="group flex flex-1 flex-col items-center gap-[3px] py-2 transition-colors"
          >
            {/* Day letter */}
            <span
              className="text-[9px] font-semibold uppercase tracking-wider transition-colors"
              style={
                isPrimary || (today && !isSecondary)
                  ? {
                      background: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }
                  : { color: '#9CA3AF' }
              }
            >
              {DAY_LETTER[dayOfWeek]}
            </span>

            {/* Day number circle */}
            <div className="relative flex h-[30px] w-full items-center justify-center">
              {isPrimary && (
                <motion.div
                  layoutId="dateStripPrimary"
                  className="absolute inset-0 mx-auto w-[30px] rounded-full"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)' }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              {isSecondary && !isPrimary && (
                <motion.div
                  layoutId="dateStripSecondary"
                  className="absolute inset-0 mx-auto w-[30px] rounded-full bg-gray-200"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <span
                className="relative z-10 text-[14px] font-semibold leading-none"
                style={
                  isPrimary
                    ? { color: '#fff' }
                    : isSecondary
                      ? { color: '#6B7280' }
                      : today
                        ? {
                            background: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                          }
                        : { color: '#1A1F36' }
                }
              >
                {day.getDate()}
              </span>
            </div>

            {/* Today dot – shown only when not selected */}
            <div className="h-[5px] flex items-center justify-center">
              {today && !isPrimary && !isSecondary && (
                <span
                  className="h-[4px] w-[4px] rounded-full"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)' }}
                />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default memo(DateStrip);
