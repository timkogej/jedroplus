'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, LinkSimple, CalendarBlank, UserCircle, CheckCircle } from '@phosphor-icons/react';
import type { Employee } from '@/types/employees';
import EmployeeAvatar from './EmployeeAvatar';

interface ConnectEmployeeModalProps {
  isOpen: boolean;
  employee: Employee | null;
  isConnecting: boolean;
  onClose: () => void;
  onConfirm: (employee: Employee) => void;
}

export default function ConnectEmployeeModal({
  isOpen,
  employee,
  isConnecting,
  onClose,
  onConfirm,
}: ConnectEmployeeModalProps) {
  const [agreed, setAgreed] = useState(false);

  if (!employee) return null;

  const fullName = `${employee.ime} ${employee.priimek}`.trim();

  const handleClose = () => {
    setAgreed(false);
    onClose();
  };

  const handleConfirm = () => {
    if (!agreed) return;
    onConfirm(employee);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-gray-100 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
                <div className="flex items-center gap-3">
                  <LinkSimple className="h-6 w-6 text-violet-500 flex-shrink-0" weight="bold" />
                  <div>
                    <h2 className="text-base font-semibold text-[#1A1F36]">Poveži račun</h2>
                    <p className="text-xs text-gray-500">z zaposlenim v podjetju</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-5 w-5" weight="bold" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-5">
                {/* Employee preview */}
                <div className="flex items-center gap-4 rounded-xl bg-gray-50 p-4">
                  <EmployeeAvatar
                    firstName={employee.ime}
                    lastName={employee.priimek}
                    gradient={employee.barva}
                    size="lg"
                  />
                  <div>
                    <p className="font-semibold text-[#1A1F36]">{fullName}</p>
                    {employee.pozicija && (
                      <p className="text-sm text-gray-500">{employee.pozicija}</p>
                    )}
                    <p className="text-xs text-gray-400">{employee.email}</p>
                  </div>
                </div>

                {/* What this means */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-[#1A1F36]">Kaj pomeni ta povezava?</p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <CalendarBlank className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-500" weight="regular" />
                      <p className="text-sm text-gray-600">
                        Na <span className="font-medium">Koledarju</span> in <span className="font-medium">Nadzorni plošči</span> bodo privzeto prikazani termini tega zaposlenega.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <UserCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-500" weight="regular" />
                      <p className="text-sm text-gray-600">
                        Vaš račun bo povezan z osebo <span className="font-medium">{fullName}</span> v podjetju.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Agreement checkbox */}
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4 transition-colors hover:border-violet-300 hover:bg-violet-50/50">
                  <div className="relative mt-0.5 flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors ${
                      agreed
                        ? 'border-violet-500 bg-violet-500'
                        : 'border-gray-300 bg-white'
                    }`}>
                      {agreed && <CheckCircle className="h-3.5 w-3.5 text-white" weight="bold" />}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    Strinjam se s povezavo mojega računa z zaposlenim <span className="font-medium text-[#1A1F36]">{fullName}</span> in razumem, da bodo na koledarju in nadzorni plošči privzeto prikazani njegovi/njeni termini.
                  </p>
                </label>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isConnecting}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
                >
                  Prekliči
                </button>
                <motion.button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!agreed || isConnecting}
                  whileHover={agreed && !isConnecting ? { scale: 1.02 } : {}}
                  whileTap={agreed && !isConnecting ? { scale: 0.98 } : {}}
                  className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all ${
                    agreed && !isConnecting
                      ? 'bg-gradient-to-r from-violet-500 to-cyan-500 shadow-cyan-500/25 hover:shadow-md hover:shadow-cyan-500/30'
                      : 'cursor-not-allowed bg-gray-200 text-gray-400 shadow-none'
                  }`}
                >
                  {isConnecting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Povezujem...
                    </>
                  ) : (
                    <>
                      <LinkSimple className="h-4 w-4" weight="bold" />
                      Poveži račun
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
