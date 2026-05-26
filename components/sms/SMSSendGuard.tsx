'use client';

import { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Lock, ArrowRight } from '@phosphor-icons/react';
import Link from 'next/link';
import { useCompany } from '@/app/company-context';
import { canSendSMS } from '@/lib/api/billingClient';
import { useTranslations } from 'next-intl';

interface SMSSendGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  showBlockedUI?: boolean;
}

function getReasonKey(reason?: string): string {
  switch (reason) {
    case 'quota_exceeded': return 'sms.reasonQuota';
    case 'no_subscription': return 'sms.reasonNoSubscription';
    case 'plan_inactive': return 'sms.reasonInactive';
    default: return 'sms.reasonDefault';
  }
}

/**
 * Guard component that wraps SMS sending functionality.
 * Shows blocked UI when SMS quota is depleted or plan doesn't allow SMS.
 */
export function SMSSendGuard({
  children,
  fallback,
  showBlockedUI = true,
}: SMSSendGuardProps) {
  const t = useTranslations('communication');
  const { subscription, smsQuota, planCode } = useCompany();

  const { allowed, reason } = canSendSMS(subscription, smsQuota);

  if (allowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showBlockedUI) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative"
    >
      {/* Blocked Overlay */}
      <div className="absolute inset-0 bg-gray-100/80 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center">
        <div className="text-center p-4">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-3">
            <Lock className="h-6 w-6 text-red-500" weight="fill" />
          </div>
          <p className="text-sm font-medium text-gray-900 mb-1">{t('sms.blockedTitle')}</p>
          <p className="text-xs text-gray-600 mb-3">{t(getReasonKey(reason))}</p>
          {planCode !== 'premium' && (
            <Link
              href="/nastavitve/paketi"
              className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700"
            >
              {t('sms.blockedUpgrade')}
              <ArrowRight className="h-3 w-3" weight="bold" />
            </Link>
          )}
        </div>
      </div>

      {/* Disabled children underneath */}
      <div className="opacity-30 pointer-events-none">{children}</div>
    </motion.div>
  );
}

/**
 * Hook to check if SMS can be sent
 */
export function useSMSGuard() {
  const { subscription, smsQuota, refreshSubscription } = useCompany();

  const { allowed, reason } = canSendSMS(subscription, smsQuota);

  return {
    canSend: allowed,
    reason,
    refreshQuota: refreshSubscription,
    smsRemaining: smsQuota?.remaining ?? 0,
    smsUsed: smsQuota?.used_current_month ?? 0,
    smsLimit: smsQuota?.quota_effective ?? 0,
  };
}
