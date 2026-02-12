'use client';

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Warning, Trash, Spinner } from '@phosphor-icons/react';
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <Warning className="h-5 w-5 text-red-600" weight="fill" />
                </div>
                <h2 className="text-lg font-semibold text-[#1A1F36]">
                  Izbriši zaposlenega
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
              >
                <X className="h-5 w-5" weight="bold" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="flex flex-col items-center text-center">
                <EmployeeAvatar
                  firstName={employee.ime}
                  lastName={employee.priimek}
                  gradient={employee.barva}
                  size="xl"
                />
                <p className="mt-4 text-gray-600">
                  Ali ste prepričani, da želite izbrisati zaposlenega{' '}
                  <span className="font-semibold text-[#1A1F36]">{fullName}</span>?
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  Ta akcija je trajna in je ni mogoče razveljaviti.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Prekliči
              </button>
              <motion.button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                whileHover={{ scale: isDeleting ? 1 : 1.02 }}
                whileTap={{ scale: isDeleting ? 1 : 0.98 }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Spinner className="h-4 w-4 animate-spin" />
                    Brisanje...
                  </>
                ) : (
                  <>
                    <Trash className="h-4 w-4" weight="bold" />
                    Izbriši
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
