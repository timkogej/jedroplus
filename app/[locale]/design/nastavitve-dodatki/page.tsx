'use client';

/**
 * ZAČASNA predogledna stran za Nastavitve → Dodatki. Prava stran z
 * izmišljenim podjetjem (samo v tem drevesu, brez piškotkov) v dveh
 * različicah: Jedro Plus z aktivnim SMS dodatkom in dodatnim sedežem ter
 * brezplačni paket. Nakup in preklic sta blokirana. Ko je redizajn
 * potrjen, se mapa `design` zbriše.
 */

import { useState } from 'react';
import { CompanyContext, useCompany } from '@/app/company-context';
import DodatkiPage from '../../nastavitve/addoni/page';

const day = 86400 * 1000;
const PERIOD_START = new Date(Date.now() - 12 * day).toISOString();
const PERIOD_END = new Date(Date.now() + 18 * day).toISOString();

const PLUS_STATUS = {
  subscription: {
    id: 'sub1', status: 'active', provider_subscription_id: 'sub_preview',
    current_period_start: PERIOD_START, current_period_end: PERIOD_END,
    sms_addon_monthly: 100, email_addon_monthly: 0,
    sms_addon_stripe_item_id: 'si_sms', email_addon_stripe_item_id: null,
    sms_addon_cancel_at_period_end: false, email_addon_cancel_at_period_end: false,
    sms_quota_override: null, email_quota_override: null,
    plan: { code: 'JEDRO_PLUS', name: 'Jedro Plus', price_monthly_cents: 1900, sms_quota_monthly: 200, email_quota_monthly: 1000, sms_enabled: true, email_enabled: true, max_employees: 3 },
  },
  smsUsage: { sent_count: 254, period_end: PERIOD_END },
  emailUsage: { sent_count: 312, period_end: PERIOD_END },
  employeeLimits: { included_users: 3, extra_users: 1, max_users: 4, stripe_subscription_item_id: 'si_seat', cancel_at_period_end: false },
  memberCount: 4,
};

const FREE_STATUS = {
  subscription: {
    ...PLUS_STATUS.subscription, id: 'sub0', provider_subscription_id: null, current_period_start: null, current_period_end: null,
    sms_addon_monthly: 0, sms_addon_stripe_item_id: null, sms_quota_override: 20, email_quota_override: 50,
    plan: { ...PLUS_STATUS.subscription.plan, code: 'FREE', name: 'Free', price_monthly_cents: 0, sms_quota_monthly: 0, email_quota_monthly: 0, max_employees: 1 },
  },
  smsUsage: { sent_count: 6 },
  emailUsage: { sent_count: 21 },
  employeeLimits: { included_users: 1, extra_users: 0, max_users: 1, stripe_subscription_item_id: null, cancel_at_period_end: false },
  memberCount: 1,
};

type Patched = { __dodatkiPreview?: boolean };

if (typeof window !== 'undefined' && !(window as unknown as Patched).__dodatkiPreview) {
  (window as unknown as Patched).__dodatkiPreview = true;
  const json = (body: unknown, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/addons/status')) return json(url.includes('preview-free') ? FREE_STATUS : PLUS_STATUS);
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url.includes('/api/') && method !== 'GET') return json({ success: false, message: 'Predogled — nakup ne deluje.' }, 400);
    return realFetch(input, init);
  };
}

export default function NastavitveDodatkiPreview() {
  const [plan, setPlan] = useState<'plus' | 'free'>('plus');
  const company = useCompany();
  const isFree = plan === 'free';

  return (
    <CompanyContext.Provider
      key={plan}
      value={{ ...company, companyId: 'PREVIEW', companyUuid: isFree ? 'preview-free' : 'preview-plus' }}
    >
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-2xl px-4 py-7 sm:px-6 sm:py-9">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              predogled — nakup ne deluje
            </span>
            {(['plus', 'free'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlan(p)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  plan === p ? 'bg-amber-800 text-white' : 'bg-amber-50 text-amber-900'
                }`}
              >
                {p === 'plus' ? 'Jedro Plus' : 'Brezplačno'}
              </button>
            ))}
          </div>
          <DodatkiPage />
        </div>
      </div>
    </CompanyContext.Provider>
  );
}
