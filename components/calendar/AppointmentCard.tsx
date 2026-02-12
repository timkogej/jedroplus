'use client';

import { memo, useMemo } from 'react';
import { X, Clock } from '@phosphor-icons/react';
import type { AppointmentWithDetails, Storitev } from '@/types/appointments';
import { formatTime, getGradientCSS } from '@/lib/utils/calendar';

// Extract FIRST hex color from a gradient or return the hex color as-is
function extractFirstColor(barva: string): string {
  if (!barva) return '#6366F1';

  if (barva.includes('gradient')) {
    // Match all hex colors like #6366F1
    const hexMatches = barva.match(/#[0-9A-Fa-f]{6}/g);
    if (hexMatches && hexMatches.length > 0) return hexMatches[0];

    // Match rgb colors
    const rgbMatch = barva.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0');
      const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0');
      const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
  }

  // It's a plain hex color
  return barva;
}

// Extract LAST hex color from a gradient or return the hex color as-is
function extractLastColor(barva: string): string {
  if (!barva) return '#6366F1';

  if (barva.includes('gradient')) {
    // Match all hex colors like #6366F1
    const hexMatches = barva.match(/#[0-9A-Fa-f]{6}/g);
    if (hexMatches && hexMatches.length > 0) return hexMatches[hexMatches.length - 1];

    // Match all rgb colors and take last
    const rgbMatches = [...barva.matchAll(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi)];
    if (rgbMatches.length > 0) {
      const last = rgbMatches[rgbMatches.length - 1];
      const r = parseInt(last[1], 10).toString(16).padStart(2, '0');
      const g = parseInt(last[2], 10).toString(16).padStart(2, '0');
      const b = parseInt(last[3], 10).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
  }

  // It's a plain hex color
  return barva;
}

// Create a combined gradient from multiple service colors
// Service 1: take FIRST color, Service 2: take LAST color, Service 3: take LAST color
function createCombinedGradient(serviceColors: string[]): string {
  if (serviceColors.length === 0) {
    return 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)';
  }

  if (serviceColors.length === 1) {
    return getGradientCSS(serviceColors[0]);
  }

  // For 2 services: first color of service 1, last color of service 2
  if (serviceColors.length === 2) {
    const c1 = extractFirstColor(serviceColors[0]);
    const c2 = extractLastColor(serviceColors[1]);
    return `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
  }

  // For 3 services: first color of service 1, last color of service 2, last color of service 3
  const c1 = extractFirstColor(serviceColors[0]);
  const c2 = extractLastColor(serviceColors[1]);
  const c3 = extractLastColor(serviceColors[2]);
  return `linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c3} 100%)`;
}

interface AppointmentCardProps {
  appointment: AppointmentWithDetails;
  onClick: (appointment: AppointmentWithDetails) => void;
  variant?: 'grid' | 'compact' | 'mini';
  style?: React.CSSProperties;
  duration?: number; // Duration in minutes
  condensed?: boolean; // Force condensed view (hide end time, service name)
  services?: Storitev[]; // List of services to lookup additional service colors
}

function AppointmentCard({ appointment, onClick, variant = 'grid', style, duration, condensed = false, services = [] }: AppointmentCardProps) {
  // Check if appointment is completed - show gray gradient
  const isCompleted = ['completed', 'Zaključen', 'zaključen'].includes(appointment.status || '');

  // Calculate duration if not provided
  const appointmentDuration = useMemo(() => {
    if (duration !== undefined) return duration;
    if (appointment.cas_zacetek && appointment.cas_konec) {
      const [startH, startM] = appointment.cas_zacetek.split(':').map(Number);
      const [endH, endM] = appointment.cas_konec.split(':').map(Number);
      return (endH * 60 + endM) - (startH * 60 + startM);
    }
    return appointment.storitev?.trajanje || 60;
  }, [duration, appointment.cas_zacetek, appointment.cas_konec, appointment.storitev?.trajanje]);

  // Determine if this is a short appointment (less than 45 minutes)
  const isShortAppointment = appointmentDuration < 45;

  // Check if service barva is a gradient string or hex color - now supports combined gradients
  const serviceGradient = useMemo(() => {
    // If completed, use SOFTER gray gradient
    if (isCompleted) {
      return 'linear-gradient(135deg, #D1D5DB 0%, #9CA3AF 100%)'; // Lighter gray
    }

    // Get primary service color
    const primaryColor = appointment.storitev?.barva || '#6366F1';

    // Use typed fields for additional service IDs
    const id2 = appointment.storitev_id_2 || null;
    const id3 = appointment.storitev_id_3 || null;

    // Lookup additional service colors if services list is provided
    const service2 = id2 && services.length > 0 ? services.find(s => s.id === id2) : null;
    const service3 = id3 && services.length > 0 ? services.find(s => s.id === id3) : null;

    // Collect all colors
    const allColors: string[] = [primaryColor];
    if (service2?.barva) allColors.push(service2.barva);
    if (service3?.barva) allColors.push(service3.barva);

    // If only one color, use the standard gradient
    if (allColors.length === 1) {
      return getGradientCSS(primaryColor);
    }

    // Create combined gradient from multiple colors
    return createCombinedGradient(allColors);
  }, [appointment, services, isCompleted]);

  // Force white text for all appointment cards for better contrast on gradient backgrounds
  const colors = useMemo(() => {
    return {
      from: '',
      to: '',
      text: '#FFFFFF', // Always white text
      border: '',
    };
  }, []);

  const handleClick = () => {
    onClick(appointment);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(appointment);
    }
  };

  // Status indicator component - NO "Zaključen" text, NO checkmark for completed
  const StatusIndicator = () => {
    // Completed appointments - show nothing (softer gray gradient is enough)
    if (isCompleted) {
      return null;
    }
    if (appointment.status === 'cancelled' || appointment.status === 'Odpovedan') {
      return (
        <div className="w-5 h-5 rounded-full bg-red-500/80 backdrop-blur-sm flex items-center justify-center">
          <X className="w-3 h-3 text-white" weight="bold" />
        </div>
      );
    }
    if (appointment.status === 'no_show' || appointment.status === 'Ni prišel') {
      return (
        <div className="w-5 h-5 rounded-full bg-orange-500/80 backdrop-blur-sm flex items-center justify-center">
          <X className="w-3 h-3 text-white" weight="bold" />
        </div>
      );
    }
    return null;
  };

  // Mini variant for month view
  if (variant === 'mini') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="group mb-0.5 cursor-pointer truncate rounded px-1.5 py-0.5 text-[10px] font-medium
                   transition-all hover:shadow-sm border border-white/20"
        style={{
          background: serviceGradient,
          color: colors.text,
          ...style,
        }}
      >
        <span className="mr-1 opacity-80">{formatTime(appointment.cas_zacetek)}</span>
        <span className="font-semibold">{appointment.stranka_ime}</span>
      </div>
    );
  }

  // Compact variant for sidebar or list
  if (variant === 'compact') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="group cursor-pointer rounded-xl p-3 transition-all duration-200
                   hover:-translate-y-0.5 hover:shadow-lg border border-white/20 overflow-hidden"
        style={{
          background: serviceGradient,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          ...style,
        }}
      >
        {/* Time badge */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="flex items-center gap-1 text-xs font-semibold bg-white/20 px-2 py-1 rounded backdrop-blur-sm"
            style={{ color: colors.text }}
          >
            <Clock className="w-3 h-3" weight="fill" />
            <span>{formatTime(appointment.cas_zacetek)}</span>
          </div>
          <span className="text-xs opacity-75" style={{ color: colors.text }}>
            {formatTime(appointment.cas_konec)}
          </span>
        </div>

        {/* Client name - prominent */}
        <p className="font-bold text-sm leading-tight mb-1" style={{ color: colors.text }}>
          {appointment.stranka_ime}
        </p>

        {/* Service name */}
        {appointment.storitev && (
          <p className="text-xs opacity-90 truncate mb-2 flex items-center gap-1" style={{ color: colors.text }}>
            <span className="truncate">{appointment.storitev.naziv}</span>
            {(appointment.storitev_id_2 || appointment.storitev_id_3) && (
              <span className="font-bold flex-shrink-0">
                +{(appointment.storitev_id_2 ? 1 : 0) + (appointment.storitev_id_3 ? 1 : 0)}
              </span>
            )}
          </p>
        )}

        {/* Bottom: Employee & Status */}
        <div className="flex items-center justify-between">
          {appointment.zaposleni && (
            <div
              className="w-6 h-6 flex items-center justify-center text-xs font-bold"
              style={{
                background: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                color: 'transparent'
              }}
            >
              {appointment.zaposleni.initials}
            </div>
          )}
          <StatusIndicator />
        </div>
      </div>
    );
  }

  // Grid variant for week/day view (positioned absolutely)
  // Short appointments (< 45 min) OR condensed mode: Compact layout with employee on same row as time
  if ((isShortAppointment || condensed) && variant === 'grid') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="group absolute cursor-pointer overflow-hidden rounded-lg border border-white/20
                   transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:z-30"
        style={{
          background: serviceGradient,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          minHeight: '30px',
          ...style,
        }}
      >
        {/* Compact content for short/condensed appointments */}
        <div className="p-1.5 h-full flex flex-col" style={{ color: colors.text }}>
          {/* Top: Time + Employee initials on same row */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              {/* Start time - bold, NO background box */}
              <div className="text-[9px] font-bold">
                {formatTime(appointment.cas_zacetek)}
              </div>
              {/* End time - only show when NOT condensed */}
              {!condensed && appointment.cas_konec && (
                <>
                  <span className="text-[9px] opacity-75">-</span>
                  <span className="text-[9px] opacity-90">
                    {formatTime(appointment.cas_konec)}
                  </span>
                </>
              )}
            </div>
            {/* Employee initials on same row as time */}
            {appointment.zaposleni && (
              <div className="text-[9px] font-bold bg-white/25 px-1 py-0.5 rounded backdrop-blur-sm flex-shrink-0">
                {appointment.zaposleni.initials}
              </div>
            )}
          </div>

          {/* Only client name - no service name for short/condensed appointments */}
          <div className="font-bold text-[10px] leading-tight truncate mt-0.5">
            {appointment.stranka_ime}
          </div>
        </div>

        {/* Hover Effect */}
        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-lg" />
      </div>
    );
  }

  // Standard grid variant for normal length appointments
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="group absolute cursor-pointer overflow-hidden rounded-lg border border-white/20
                 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:z-30"
      style={{
        background: serviceGradient,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        minHeight: condensed ? '40px' : '50px',
        ...style,
      }}
    >
      {/* Content container with proper padding */}
      <div className="p-2 h-full flex flex-col" style={{ color: colors.text }}>
        {/* Top Section: Time - NO background box, bold only */}
        <div className="flex items-center gap-1 mb-1">
          <div className="text-[10px] font-bold">
            {formatTime(appointment.cas_zacetek)}
          </div>
          {/* End time - only show when NOT condensed */}
          {!condensed && appointment.cas_konec && (
            <>
              <span className="text-[10px] opacity-75">-</span>
              <span className="text-[10px] opacity-90">
                {formatTime(appointment.cas_konec)}
              </span>
            </>
          )}
        </div>

        {/* CLIENT NAME (LEFT) & EMPLOYEE INITIALS (RIGHT) */}
        <div className="flex items-center justify-between flex-1 min-w-0">
          {/* CLIENT NAME - LEFT SIDE, PROMINENT */}
          <div className="font-bold text-xs leading-tight pr-2 flex-1 min-w-0">
            <div className="truncate">
              {appointment.stranka_ime}
            </div>
          </div>

          {/* EMPLOYEE INITIALS - RIGHT SIDE (no circle, just letters with subtle bg) */}
          {appointment.zaposleni && (
            <div className="text-[10px] font-bold bg-white/25 px-1.5 py-0.5 rounded backdrop-blur-sm flex-shrink-0">
              {appointment.zaposleni.initials}
            </div>
          )}
        </div>

        {/* Service name at bottom - only show when NOT condensed */}
        {!condensed && appointment.storitev && (
          <div className="text-[10px] opacity-80 mt-1 truncate flex items-center gap-1">
            <span className="truncate">{appointment.storitev.naziv}</span>
            {(appointment.storitev_id_2 || appointment.storitev_id_3) && (
              <span className="font-bold opacity-90 flex-shrink-0">
                +{(appointment.storitev_id_2 ? 1 : 0) + (appointment.storitev_id_3 ? 1 : 0)}
              </span>
            )}
          </div>
        )}

        {/* Status Indicator - bottom right */}
        <div className="flex justify-end mt-auto pt-0.5">
          <StatusIndicator />
        </div>
      </div>

      {/* Hover Effect */}
      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-lg" />
    </div>
  );
}

export default memo(AppointmentCard);
