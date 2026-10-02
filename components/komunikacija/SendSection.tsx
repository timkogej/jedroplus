'use client';

import { PaperPlaneTilt, Warning, CircleNotch } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';

interface SendSectionProps {
  selectedCount: number;
  remainingQuota: number;
  hasMessage: boolean;
  hasSubject: boolean;
  onSend: () => void;
  sending?: boolean;
}

export default function SendSection({
  selectedCount,
  remainingQuota,
  hasMessage,
  hasSubject,
  onSend,
  sending = false,
}: SendSectionProps) {
  const t = useTranslations('communication');
  const canSend = !sending && selectedCount > 0 && hasMessage && hasSubject && remainingQuota >= selectedCount;
  const exceedsQuota = selectedCount > remainingQuota;

  return (
    <div className="space-y-4 rounded-xl border border-gray-100 bg-white p-5">
      {/* Summary */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">{t('send.recipientsLabel')}</span>
          <span className={`tnum text-sm font-semibold ${selectedCount > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
            {t('send.recipientCount', { count: selectedCount })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">{t('send.remainingQuotaLabel')}</span>
          <span className="tnum text-sm font-semibold text-gray-900">
            {t('send.remainingEmails', { count: remainingQuota })}
          </span>
        </div>
        {!hasSubject && selectedCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-600">
            <Warning className="h-3.5 w-3.5" weight="regular" />
            <span>{t('send.warnNoSubject')}</span>
          </div>
        )}
        {!hasMessage && selectedCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-600">
            <Warning className="h-3.5 w-3.5" weight="regular" />
            <span>{t('send.warnNoMessage')}</span>
          </div>
        )}
        {exceedsQuota && (
          <div className="flex items-center gap-2 text-xs text-red-500">
            <Warning className="h-3.5 w-3.5" weight="regular" />
            <span>{t('send.warnQuotaExceeded')}</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-100" />

      {/* Send button */}
      <button
        type="button"
        onClick={onSend}
        disabled={!canSend}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 py-3 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:bg-none disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none"
      >
        {sending ? (
          <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
        ) : (
          <PaperPlaneTilt className="h-4 w-4" weight="bold" />
        )}
        {sending ? t('send.sendingButton') : t('send.sendButton')}
      </button>

      <p className="text-center text-xs text-gray-400">
        {t('send.sendNote')}
      </p>
    </div>
  );
}
