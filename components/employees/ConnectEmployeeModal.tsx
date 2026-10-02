'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, LinkSimple, CalendarBlank, UserCircle, Check } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('staff');
  const tCommon = useTranslations('common');
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
            className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none sm:items-center sm:p-4"
          >
            <div className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-[#F2F2F7] shadow-2xl pointer-events-auto sm:max-h-[90vh] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="glass-bar border-b border-gray-200/70 px-5 py-3.5 sm:px-6">
                <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-gray-300 sm:hidden" aria-hidden="true" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-[17px] font-semibold text-gray-900">{t('connect.title')}</h2>
                    <p className="mt-0.5 text-[13px] text-gray-500">{t('connect.subtitle')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
                  >
                    <X className="h-5 w-5" weight="regular" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                {/* Employee preview */}
                <div className="flex items-center gap-3 rounded-xl bg-white p-4">
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
                    <p className="truncate text-[13px] text-gray-400">{employee.email}</p>
                  </div>
                </div>

                {/* What this means */}
                <div className="rounded-xl bg-white p-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t('connect.whatItMeans')}</p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <CalendarBlank className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" weight="regular" />
                      <p className="text-sm text-gray-600">
                        {t('connect.calendarBulletBefore')} <span className="font-medium text-gray-900">{t('connect.calendarLabel')}</span> {t('connect.calendarBulletMid')} <span className="font-medium text-gray-900">{t('connect.dashboardLabel')}</span> {t('connect.calendarBulletAfter')}
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <UserCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" weight="regular" />
                      <p className="text-sm text-gray-600">
                        {t('connect.accountBulletBefore')} <span className="font-medium text-gray-900">{fullName}</span> {t('connect.accountBulletAfter')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Agreement checkbox */}
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 transition-colors ${
                    agreed ? 'border-gray-900' : 'border-transparent hover:border-gray-200'
                  }`}
                >
                  <div className="relative mt-0.5 flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors ${
                      agreed
                        ? 'bg-gray-900 border-gray-900'
                        : 'border-gray-300 bg-white'
                    }`}>
                      {agreed && <Check className="h-3 w-3 text-white" weight="bold" />}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {t('connect.agreementPrefix')} <span className="font-medium text-gray-900">{fullName}</span> {t('connect.agreementSuffix')}
                  </p>
                </label>
              </div>

              {/* Footer */}
              <div className="glass-bar flex flex-shrink-0 items-center justify-end gap-3 border-t border-gray-200/70 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:px-6">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isConnecting}
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 sm:flex-none"
                >
                  {tCommon('buttons.cancel')}
                </button>
                <motion.button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!agreed || isConnecting}
                  whileHover={agreed && !isConnecting ? { scale: 1.02 } : {}}
                  whileTap={agreed && !isConnecting ? { scale: 0.98 } : {}}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all sm:flex-none ${
                    agreed && !isConnecting
                      ? 'bg-gradient-to-r from-violet-500 to-cyan-500 hover:opacity-90'
                      : 'cursor-not-allowed bg-gray-200 text-gray-400 shadow-none'
                  }`}
                >
                  {isConnecting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      {t('connect.connecting')}
                    </>
                  ) : (
                    <>
                      <LinkSimple className="h-4 w-4 text-white" weight="bold" />
                      {t('connect.connect')}
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
