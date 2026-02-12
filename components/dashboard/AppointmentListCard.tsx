"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Calendar, Clock, ArrowRight, X, Envelope, Phone, Copy, Check, Briefcase } from "@phosphor-icons/react";
import Link from "next/link";
import type { AppointmentItem } from "@/lib/dashboard/fetchDashboardData";

interface AppointmentListCardProps {
  title: string;
  subtitle: string;
  appointments: AppointmentItem[];
  emptyMessage?: string;
  showViewAll?: boolean;
  gradientOutline?: boolean;
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

// Appointment detail modal
function AppointmentDetailModal({
  appointment,
  onClose,
}: {
  appointment: AppointmentItem;
  onClose: () => void;
}) {
  const serviceColor = appointment.serviceColor || '#8B5CF6';
  const employeeColor = appointment.employeeColor || 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)';

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
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with service gradient */}
        <div
          className="p-6"
          style={{ background: serviceColor.includes('gradient') ? serviceColor : `linear-gradient(135deg, ${serviceColor} 0%, ${serviceColor}dd 100%)` }}
        >
          <div className="flex-1 pr-8">
            <h2 className="text-2xl font-bold text-white mb-2">
              {appointment.clientName}
            </h2>
            <div className="flex items-center gap-2 text-white/90">
              <Briefcase className="w-5 h-5" />
              <span>{appointment.serviceName}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white transition-colors hover:bg-white/30"
            aria-label="Zapri"
          >
            <X className="h-5 w-5" weight="bold" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Time */}
          <div className="flex items-center gap-3 p-3 bg-violet-50 rounded-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
              <Clock className="h-5 w-5 text-violet-600" weight="regular" />
            </div>
            <div>
              <p className="text-xs text-violet-600 font-semibold">Čas</p>
              <p className="text-lg font-bold text-gray-900">{appointment.time}</p>
            </div>
          </div>

          {/* Employee */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div
              className="flex h-10 w-10 items-center justify-center text-xl font-bold"
              style={{
                background: employeeColor || 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                color: 'transparent'
              }}
            >
              {appointment.employeeInitials}
            </div>
            <div>
              <p className="text-xs text-gray-500">Zaposleni</p>
              <p className="text-sm font-semibold text-gray-900">
                {appointment.employeeName}
              </p>
            </div>
          </div>

          {/* Client contact */}
          {(appointment.clientEmail || appointment.clientPhone) && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kontakt stranke</p>

              {appointment.clientEmail && (
                <div className="p-3 bg-blue-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500">
                        <Envelope className="h-4 w-4 text-white" weight="fill" />
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 font-semibold">Email</p>
                        <p className="text-sm font-medium text-gray-900">{appointment.clientEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <CopyButton text={appointment.clientEmail} label="email" />
                      <a
                        href={`mailto:${appointment.clientEmail}`}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-blue-600"
                      >
                        <Envelope className="h-3.5 w-3.5" weight="bold" />
                        Pošlji
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {appointment.clientPhone && (
                <div className="p-3 bg-emerald-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500">
                        <Phone className="h-4 w-4 text-white" weight="fill" />
                      </div>
                      <div>
                        <p className="text-xs text-emerald-600 font-semibold">Telefon</p>
                        <p className="text-sm font-medium text-gray-900">{appointment.clientPhone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <CopyButton text={appointment.clientPhone} label="telefon" />
                      <a
                        href={`tel:${appointment.clientPhone}`}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-emerald-600"
                      >
                        <Phone className="h-3.5 w-3.5" weight="bold" />
                        Kliči
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer - view in termini */}
        <div className="border-t border-gray-100 p-4">
          <Link
            href={`/termini?id=${appointment.id}`}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 py-3 text-sm font-medium text-white transition-all hover:shadow-lg hover:shadow-violet-500/25"
          >
            Odpri v Termini
            <ArrowRight className="h-4 w-4" weight="bold" />
          </Link>
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
  gradientOutline = false,
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
          {/* Appointment count as text badge, not number in icon */}
          <span className="text-sm font-medium text-gray-500">
            {appointments.length} {appointments.length === 1 ? 'termin' : 'terminov'}
          </span>
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
              onClick={() => setSelectedAppointment(appointment)}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="w-full p-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-4">
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
                  <div className="text-sm text-gray-600 truncate">
                    {appointment.serviceName}
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
          href="/termini"
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
