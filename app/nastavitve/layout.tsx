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
      <div className="flex h-full min-h-screen w-full">
        {/* Settings Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 flex-shrink-0">
          <div className="sticky top-0 p-5">
            <motion.h2
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-lg font-bold text-gray-900 mb-6 px-3"
            >
              Nastavitve
            </motion.h2>
            <SettingsSidebar />
          </div>
        </div>

        {/* Settings Content Area */}
        <div className="flex-1 overflow-auto bg-gray-50/50">
          <div className="max-w-4xl mx-auto px-8 py-8">
            {children}
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
