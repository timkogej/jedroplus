'use client';

import { motion } from 'motion/react';
import { Envelope } from '@phosphor-icons/react';

interface EmailQuotaCardProps {
  used: number;
  total: number;
  resetDate: string;
}

export default function EmailQuotaCard({ used, total, resetDate }: EmailQuotaCardProps) {
  const percentage = Math.round((used / total) * 100);
  const remaining = total - used;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm p-5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Envelope className="h-6 w-6 text-[#1A1F36]" weight="regular" />
          <div>
            <p className="text-sm font-bold text-gray-500">Email kvota</p>
            <p className="text-xl font-medium text-[#1A1F36]">
              {used.toLocaleString()} / {total.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-2xl font-medium text-[#1A1F36]">
            {percentage}%
          </span>
          <p className="text-xs text-gray-400 mt-0.5">porabljeno</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-1 rounded-full bg-gray-100 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
          className="h-full rounded-full bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500"
        />
      </div>

      {/* Footer info */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
        <span>
          Preostalo: <span className="font-semibold text-gray-600">{remaining}</span> emailov
        </span>
        <span>Ponastavi se: {resetDate}</span>
      </div>
    </motion.div>
  );
}
