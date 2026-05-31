'use client';

import { memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Warning, Trash, SpinnerGap } from '@phosphor-icons/react';
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
            {/* Header */}
            <div
              className="relative p-6"
              style={{ background: resurs.barva }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <Warning className="h-5 w-5 text-white" weight="bold" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{t('deleteModal.title')}</h2>
                    <p className="text-sm text-white/80">{resurs.naziv}</p>
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
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                {t('deleteModal.confirmPrefix')}{' '}
                <span className="font-semibold">&quot;{resurs.naziv}&quot;</span>?{' '}
                {t('deleteModal.confirmSuffix')}
              </p>

              <div className="flex items-center justify-end gap-3">
                <motion.button
                  type="button"
                  onClick={onClose}
                  disabled={isDeleting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-xl px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
                >
                  {t('deleteModal.cancel')}
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(DeleteResursModal);
