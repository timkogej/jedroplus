'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface TestSendButtonProps {
  channel: 'sms' | 'email';
  template: string;
}

type Stanje =
  | { vrsta: 'mirno' }
  | { vrsta: 'poslano'; prejemnik: string; neznane: string[] }
  | { vrsta: 'napaka'; razlog: string };

/**
 * Sends one test message through the real sender, to the company's own contact
 * details. The preview above is a different code path, so this is the only way
 * to see exactly what a client would receive.
 */
export function TestSendButton({ channel, template }: TestSendButtonProps) {
  const t = useTranslations('reminders.test');
  const [posiljam, setPosiljam] = useState(false);
  const [stanje, setStanje] = useState<Stanje>({ vrsta: 'mirno' });

  const prazna = !template.trim();

  async function poslji() {
    setPosiljam(true);
    setStanje({ vrsta: 'mirno' });
    try {
      const res = await fetch('/api/reminders/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, template }),
      });
      const data = (await res.json().catch(() => null)) as {
        poslano?: boolean;
        prejemnik?: string;
        razlog?: string;
        neznane_oznake?: string[];
      } | null;

      if (data?.poslano) {
        setStanje({
          vrsta: 'poslano',
          prejemnik: data.prejemnik ?? '',
          neznane: data.neznane_oznake ?? [],
        });
      } else {
        setStanje({ vrsta: 'napaka', razlog: data?.razlog ?? t('failed') });
      }
    } catch {
      setStanje({ vrsta: 'napaka', razlog: t('failed') });
    } finally {
      setPosiljam(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={poslji}
          disabled={posiljam || prazna}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {posiljam ? t('sending') : channel === 'sms' ? t('buttonSms') : t('buttonEmail')}
        </button>
        <span className="text-[11px] leading-5 text-gray-500">{t('note')}</span>
      </div>

      {stanje.vrsta === 'poslano' && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800">
          {t('sent', { recipient: stanje.prejemnik })}
          {stanje.neznane.length > 0 && ` ${t('unknownVars', { tokens: stanje.neznane.join(', ') })}`}
        </p>
      )}

      {stanje.vrsta === 'napaka' && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
          {stanje.razlog}
        </p>
      )}
    </div>
  );
}
