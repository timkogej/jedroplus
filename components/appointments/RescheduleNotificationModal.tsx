'use client';

import { motion, AnimatePresence } from 'motion/react';
import { Info } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import type { AppointmentWithDetails } from '@/types/appointments';
import { sheet } from '@/components/ui/sheetClasses';
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
          className={sheet.backdrop.replace('z-50', 'z-[100]')}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', stiffness: 400, damping: 36 }}
            className={`${sheet.panel} sm:max-w-sm`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={sheet.header}>
              <div className={sheet.grabber} aria-hidden="true" />
              <h3 className={sheet.title}>{t('title')}</h3>
              <p className={sheet.subtitle}>
                {t('description')}
              </p>
            </div>

            {/* Body */}
            <div className={sheet.body}>
              {/* Client + new time summary */}
              <div className="overflow-hidden rounded-xl bg-white">
                <div className="px-4 py-3">
                  <p className="text-[15px] font-semibold text-gray-900">{clientName}</p>
                  <p className="tnum mt-0.5 text-sm text-gray-500">{formattedDate} · {newTime}</p>
                </div>

                {/* Channel info */}
                <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-[13px] text-gray-500">
                  <Info className="h-4 w-4 flex-shrink-0 text-violet-500" weight="regular" />
                  <span>{t(`channel.${channel}`)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={sheet.footer}>
              <button
                type="button"
                onClick={onClose}
                className={sheet.cancel}
              >
                {t('skip')}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={sheet.action}
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
