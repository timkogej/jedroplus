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

  const pathnameWithoutLocale = pathname.replace(/^\/[^/]+(?=\/promotions(?:\/|$))/, '');
  const activeTab = TABS.find((tab) =>
    pathnameWithoutLocale === tab.href || pathnameWithoutLocale.startsWith(`${tab.href}/`)
  )?.href ?? TABS[0].href;

  return (
    <ProtectedLayout>
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div>
            <h1 className="text-2xl font-normal text-[#1A1F36]">{t('layout.title')}</h1>
            <p className="mt-1 text-gray-500">{t('layout.subtitle')}</p>
          </div>
        </motion.div>

        {/* Tab navigation */}
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex border-b border-gray-100">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.href;
              return (
                <button
                  key={tab.href}
                  onClick={() => router.push(tab.href)}
                  className={`relative flex-1 px-4 py-3.5 text-sm font-medium transition-colors ${
                    isActive ? 'text-gray-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {t(tab.labelKey as Parameters<typeof t>[0])}
                  {isActive && (
                    <motion.div
                      layoutId="promo-tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ background: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)' }}
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
