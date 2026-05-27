'use client';

import { motion, AnimatePresence } from 'motion/react';
import { Check } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';

interface SaveIndicatorProps {
  saving: boolean;
  lastSaved: Date | null;
}

export function SaveIndicator({ saving, lastSaved }: SaveIndicatorProps) {
  const t = useTranslations('settings');

  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 5) return t('saveIndicator.justNow');
    if (diff < 60) return t('saveIndicator.secondsAgo', { seconds: diff });
    if (diff < 3600) return t('saveIndicator.minutesAgo', { minutes: Math.floor(diff / 60) });
    return t('saveIndicator.hoursAgo', { hours: Math.floor(diff / 3600) });
  };

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
          <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 border-t-gray-900 animate-spin" />
          <span className="text-sm">{t('saveIndicator.saving')}</span>
        </motion.div>
      ) : lastSaved ? (
        <motion.div
          key="saved"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-2 text-gray-500"
        >
          <Check className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-sm">{t('saveIndicator.saved', { relative: formatRelativeTime(lastSaved) })}</span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
