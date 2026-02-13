'use client';

import { motion } from 'motion/react';
import { SettingsSidebar } from '@/components/settings';
import ProtectedLayout from '@/components/ProtectedLayout';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedLayout>
      <div className="min-h-screen bg-[#F7F8FA]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1F36]">
              Nastavitve
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Upravljajte nastavitve vašega podjetja
            </p>
          </motion.div>

          {/* Tab Switcher */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-6"
          >
            <SettingsSidebar />
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {children}
          </motion.div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
