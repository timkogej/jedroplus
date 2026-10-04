'use client';

import { memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash, SpinnerGap } from '@phosphor-icons/react';
import { sheet } from '@/components/ui/sheetClasses';
import { useTranslations } from 'next-intl';
import type { Resurs } from '@/types/resursi';

interface DeleteResursModalProps {
  isOpen: boolean;
  onClose: () => void;
  resurs: Resurs | null;
  onConfirm: () => Promise<void>;
  isDeleting?: boolean;
}

const backdropVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
  exit: { opacity: 0, scale: 0.95, y: 20 },
};

function DeleteResursModal({ isOpen, onClose, resurs, onConfirm, isDeleting = false }: DeleteResursModalProps) {
  const t = useTranslations('resursi');

  if (!resurs) return null;

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
                <h2 className={sheet.title}>{t('deleteModal.title')}</h2>
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
                <span className="h-8 w-8 flex-shrink-0 rounded-lg" style={{ background: resurs.barva }} />
                <p className="min-w-0 truncate text-[15px] font-semibold text-gray-900">{resurs.naziv}</p>
              </div>
              <p className="px-1 text-sm text-gray-600">
                {t('deleteModal.confirmPrefix')}{' '}
                <span className="font-semibold text-gray-900">&quot;{resurs.naziv}&quot;</span>?{' '}
                {t('deleteModal.confirmSuffix')}
              </p>
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
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(DeleteResursModal);
