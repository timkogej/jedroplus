'use client';

import { motion } from 'motion/react';
import { ChatTeardropText, Warning, ArrowRight } from '@phosphor-icons/react';
import Link from 'next/link';
import { useCompany } from '@/app/company-context';

interface SMSQuotaBarProps {
  showUpgradeLink?: boolean;
  compact?: boolean;
}

export function SMSQuotaBar({ showUpgradeLink = true, compact = false }: SMSQuotaBarProps) {
  const { smsQuota, planCode } = useCompany();

  if (!smsQuota) {
    return null;
  }

  const used = smsQuota.used_current_month;
  const limit = smsQuota.quota_effective;
  const remaining = smsQuota.remaining;
  const usagePercent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  const isLow = usagePercent >= 70;
  const isCritical = usagePercent >= 90;
  const isDepleted = remaining <= 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <ChatTeardropText
          className={`h-4 w-4 ${
            isDepleted
              ? 'text-red-500'
              : isCritical
              ? 'text-amber-500'
              : 'text-gray-400'
          }`}
          weight="fill"
        />
        <span className={`font-medium ${isDepleted ? 'text-red-600' : 'text-gray-600'}`}>
          {remaining} SMS
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl p-4 ${
        isDepleted
          ? 'bg-red-50 border-2 border-red-200'
          : isCritical
          ? 'bg-amber-50 border-2 border-amber-200'
          : 'bg-gray-50 border border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ChatTeardropText
            className={`h-5 w-5 ${
              isDepleted
                ? 'text-red-500'
                : isCritical
                ? 'text-amber-500'
                : 'text-violet-500'
            }`}
            weight="fill"
          />
          <span className="font-semibold text-gray-900">SMS kvota</span>
        </div>
        <span
          className={`text-sm font-medium ${
            isDepleted
              ? 'text-red-600'
              : isCritical
              ? 'text-amber-600'
              : 'text-gray-600'
          }`}
        >
          {used} / {limit}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${usagePercent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`h-full rounded-full ${
            isDepleted
              ? 'bg-red-500'
              : isCritical
              ? 'bg-amber-500'
              : isLow
              ? 'bg-amber-400'
              : 'bg-gradient-to-r from-violet-500 to-cyan-500'
          }`}
        />
      </div>

      {/* Warning Message */}
      {isDepleted && (
        <div className="flex items-start gap-2 mb-3">
          <Warning className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" weight="fill" />
          <p className="text-sm text-red-700">
            Dosegli ste SMS limit. Nadgradite paket za nadaljevanje pošiljanja.
          </p>
        </div>
      )}

      {isCritical && !isDepleted && (
        <div className="flex items-start gap-2 mb-3">
          <Warning className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" weight="fill" />
          <p className="text-sm text-amber-700">
            Ostalo vam je samo še {remaining} SMS-ov ta mesec.
          </p>
        </div>
      )}

      {/* Upgrade Link */}
      {showUpgradeLink && (isDepleted || isCritical) && planCode !== 'PREMIUM' && planCode !== 'premium' && (
        <Link
          href="/nastavitve/paketi"
          className="inline-flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-700 transition-colors"
        >
          Nadgradi za več SMS-ov
          <ArrowRight className="h-3 w-3" weight="bold" />
        </Link>
      )}
    </div>
  );
}
