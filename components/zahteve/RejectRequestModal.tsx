'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, SpinnerGap, Prohibit } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Textarea } from '@/components/settings';
import { rejectRequest } from '@/lib/bookingRequests';
import type { ZahtevaTermina } from '@/lib/supabase/zahteveTermini';
import { sheet } from '@/components/ui/sheetClasses';
import { RequestSummary } from './RequestSummary';

interface RejectRequestModalProps {
  zahteva: ZahtevaTermina;
  onClose: () => void;
  onRejected: () => void;
}

export function RejectRequestModal({ zahteva, onClose, onRejected }: RejectRequestModalProps) {
  const t = useTranslations('zahteve-termini');
  const [razlog, setRazlog] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleReject = async () => {
    if (!razlog.trim()) {
      setError(true);
      return;
    }
    setSubmitting(true);
    try {
      const result = await rejectRequest({ requestId: zahteva.id, razlog: razlog.trim() });
      if (!result.success) {
        toast.error(t('rejectModal.error'));
        return;
      }
      toast.success(t('rejectModal.success'));
      onRejected();
    } catch {
      toast.error(t('rejectModal.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
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
          className={sheet.panel}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={sheet.header}>
            <div className={sheet.grabber} aria-hidden="true" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className={sheet.title}>{t('rejectModal.title')}</h2>
                <p className={sheet.subtitle}>
                  {t('rejectModal.subtitle', { name: `${zahteva.ime} ${zahteva.priimek}`.trim() })}
                </p>
              </div>
              <button onClick={onClose} className={sheet.close}>
                <X className="h-5 w-5" weight="regular" />
              </button>
            </div>
          </div>

          <div className={sheet.body}>
            <RequestSummary zahteva={zahteva} />

            <div className={sheet.group}>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                {t('rejectModal.reasonLabel')}
              </label>
              <Textarea
                value={razlog}
                onChange={(e) => {
                  setRazlog(e.target.value);
                  if (error) setError(false);
                }}
                placeholder={t('rejectModal.reasonPlaceholder')}
                rows={3}
                error={error}
              />
              {error && (
                <p className="mt-1 text-xs text-red-500">{t('rejectModal.reasonRequired')}</p>
              )}
            </div>
          </div>

          <div className={sheet.footer}>
            <button
              onClick={onClose}
              className={sheet.cancel}
            >
              {t('rejectModal.cancel')}
            </button>
            <button
              onClick={handleReject}
              disabled={submitting}
              className={`${sheet.action} bg-red-600 disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {submitting ? (
                <>
                  <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                  {t('rejectModal.rejecting')}
                </>
              ) : (
                <>
                  <Prohibit className="h-4 w-4" weight="bold" />
                  {t('rejectModal.confirm')}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
