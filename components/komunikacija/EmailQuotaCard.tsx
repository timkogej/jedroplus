'use client';

import { motion } from 'motion/react';
import { Envelope, Warning } from '@phosphor-icons/react';

interface EmailQuotaCardProps {
  used: number;
  total: number;
  resetDate: string;
}

export default function EmailQuotaCard({ used, total, resetDate }: EmailQuotaCardProps) {
  const percentage = Math.round((used / total) * 100);
  const remaining = total - used;
  const isLow = percentage >= 80;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm p-5"
    >
      {/* Subtle gradient accent at top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50">
            <Envelope className="h-5 w-5 text-violet-600" weight="duotone" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Email kvota</p>
            <p className="text-xl font-bold text-[#1A1F36]">
              {used.toLocaleString()} / {total.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center gap-2">
            {isLow && (
              <Warning className="h-4 w-4 text-amber-500" weight="fill" />
            )}
            <span
              className={`text-2xl font-bold ${
                isLow ? 'text-amber-500' : 'text-violet-600'
              }`}
            >
              {percentage}%
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">porabljeno</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-2 rounded-full bg-gray-100 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
          className={`h-full rounded-full ${
            isLow
              ? 'bg-gradient-to-r from-amber-400 to-orange-500'
              : 'bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500'
          }`}
        />
      </div>

      {/* Footer info */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
        <span>
          Preostalo: <span className={`font-semibold ${isLow ? 'text-amber-500' : 'text-gray-600'}`}>{remaining}</span> emailov
        </span>
        <span>Ponastavi se: {resetDate}</span>
      </div>
    </motion.div>
  );
}
