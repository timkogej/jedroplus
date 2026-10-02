'use client';

import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslations } from 'next-intl';
import ProtectedLayout from '@/components/ProtectedLayout';
import { SegmentedControl } from '@/components/settings/SegmentedControl';

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
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="mb-6"
          >
            <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">{t('layout.title')}</h1>
            <p className="mt-0.5 text-base text-gray-500">{t('layout.subtitle')}</p>
          </motion.div>

          {/* Zavihki kot Applov segmentni preklopnik namesto kartice s črto */}
          <div className="mb-6 overflow-x-auto">
            <SegmentedControl
              options={TABS.map((tab) => ({
                value: tab.href,
                label: t(tab.labelKey as Parameters<typeof t>[0]),
              }))}
              value={activeTab}
              onChange={(href) => router.push(href)}
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </ProtectedLayout>
  );
}
