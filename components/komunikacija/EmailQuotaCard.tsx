'use client';

import { motion } from 'motion/react';

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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl bg-white border border-gray-100 px-5 py-3.5"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-semibold text-[#1A1F36]">
            {used.toLocaleString()} / {total.toLocaleString()}
          </span>
          <span className="text-sm text-gray-400">emailov</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>
            Preostalo:{' '}
            <span className="font-medium text-gray-600">{remaining}</span>
          </span>
          <span className="hidden sm:inline">Ponastavi se: {resetDate}</span>
        </div>
      </div>

      {/* Thin progress bar */}
      <div className="mt-2.5 h-0.5 rounded-full bg-gray-100 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          className="h-full rounded-full bg-[#6D5EF7]"
        />
      </div>
    </motion.div>
  );
}
