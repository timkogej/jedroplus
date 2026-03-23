'use client';

import { memo, useMemo, useRef, useLayoutEffect, useState, useCallback } from 'react';
import { X } from '@phosphor-icons/react';
import type { AppointmentWithDetails, Storitev } from '@/types/appointments';
import { formatTime, getGradientCSS } from '@/lib/utils/calendar';

// Extract FIRST hex color from a gradient or return the hex color as-is
function extractFirstColor(barva: string): string {
  if (!barva) return '#6366F1';

  if (barva.includes('gradient')) {
    const hexMatches = barva.match(/#[0-9A-Fa-f]{6}/g);
    if (hexMatches && hexMatches.length > 0) return hexMatches[0];

    const rgbMatch = barva.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0');
      const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0');
      const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
  }

  return barva;
}

// Extract LAST hex color from a gradient or return the hex color as-is
function extractLastColor(barva: string): string {
  if (!barva) return '#6366F1';

  if (barva.includes('gradient')) {
    const hexMatches = barva.match(/#[0-9A-Fa-f]{6}/g);
    if (hexMatches && hexMatches.length > 0) return hexMatches[hexMatches.length - 1];

    const rgbMatches = [...barva.matchAll(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi)];
    if (rgbMatches.length > 0) {
      const last = rgbMatches[rgbMatches.length - 1];
      const r = parseInt(last[1], 10).toString(16).padStart(2, '0');
      const g = parseInt(last[2], 10).toString(16).padStart(2, '0');
      const b = parseInt(last[3], 10).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
  }

  return barva;
}

// Create a combined gradient from multiple service colors
function createCombinedGradient(serviceColors: string[]): string {
  if (serviceColors.length === 0) {
    return 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)';
  }

  if (serviceColors.length === 1) {
    return getGradientCSS(serviceColors[0]);
  }

  if (serviceColors.length === 2) {
    const c1 = extractFirstColor(serviceColors[0]);
    const c2 = extractLastColor(serviceColors[1]);
    return `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
  }

  const c1 = extractFirstColor(serviceColors[0]);
  const c2 = extractLastColor(serviceColors[1]);
  const c3 = extractLastColor(serviceColors[2]);
  return `linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c3} 100%)`;
}

// Reusable canvas for text measurement
let _canvas: HTMLCanvasElement | null = null;
function measureTextWidth(text: string, font: string): number {
  if (typeof window === 'undefined') return text.length * 6;
  if (!_canvas) _canvas = document.createElement('canvas');
  const ctx = _canvas.getContext('2d');
  if (!ctx) return text.length * 6;
  ctx.font = font;
  return ctx.measureText(text).width;
}

// Smart client name component: shows "First Last", "First L.", or "First" based on available space
function SmartClientName({
  fullName,
  priimek,
  fontSize,
  fontWeight,
  className = '',
}: {
  fullName: string;
  priimek?: string;
  fontSize: string; // e.g. "11px"
  fontWeight: string | number; // e.g. "600"
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState('');

  // Parse name parts
  const { firstName, lastName } = useMemo(() => {
    const trimmed = (fullName || '').trim();
    if (priimek) {
      const before = trimmed.replace(new RegExp(`\\s*${priimek.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`), '').trim();
      return { firstName: before || trimmed, lastName: priimek };
    }
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return { firstName: words[0], lastName: words.slice(1).join(' ') };
    }
    return { firstName: words[0] || trimmed, lastName: '' };
  }, [fullName, priimek]);

  const font = `${fontWeight} ${fontSize} ui-sans-serif, system-ui, sans-serif`;

  const computeDisplay = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const availWidth = container.clientWidth;
    if (availWidth <= 0) return;

    const full = lastName ? `${firstName} ${lastName}` : firstName;
    const withInitial = lastName ? `${firstName} ${lastName.charAt(0)}.` : firstName;

    const fullW = measureTextWidth(full, font);
    const shortW = measureTextWidth(withInitial, font);

    if (fullW <= availWidth) {
      setDisplay(full);
    } else if (shortW <= availWidth) {
      setDisplay(withInitial);
    } else {
      setDisplay(firstName);
    }
  }, [firstName, lastName, font]);

  useLayoutEffect(() => {
    computeDisplay();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(computeDisplay);
    ro.observe(el);
    return () => ro.disconnect();
  }, [computeDisplay]);

  const fallback = lastName ? `${firstName} ${lastName}` : firstName;

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden whitespace-nowrap min-w-0 flex-1 leading-tight ${className}`}
      style={{ fontSize, fontWeight }}
    >
      {display || fallback}
    </div>
  );
}

interface AppointmentCardProps {
  appointment: AppointmentWithDetails;
  onClick: (appointment: AppointmentWithDetails) => void;
  variant?: 'grid' | 'compact' | 'mini';
  style?: React.CSSProperties;
  duration?: number;
  condensed?: boolean;
  services?: Storitev[];
  timeOnly?: boolean;
}

function AppointmentCard({
  appointment,
  onClick,
  variant = 'grid',
  style,
  duration,
  condensed = false,
  services = [],
  timeOnly = false,
}: AppointmentCardProps) {
  const isCompleted = ['completed', 'Zaključen', 'zaključen', 'no_show', 'Ni prišel'].includes(appointment.status || '');
  const isNoShow = appointment.status === 'no_show' || appointment.status === 'Ni prišel';

  const appointmentDuration = useMemo(() => {
    if (duration !== undefined) return duration;
    if (appointment.cas_zacetek && appointment.cas_konec) {
      const [startH, startM] = appointment.cas_zacetek.split(':').map(Number);
      const [endH, endM] = appointment.cas_konec.split(':').map(Number);
      return (endH * 60 + endM) - (startH * 60 + startM);
    }
    return appointment.storitev?.trajanje || 60;
  }, [duration, appointment.cas_zacetek, appointment.cas_konec, appointment.storitev?.trajanje]);

  const serviceGradient = useMemo(() => {
    if (isCompleted) {
      return 'linear-gradient(135deg, #D1D5DB 0%, #9CA3AF 100%)';
    }

    const primaryColor = appointment.storitev?.barva || '#6366F1';
    const id2 = appointment.storitev_id_2 || null;
    const id3 = appointment.storitev_id_3 || null;

    const service2 = appointment.storitev_2 || (id2 && services.length > 0 ? services.find(s => s.id === id2) : null);
    const service3 = appointment.storitev_3 || (id3 && services.length > 0 ? services.find(s => s.id === id3) : null);

    const allColors: string[] = [primaryColor];
    if (service2?.barva) allColors.push(service2.barva);
    if (service3?.barva) allColors.push(service3.barva);

    if (allColors.length === 1) return getGradientCSS(primaryColor);
    return createCombinedGradient(allColors);
  }, [appointment, services, isCompleted]);

  const handleClick = (e: React.MouseEvent) => { e.stopPropagation(); onClick(appointment); };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(appointment);
    }
  };

  const StatusIndicator = () => {
    if (isCompleted) return null;
    if (appointment.status === 'cancelled' || appointment.status === 'Odpovedan') {
      return (
        <div className="w-4 h-4 rounded-full bg-red-500/80 flex items-center justify-center flex-shrink-0">
          <X className="w-2.5 h-2.5 text-white" weight="bold" />
        </div>
      );
    }
    if (appointment.status === 'no_show' || appointment.status === 'Ni prišel') {
      return (
        <div className="w-4 h-4 rounded-full bg-orange-500/80 flex items-center justify-center flex-shrink-0">
          <X className="w-2.5 h-2.5 text-white" weight="bold" />
        </div>
      );
    }
    return null;
  };

  // ── Mini variant (month view) ──────────────────────────────────────────────
  if (variant === 'mini') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="group mb-0.5 cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-medium
                   transition-all hover:shadow-sm relative overflow-hidden flex items-center"
        style={{ background: serviceGradient, color: '#FFFFFF', ...style }}
      >
        <SmartClientName
          fullName={appointment.stranka_ime}
          priimek={appointment.stranka_priimek}
          fontSize="10px"
          fontWeight={600}
        />
        {isNoShow && (
          <div
            className="absolute inset-0 pointer-events-none rounded"
            style={{
              background: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(55,55,55,0.18) 4px, rgba(55,55,55,0.18) 7px)',
            }}
          />
        )}
      </div>
    );
  }

  // ── Compact variant (sidebar / list) ──────────────────────────────────────
  if (variant === 'compact') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="group cursor-pointer rounded-xl p-3 transition-all duration-200
                   hover:-translate-y-0.5 hover:shadow-lg overflow-hidden relative"
        style={{ background: serviceGradient, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', ...style }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1 text-xs font-semibold bg-white/20 px-2 py-1 rounded backdrop-blur-sm text-white">
            <span>{formatTime(appointment.cas_zacetek)}</span>
          </div>
          <span className="text-xs opacity-75 text-white">{formatTime(appointment.cas_konec)}</span>
        </div>
        <p className="font-bold text-sm leading-tight mb-1 text-white">{appointment.stranka_ime}</p>
        {appointment.storitev && (
          <p className="text-xs opacity-90 truncate mb-2 text-white">
            <span className="truncate">{appointment.storitev.naziv}</span>
            {(appointment.storitev_id_2 || appointment.storitev_id_3) && (
              <span className="font-bold flex-shrink-0 ml-1">
                +{(appointment.storitev_id_2 ? 1 : 0) + (appointment.storitev_id_3 ? 1 : 0)}
              </span>
            )}
          </p>
        )}
        <div className="flex items-center justify-between">
          {appointment.zaposleni && (
            <div
              className="w-6 h-6 flex items-center justify-center text-xs font-bold"
              style={{
                background: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {appointment.zaposleni.initials}
            </div>
          )}
          <StatusIndicator />
        </div>
        {isNoShow && (
          <div
            className="absolute inset-0 pointer-events-none rounded-xl"
            style={{
              background: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(55,55,55,0.18) 4px, rgba(55,55,55,0.18) 7px)',
            }}
          />
        )}
      </div>
    );
  }

  // ── Grid variant (week / day view) ─────────────────────────────────────────
  // Duration buckets (minutes):
  //   < 15  → ultra-mini: name + initials (no box) on one line, small font
  //   15-29 → very-short: name + initials (box), no time, no service
  //   30-59 → normal: name + initials, then time row
  //   ≥ 60  → full (≥1h): name + initials, time, service

  const isUltraMini = appointmentDuration < 15;
  const isVeryShort = appointmentDuration >= 15 && appointmentDuration <= 30;
  const isMedium = appointmentDuration > 30 && appointmentDuration < 60;
  const isFull = appointmentDuration >= 60;

  // For "condensed" override (forced from parent), treat as very-short
  const effectiveVeryShort = condensed ? true : isVeryShort;
  const effectiveMedium = condensed ? false : isMedium;
  const effectiveFull = condensed ? false : isFull;

  // Time display helpers – only show end time if the card has room
  const startTime = formatTime(appointment.cas_zacetek);
  const endTime = appointment.cas_konec ? formatTime(appointment.cas_konec) : null;

  // Service name (primary + +N indicator)
  const serviceLabel = appointment.storitev
    ? appointment.storitev.naziv +
      ((appointment.storitev_id_2 || appointment.storitev_id_3)
        ? ` +${(appointment.storitev_id_2 ? 1 : 0) + (appointment.storitev_id_3 ? 1 : 0)}`
        : '')
    : null;

  // ── Ultra-mini (< 15 min) ──────────────────────────────────────────────────
  if (isUltraMini) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="group absolute cursor-pointer overflow-hidden rounded-md
                   transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:z-30"
        style={{
          background: serviceGradient,
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          minHeight: '20px',
          ...style,
        }}
      >
        <div className="px-1.5 h-full flex items-center gap-1" style={{ color: '#FFFFFF' }}>
          <SmartClientName
            fullName={appointment.stranka_ime}
            priimek={appointment.stranka_priimek}
            fontSize="9.5px"
            fontWeight={500}
          />
          {appointment.zaposleni && (
            <span className="flex-shrink-0" style={{ fontSize: '8.5px', fontWeight: 500, opacity: 0.85 }}>
              {appointment.zaposleni.initials}
            </span>
          )}
          <StatusIndicator />
        </div>
        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-md" />
        {isNoShow && (
          <div
            className="absolute inset-0 pointer-events-none rounded-md"
            style={{
              background: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(55,55,55,0.18) 4px, rgba(55,55,55,0.18) 7px)',
            }}
          />
        )}
      </div>
    );
  }

  // ── Very-short (15-29 min) or condensed override ──────────────────────────
  if (effectiveVeryShort && !effectiveMedium && !effectiveFull) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="group absolute cursor-pointer overflow-hidden rounded-lg
                   transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:z-30"
        style={{
          background: serviceGradient,
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          minHeight: '24px',
          ...style,
        }}
      >
        <div className="px-2.5 py-1.5 h-full flex items-center gap-1.5" style={{ color: '#FFFFFF' }}>
          <SmartClientName
            fullName={appointment.stranka_ime}
            priimek={appointment.stranka_priimek}
            fontSize="12px"
            fontWeight={600}
          />
          {appointment.zaposleni && (
            <div
              className="bg-white/20 px-1 py-0.5 rounded flex-shrink-0"
              style={{ fontSize: '10px', fontWeight: 600 }}
            >
              {appointment.zaposleni.initials}
            </div>
          )}
          <StatusIndicator />
        </div>
        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-lg" />
        {isNoShow && (
          <div
            className="absolute inset-0 pointer-events-none rounded-lg"
            style={{
              background: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(55,55,55,0.18) 4px, rgba(55,55,55,0.18) 7px)',
            }}
          />
        )}
      </div>
    );
  }

  // ── Normal (30-59 min): name + initials, then time ─────────────────────────
  if (effectiveMedium) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="group absolute cursor-pointer overflow-hidden rounded-lg
                   transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:z-30"
        style={{
          background: serviceGradient,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          minHeight: '40px',
          ...style,
        }}
      >
        <div className="px-2.5 pt-2.5 pb-1.5 h-full flex flex-col" style={{ color: '#FFFFFF' }}>
          {/* Row 1: client name + initials */}
          <div className="flex items-center gap-1.5 min-w-0">
            <SmartClientName
              fullName={appointment.stranka_ime}
              priimek={appointment.stranka_priimek}
              fontSize="12px"
              fontWeight={600}
            />
            {appointment.zaposleni && (
              <div
                className="bg-white/20 px-1 py-0.5 rounded flex-shrink-0"
                style={{ fontSize: '10px', fontWeight: 600 }}
              >
                {appointment.zaposleni.initials}
              </div>
            )}
            <StatusIndicator />
          </div>
          {/* Row 2: time */}
          <TimeRow startTime={startTime} endTime={endTime} />
        </div>
        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-lg" />
        {isNoShow && (
          <div
            className="absolute inset-0 pointer-events-none rounded-lg"
            style={{
              background: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(55,55,55,0.18) 4px, rgba(55,55,55,0.18) 7px)',
            }}
          />
        )}
      </div>
    );
  }

  // ── Full (≥ 1h): name + initials, time, service ───────────────────────────
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="group absolute cursor-pointer overflow-hidden rounded-lg
                 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:z-30"
      style={{
        background: serviceGradient,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        minHeight: '60px',
        ...style,
      }}
    >
      <div className="px-2.5 pt-2.5 pb-1.5 h-full flex flex-col" style={{ color: '#FFFFFF' }}>
        {/* Row 1: client name + initials */}
        <div className="flex items-center gap-1.5 min-w-0">
          <SmartClientName
            fullName={appointment.stranka_ime}
            priimek={appointment.stranka_priimek}
            fontSize="12px"
            fontWeight={600}
          />
          {appointment.zaposleni && (
            <div
              className="bg-white/20 px-1 py-0.5 rounded flex-shrink-0"
              style={{ fontSize: '10px', fontWeight: 600 }}
            >
              {appointment.zaposleni.initials}
            </div>
          )}
          <StatusIndicator />
        </div>
        {/* Row 2: time */}
        <TimeRow startTime={startTime} endTime={endTime} />
        {/* Row 3: service name */}
        {serviceLabel && (
          <div
            className="mt-0.5 overflow-hidden whitespace-nowrap"
            style={{ fontSize: '10px', fontWeight: 400, opacity: 0.80 }}
          >
            {serviceLabel}
          </div>
        )}
      </div>
      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-lg" />
      {isNoShow && (
        <div
          className="absolute inset-0 pointer-events-none rounded-lg"
          style={{
            background: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(55,55,55,0.18) 4px, rgba(55,55,55,0.18) 7px)',
          }}
        />
      )}
    </div>
  );
}

// Time row: shows "HH:MM - HH:MM" or just "HH:MM" if the end time doesn't fit
function TimeRow({ startTime, endTime }: { startTime: string; endTime: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showEnd, setShowEnd] = useState(true);

  const font = '500 10px ui-sans-serif, system-ui, sans-serif';

  const computeVisibility = useCallback(() => {
    const container = containerRef.current;
    if (!container || !endTime) return;
    const availWidth = container.clientWidth;
    const fullW = measureTextWidth(`${startTime} - ${endTime}`, font);
    setShowEnd(fullW <= availWidth);
  }, [startTime, endTime, font]);

  useLayoutEffect(() => {
    computeVisibility();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(computeVisibility);
    ro.observe(el);
    return () => ro.disconnect();
  }, [computeVisibility]);

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-0.5 mt-0.5 overflow-hidden whitespace-nowrap"
      style={{ fontSize: '10px', fontWeight: 500, opacity: 0.88 }}
    >
      <span>{startTime}</span>
      {endTime && showEnd && (
        <>
          <span className="opacity-60 mx-px">–</span>
          <span>{endTime}</span>
        </>
      )}
    </div>
  );
}

export default memo(AppointmentCard);
