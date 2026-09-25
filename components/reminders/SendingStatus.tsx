'use client';

import { intlLocale } from '@/lib/format';
import { Link } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle, WarningCircle, XCircle } from '@phosphor-icons/react';
import type { ChannelUsage } from '@/lib/billing/usage';

type Channel = 'sms' | 'email';

interface SendingStatusProps {
  /** Channels used by at least one enabled reminder flow. */
  channels: Channel[];
  sms: ChannelUsage | null;
  email: ChannelUsage | null;
  periodEnd: string | null;
  canBuy: boolean;
  /** Free plan: the quota is a one-time trial and the fix is an upgrade. */
  isFree?: boolean;
}

/**
 * Tells the owner, per channel in use, whether reminders are actually going
 * out. When a quota is used up the backend silently skips messages, so this is
 * the one place that must say so plainly.
 */
export function SendingStatus({ channels, sms, email, periodEnd, canBuy, isFree = false }: SendingStatusProps) {
  const t = useTranslations('reminders.page.sendingStatus');
  const locale = useLocale();
  if (channels.length === 0 && !isFree) return null;

  const renewal = periodEnd
    ? new Date(periodEnd).toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'numeric', year: 'numeric' })
    : null;

  return (
    <section aria-label={t('title')} className="mb-7 space-y-2">
      {isFree && (sms?.total || email?.total) ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3 text-sm text-violet-900">
          <p className="font-semibold">{t('trial.introTitle')}</p>
          <p className="mt-1 text-xs leading-5 opacity-90">
            {t('trial.introBody', { sms: sms?.total ?? 0, email: email?.total ?? 0 })}
          </p>
          <Link href="/nastavitve/paketi" className="mt-1 inline-flex text-xs font-semibold underline underline-offset-2">
            {t('trial.upgrade')}
          </Link>
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
      {channels.map((channel) => {
        const usage = channel === 'sms' ? sms : email;
        if (!usage) return null;
        const name = channel === 'sms' ? 'SMS' : 'Email';
        const values = { name, used: usage.used, total: usage.total, remaining: usage.remaining, date: renewal ?? '' };

        const state = usage.unavailable
          ? 'unavailable'
          : usage.exhausted
          ? 'exhausted'
          : usage.nearLimit
          ? 'nearLimit'
          : 'ok';

        const tone =
          state === 'ok'
            ? 'border-zinc-200 bg-white text-zinc-700'
            : state === 'nearLimit'
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : 'border-red-200 bg-red-50 text-red-800';
        const Icon = state === 'ok' ? CheckCircle : state === 'nearLimit' ? WarningCircle : XCircle;

        return (
          <div key={channel} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${tone}`}>
            <Icon size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 space-y-1">
              <p className="font-semibold">
                {t(isFree && state !== 'unavailable' ? `trial.${state}.title` : `${state}.title`, values)}
              </p>
              <p className="text-xs leading-5 opacity-90">
                {t(isFree && state !== 'unavailable' ? `trial.${state}.body` : `${state}.body`, values)}
                {state === 'exhausted' && renewal && !isFree ? ` ${t('renews', values)}` : ''}
              </p>
              {state !== 'ok' && isFree && (
                <Link href="/nastavitve/paketi" className="inline-flex text-xs font-semibold underline underline-offset-2">
                  {t('trial.upgrade')}
                </Link>
              )}
              {state !== 'ok' && canBuy && !isFree && (
                <Link
                  href="/nastavitve/addoni"
                  className="inline-flex text-xs font-semibold underline underline-offset-2"
                >
                  {t(channel === 'sms' ? 'buySms' : 'buyEmail')}
                </Link>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </section>
  );
}
