'use client';

import { motion } from 'motion/react';
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
    <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      {/* Summary */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">{t('send.recipientsLabel')}</span>
          <span className={`text-sm font-semibold ${selectedCount > 0 ? 'text-[#1A1F36]' : 'text-gray-400'}`}>
            {t('send.recipientCount', { count: selectedCount })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">{t('send.remainingQuotaLabel')}</span>
          <span
            className="text-sm font-semibold"
            style={{
              backgroundImage: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {t('send.remainingEmails', { count: remainingQuota })}
          </span>
        </div>
        {!hasSubject && selectedCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-500">
            <Warning className="h-3.5 w-3.5" weight="fill" />
            <span>{t('send.warnNoSubject')}</span>
          </div>
        )}
        {!hasMessage && selectedCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-500">
            <Warning className="h-3.5 w-3.5" weight="fill" />
            <span>{t('send.warnNoMessage')}</span>
          </div>
        )}
        {exceedsQuota && (
          <div className="flex items-center gap-2 text-xs text-red-500">
            <Warning className="h-3.5 w-3.5" weight="fill" />
            <span>{t('send.warnQuotaExceeded')}</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-100" />

      {/* Send button */}
      <motion.button
        type="button"
        onClick={onSend}
        disabled={!canSend}
        whileHover={{ scale: canSend ? 1.01 : 1 }}
        whileTap={{ scale: canSend ? 0.99 : 1 }}
        className={`w-full py-3.5 rounded-xl flex items-center justify-center gap-2.5 font-normal text-sm transition-all duration-200 ${
          canSend
            ? 'bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-transparent'
        }`}
      >
        <span
          className="flex items-center gap-2.5"
          style={canSend || sending ? {
            backgroundImage: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          } : undefined}
        >
          {sending ? (
            <CircleNotch className="h-5 w-5 animate-spin" weight="bold" style={{ fill: 'url(#btn-icon-grad)' }} />
          ) : (
            <PaperPlaneTilt className="h-5 w-5" weight="fill" style={canSend ? { fill: 'url(#btn-icon-grad)' } : undefined} />
          )}
          {sending ? t('send.sendingButton') : t('send.sendButton')}
        </span>
      </motion.button>

      <p className="text-center text-xs text-gray-400">
        {t('send.sendNote')}
      </p>
    </div>
  );
}
