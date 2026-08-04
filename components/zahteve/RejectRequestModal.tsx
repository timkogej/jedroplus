'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, SpinnerGap, Prohibit } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Textarea } from '@/components/settings';
import { rejectRequest } from '@/lib/bookingRequests';
import type { ZahtevaTermina } from '@/lib/supabase/zahteveTermini';

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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('rejectModal.title')}</h2>
            <button onClick={onClose} className="rounded-lg p-2 transition-colors hover:bg-gray-100">
              <X className="h-4 w-4 text-gray-500" weight="bold" />
            </button>
          </div>

          <div className="px-5 py-4">
            <p className="mb-3 text-sm text-gray-500">
              {t('rejectModal.subtitle', { name: `${zahteva.ime} ${zahteva.priimek}`.trim() })}
            </p>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
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

          <div className="flex justify-end gap-3 border-t border-gray-100 px-5 py-4">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
            >
              {t('rejectModal.cancel')}
            </button>
            <button
              onClick={handleReject}
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
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
