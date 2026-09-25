'use client';

import { motion, AnimatePresence } from 'motion/react';
import { Info } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import type { AppointmentWithDetails } from '@/types/appointments';
import { BodyPortal } from '@/components/ui/BodyPortal';

interface RescheduleNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  appointment: AppointmentWithDetails;
  newDate: string;
  newTime: string;
  channel: 'sms' | 'email' | 'both';
}

export function RescheduleNotificationModal({
  isOpen,
  onClose,
  onConfirm,
  appointment,
  newDate,
  newTime,
  channel,
}: RescheduleNotificationModalProps) {
  const t = useTranslations('appointments.rescheduleNotify');
  const formattedDate = newDate.split('-').reverse().join('.');
  const clientName = [appointment.stranka_ime, appointment.stranka_priimek].filter(Boolean).join(' ');

  return (
    <BodyPortal>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', stiffness: 400, damping: 36 }}
            className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-base font-semibold text-[#1A1F36]">{t('title')}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {t('description')}
              </p>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-3">
              {/* Client + new time summary */}
              <div className="rounded-xl bg-[#F7F8FA] px-4 py-3">
                <p className="text-sm font-medium text-[#1A1F36]">{clientName}</p>
                <p className="text-sm text-gray-500 mt-0.5">{formattedDate} · {newTime}</p>
              </div>

              {/* Channel info */}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Info className="h-4 w-4 flex-shrink-0 text-violet-400" weight="fill" />
                <span>{t(`channel.${channel}`)}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 pb-5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                {t('skip')}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)' }}
              >
                {t('send')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </BodyPortal>
  );
}
