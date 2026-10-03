'use client';

import { memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Trash,
  SpinnerGap,
  ToggleLeft,
  CalendarBlank,
} from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { sheet } from '@/components/ui/sheetClasses';
import type { Service } from '@/types/services';
import { generateGradient } from '@/lib/utils/colors';
import { isGradient, DEFAULT_SERVICE_GRADIENT } from '@/lib/constants/serviceGradients';

interface DeleteServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: Service | null;
  appointmentCount: number;
  onConfirm: () => Promise<void>;
  onDeactivate: () => Promise<void>;
  isDeleting?: boolean;
}

function DeleteServiceModal({
  isOpen,
  onClose,
  service,
  appointmentCount,
  onConfirm,
  onDeactivate,
  isDeleting = false,
}: DeleteServiceModalProps) {
  const t = useTranslations('services');
  const tCommon = useTranslations('common');
  const hasAppointments = appointmentCount > 0;

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

  if (!service) return null;

  const headerBackground = isGradient(service.barva)
    ? service.barva
    : service.barva
      ? generateGradient(service.barva, 25)
      : DEFAULT_SERVICE_GRADIENT;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className={sheet.backdrop}
          onClick={(e) => e.target === e.currentTarget && onClose()}
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
                <h2 className={sheet.title}>
                  {hasAppointments ? t('deleteModal.titleHasAppointments') : t('deleteModal.titleDelete')}
                </h2>
                <motion.button
                  type="button"
                  onClick={onClose}
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
              <div className={`${sheet.group} flex items-center gap-3`}>
                <span className="h-8 w-8 flex-shrink-0 rounded-lg" style={{ background: headerBackground }} />
                <p className="min-w-0 truncate text-[15px] font-semibold text-gray-900">{service.naziv}</p>
              </div>

              {hasAppointments ? (
                /* Warning message */
                <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4">
                  <CalendarBlank className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" weight="regular" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      {t('deleteModal.warningCount', { count: appointmentCount })}
                    </p>
                    <p className="mt-1 text-sm text-amber-700">
                      {t('deleteModal.warningDesc')}
                    </p>
                  </div>
                </div>
              ) : (
                /* Confirmation message */
                <p className="px-1 text-sm text-gray-600">
                  {t('deleteModal.confirmPrefix')}{' '}
                  <span className="font-semibold text-gray-900">&quot;{service.naziv}&quot;</span>?{' '}
                  {t('deleteModal.confirmSuffix')}
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className={sheet.footer}>
              <motion.button
                type="button"
                onClick={onClose}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={sheet.cancel}
              >
                {tCommon('buttons.cancel')}
              </motion.button>
              {hasAppointments ? (
                <motion.button
                  type="button"
                  onClick={onDeactivate}
                  disabled={isDeleting}
                  whileHover={{ scale: isDeleting ? 1 : 1.02 }}
                  whileTap={{ scale: isDeleting ? 1 : 0.98 }}
                  className={`${sheet.action} bg-gradient-to-r from-amber-500 to-orange-500`}
                >
                  {isDeleting ? (
                    <>
                      <SpinnerGap className="h-4 w-4 animate-spin" />
                      {t('deleteModal.deactivating')}
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="h-4 w-4" weight="bold" />
                      {t('deleteModal.deactivate')}
                    </>
                  )}
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  onClick={onConfirm}
                  disabled={isDeleting}
                  whileHover={{ scale: isDeleting ? 1 : 1.02 }}
                  whileTap={{ scale: isDeleting ? 1 : 0.98 }}
                  className={`${sheet.action} bg-gradient-to-r from-red-500 to-rose-500`}
                >
                  {isDeleting ? (
                    <>
                      <SpinnerGap className="h-4 w-4 animate-spin" />
                      {t('deleteModal.deleting')}
                    </>
                  ) : (
                    <>
                      <Trash className="h-4 w-4" weight="bold" />
                      {t('deleteModal.delete')}
                    </>
                  )}
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(DeleteServiceModal);
