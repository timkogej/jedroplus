'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'motion/react';
import { Trash, X, SpinnerGap, CalendarBlank } from '@phosphor-icons/react';
import { sheet } from '@/components/ui/sheetClasses';
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
                  <h2 className={sheet.title}>{t('deleteModal.title')}</h2>
                  <p className={sheet.subtitle}>{t('deleteModal.areYouSure')}</p>
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
              {/* Client info */}
              <div className={`${sheet.group} flex items-center gap-3`}>
                <ClientInitialsBadge
                  firstName={client.ime}
                  lastName={client.priimek}
                  size="lg"
                  variant="text"
                />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-gray-900">
                    {client.ime} {client.priimek}
                  </p>
                  <p className="truncate text-[13px] text-gray-500">{client.email}</p>
                </div>
              </div>

              {/* Warning message */}
              <div className="rounded-xl bg-red-50 p-4">
                <p className="text-sm text-red-800">
                  {t('deleteModal.warningPrefix')} <strong>{client.ime} {client.priimek}</strong> {t('deleteModal.warningSuffix')}
                </p>
              </div>

              {/* Appointment count warning */}
              {appointmentCount > 0 && (
                <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4">
                  <CalendarBlank className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" weight="regular" />
                  <p className="text-sm text-amber-800">
                    {t('deleteModal.appointmentWarningPrefix')} <strong>{t('deleteModal.appointmentCount', { count: appointmentCount })}</strong>. {t('deleteModal.appointmentWarningSuffix')}
                  </p>
                </div>
              )}
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
                {t('deleteModal.cancel')}
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
