'use client';

import { motion, AnimatePresence } from 'motion/react';
import { LockSimple, X } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';

interface DisabledActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

/**
 * Small modal shown when a staff user tries to perform an action
 * that the company owner has disabled for them.
 */
export default function DisabledActionModal({
  isOpen,
  onClose,
  message,
}: DisabledActionModalProps) {
  const t = useTranslations('appointments');
  const resolvedMessage = message ?? t('disabledModal.defaultMessage');
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" weight="bold" />
            </button>

            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
                <LockSimple className="h-7 w-7 text-gray-500" weight="fill" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">{t('disabledModal.title')}</h3>
                <p className="mt-1 text-sm text-gray-500">{resolvedMessage}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 rounded-xl bg-gray-100 px-6 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
              >
                {t('disabledModal.button')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
