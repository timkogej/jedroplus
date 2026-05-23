'use client';

import { motion } from 'motion/react';
import ProtectedLayout from '@/components/ProtectedLayout';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedLayout>
      <div className="min-h-screen bg-[#F7F8FA]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {children}
          </motion.div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
