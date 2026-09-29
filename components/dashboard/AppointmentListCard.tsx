"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Calendar, ArrowRight, Copy, Check } from "@phosphor-icons/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { AppointmentItem } from "@/lib/dashboard/fetchDashboardData";
import { initialsStyle } from "./initialsStyle";
import CommunicationLanguageFlag from "@/components/shared/CommunicationLanguageFlag";
import {
  Sheet,
  SheetHeader,
  SheetBody,
  SheetGroup,
  SheetRow,
  SheetFooter,
} from "@/components/ui/sheet";

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
  appointments: AppointmentItem[];
  emptyMessage?: string;
  onAppointmentClick?: (item: AppointmentItem) => void;
}

// Copy button for contact info
function CopyButton({ text, label }: { text: string; label: string }) {
  const t = useTranslations('dashboard');
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
      title={t('copyButton', { label })}
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-500" weight="bold" />
      ) : (
        <Copy className="h-4 w-4" weight="regular" />
      )}
    </button>
  );
}

// ─── Podrobnosti termina ─────────────────────────────────────────────────────
// Na telefonu list od spodaj, na namizju sredinska plošča. Vsebina je urejena
// v skupine z vrsticami oznaka/vrednost — vzorec iz iOS in macOS Nastavitev.

/** Iz barve storitve (lahko je preliv) potegne eno polno barvo za piko. */
function solidColor(value?: string | null): string {
  if (!value) return '#6366F1';
  if (value.includes('gradient')) {
    const m = value.match(/#[0-9A-Fa-f]{6}/g);
    return m?.[0] ?? '#6366F1';
  }
  return value;
}

function AppointmentDetailModal({
  appointment,
  onClose,
}: {
  appointment: AppointmentItem;
  onClose: () => void;
}) {
  const t = useTranslations('dashboard');

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return t('detailModal.status.scheduled');
      case 'confirmed': return t('detailModal.status.confirmed');
      case 'completed': return t('detailModal.status.completed');
      case 'cancelled': return t('detailModal.status.cancelled');
      case 'pending': return t('detailModal.status.pending');
      case 'no_show': return t('detailModal.status.noShow');
      default: return status;
    }
  };

  // Ploskovni odtenki namesto nasičenih ploščic — Apple barvo uporabi
  // kot namig, ne kot poudarek.
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-emerald-50 text-emerald-700';
      case 'confirmed': return 'bg-blue-50 text-blue-700';
      case 'completed': return 'bg-gray-100 text-gray-600';
      case 'cancelled': return 'bg-red-50 text-red-600';
      case 'pending': return 'bg-amber-50 text-amber-700';
      case 'no_show': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
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

  const formattedDate = (() => {
    if (!appointment.datum) return null;
    const rawDate = appointment.datum.includes('T') ? appointment.datum : `${appointment.datum}T00:00:00`;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return appointment.datum;
    return date.toLocaleDateString('sl-SI', { day: 'numeric', month: 'long', year: 'numeric' });
  })();

  const status = appointment.status || 'scheduled';
  const hasEmployee = appointment.employeeName && appointment.employeeName !== 'Nedoločeno';
  const hasContact = Boolean(appointment.clientEmail || appointment.clientPhone);

  return (
    <Sheet onClose={onClose}>
      <SheetHeader
        title={appointment.clientName}
        subtitle={formattedDate ?? undefined}
        accent={solidColor(appointment.serviceColor)}
        onClose={onClose}
        closeLabel={t('detailModal.actions.close')}
        badge={
          <>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(status)}`}>
              {getStatusLabel(status)}
            </span>
            <CommunicationLanguageFlag value={appointment.language} />
          </>
        }
      />

      <SheetBody>
        {/* Kdaj — brez oznake skupine, ker datum stoji že v glavi */}
        <SheetGroup>
          <SheetRow
            label={t('detailModal.fields.time')}
            value={
              <span className="tnum">
                {appointment.time}{appointment.endTime ? ` – ${appointment.endTime}` : ''}
              </span>
            }
          />
          {duration !== null && (
            <SheetRow
              label={t('detailModal.fields.duration')}
              value={<span className="tnum">{duration} min</span>}
            />
          )}
        </SheetGroup>

        {/* Storitve */}
        <SheetGroup label={t('detailModal.fields.service')}>
          <SheetRow label={appointment.serviceName}>
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ background: solidColor(appointment.serviceColor) }}
              />
              <span className="truncate text-sm font-medium text-gray-900">
                {appointment.serviceName}
              </span>
            </span>
          </SheetRow>

          {appointment.addOnName && (
            <SheetRow label={appointment.addOnName}>
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ background: solidColor(appointment.addOnServiceColor) }}
                />
                <span className="truncate text-sm font-medium text-gray-900">
                  {appointment.addOnName}
                </span>
                <span className="flex-shrink-0 rounded-full bg-gray-100 px-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  {t('detailModal.fields.additionalService')}
                </span>
              </span>
              {appointment.addOnDuration && appointment.addOnDuration > 0 ? (
                <span className="tnum flex-shrink-0 text-sm text-gray-500">
                  {appointment.addOnDuration} min
                </span>
              ) : null}
            </SheetRow>
          )}
        </SheetGroup>

        {/* Zaposleni */}
        {hasEmployee && (
          <SheetGroup label={t('detailModal.fields.employee')}>
            <SheetRow label={appointment.employeeName ?? ''}>
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className="flex-shrink-0 text-lg font-bold"
                  style={initialsStyle(appointment.employeeColor)}
                >
                  {appointment.employeeInitials}
                </span>
                <span className="truncate text-sm font-medium text-gray-900">
                  {appointment.employeeName}
                </span>
              </span>
            </SheetRow>
          </SheetGroup>
        )}

        {/* Stranka — vrstici sta klicljivi oziroma odpreta e-pošto */}
        {hasContact && (
          <SheetGroup label={t('detailModal.fields.client')}>
            {appointment.clientEmail && (
              <SheetRow label="Email">
                <span className="flex-shrink-0 text-sm text-gray-500">Email</span>
                <span className="flex min-w-0 items-center gap-1">
                  <a
                    href={`mailto:${appointment.clientEmail}`}
                    className="truncate text-sm font-medium text-[#6D5EF7] hover:opacity-70"
                  >
                    {appointment.clientEmail}
                  </a>
                  <CopyButton text={appointment.clientEmail} label="email" />
                </span>
              </SheetRow>
            )}
            {appointment.clientPhone && (
              <SheetRow label={t('detailModal.fields.phone')}>
                <span className="flex-shrink-0 text-sm text-gray-500">
                  {t('detailModal.fields.phone')}
                </span>
                <span className="flex min-w-0 items-center gap-1">
                  <a
                    href={`tel:${appointment.clientPhone}`}
                    className="tnum truncate text-sm font-medium text-[#6D5EF7] hover:opacity-70"
                  >
                    {appointment.clientPhone}
                  </a>
                  <CopyButton text={appointment.clientPhone} label="telefon" />
                </span>
              </SheetRow>
            )}
          </SheetGroup>
        )}
      </SheetBody>

      <SheetFooter>
        <Link
          href={`/termini?id=${appointment.id}`}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80"
        >
          {t('detailModal.openInAppointments')}
          <ArrowRight className="h-4 w-4" weight="bold" />
        </Link>
      </SheetFooter>
    </Sheet>
  );
}


export function AppointmentListCard({
  appointments,
  emptyMessage,
  onAppointmentClick,
}: AppointmentListCardProps) {
  const t = useTranslations('dashboard');
  const resolvedEmptyMessage = emptyMessage ?? t('appointmentList.defaultEmpty');
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentItem | null>(null);

  const cardContent = (
    <>
      {/* Appointments List - Clickable cards */}
      <div className="divide-y divide-gray-100">
        {appointments.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Calendar size={24} weight="regular" className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-400">{resolvedEmptyMessage}</p>
          </div>
        ) : (
          appointments.slice(0, 5).map((appointment) => (
            <motion.button
              key={appointment.id}
              type="button"
              onClick={() => onAppointmentClick ? onAppointmentClick(appointment) : setSelectedAppointment(appointment)}
              className="w-full px-5 py-3 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
            >
              <div className="flex items-center gap-3">
                {/* Time */}
                <div className="w-12 flex-shrink-0">
                  <div className="tnum text-base font-semibold text-gray-900">
                    {appointment.time}
                  </div>
                  {appointment.endTime && (
                    <div className="tnum text-xs text-gray-400">
                      {appointment.endTime}
                    </div>
                  )}
                </div>

                {/* Client - no initials, just name and service */}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-medium text-gray-900">
                    {appointment.clientName}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <span className="truncate">{appointment.serviceName}</span>
                    {((appointment.serviceId2 ? 1 : 0) + (appointment.serviceId3 ? 1 : 0) + (appointment.addOnName ? 1 : 0)) > 0 && (
                      <span className="tnum flex-shrink-0 rounded-full bg-gray-100 px-1.5 text-xs font-medium text-gray-600">
                        +{(appointment.serviceId2 ? 1 : 0) + (appointment.serviceId3 ? 1 : 0) + (appointment.addOnName ? 1 : 0)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Employee initials - gradient text, no circle */}
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-lg font-bold"
                  style={initialsStyle(appointment.employeeColor)}
                >
                  {appointment.employeeInitials}
                </div>
              </div>
            </motion.button>
          ))
        )}
      </div>

    </>
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
        className="overflow-hidden rounded-2xl border border-gray-100 bg-white"
      >
        {cardContent}
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
