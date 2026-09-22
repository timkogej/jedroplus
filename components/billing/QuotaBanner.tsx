'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { WarningCircle, XCircle, X } from '@phosphor-icons/react';
import { useBillingUsage } from '@/hooks/useBillingUsage';
import type { ChannelUsage } from '@/lib/billing/usage';

const DISMISS_KEY = 'jedroplus_quota_banner_dismissed';

type Channel = 'sms' | 'email';
type Level = 'exhausted' | 'nearLimit';

function levelOf(usage: ChannelUsage): Level | null {
  if (usage.exhausted) return 'exhausted';
  if (usage.nearLimit) return 'nearLimit';
  return null;
}

/**
 * App-wide warning when SMS or email quota is nearly or fully used.
 * The backend silently skips messages once a quota is exhausted, so owners
 * must hear about it before clients stop getting reminders.
 * Dismissing hides the current warning for the rest of the day.
 */
export default function QuotaBanner() {
  const t = useTranslations('billing.quotaBanner');
  const { usage } = useBillingUsage();
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY));
    } catch {
      setDismissed(null);
    }
  }, []);

  if (!usage) return null;

  const issues = (['sms', 'email'] as Channel[])
    .map((channel) => ({ channel, usage: usage[channel], level: levelOf(usage[channel]) }))
    .filter((item): item is { channel: Channel; usage: ChannelUsage; level: Level } => item.level !== null);

  if (issues.length === 0) return null;

  // The worst issue leads; exhausted outranks near-limit.
  issues.sort((a, b) => (a.level === b.level ? 0 : a.level === 'exhausted' ? -1 : 1));
  const top = issues[0];

  const signature = `${new Date().toDateString()}|${issues.map((i) => `${i.channel}:${i.level}`).join(',')}`;
  if (dismissed === signature) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, signature);
    } catch {
      // storage unavailable — hide for this render only
    }
    setDismissed(signature);
  };

  const exhausted = top.level === 'exhausted';
  const name = top.channel === 'sms' ? 'SMS' : t('emailName');
  const nameLoc = top.channel === 'sms' ? 'SMS' : t('emailNameLoc');
  const values = { name, nameLoc, used: top.usage.used, total: top.usage.total, remaining: top.usage.remaining };
  const isFree = usage.isFree;
  const prefix = isFree ? `trial.${top.level}` : top.level;
  const Icon = exhausted ? XCircle : WarningCircle;

  return (
    <div
      role={exhausted ? 'alert' : 'status'}
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2.5 text-sm sm:px-6 ${
        exhausted ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'
      }`}
    >
      <Icon size={18} weight="fill" className="shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">{t(`${prefix}.title`, values)}</span>{' '}
        <span className="opacity-90">{t(`${prefix}.body`, values)}</span>
        {issues.length > 1 && <span className="opacity-90"> {t('alsoOther')}</span>}
      </p>
      <Link
        href={isFree ? '/nastavitve/paketi' : '/nastavitve/addoni'}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${
          exhausted ? 'bg-red-700 hover:bg-red-800' : 'bg-amber-700 hover:bg-amber-800'
        }`}
      >
        {isFree ? t('trial.cta') : t(top.channel === 'sms' ? 'ctaSms' : 'ctaEmail')}
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('dismiss')}
        className="shrink-0 rounded-md p-1 opacity-70 hover:opacity-100"
      >
        <X size={14} weight="bold" />
      </button>
    </div>
  );
}
