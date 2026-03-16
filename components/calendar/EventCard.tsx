'use client';

import { memo } from 'react';
import type { CalendarEvent } from '@/types/events';
import { getEventTitleStyle, isGradient, extractFirstColorStop } from '@/lib/utils/eventColors';

interface EventCardProps {
  event: CalendarEvent;
  onClick: (event: CalendarEvent) => void;
  /**
   * mini   — compact row used in MonthView cells
   * banner — slim strip used in DayView / WeekView header
   * grid   — absolute-positioned block used in time grid (future)
   */
  variant?: 'mini' | 'banner';
  style?: React.CSSProperties;
}

/**
 * Gradient border via wrapper technique:
 *   outer div  → background = event color (gradient or solid), padding = 2px
 *   inner div  → background = white, border-radius = outer - 2
 * This gives a real 2 px colored border that supports gradients.
 */
function formatTime(t: string): string {
  return t.slice(0, 5);
}

function EventCard({ event, onClick, variant = 'mini', style }: EventCardProps) {
  const { color, title, start_time, end_time, all_day, location } = event;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(event);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(event);
    }
  };

  // Title style: gradient text clip when gradient color, solid otherwise
  const titleStyle = getEventTitleStyle(color);

  // ── Mini variant — MonthView cells ──────────────────────────────────────────
  if (variant === 'mini') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="group mb-0.5 cursor-pointer w-full"
        style={{
          padding: '2px',
          background: color || '#6D5EF7',
          borderRadius: '6px',
          ...style,
        }}
        title={title}
      >
        <div
          className="w-full overflow-hidden"
          style={{
            background: '#fff',
            borderRadius: '4px',
            padding: '1px 6px 2px',
          }}
        >
          {/* Title row */}
          <div className="flex items-center gap-1 min-w-0">
            <span
              className="text-[10px] font-semibold truncate leading-tight flex-1"
              style={titleStyle}
            >
              {title}
            </span>
          </div>
          {/* Time row — only when not all-day */}
          {!all_day && start_time && (
            <div
              className="leading-tight"
              style={{ fontSize: '9px', fontWeight: 500, color: '#1A1F36', opacity: 0.75 }}
            >
              {formatTime(start_time)}{end_time ? ` – ${formatTime(end_time)}` : ''}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Banner variant — DayView / WeekView header strip ──────────────────────
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="group cursor-pointer w-full"
      style={{
        padding: '1.5px',
        background: color || '#6D5EF7',
        borderRadius: '5px',
        ...style,
      }}
      title={title}
    >
      <div
        className="w-full overflow-hidden flex items-center gap-1 min-w-0"
        style={{
          background: '#fff',
          borderRadius: '3px',
          padding: '1.5px 5px',
        }}
      >
        <span
          className="text-[10px] font-semibold truncate flex-1 leading-tight"
          style={titleStyle}
        >
          {title}
        </span>
        {!all_day && start_time && (
          <span
            className="flex-shrink-0 leading-tight"
            style={{ fontSize: '9px', fontWeight: 500, color: '#1A1F36', opacity: 0.7 }}
          >
            {formatTime(start_time)}
          </span>
        )}
      </div>
    </div>
  );
}

export default memo(EventCard);
