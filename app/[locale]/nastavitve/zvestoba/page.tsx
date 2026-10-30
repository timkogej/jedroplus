'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';

type Settings = { enabled: boolean; reward_threshold: number; reward_name: string };

export default function LoyaltySettingsPage() {
  const locale = useLocale();
  const english = locale === 'en';
  const [settings, setSettings] = useState<Settings>({ enabled: true, reward_threshold: 10, reward_name: 'Nagrada zvestobe' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/loyalty', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error();
      return response.json() as Promise<{ settings: Settings }>;
    }).then((data) => { if (active) setSettings(data.settings); })
      .catch(() => { if (active) setMessage(english ? 'Could not load settings.' : 'Nastavitev ni bilo mogoče naložiti.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [english]);

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/loyalty', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error();
      setMessage(english ? 'Saved.' : 'Shranjeno.');
    } catch {
      setMessage(english ? 'Could not save settings. Only owners and admins can change them.' : 'Shranjevanje ni uspelo. Nastavitve lahko spreminjajo lastniki in administratorji.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <Link href="/nastavitve" className="text-sm text-gray-500 hover:text-gray-900">← {english ? 'Settings' : 'Nastavitve'}</Link>
      <h1 className="mt-5 text-2xl font-semibold text-gray-900">{english ? 'Loyalty' : 'Zvestoba'}</h1>
      <p className="mt-1 text-sm text-gray-500">{english ? 'A customer earns one point per completed visit day. Cancelled appointments and no-shows do not count.' : 'Stranka prejme eno točko za dan z opravljenim obiskom. Odpovedani termini in neprihodi ne štejejo.'}</p>
      <div className="mt-7 space-y-6 rounded-2xl border border-gray-100 bg-white p-6">
        {loading ? <p className="text-sm text-gray-500">{english ? 'Loading...' : 'Nalagam...'}</p> : (
          <>
            <label className="flex items-center justify-between gap-4 text-sm font-medium text-gray-900">
              {english ? 'Enable loyalty card in customer portal' : 'Prikaži kartico zvestobe v portalu strank'}
              <input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} className="h-5 w-5 accent-violet-600" />
            </label>
            <div>
              <label htmlFor="reward-threshold" className="block text-sm font-medium text-gray-900">{english ? 'Points needed for a reward' : 'Točk za nagrado'}</label>
              <input id="reward-threshold" type="number" min={2} max={100} value={settings.reward_threshold} onChange={(event) => setSettings({ ...settings, reward_threshold: Number(event.target.value) })} className="mt-2 w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="reward-name" className="block text-sm font-medium text-gray-900">{english ? 'Reward name' : 'Naziv nagrade'}</label>
              <input id="reward-name" type="text" maxLength={120} value={settings.reward_name} onChange={(event) => setSettings({ ...settings, reward_name: event.target.value })} className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </div>
            <p className="text-xs text-gray-500">{english ? 'When redeemed in the customer record, the required points are deducted. Past visit counts remain visible.' : 'Ob unovčenju v kartici stranke se odšteje potrebno število točk. Skupno število obiskov ostane vidno.'}</p>
            <button type="button" disabled={saving || !Number.isInteger(settings.reward_threshold) || settings.reward_threshold < 2 || settings.reward_threshold > 100 || !settings.reward_name.trim()} onClick={save} className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">{saving ? (english ? 'Saving...' : 'Shranjujem...') : (english ? 'Save settings' : 'Shrani nastavitve')}</button>
          </>
        )}
        {message && <p role="status" className="text-sm text-gray-600">{message}</p>}
      </div>
    </div>
  );
}
