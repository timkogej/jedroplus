'use client';

import { memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Warning,
  Trash,
  SpinnerGap,
  ToggleLeft,
  CalendarBlank,
} from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import type { Service } from '@/types/services';
import { generateGradient } from '@/lib/utils/colors';

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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with service color */}
            <div
              className="relative p-6"
              style={{ background: generateGradient(service.barva, 25) }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <Warning className="h-5 w-5 text-white" weight="bold" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {hasAppointments ? t('deleteModal.titleHasAppointments') : t('deleteModal.titleDelete')}
                    </h2>
                    <p className="text-sm text-white/80">
                      {service.naziv}
                    </p>
                  </div>
                </div>
                <motion.button
                  type="button"
                  onClick={onClose}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                >
                  <X className="h-5 w-5" weight="bold" />
                </motion.button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {hasAppointments ? (
                <div className="space-y-4">
                  {/* Warning message */}
                  <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4">
                    <CalendarBlank className="h-5 w-5 flex-shrink-0 text-amber-500" weight="fill" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        {t('deleteModal.warningCount', { count: appointmentCount })}
                      </p>
                      <p className="mt-1 text-sm text-amber-700">
                        {t('deleteModal.warningDesc')}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-3">
                    <motion.button
                      type="button"
                      onClick={onClose}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="rounded-xl px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
                    >
                      {tCommon('buttons.cancel')}
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={onDeactivate}
                      disabled={isDeleting}
                      whileHover={{ scale: isDeleting ? 1 : 1.02 }}
                      whileTap={{ scale: isDeleting ? 1 : 0.98 }}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5
                                 text-sm font-medium text-white shadow-lg shadow-orange-500/25 transition-all
                                 hover:shadow-xl hover:shadow-orange-500/30 disabled:opacity-70"
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
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Confirmation message */}
                  <p className="text-sm text-gray-600">
                    {t('deleteModal.confirmPrefix')}{' '}
                    <span className="font-semibold">&quot;{service.naziv}&quot;</span>?{' '}
                    {t('deleteModal.confirmSuffix')}
                  </p>

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-3">
                    <motion.button
                      type="button"
                      onClick={onClose}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="rounded-xl px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
                    >
                      {tCommon('buttons.cancel')}
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={onConfirm}
                      disabled={isDeleting}
                      whileHover={{ scale: isDeleting ? 1 : 1.02 }}
                      whileTap={{ scale: isDeleting ? 1 : 0.98 }}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 px-5 py-2.5
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
                          {t('deleteModal.delete')}
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(DeleteServiceModal);
