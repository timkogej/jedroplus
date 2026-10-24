'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SpinnerGap, X } from '@phosphor-icons/react';

type TodayMode = 'send' | 'silent' | 'leave';

interface BulkCompleteModalProps {
  isOpen: boolean;
  companyId: string;
  /** Appointments that ended today and are still open; closed one by one so each client is thanked. */
  endedToday: number;
  /** Closes one of today's appointments through the normal flow (sends the follow-up). */
  onCompleteWithMessage: () => Promise<{ failed: number }>;
  onClose: () => void;
  onDone: (summary: { completed: number; failed: number }) => void;
}

/**
 * Closes the backlog of past, never-closed appointments in one go.
 * Old history is closed silently; for today's visits the owner picks whether
 * clients are thanked, so nobody gets a message for something that happened
 * weeks ago.
 */
export default function BulkCompleteModal({
  isOpen,
  companyId,
  endedToday,
  onCompleteWithMessage,
  onClose,
  onDone,
}: BulkCompleteModalProps) {
  const t = useTranslations('appointments.bulkComplete');
  const [beforeToday, setBeforeToday] = useState<number | null>(null);
  const [todayMode, setTodayMode] = useState<TodayMode>('send');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ask the server how many would be closed, so the dialog states real numbers.
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setBeforeToday(null);
    setError(null);
    setTodayMode(endedToday > 0 ? 'send' : 'leave');
    fetch('/api/appointments/bulk-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, dryRun: true }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d?.ok) setBeforeToday(Number(d.beforeToday) || 0);
        else setError(t('loadError'));
      })
      .catch(() => active && setError(t('loadError')));
    return () => {
      active = false;
    };
  }, [isOpen, companyId, endedToday, t]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch('/api/appointments/bulk-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, includeToday: todayMode === 'silent' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error('bulk failed');

      let completed = Number(data.completed) || 0;
      let failed = 0;
      if (todayMode === 'send' && endedToday > 0) {
        const result = await onCompleteWithMessage();
        failed = result.failed;
        completed += endedToday - result.failed;
      }
      onDone({ completed, failed });
    } catch {
      setError(t('error'));
    } finally {
      setWorking(false);
    }
  };

  const options: Array<{ id: TodayMode; label: string }> = [
    { id: 'send', label: t('todaySend', { count: endedToday }) },
    { id: 'silent', label: t('todaySilent') },
    { id: 'leave', label: t('todayLeave') },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('title')}</h2>
          <button
            type="button"
            onClick={() => !working && onClose()}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label={t('cancel')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm leading-6 text-gray-700">
          {beforeToday === null && !error
            ? t('loading')
            : t('olderBody', { count: beforeToday ?? 0 })}
        </p>

        {endedToday > 0 && (
          <fieldset className="mt-5 space-y-2" disabled={working}>
            <legend className="mb-1 text-sm font-medium text-gray-900">{t('todayHeading')}</legend>
            {options.map((opt) => (
              <label
                key={opt.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${
                  todayMode === opt.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name="today-mode"
                  className="mt-0.5"
                  checked={todayMode === opt.id}
                  onChange={() => setTodayMode(opt.id)}
                />
                <span className="text-gray-800">{opt.label}</span>
              </label>
            ))}
          </fieldset>
        )}

        <p className="mt-4 text-xs leading-5 text-gray-500">{t('note')}</p>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={working || beforeToday === null}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {working && <SpinnerGap className="h-4 w-4 animate-spin" />}
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
