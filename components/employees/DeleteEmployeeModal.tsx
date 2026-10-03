'use client';

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash, Spinner } from '@phosphor-icons/react';
import { sheet } from '@/components/ui/sheetClasses';
import { useTranslations } from 'next-intl';
import type { Employee } from '@/types/employees';
import EmployeeAvatar from './EmployeeAvatar';

interface DeleteEmployeeModalProps {
  isOpen: boolean;
  employee: Employee | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

function DeleteEmployeeModal({
  isOpen,
  employee,
  onClose,
  onConfirm,
}: DeleteEmployeeModalProps) {
  const t = useTranslations('staff');
  const tCommon = useTranslations('common');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  if (!employee) return null;

  const fullName = `${employee.ime} ${employee.priimek}`.trim();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={sheet.backdrop}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className={sheet.panel}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={sheet.header}>
              <div className={sheet.grabber} aria-hidden="true" />
              <div className="flex items-start justify-between gap-4">
                <h2 className={sheet.title}>{t('deleteModal.title')}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isDeleting}
                  className={sheet.close}
                >
                  <X className="h-5 w-5" weight="regular" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className={sheet.body}>
              <div className={`${sheet.group} flex items-center gap-3`}>
                <EmployeeAvatar
                  firstName={employee.ime}
                  lastName={employee.priimek}
                  gradient={employee.barva}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-gray-900">{fullName}</p>
                  {employee.pozicija && (
                    <p className="truncate text-[13px] text-gray-500">{employee.pozicija}</p>
                  )}
                </div>
              </div>
              <div className="rounded-xl bg-red-50 p-4">
                <p className="text-sm text-red-800">
                  {t('deleteModal.confirmMessage')}{' '}
                  <span className="font-semibold">{fullName}</span>?
                </p>
                <p className="mt-1 text-sm text-red-700/80">
                  {t('deleteModal.warning')}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className={sheet.footer}>
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className={sheet.cancel}
              >
                {tCommon('buttons.cancel')}
              </button>
              <motion.button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                whileHover={{ scale: isDeleting ? 1 : 1.02 }}
                whileTap={{ scale: isDeleting ? 1 : 0.98 }}
                className={`${sheet.action} bg-red-500`}
              >
                {isDeleting ? (
                  <>
                    <Spinner className="h-4 w-4 animate-spin" />
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

export default memo(DeleteEmployeeModal);
