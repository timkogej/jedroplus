'use client';

import { motion, AnimatePresence } from 'motion/react';
import { Check, CircleNotch } from '@phosphor-icons/react';

interface SaveIndicatorProps {
  saving: boolean;
  lastSaved: Date | null;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 5) return 'pravkar';
  if (diff < 60) return `pred ${diff}s`;
  if (diff < 3600) return `pred ${Math.floor(diff / 60)}min`;
  return `pred ${Math.floor(diff / 3600)}h`;
}

export function SaveIndicator({ saving, lastSaved }: SaveIndicatorProps) {
  return (
    <AnimatePresence mode="wait">
      {saving ? (
        <motion.div
          key="saving"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-2 text-gray-500"
        >
          <CircleNotch className="w-4 h-4 animate-spin" />
          <span className="text-sm">Shranjevanje...</span>
        </motion.div>
      ) : lastSaved ? (
        <motion.div
          key="saved"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-2 text-green-600"
        >
          <Check className="w-4 h-4" />
          <span className="text-sm">Shranjeno {formatRelativeTime(lastSaved)}</span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
