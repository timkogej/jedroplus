'use client';

import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslations } from 'next-intl';
import ProtectedLayout from '@/components/ProtectedLayout';

export default function PromotionsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('promotions');
  const pathname = usePathname();
  const router = useRouter();

  const TABS = [
    { labelKey: 'layout.tabs.discounts', href: '/promotions/discounts' },
    { labelKey: 'layout.tabs.happyHours', href: '/promotions/happy-hours' },
    { labelKey: 'layout.tabs.addOns', href: '/promotions/add-ons' },
  ];

  const activeTab = TABS.find((tab) => pathname.startsWith(tab.href))?.href ?? TABS[0].href;

  return (
    <ProtectedLayout>
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center gap-3"
        >
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('layout.title')}</h1>
            <p className="text-sm text-gray-500">{t('layout.subtitle')}</p>
          </div>
        </motion.div>

        {/* Tab navigation */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex border-b border-gray-100">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.href;
              return (
                <button
                  key={tab.href}
                  onClick={() => router.push(tab.href)}
                  className={`relative flex-1 px-4 py-3.5 text-sm font-medium transition-colors ${
                    isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t(tab.labelKey as Parameters<typeof t>[0])}
                  {isActive && (
                    <motion.div
                      layoutId="promo-tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ background: 'linear-gradient(90deg, #6D5EF7 0%, #2F80ED 50%, #2AD4C5 100%)' }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="p-6"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
    </ProtectedLayout>
  );
}
