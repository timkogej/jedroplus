"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Calendar, ArrowRight, X, Copy, Check } from "@phosphor-icons/react";
import Link from "next/link";
import type { AppointmentItem } from "@/lib/dashboard/fetchDashboardData";

function extractFirstColor(barva: string): string {
  if (!barva) return '#8B5CF6';
  if (barva.includes('gradient')) {
    // Try hex
    const m = barva.match(/#[0-9A-Fa-f]{6}/g);
    if (m && m.length > 0) return m[0];
    // Try rgb(...)
    const rgb = barva.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (rgb) return `rgb(${rgb[1]}, ${rgb[2]}, ${rgb[3]})`;
  }
  return barva;
}

function extractLastColor(barva: string): string {
  if (!barva) return '#8B5CF6';
  if (barva.includes('gradient')) {
    const m = barva.match(/#[0-9A-Fa-f]{6}/g);
    if (m && m.length > 0) return m[m.length - 1];
    const allRgb = [...barva.matchAll(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi)];
    if (allRgb.length > 0) { const last = allRgb[allRgb.length - 1]; return `rgb(${last[1]}, ${last[2]}, ${last[3]})`; }
  }
  return barva;
}

// For a single hex/solid color, generate a light→dark gradient (same as calendar AppointmentCard)
function singleColorGradient(barva: string): string {
  if (barva.includes('gradient')) {
    // Already a gradient — change direction to 180deg (top→bottom) for vertical bar
    return barva.replace(/\d+deg/, '180deg');
  }
  const hex = barva.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 100;
  const g = parseInt(hex.substring(2, 4), 16) || 100;
  const b = parseInt(hex.substring(4, 6), 16) || 240;
  const lr = Math.min(255, r + 40);
  const lg = Math.min(255, g + 40);
  const lb = Math.min(255, b + 40);
  const dr = Math.max(0, r - 20);
  const dg = Math.max(0, g - 20);
  const db = Math.max(0, b - 20);
  return `linear-gradient(180deg, rgb(${lr},${lg},${lb}) 0%, rgb(${dr},${dg},${db}) 100%)`;
}

function buildServiceBarGradient(c1: string, c2?: string, c3?: string): string {
  if (!c2) return singleColorGradient(c1);
  if (!c3) return `linear-gradient(180deg, ${extractFirstColor(c1)} 0%, ${extractLastColor(c2)} 100%)`;
  return `linear-gradient(180deg, ${extractFirstColor(c1)} 0%, ${extractLastColor(c2)} 50%, ${extractLastColor(c3)} 100%)`;
}

interface AppointmentListCardProps {
  title: string;
  subtitle: string;
  appointments: AppointmentItem[];
  emptyMessage?: string;
  showViewAll?: boolean;
  viewAllHref?: string;
  gradientOutline?: boolean;
  onAppointmentClick?: (item: AppointmentItem) => void;
}

// Copy button for contact info
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
      title={`Kopiraj ${label}`}
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-500" weight="bold" />
      ) : (
        <Copy className="h-4 w-4" weight="regular" />
      )}
    </button>
  );
}

// Appointment detail modal — matches Calendar AppointmentDetailModal style
function AppointmentDetailModal({
  appointment,
  onClose,
}: {
  appointment: AppointmentItem;
  onClose: () => void;
}) {
  const getGradientBackground = () => {
    const extractFirst = (barva: string): string => {
      if (!barva) return '#6366F1';
      if (barva.includes('gradient')) {
        const m = barva.match(/#[0-9A-Fa-f]{6}/g);
        if (m && m.length > 0) return m[0];
      }
      return barva;
    };
    const extractLast = (barva: string): string => {
      if (!barva) return '#6366F1';
      if (barva.includes('gradient')) {
        const m = barva.match(/#[0-9A-Fa-f]{6}/g);
        if (m && m.length > 0) return m[m.length - 1];
      }
      return barva;
    };
    const singleGradient = (barva: string): string => {
      if (barva.includes('gradient')) return barva;
      const hex = barva.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 100;
      const g = parseInt(hex.substring(2, 4), 16) || 100;
      const b = parseInt(hex.substring(4, 6), 16) || 240;
      const lr = Math.min(255, r + 40);
      const lg = Math.min(255, g + 40);
      const lb = Math.min(255, b + 40);
      return `linear-gradient(135deg, rgb(${lr}, ${lg}, ${lb}) 0%, ${barva} 100%)`;
    };

    const allColors: string[] = [appointment.serviceColor || '#6366F1'];
    if (appointment.serviceColor2) allColors.push(appointment.serviceColor2);
    if (appointment.serviceColor3) allColors.push(appointment.serviceColor3);

    if (allColors.length === 1) return singleGradient(allColors[0]);
    if (allColors.length === 2) return `linear-gradient(135deg, ${extractFirst(allColors[0])} 0%, ${extractLast(allColors[1])} 100%)`;
    return `linear-gradient(135deg, ${extractFirst(allColors[0])} 0%, ${extractLast(allColors[1])} 50%, ${extractLast(allColors[2])} 100%)`;
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Načrtovano';
      case 'confirmed': return 'Potrjeno';
      case 'completed': return 'Zaključeno';
      case 'cancelled': return 'Preklicano';
      case 'pending': return 'Čakajoč';
      case 'no_show': return 'Ni prišel/a';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-emerald-100 text-emerald-700';
      case 'confirmed': return 'bg-blue-100 text-blue-700';
      case 'completed': return 'bg-gray-100 text-gray-600';
      case 'cancelled': return 'bg-red-100 text-red-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'no_show': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const duration = (() => {
    if (!appointment.time || !appointment.endTime) return null;
    try {
      const [sh, sm] = appointment.time.split(':').map(Number);
      const [eh, em] = appointment.endTime.split(':').map(Number);
      const mins = (eh * 60 + em) - (sh * 60 + sm);
      return mins > 0 ? mins : null;
    } catch { return null; }
  })();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Colored header with client name and close button */}
        <div
          className="relative flex items-center justify-between px-5 py-3.5"
          style={{ background: getGradientBackground() }}
        >
          <h3 className="text-base font-semibold text-white truncate pr-3">
            {appointment.clientName}
          </h3>
          <motion.button
            type="button"
            onClick={onClose}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-full bg-white/20 p-2 text-white transition-colors hover:bg-white/30 flex-shrink-0"
            aria-label="Zapri"
          >
            <X className="h-5 w-5" weight="bold" />
          </motion.button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Status */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Status</label>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(appointment.status || 'scheduled')}`}>
              {getStatusLabel(appointment.status || 'scheduled')}
            </span>
          </div>

          {/* Client */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Stranka</label>
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
              <span className="text-lg font-bold bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent flex-shrink-0">
                {appointment.clientName?.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="font-medium text-[#1A1F36]">{appointment.clientName || '-'}</p>
                {appointment.clientEmail && <p className="text-xs text-gray-500 truncate">{appointment.clientEmail}</p>}
                {appointment.clientPhone && <p className="text-xs text-gray-500">{appointment.clientPhone}</p>}
              </div>
              {(appointment.clientEmail || appointment.clientPhone) && (
                <div className="flex flex-col gap-1 ml-auto">
                  {appointment.clientEmail && <CopyButton text={appointment.clientEmail} label="email" />}
                  {appointment.clientPhone && <CopyButton text={appointment.clientPhone} label="telefon" />}
                </div>
              )}
            </div>
          </div>

          {/* Service */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Storitev</label>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: appointment.serviceColor || '#6366F1' }} />
              <p className="text-sm font-medium text-[#1A1F36]">{appointment.serviceName}</p>
            </div>
          </div>

          {/* Employee */}
          {appointment.employeeName && appointment.employeeName !== 'Nedoločeno' && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Oseba</label>
              <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
                <span
                  className="text-lg font-bold flex-shrink-0"
                  style={{
                    background: appointment.employeeColor || 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {appointment.employeeInitials}
                </span>
                <p className="font-medium text-[#1A1F36]">{appointment.employeeName}</p>
              </div>
            </div>
          )}

          {/* Time */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Čas</label>
            <p className="text-sm font-medium text-[#1A1F36]">
              {appointment.time}{appointment.endTime ? ` – ${appointment.endTime}` : ''}
            </p>
          </div>

          {/* Duration */}
          {duration !== null && (
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-violet-50 to-cyan-50 rounded-xl">
              <span className="text-sm font-medium text-gray-700">Trajanje</span>
              <span className="text-lg font-bold bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                {duration} min
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-3">
          <div className="flex items-center justify-end gap-1">
            <Link
              href={`/termini?id=${appointment.id}`}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
              title="Odpri v Termini"
            >
              <ArrowRight className="h-4.5 w-4.5" weight="regular" />
            </Link>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function AppointmentListCard({
  title,
  subtitle,
  appointments,
  emptyMessage = "Ni terminov",
  showViewAll = true,
  viewAllHref = "/termini",
  gradientOutline = false,
  onAppointmentClick,
}: AppointmentListCardProps) {
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentItem | null>(null);

  const cardContent = (
    <>
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Icon only - no circle background */}
            <Calendar size={24} weight="bold" className="text-gray-900" />
            <div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-gray-500">
            <span className="text-lg font-semibold text-gray-900">{appointments.length}</span>
          </div>
        </div>
      </div>

      {/* Appointments List - Clickable cards */}
      <div className="divide-y divide-gray-50">
        {appointments.length === 0 ? (
          <div className="p-6 text-center text-gray-400">
            <Calendar size={32} className="mx-auto mb-2 opacity-50" />
            <p>{emptyMessage}</p>
          </div>
        ) : (
          appointments.slice(0, 5).map((appointment, index) => (
            <motion.button
              key={appointment.id}
              type="button"
              onClick={() => onAppointmentClick ? onAppointmentClick(appointment) : setSelectedAppointment(appointment)}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="w-full p-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                {/* Time */}
                <div className="flex-shrink-0">
                  <div className="text-lg font-bold text-gray-900">
                    {appointment.time}
                  </div>
                  {appointment.endTime && (
                    <div className="text-xs text-gray-500">
                      {appointment.endTime}
                    </div>
                  )}
                </div>

                {/* Client - no initials, just name and service */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">
                    {appointment.clientName}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <span className="truncate">{appointment.serviceName}</span>
                    {((appointment.serviceId2 ? 1 : 0) + (appointment.serviceId3 ? 1 : 0)) > 0 && (
                      <span
                        className="text-sm font-bold flex-shrink-0"
                        style={{
                          backgroundImage: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >
                        +{(appointment.serviceId2 ? 1 : 0) + (appointment.serviceId3 ? 1 : 0)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Employee initials - gradient text, no circle */}
                <div
                  className="flex h-10 w-10 items-center justify-center text-lg font-bold flex-shrink-0"
                  style={{
                    background: appointment.employeeColor || 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    color: 'transparent'
                  }}
                >
                  {appointment.employeeInitials}
                </div>
              </div>
            </motion.button>
          ))
        )}
      </div>

      {/* View all link */}
      {showViewAll && appointments.length > 0 && (
        <Link
          href={viewAllHref}
          className="flex items-center justify-center gap-2 p-4 border-t border-gray-100 text-sm font-medium text-violet-600 hover:bg-violet-50 transition-colors"
        >
          Poglej vse termine
          <ArrowRight size={16} weight="bold" />
        </Link>
      )}
    </>
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={
          gradientOutline
            ? "relative rounded-2xl p-[2px] bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 overflow-hidden"
            : "rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden"
        }
      >
        {gradientOutline ? (
          <div className="h-full w-full rounded-[14px] bg-white overflow-hidden">
            {cardContent}
          </div>
        ) : (
          cardContent
        )}
      </motion.div>

      {/* Appointment detail modal */}
      <AnimatePresence>
        {selectedAppointment && (
          <AppointmentDetailModal
            appointment={selectedAppointment}
            onClose={() => setSelectedAppointment(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
