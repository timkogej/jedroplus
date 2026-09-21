'use client';

import { useCallback, useState } from 'react';
import { END_HOUR, HOUR_HEIGHT, START_HOUR } from '@/lib/utils/calendar';

interface HoverState {
  key: string;
  top: number;
  label: string;
}

/**
 * Shows "+ 10:30" over the empty slot under the mouse, so it's obvious that a
 * click books an appointment there. Snaps exactly like the click handlers in
 * WeekView/DayView (nearest half hour), so the hint and the result agree.
 * Hidden on touch screens, where there is no hover.
 */
export function useSlotHover(enabled: boolean) {
  const [hover, setHover] = useState<HoverState | null>(null);

  const onMouseMove = useCallback(
    (e: React.MouseEvent, key: string) => {
      if (!enabled) return;
      // Over an appointment or other card, not an empty slot.
      const target = e.target as HTMLElement;
      if (target !== e.currentTarget && target.closest('[role="button"], button, a, [data-slot-blocker]')) {
        setHover(null);
        return;
      }
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const totalMinutes = ((e.clientY - rect.top) / HOUR_HEIGHT) * 60;
      let hour = Math.floor(totalMinutes / 60) + START_HOUR;
      let minute = Math.round((totalMinutes % 60) / 30) * 30;
      if (minute >= 60) {
        hour++;
        minute = 0;
      }
      hour = Math.max(START_HOUR, Math.min(hour, END_HOUR - 1));
      const top = ((hour - START_HOUR) * 60 + minute) / 60 * HOUR_HEIGHT;
      const label = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      setHover((prev) => (prev && prev.key === key && prev.top === top ? prev : { key, top, label }));
    },
    [enabled]
  );

  const onMouseLeave = useCallback(() => setHover(null), []);

  const renderHint = (key: string) =>
    enabled && hover && hover.key === key ? (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1 right-1 z-[1] hidden items-start rounded-md border border-dashed border-violet-300 bg-violet-50/70 px-1.5 pt-0.5 text-[11px] font-medium text-violet-700 [@media(hover:hover)]:flex"
        style={{ top: hover.top, height: HOUR_HEIGHT / 2 }}
      >
        + {hover.label}
      </div>
    ) : null;

  return { onMouseMove, onMouseLeave, renderHint };
}
