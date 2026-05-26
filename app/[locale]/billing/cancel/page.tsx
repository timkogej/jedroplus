'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { XCircle, ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';

export default function BillingCancelPage() {
  const t = useTranslations('billing');
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
      >
        {/* Cancel Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="relative inline-block mb-6"
        >
          <div className="absolute inset-0 bg-gray-400/20 rounded-full blur-2xl" />
          <XCircle className="h-20 w-20 text-gray-400 relative" weight="fill" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold text-gray-900 mb-2"
        >
          {t('cancel.title')}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-gray-600 mb-8"
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
            onClick={() => router.push('/billing')}
            className="w-full py-3 px-4 bg-gradient-to-r from-violet-500 to-cyan-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" weight="bold" />
            {t('cancel.backButton')}
          </button>

          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
          >
            {t('cancel.dashboardButton')}
            <ArrowRight className="h-4 w-4" weight="bold" />
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
