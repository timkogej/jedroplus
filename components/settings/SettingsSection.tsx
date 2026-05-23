'use client';

import { motion } from 'motion/react';

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-100 p-5 mb-5"
    >
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</p>
      {description && (
        <p className="text-xs text-gray-500 mb-3 -mt-1">{description}</p>
      )}
      <div className="space-y-4">
        {children}
      </div>
    </motion.div>
  );
}
