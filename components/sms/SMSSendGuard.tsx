'use client';

import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Warning, Lock, ArrowRight } from '@phosphor-icons/react';
import Link from 'next/link';
import { useCompany } from '@/app/company-context';
import { canSendSMS } from '@/lib/api/billingClient';

interface SMSSendGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  showBlockedUI?: boolean;
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
          <p className="text-sm font-medium text-gray-900 mb-1">SMS pošiljanje blokirano</p>
          <p className="text-xs text-gray-600 mb-3">{getReasonText(reason)}</p>
          {planCode !== 'premium' && (
            <Link
              href="/plans"
              className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700"
            >
              Nadgradi paket
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

function getReasonText(reason?: string): string {
  switch (reason) {
    case 'quota_exceeded':
      return 'Dosegli ste mesečni SMS limit';
    case 'no_subscription':
      return 'Nimate aktivne naročnine';
    case 'plan_inactive':
      return 'Vaša naročnina ni aktivna';
    default:
      return 'SMS pošiljanje ni na voljo';
  }
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
    reasonText: getReasonText(reason),
    refreshQuota: refreshSubscription,
    smsRemaining: smsQuota?.remaining ?? 0,
    smsUsed: smsQuota?.used_current_month ?? 0,
    smsLimit: smsQuota?.quota_effective ?? 0,
  };
}
