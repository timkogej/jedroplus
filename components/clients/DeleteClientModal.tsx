'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'motion/react';
import { Warning, Trash, X, SpinnerGap, CalendarBlank } from '@phosphor-icons/react';
import type { Client } from '@/types/clients';
import ClientInitialsBadge from './ClientInitialsBadge';


interface DeleteClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  onConfirm: () => Promise<void>;
  isDeleting?: boolean;
}

function DeleteClientModal({
  isOpen,
  onClose,
  client,
  onConfirm,
  isDeleting = false,
}: DeleteClientModalProps) {
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

  const t = useTranslations('clients');

  if (!client) return null;

  const appointmentCount = client.appointment_count || 0;

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
                    {t('deleteModal.title')}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {t('deleteModal.areYouSure')}
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
              {/* Client info card */}
              <div className="flex items-center gap-4 rounded-xl bg-gray-50 p-4">
                <ClientInitialsBadge
                  firstName={client.ime}
                  lastName={client.priimek}
                  size="lg"
                  variant="text"
                />
                <div>
                  <p className="font-semibold text-[#1A1F36]">
                    {client.ime} {client.priimek}
                  </p>
                  <p className="text-sm text-gray-500">{client.email}</p>
                </div>
              </div>

              {/* Warning message */}
              <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4">
                <p className="text-sm text-red-800">
                  {t('deleteModal.warningPrefix')} <strong>{client.ime} {client.priimek}</strong> {t('deleteModal.warningSuffix')}
                </p>
              </div>

              {/* Appointment count warning */}
              {appointmentCount > 0 && (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <CalendarBlank className="h-5 w-5 flex-shrink-0 text-amber-600" weight="duotone" />
                  <p className="text-sm text-amber-800">
                    {t('deleteModal.appointmentWarningPrefix')} <strong>{t('deleteModal.appointmentCount', { count: appointmentCount })}</strong>. {t('deleteModal.appointmentWarningSuffix')}
                  </p>
                </div>
              )}
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
                {t('deleteModal.cancel')}
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
                    {t('deleteModal.deleting')}
                  </>
                ) : (
                  <>
                    <Trash className="h-4 w-4" weight="bold" />
                    {t('deleteModal.deleteButton')}
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

export default memo(DeleteClientModal);
