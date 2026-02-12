'use client';

import { memo, useEffect, useRef, useState, useCallback } from 'react';
import {
  generateTimeSlots,
  getCurrentTimePosition,
  isCurrentTimeVisible,
  HOUR_HEIGHT,
  START_HOUR,
  END_HOUR,
} from '@/lib/utils/calendar';

interface TimeGridProps {
  children: React.ReactNode;
  columnCount?: number; // 1 for day view, 7 for week view
  showCurrentTime?: boolean;
}

function TimeGrid({ children, columnCount = 7, showCurrentTime = true }: TimeGridProps) {
  const timeSlots = generateTimeSlots();
  const gridRef = useRef<HTMLDivElement>(null);
  const timeLabelsRef = useRef<HTMLDivElement>(null);
  const [currentTimePosition, setCurrentTimePosition] = useState(getCurrentTimePosition());

  // Update current time indicator every minute
  useEffect(() => {
    if (!showCurrentTime) return;

    const interval = setInterval(() => {
      setCurrentTimePosition(getCurrentTimePosition());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [showCurrentTime]);

  // Scroll to current time on mount and sync both containers
  useEffect(() => {
    if (gridRef.current && isCurrentTimeVisible()) {
      const scrollPosition = Math.max(0, currentTimePosition - 100);
      gridRef.current.scrollTop = scrollPosition;
      // Also sync time labels
      if (timeLabelsRef.current) {
        timeLabelsRef.current.scrollTop = scrollPosition;
      }
    }
  }, []);

  // Sync time labels scroll with grid scroll
  const handleGridScroll = useCallback(() => {
    if (gridRef.current && timeLabelsRef.current) {
      timeLabelsRef.current.scrollTop = gridRef.current.scrollTop;
    }
  }, []);

  const totalHours = END_HOUR - START_HOUR + 1;
  const gridHeight = totalHours * HOUR_HEIGHT;

  return (
    <div className="flex flex-1 overflow-hidden bg-white">
      {/* Time labels column - Apple Calendar style: clean, no background */}
      <div className="flex w-[52px] flex-shrink-0 flex-col">
        {/* Time labels - hidden scrollbar, synced with grid */}
        <div
          ref={timeLabelsRef}
          className="relative flex-1 overflow-hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div style={{ height: gridHeight }}>
            {timeSlots.map((time, index) => {
              // Only show labels from 6:00 onwards (first labeled hour)
              const hour = parseInt(time.split(':')[0], 10);
              const showLabel = hour >= 6;

              return (
                <div
                  key={time}
                  className="absolute right-2 flex items-center"
                  style={{ top: index * HOUR_HEIGHT - 7 }}
                >
                  {showLabel && (
                    <span className="text-[10px] font-normal tabular-nums text-gray-400">
                      {time}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main grid area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Grid content with scroll */}
        <div
          ref={gridRef}
          className="relative flex-1 overflow-auto"
          onScroll={handleGridScroll}
        >
          <div className="relative" style={{ height: gridHeight, minWidth: '100%' }}>
            {/* Horizontal hour lines - Apple Calendar style: subtle, clean */}
            {timeSlots.map((time, index) => (
              <div
                key={time}
                className="absolute left-0 right-0"
                style={{
                  top: index * HOUR_HEIGHT,
                  height: '1px',
                  background: 'rgba(0, 0, 0, 0.06)',
                }}
              />
            ))}

            {/* Half-hour lines - Apple Calendar style: barely visible */}
            {timeSlots.slice(0, -1).map((time, index) => (
              <div
                key={`${time}-half`}
                className="absolute left-0 right-0"
                style={{
                  top: index * HOUR_HEIGHT + HOUR_HEIGHT / 2,
                  height: '1px',
                  background: 'rgba(0, 0, 0, 0.025)',
                }}
              />
            ))}

            {/* Current time indicator - Apple Calendar style: red line with dot */}
            {showCurrentTime && isCurrentTimeVisible() && (
              <div
                className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                style={{ top: currentTimePosition }}
              >
                <div
                  className="-ml-[5px] h-[10px] w-[10px] rounded-full"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)' }}
                />
                <div
                  className="flex-1"
                  style={{
                    height: '2px',
                    background: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                  }}
                />
              </div>
            )}

            {/* Column content */}
            <div className="absolute inset-0">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(TimeGrid);
