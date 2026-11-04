'use client';

import { Link } from '@/i18n/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type Settings = { enabled: boolean; reward_threshold: number; reward_name: string };

export default function LoyaltySettingsPage() {
  const t = useTranslations('settings.loyaltyPage');
  const [settings, setSettings] = useState<Settings>({ enabled: true, reward_threshold: 10, reward_name: t('defaultReward') });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/loyalty', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error();
      return response.json() as Promise<{ settings: Settings }>;
    }).then((data) => { if (active) setSettings(data.settings); })
      .catch(() => { if (active) setMessage(t('loadError')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once; t only labels the error
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/loyalty', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error();
      setMessage(t('saved'));
    } catch {
      setMessage(t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <Link href="/nastavitve" className="text-sm text-gray-500 hover:text-gray-900">← {t('back')}</Link>
      <h1 className="mt-5 text-2xl font-semibold text-gray-900">{t('title')}</h1>
      <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
      <div className="mt-7 space-y-6 rounded-2xl border border-gray-100 bg-white p-6">
        {loading ? <p className="text-sm text-gray-500">{t('loading')}</p> : (
          <>
            <label className="flex items-center justify-between gap-4 text-sm font-medium text-gray-900">
              {t('enable')}
              <input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} className="h-5 w-5 accent-violet-600" />
            </label>
            <div>
              <label htmlFor="reward-threshold" className="block text-sm font-medium text-gray-900">{t('threshold')}</label>
              <input id="reward-threshold" type="number" min={2} max={100} value={settings.reward_threshold} onChange={(event) => setSettings({ ...settings, reward_threshold: Number(event.target.value) })} className="mt-2 w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="reward-name" className="block text-sm font-medium text-gray-900">{t('rewardName')}</label>
              <input id="reward-name" type="text" maxLength={120} value={settings.reward_name} onChange={(event) => setSettings({ ...settings, reward_name: event.target.value })} className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </div>
            <p className="text-xs text-gray-500">{t('redeemHint')}</p>
            <button type="button" disabled={saving || !Number.isInteger(settings.reward_threshold) || settings.reward_threshold < 2 || settings.reward_threshold > 100 || !settings.reward_name.trim()} onClick={save} className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">{saving ? t('saving') : t('save')}</button>
          </>
        )}
        {message && <p role="status" className="text-sm text-gray-600">{message}</p>}
      </div>
    </div>
  );
}
