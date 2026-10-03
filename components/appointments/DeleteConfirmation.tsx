'use client';

import { memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash, X, SpinnerGap, CalendarBlank, Clock, Briefcase, UserCircle, Plus } from '@phosphor-icons/react';
import { sheet } from '@/components/ui/sheetClasses';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('appointments');
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
          className={sheet.backdrop}
          onClick={(e) => e.target === e.currentTarget && !isDeleting && onClose()}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={sheet.panel}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={sheet.header}>
              <div className={sheet.grabber} aria-hidden="true" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className={sheet.title}>{title}</h2>
                  <p className={sheet.subtitle}>{t('deleteConfirmation.areYouSure')}</p>
                </div>
                <motion.button
                  type="button"
                  onClick={onClose}
                  disabled={isDeleting}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className={sheet.close}
                >
                  <X className="h-5 w-5" weight="regular" />
                </motion.button>
              </div>
            </div>

            {/* Content */}
            <div className={sheet.body}>
              {/* Appointment details */}
              {appointment ? (
                <div className="overflow-hidden rounded-xl bg-white">
                  {/* Client */}
                  <div className="px-4 py-3">
                    <p className="text-[15px] font-semibold text-gray-900">
                      {appointment.stranka_ime || t('deleteConfirmation.unknownClient')}
                    </p>
                    {appointment.stranka_email && (
                      <p className="text-[13px] text-gray-500">{appointment.stranka_email}</p>
                    )}
                  </div>

                  <div className="divide-y divide-gray-100 border-t border-gray-100">
                    {/* Date + time */}
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      <CalendarBlank className="h-4 w-4 flex-shrink-0 text-gray-400" weight="regular" />
                      <span className="flex-1 text-sm text-gray-900">
                        {appointment.datum ? formatDate(appointment.datum) : '-'}
                      </span>
                      <span className="tnum flex items-center gap-1.5 text-sm text-gray-500">
                        <Clock className="h-4 w-4 text-gray-400" weight="regular" />
                        {appointment.cas_zacetek ? appointment.cas_zacetek.substring(0, 5) : '-'}
                      </span>
                    </div>

                    {/* Service */}
                    {appointment.storitev?.naziv && (
                      <div className="flex items-start gap-3 px-4 py-2.5">
                        <Briefcase className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" weight="regular" />
                        <div className="min-w-0 space-y-1">
                          <span className="block text-sm text-gray-900">
                            {appointment.storitev.naziv}
                          </span>
                          {appointment.add_on_naziv && (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm text-gray-900">{appointment.add_on_naziv}</span>
                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                                <Plus className="h-2.5 w-2.5" weight="bold" />
                                Dodatna storitev
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Employee */}
                    {appointment.zaposleni && (
                      <div className="flex items-center gap-3 px-4 py-2.5">
                        <UserCircle className="h-4 w-4 flex-shrink-0 text-gray-400" weight="regular" />
                        <span className="text-sm text-gray-900">
                          {appointment.zaposleni.ime} {appointment.zaposleni.priimek}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : itemName ? (
                <div className={sheet.group}>
                  <p className="text-center text-[15px] font-semibold text-gray-900">
                    {itemName}
                  </p>
                </div>
              ) : null}

              {/* Warning message */}
              <div className="rounded-xl bg-red-50 p-4">
                <p className="text-sm text-red-800">
                  {message}
                </p>
                <p className="mt-2 text-sm font-semibold text-red-600">
                  {t('deleteConfirmation.irreversible')}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className={sheet.footer}>
              <motion.button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={sheet.cancel}
              >
                {t('deleteConfirmation.cancel')}
              </motion.button>
              <motion.button
                type="button"
                onClick={onConfirm}
                disabled={isDeleting}
                whileHover={{ scale: isDeleting ? 1 : 1.02 }}
                whileTap={{ scale: isDeleting ? 1 : 0.98 }}
                className={`${sheet.action} bg-gradient-to-r from-red-500 to-rose-600`}
              >
                {isDeleting ? (
                  <>
                    <SpinnerGap className="h-4 w-4 animate-spin" />
                    {t('deleteConfirmation.deleting')}
                  </>
                ) : (
                  <>
                    <Trash className="h-4 w-4" weight="bold" />
                    {t('deleteConfirmation.deleteButton')}
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
