'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import ProtectedLayout from '@/components/ProtectedLayout';
import { SegmentedControl } from '@/components/settings/SegmentedControl';
import {
  TABS,
  type TabKey,
  type ReceptionistSettings,
  NastavitveTab,
  DnevnikTab,
  KreditiTab,
  NotActivated,
  LoadingState,
  ErrorState,
} from '@/components/receptionist-plus/ReceptionistPlusTabs';

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ReceptionistPlusPage() {
  const t = useTranslations('receptionist');
  const [tab, setTab] = useState<TabKey>('nastavitve');
  const [provisioned, setProvisioned] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<ReceptionistSettings | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch('/api/receptionistplus/settings');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'load_failed');
      setProvisioned(Boolean(data.provisioned));
      setSettings(data.settings);
    } catch (e) {
      console.error('[ReceptionistPlus] load settings error:', e);
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'krediti') setTab('krediti');
    const checkout = params.get('checkout');
    if (checkout === 'success') toast.success(t('credits.checkoutSuccess'));
    else if (checkout === 'canceled') toast(t('credits.checkoutCanceled'));
  }, [t]);

  const saveSettings = useCallback(async (patch: Partial<ReceptionistSettings>) => {
    const res = await fetch('/api/receptionistplus/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error ?? 'save_failed');
    setSettings((s) => (s ? { ...s, ...patch } : s));
  }, []);

  return (
    <ProtectedLayout>
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="mb-6"
          >
            <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">{t('title')}</h1>
            <p className="mt-0.5 text-base text-gray-500">{t('subtitle')}</p>
          </motion.div>

          {provisioned === null && !error ? (
            <LoadingState />
          ) : error && provisioned === null ? (
            <ErrorState message={t('loadError')} />
          ) : !provisioned ? (
            <NotActivated onActivated={load} />
          ) : (
            <>
              <div className="mb-6">
                <SegmentedControl
                  options={TABS.map(({ key, labelKey }) => ({ value: key, label: t(labelKey) }))}
                  value={tab}
                  onChange={(value) => setTab(value as TabKey)}
                />
              </div>

              {tab === 'nastavitve' && settings && (
                <NastavitveTab settings={settings} onSave={saveSettings} />
              )}
              {tab === 'dnevnik' && <DnevnikTab />}
              {tab === 'krediti' && <KreditiTab />}
            </>
          )}
        </div>
      </main>
    </ProtectedLayout>
  );
}
