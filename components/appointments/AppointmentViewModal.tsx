'use client';

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Calendar,
  Clock,
  User,
  Briefcase,
  Envelope,
  Phone,
  Copy,
  Check,
  PencilSimple,
  Trash,
} from '@phosphor-icons/react';
import { format } from 'date-fns';
import { sl } from 'date-fns/locale';
import type { AppointmentWithDetails } from '@/types/appointments';
import StatusBadge from './StatusBadge';

interface AppointmentViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: AppointmentWithDetails | null;
  onEdit?: () => void;
  onDelete?: () => void;
}

// Copy button component
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.button
      type="button"
      onClick={handleCopy}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="rounded-lg p-2 border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
      title={`Kopiraj ${label}`}
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-500" weight="bold" />
      ) : (
        <Copy className="h-4 w-4" weight="regular" />
      )}
    </motion.button>
  );
}

// Calculate duration in minutes
function calculateDuration(start: string, end: string): number {
  if (!start || !end) return 0;
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
}

function AppointmentViewModal({
  isOpen,
  onClose,
  appointment,
  onEdit,
  onDelete,
}: AppointmentViewModalProps) {
  if (!isOpen || !appointment) return null;

  const duration = calculateDuration(appointment.cas_zacetek, appointment.cas_konec || '');

  // Animation variants
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
    },
    exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.15 } },
  };

  // Get service color for header
  const headerColor = appointment.storitev?.barva || 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)';

  // Format date
  const formattedDate = appointment.datum
    ? format(new Date(appointment.datum), "d. MMMM yyyy", { locale: sl })
    : '-';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          {/* GRADIENT HEADER with service color */}
          <div
            className="px-8 py-8"
            style={{ background: headerColor }}
          >
            <div className="flex items-start justify-between">
              <div>
                {/* Client Name - Large */}
                <h2 className="text-3xl font-bold text-white mb-3">
                  {appointment.stranka_ime || '-'}
                </h2>

                {/* Service Name */}
                <div className="flex items-center gap-2 text-white/95 mb-2">
                  <Briefcase className="w-5 h-5" weight="fill" />
                  <span className="text-lg font-semibold">
                    {appointment.storitev?.naziv || '-'}
                  </span>
                </div>

                {/* Duration */}
                {duration > 0 && (
                  <div className="flex items-center gap-2 text-white/90 text-sm">
                    <Clock className="w-4 h-4" weight="fill" />
                    <span>Trajanje: {duration} minut</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Status Badge */}
                <StatusBadge status={appointment.status || 'scheduled'} size="md" />

                {/* Close button */}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                >
                  <X className="h-5 w-5" weight="bold" />
                </button>
              </div>
            </div>
          </div>

          {/* CONTENT */}
          <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {/* Date & Time - GRADIENT BORDER ONLY */}
            <div className="grid grid-cols-2 gap-4">
              {/* Datum */}
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 p-[3px]">
                  <div className="h-full bg-white rounded-xl" />
                </div>
                <div className="relative rounded-xl bg-white p-4">
                  <div className="flex items-center gap-3">
                    {/* Icon - BLACK, NO CIRCLE */}
                    <Calendar className="w-5 h-5 text-gray-900" weight="bold" />
                    <div>
                      <div className="text-sm text-gray-600">Datum</div>
                      <div className="font-semibold text-gray-900">
                        {formattedDate}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Čas */}
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 p-[3px]">
                  <div className="h-full bg-white rounded-xl" />
                </div>
                <div className="relative rounded-xl bg-white p-4">
                  <div className="flex items-center gap-3">
                    {/* Icon - BLACK, NO CIRCLE */}
                    <Clock className="w-5 h-5 text-gray-900" weight="bold" />
                    <div>
                      <div className="text-sm text-gray-600">Čas</div>
                      <div className="font-semibold text-gray-900">
                        {appointment.cas_zacetek} - {appointment.cas_konec || '-'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Trajanje & Cena */}
            <div className="space-y-3">
              {/* Trajanje termina */}
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-violet-50 to-cyan-50 rounded-xl">
                <span className="text-sm font-medium text-gray-700">Trajanje termina</span>
                <span className="text-lg font-bold bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                  {duration > 0 ? `${duration} min` : '-'}
                </span>
              </div>

              {/* Skupno trajanje - only show if multiple services */}
              {(appointment.storitev_id_2 || appointment.storitev_id_3) && (
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-violet-50 to-cyan-50 rounded-xl">
                  <span className="text-sm font-medium text-gray-700">Skupno trajanje</span>
                  <span className="text-lg font-bold bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                    {duration > 0 ? `${duration} min` : '-'}
                  </span>
                </div>
              )}

              {/* Končna cena */}
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-violet-50 to-cyan-50 rounded-xl">
                <span className="text-sm font-medium text-gray-700">Končna cena</span>
                <span className="text-xl font-bold bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                  {appointment.koncna_cena || appointment.cena || '0.00'} €
                </span>
              </div>
            </div>

            {/* Service & Employee - Side by side */}
            <div className="grid grid-cols-2 gap-4">
              {/* Service Info */}
              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200">
                <div className="flex items-center gap-4">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ background: appointment.storitev?.barva || '#8B5CF6' }}
                  />
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Storitev
                    </div>
                    <div className="text-lg font-bold text-gray-900 mt-0.5">
                      {appointment.storitev?.naziv || '-'}
                    </div>
                    {appointment.storitev?.trajanje && appointment.storitev.trajanje > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        {appointment.storitev.trajanje} minut
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Employee Info */}
              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200">
                <div className="flex items-center gap-4">
                  <span
                    className="text-2xl font-bold flex-shrink-0"
                    style={{
                      backgroundImage: appointment.zaposleni?.barva || 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {appointment.zaposleni?.initials || '?'}
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Zaposleni
                    </div>
                    <div className="text-lg font-bold text-gray-900 mt-0.5">
                      {appointment.zaposleni
                        ? `${appointment.zaposleni.ime} ${appointment.zaposleni.priimek}`
                        : '-'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Client Contact Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                Kontakt stranke
              </h3>

              {/* Email */}
              {appointment.stranka_email && (
                <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                        <Envelope className="w-5 h-5 text-white" weight="fill" />
                      </div>
                      <div>
                        <div className="text-xs text-blue-600 font-semibold">Email</div>
                        <div className="text-sm font-medium text-gray-900">
                          {appointment.stranka_email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <CopyButton text={appointment.stranka_email} label="email" />

                      <motion.a
                        href={`mailto:${appointment.stranka_email}`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md"
                      >
                        <Envelope className="w-4 h-4" weight="bold" />
                        Email
                      </motion.a>
                    </div>
                  </div>
                </div>
              )}

              {/* Phone */}
              {appointment.stranka_telefon && (
                <div className="p-4 bg-green-50 rounded-xl border-2 border-green-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
                        <Phone className="w-5 h-5 text-white" weight="fill" />
                      </div>
                      <div>
                        <div className="text-xs text-green-600 font-semibold">Telefon</div>
                        <div className="text-sm font-medium text-gray-900">
                          {appointment.stranka_telefon}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <CopyButton text={appointment.stranka_telefon} label="telefon" />

                      <motion.a
                        href={`tel:${appointment.stranka_telefon}`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md"
                      >
                        <Phone className="w-4 h-4" weight="bold" />
                        Kliči
                      </motion.a>
                    </div>
                  </div>
                </div>
              )}

              {/* No contact info message */}
              {!appointment.stranka_email && !appointment.stranka_telefon && (
                <div className="p-4 bg-gray-50 rounded-xl text-center text-gray-500 text-sm">
                  Ni kontaktnih podatkov
                </div>
              )}
            </div>

            {/* Notes */}
            {appointment.opombe && (
              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Opombe
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {appointment.opombe}
                </p>
              </div>
            )}

            {/* Internal Notes */}
            {(() => {
              const notes = appointment.interne_opombe
                || (appointment as unknown as Record<string, unknown>)['Interne opombe'] as string
                || '';
              if (!notes) return null;
              return (
                <div className="p-5 bg-white rounded-2xl border-2 border-yellow-200">
                  <div className="text-xs font-bold text-yellow-700 uppercase tracking-wide mb-2">
                    Interne opombe
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {notes}
                  </p>
                </div>
              );
            })()}
          </div>

          {/* FOOTER - No Zapri button, only action buttons */}
          <div className="flex gap-3 p-6 border-t border-gray-100 bg-gray-50">
            {onEdit && (
              <motion.button
                type="button"
                onClick={onEdit}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:shadow-lg"
              >
                <PencilSimple className="w-4 h-4" weight="bold" />
                Uredi
              </motion.button>
            )}
            {onDelete && (
              <motion.button
                type="button"
                onClick={onDelete}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-red-600"
              >
                <Trash className="w-4 h-4" weight="bold" />
                Izbriši
              </motion.button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default memo(AppointmentViewModal);
