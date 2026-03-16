'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock } from '@phosphor-icons/react';

// ── Constants ─────────────────────────────────────────────────────────────────

const ITEM_HEIGHT = 44; // px height of each scroll item
const VISIBLE_ITEMS = 5; // odd number so selected is centered
const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

// ── Single drum column ────────────────────────────────────────────────────────

function DrumColumn({
  items,
  value,
  onChange,
  label,
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startScrollTop = useRef(0);

  const currentIndex = items.indexOf(value);

  // Scroll to the selected item
  const scrollToIndex = useCallback(
    (idx: number, instant = false) => {
      const el = containerRef.current;
      if (!el) return;
      const target = idx * ITEM_HEIGHT;
      if (instant) {
        el.scrollTop = target;
      } else {
        el.scrollTo({ top: target, behavior: 'smooth' });
      }
    },
    []
  );

  // On mount / value change - scroll to match
  useEffect(() => {
    if (currentIndex >= 0) scrollToIndex(currentIndex, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentIndex >= 0) scrollToIndex(currentIndex);
  }, [value, currentIndex, scrollToIndex]);

  // Snap to nearest item on scroll end
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || isDragging.current) return;
    const rawIndex = el.scrollTop / ITEM_HEIGHT;
    const snapped = Math.round(rawIndex);
    const clamped = Math.max(0, Math.min(items.length - 1, snapped));
    if (items[clamped] !== value) {
      onChange(items[clamped]);
    }
  }, [items, value, onChange]);

  // Debounced snap
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleScrollEvent = useCallback(() => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(handleScroll, 80);
  }, [handleScroll]);

  return (
    <div className="flex flex-col items-center select-none" style={{ width: 64 }}>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
        {label}
      </span>

      {/* Drum wrapper */}
      <div className="relative" style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}>
        {/* Selection highlight */}
        <div
          className="absolute left-0 right-0 z-10 pointer-events-none rounded-xl"
          style={{
            top: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2),
            height: ITEM_HEIGHT,
            background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(6,182,212,0.08) 100%)',
            border: '1.5px solid rgba(139,92,246,0.2)',
          }}
        />

        {/* Top fade */}
        <div
          className="absolute top-0 left-0 right-0 z-20 pointer-events-none"
          style={{
            height: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2),
            background: 'linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)',
          }}
        />

        {/* Bottom fade */}
        <div
          className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none"
          style={{
            height: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2),
            background: 'linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)',
          }}
        />

        {/* Scroll container */}
        <div
          ref={containerRef}
          onScroll={handleScrollEvent}
          className="overflow-y-scroll h-full"
          style={{
            scrollSnapType: 'y mandatory',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {/* Padding items top */}
          {Array.from({ length: Math.floor(VISIBLE_ITEMS / 2) }).map((_, i) => (
            <div key={`pad-top-${i}`} style={{ height: ITEM_HEIGHT }} />
          ))}

          {items.map((item) => (
            <div
              key={item}
              onClick={() => onChange(item)}
              style={{
                height: ITEM_HEIGHT,
                scrollSnapAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: item === value ? 22 : 18,
                fontWeight: item === value ? 700 : 400,
                color: item === value ? '#1A1F36' : '#9CA3AF',
                transition: 'all 0.15s',
              }}
            >
              {item}
            </div>
          ))}

          {/* Padding items bottom */}
          {Array.from({ length: Math.floor(VISIBLE_ITEMS / 2) }).map((_, i) => (
            <div key={`pad-bot-${i}`} style={{ height: ITEM_HEIGHT }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ScrollTimePicker ──────────────────────────────────────────────────────────

interface ScrollTimePickerProps {
  value: string; // HH:MM
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  dimmedHint?: string; // optional hint text below
}

export function ScrollTimePicker({
  value,
  onChange,
  placeholder = 'Izberi čas',
  error = false,
}: ScrollTimePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [hh, mm] = value ? value.split(':') : ['09', '00'];

  const handleHourChange = useCallback(
    (h: string) => {
      onChange(`${h}:${mm || '00'}`);
    },
    [mm, onChange]
  );

  const handleMinuteChange = useCallback(
    (m: string) => {
      onChange(`${hh || '09'}:${m}`);
    },
    [hh, onChange]
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button - styled like the animated Select */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-sm transition-all
                    ${open
                      ? 'border-violet-400 ring-2 ring-violet-100'
                      : error
                        ? 'border-red-300'
                        : 'border-gray-200 hover:border-gray-300'
                    }
                    bg-white text-[#1A1F36]`}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" weight="regular" />
          <span className={value ? 'text-[#1A1F36]' : 'text-gray-400'}>
            {value || placeholder}
          </span>
        </div>
        <motion.svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-gray-400 flex-shrink-0"
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </motion.svg>
      </button>

      {/* Dropdown picker */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="absolute z-50 mt-2 left-0 right-0 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
            style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(139,92,246,0.08)' }}
          >
            <div className="flex items-start justify-center gap-2 px-4 py-4">
              <DrumColumn
                items={HOURS}
                value={hh || '09'}
                onChange={handleHourChange}
                label="Ura"
              />

              {/* Colon separator */}
              <div
                className="flex flex-col items-center justify-center font-bold text-gray-300 flex-shrink-0"
                style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS, paddingTop: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2) + 4 }}
              >
                :
              </div>

              <DrumColumn
                items={MINUTES}
                value={mm || '00'}
                onChange={handleMinuteChange}
                label="Minuta"
              />
            </div>

            {/* Confirm button */}
            <div className="px-4 pb-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)' }}
              >
                Potrdi — {hh || '09'}:{mm || '00'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
