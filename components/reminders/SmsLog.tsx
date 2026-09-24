'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useCompanyRegion } from '@/lib/hooks/useCompanyRegion';
import { formatPhone } from '@/lib/phone';
import { SMS_COUNTRIES } from '@/lib/sms';
import { intlLocale } from '@/lib/format';

type SmsStatus = 'sent' | 'delivered' | 'failed' | 'blocked_country';

interface SmsLogRow {
  id: number;
  phone: string;
  kind: string;
  status: SmsStatus;
  error: string | null;
  created_at: string;
}

const STATUS_STYLE: Record<SmsStatus, string> = {
  sent: 'bg-zinc-100 text-zinc-600',
  delivered: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
  blocked_country: 'bg-amber-50 text-amber-700',
};

const KINDS = ['reminder_before', 'reminder_after', 'reschedule', 'confirmation', 'marketing', 'other'];

/**
 * The latest SMS and whether they arrived (sms_log: n8n writes a row per
 * SMS, BulkGate's delivery report updates it). Hidden until the table exists.
 */
export function SmsLog() {
  const t = useTranslations('reminders.page.smsLog');
  const locale = useLocale();
  const region = useCompanyRegion();
  const [rows, setRows] = useState<SmsLogRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/sms/log')
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { available?: boolean; rows?: SmsLogRow[] } | null) => {
        if (cancelled) return;
        setRows(body?.available ? body.rows ?? [] : null);
      })
      .catch(() => {
        if (!cancelled) setRows(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const countries = useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([locale], { type: 'region' });
    } catch {
      names = null;
    }
    return SMS_COUNTRIES.map((code) => names?.of(code) ?? code).join(', ');
  }, [locale]);

  if (rows === null) return null;

  const when = (iso: string) =>
    new Date(iso).toLocaleString(intlLocale(locale), {
      timeZone: region.timezone,
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.04)]">
      <h2 className="text-base font-semibold text-zinc-950">{t('title')}</h2>
      <p className="mt-1 text-xs leading-5 text-zinc-500">{t('countries', { countries })}</p>

      {rows.length === 0 ? (
        <p className="mt-5 border-t border-zinc-100 pt-5 text-sm text-zinc-500">{t('empty')}</p>
      ) : (
        <ul className="mt-5 divide-y divide-zinc-100 border-t border-zinc-100">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-900">{formatPhone(row.phone, region.countryCode)}</p>
                <p className="truncate text-xs text-zinc-500">
                  {t(`kind.${KINDS.includes(row.kind) ? row.kind : 'other'}`)} · {when(row.created_at)}
                </p>
              </div>
              <span
                title={row.error ?? undefined}
                className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[row.status] ?? STATUS_STYLE.sent}`}
              >
                {t(`status.${row.status in STATUS_STYLE ? row.status : 'sent'}`)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
