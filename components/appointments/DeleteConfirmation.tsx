'use client';

import { memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Warning, Trash, X, SpinnerGap, CalendarBlank, Clock, Briefcase, UserCircle } from '@phosphor-icons/react';
import type { AppointmentWithDetails } from '@/types/appointments';

interface DeleteConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  itemName?: string;
  isDeleting?: boolean;
  // Enhanced: Pass full appointment details for better display
  appointment?: AppointmentWithDetails | null;
}

function DeleteConfirmation({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
  isDeleting = false,
  appointment,
}: DeleteConfirmationProps) {
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
    exit: { opacity: 0, scale: 0.95, y: 20 },
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('sl-SI', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && !isDeleting && onClose()}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 p-6">
              <div className="flex items-center gap-3">
                <Warning className="h-6 w-6 text-red-600 flex-shrink-0" weight="regular" />
                <div>
                  <h2 className="text-lg font-semibold text-[#1A1F36]">
                    {title}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Ali ste prepričani?
                  </p>
                </div>
              </div>
              <motion.button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#1A1F36]
                           disabled:opacity-50"
              >
                <X className="h-5 w-5" weight="bold" />
              </motion.button>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Appointment details card */}
              {appointment ? (
                <div className="rounded-xl bg-gray-50 p-4 space-y-3">
                  {/* Client */}
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-semibold text-[#1A1F36]">
                        {appointment.stranka_ime || 'Neznana stranka'}
                      </p>
                      {appointment.stranka_email && (
                        <p className="text-sm text-gray-500">{appointment.stranka_email}</p>
                      )}
                    </div>
                  </div>

                  {/* Appointment details */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                    {/* Date */}
                    <div className="flex items-center gap-2">
                      <CalendarBlank className="h-4 w-4 text-gray-400" weight="regular" />
                      <span className="text-sm text-gray-700">
                        {appointment.datum ? formatDate(appointment.datum) : '-'}
                      </span>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" weight="regular" />
                      <span className="text-sm text-gray-700">
                        {appointment.cas_zacetek ? appointment.cas_zacetek.substring(0, 5) : '-'}
                      </span>
                    </div>

                    {/* Service */}
                    {appointment.storitev?.naziv && (
                      <div className="flex items-center gap-2 col-span-2">
                        <Briefcase className="h-4 w-4 text-gray-400 flex-shrink-0" weight="regular" />
                        <span className="text-sm text-gray-700">
                          {appointment.storitev.naziv}
                        </span>
                      </div>
                    )}

                    {/* Employee */}
                    {appointment.zaposleni && (
                      <div className="flex items-center gap-2 col-span-2">
                        <UserCircle className="h-4 w-4 text-gray-400 flex-shrink-0" weight="regular" />
                        <span className="text-sm text-gray-700">
                          {appointment.zaposleni.ime} {appointment.zaposleni.priimek}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : itemName ? (
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="font-semibold text-[#1A1F36] text-center">
                    {itemName}
                  </p>
                </div>
              ) : null}

              {/* Warning message */}
              <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4">
                <p className="text-sm text-red-800">
                  {message}
                </p>
                <p className="mt-2 text-sm font-semibold text-red-600">
                  To dejanje je nepovratno!
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 p-6">
              <motion.button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="rounded-xl px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100
                           disabled:opacity-50"
              >
                Prekliči
              </motion.button>
              <motion.button
                type="button"
                onClick={onConfirm}
                disabled={isDeleting}
                whileHover={{ scale: isDeleting ? 1 : 1.02 }}
                whileTap={{ scale: isDeleting ? 1 : 0.98 }}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-5 py-2.5
                           text-sm font-medium text-white shadow-lg shadow-red-500/25 transition-all
                           hover:shadow-xl hover:shadow-red-500/30 disabled:opacity-70"
              >
                {isDeleting ? (
                  <>
                    <SpinnerGap className="h-4 w-4 animate-spin" />
                    Brišem...
                  </>
                ) : (
                  <>
                    <Trash className="h-4 w-4" weight="bold" />
                    Izbriši termin
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(DeleteConfirmation);
