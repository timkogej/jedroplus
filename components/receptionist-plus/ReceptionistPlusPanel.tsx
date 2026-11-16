'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
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
import { NumberRequestCard } from '@/components/receptionist-plus/NumberRequestCard';

// ─── Panel ──────────────────────────────────────────────────────────────────
//
// Vsebina Receptionist+ (aktivacija, nastavitve, dnevnik, krediti). Živi na strani
// AI (/ai?ai=receptionist); /receptionist-plus preusmeri tja z istimi parametri
// (Stripe vrne na ?tab=krediti&checkout=…).

export function ReceptionistPlusPanel() {
  const t = useTranslations('receptionist');
  const [tab, setTab] = useState<TabKey>('nastavitve');
  const [provisioned, setProvisioned] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<ReceptionistSettings | null>(null);
  const [error, setError] = useState(false);
  const [phase7, setPhase7] = useState(true);
  const [phase10, setPhase10] = useState(true);
  const [phase11, setPhase11] = useState(true);
  const [companyName, setCompanyName] = useState('');

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch('/api/receptionistplus/settings');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'load_failed');
      setProvisioned(Boolean(data.provisioned));
      setSettings(data.settings);
      setPhase7(data.phase7 !== false);
      setPhase10(data.phase10 !== false);
      setPhase11(data.phase11 !== false);
      setCompanyName(typeof data.company_name === 'string' ? data.company_name : '');
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
    <div>
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

          {tab === 'nastavitve' && <NumberRequestCard />}
          {tab === 'nastavitve' && settings && (
            <NastavitveTab
              settings={settings}
              onSave={saveSettings}
              phase7={phase7}
              phase10={phase10}
              phase11={phase11}
              companyName={companyName}
            />
          )}
          {tab === 'dnevnik' && <DnevnikTab />}
          {tab === 'krediti' && <KreditiTab />}
        </>
      )}
    </div>
  );
}
