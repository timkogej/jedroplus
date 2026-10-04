'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { XCircle, ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import AuroraBackground from '@/components/shared/AuroraBackground';

function getSafeReturnPath(): string {
  if (typeof window === 'undefined') return '/nastavitve/paketi';
  const returnTo = new URLSearchParams(window.location.search).get('return_to');
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return '/nastavitve/paketi';
  }
  return returnTo;
}

export default function BillingCancelPage() {
  const t = useTranslations('billing');
  const router = useRouter();

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-white px-4 py-16">
      <AuroraBackground tone="light" />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-gray-200/70 bg-white/85 shadow-[0_20px_50px_-25px_rgba(60,50,140,0.35)] backdrop-blur-xl p-8 text-center"
      >
        {/* Cancel Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="relative inline-block mb-6"
        >
          <XCircle className="h-16 w-16 text-gray-400" weight="regular" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-2 text-[26px] font-semibold tracking-tight text-gray-900"
        >
          {t('cancel.title')}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8 text-[15px] text-gray-500"
        >
          {t('cancel.message')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-3"
        >
          <button
            onClick={() => router.push(getSafeReturnPath())}
            className="w-full flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2.5 font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
          >
            <ArrowLeft className="h-4 w-4" weight="bold" />
            {t('cancel.backButton')}
          </button>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100"
          >
            {t('cancel.dashboardButton')}
            <ArrowRight className="h-4 w-4" weight="bold" />
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
