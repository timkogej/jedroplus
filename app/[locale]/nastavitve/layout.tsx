'use client';

import { motion } from 'motion/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import AmbientBottomGlow from '@/components/shared/AmbientBottomGlow';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedLayout>
      <div className="relative isolate min-h-screen bg-[#F7F8FA]">
        <AmbientBottomGlow tone="gray" className="h-[42vh]" />
        <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
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
