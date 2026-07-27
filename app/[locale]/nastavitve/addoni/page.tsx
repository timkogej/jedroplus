'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import {
  CaretLeft,
  Check,
  X,
  SpinnerGap,
  Warning,
} from '@phosphor-icons/react';
import { useCompany } from '@/app/company-context';

// ─── Types ───────────────────────────────────────────────────────────────────

type PlanData = {
  code: string;
  name: string;
  price_monthly_cents: number;
  sms_quota_monthly: number;
  email_quota_monthly: number;
  sms_enabled: boolean;
  email_enabled: boolean;
  max_employees: number;
};

type SubscriptionData = {
  id: string;
  status: string;
  provider_subscription_id: string | null;
  current_period_start: string;
  current_period_end: string;
  sms_addon_monthly: number;
  email_addon_monthly: number;
  sms_addon_stripe_item_id: string | null;
  email_addon_stripe_item_id: string | null;
  sms_addon_cancel_at_period_end: boolean;
  email_addon_cancel_at_period_end: boolean;
  sms_quota_override: number | null;
  email_quota_override: number | null;
  plan: PlanData;
};

type UsageData = {
  sent_count: number;
  period_start: string;
  period_end: string;
};

type EmployeeLimitsData = {
  included_users: number;
  extra_users: number;
  max_users: number;
  stripe_subscription_item_id: string | null;
  cancel_at_period_end: boolean;
};

// ─── Package lists ────────────────────────────────────────────────────────────

const SMS_PACKAGES_LIST = [
  { key: 'sms-50',   quantity: 50,   priceMonthly: 4  },
  { key: 'sms-100',  quantity: 100,  priceMonthly: 8  },
  { key: 'sms-200',  quantity: 200,  priceMonthly: 16 },
  { key: 'sms-500',  quantity: 500,  priceMonthly: 35, badge: '-12%' },
  { key: 'sms-1000', quantity: 1000, priceMonthly: 65, badge: '-19%' },
];

const EMAIL_PACKAGES_LIST = [
  { key: 'email-500',  quantity: 500,  priceMonthly: 4  },
  { key: 'email-1000', quantity: 1000, priceMonthly: 7  },
  { key: 'email-2500', quantity: 2500, priceMonthly: 15 },
  { key: 'email-5000', quantity: 5000, priceMonthly: 25 },
];

const BRAND_GRADIENT = 'from-[#6D5EF7] via-[#2F80ED] to-[#2AD4C5]';
const BRAND_TEXT_GRADIENT = `bg-gradient-to-r ${BRAND_GRADIENT} bg-clip-text text-transparent`;
const RANGE_INPUT_CLASS = [
  'h-1.5 w-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed disabled:opacity-40',
  '[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none',
  '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white',
  '[&::-webkit-slider-thumb]:bg-[#6D5EF7] [&::-webkit-slider-thumb]:shadow-[0_4px_14px_rgba(109,94,247,0.35)]',
  '[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full',
  '[&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white',
  '[&::-moz-range-thumb]:bg-[#6D5EF7] [&::-moz-range-thumb]:shadow-[0_4px_14px_rgba(109,94,247,0.35)]',
].join(' ');

function formatCount(value: number) {
  return value.toLocaleString('sl-SI');
}

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error';

function Toast({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 32 }}
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
        type === 'error' ? 'bg-red-600 text-white' : 'bg-[#0a0a0a] text-white'
      }`}
    >
      {type === 'error'
        ? <X className="w-4 h-4 text-red-200" weight="bold" />
        : <Check className="w-4 h-4 text-emerald-400" weight="bold" />}
      {message}
    </motion.div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[120, 200, 180].map((h, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 animate-pulse" style={{ height: h }} />
      ))}
    </div>
  );
}

// ─── CurrentPlanCard ──────────────────────────────────────────────────────────

function CurrentPlanCard({ subscription }: { subscription: SubscriptionData | null }) {
  if (!subscription) {
    return (
      <div className={`rounded-[22px] bg-gradient-to-r ${BRAND_GRADIENT} p-[2px] shadow-[0_18px_45px_rgba(15,23,42,0.06)]`}>
        <div className="rounded-[20px] bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Trenutni paket</p>
          <h2 className={`mt-2 text-2xl font-bold tracking-tight ${BRAND_TEXT_GRADIENT}`}>
            Brez aktivne naročnine
          </h2>
          <p className="mt-3 text-sm text-gray-500">Dodatke lahko aktivirate, ko je paket povezan s plačilnim profilom.</p>
        </div>
      </div>
    );
  }

  const plan = subscription.plan;
  const priceEur = plan.price_monthly_cents / 100;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('sl-SI', { day: 'numeric', month: 'numeric', year: 'numeric' });

  return (
    <div className={`rounded-[22px] bg-gradient-to-r ${BRAND_GRADIENT} p-[2px] shadow-[0_18px_45px_rgba(15,23,42,0.06)]`}>
      <div className="rounded-[20px] bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Trenutni paket</p>
            <h2 className={`mt-2 truncate text-3xl font-bold tracking-tight ${BRAND_TEXT_GRADIENT}`}>
              {plan.name}
            </h2>
            <p className="mt-2 text-sm font-medium text-gray-700">{priceEur.toFixed(0)}€ / mesec</p>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-600">
            {plan.code}
          </span>
        </div>
        <div className="mt-5 border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-500">
            Obračunsko obdobje: <span className="font-medium text-gray-700">{fmtDate(subscription.current_period_start)}</span>
            {' '}do{' '}
            <span className="font-medium text-gray-700">{fmtDate(subscription.current_period_end)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── QuotaCard ────────────────────────────────────────────────────────────────

type QuotaCardProps = {
  type: 'sms' | 'email';
  title: string;
  includedInPlan: number;
  addonActive: number;
  addonStripeItemId: string | null;
  addonCancelAtPeriodEnd: boolean;
  used: number;
  total: number;
  usagePercent: number;
  packages: { key: string; quantity: number; priceMonthly: number; badge?: string }[];
  selectedPackage: string | null;
  onSelectPackage: (key: string) => void;
  onPurchase: () => void;
  onCancel: () => void;
  purchasing: boolean;
  canceling: boolean;
  disabled: boolean;
  periodEnd?: string;
};

function QuotaCard({
  type,
  title,
  includedInPlan,
  addonActive,
  addonStripeItemId,
  addonCancelAtPeriodEnd,
  used,
  total,
  usagePercent,
  packages,
  selectedPackage,
  onSelectPackage,
  onPurchase,
  onCancel,
  purchasing,
  canceling,
  disabled,
  periodEnd,
}: QuotaCardProps) {
  const barColor =
    usagePercent > 90
      ? 'bg-red-500'
      : usagePercent > 70
      ? 'bg-amber-400'
      : `bg-gradient-to-r ${BRAND_GRADIENT}`;

  const selectedPkg = packages.find((p) => p.key === selectedPackage);
  const activeQtyMatchesSelected =
    selectedPackage !== null && addonActive > 0 &&
    packages.find((p) => p.key === selectedPackage)?.quantity === addonActive;

  const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString('sl-SI', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '—';

  const activePackageKey = addonActive > 0
    ? packages.find((p) => p.quantity === addonActive)?.key ?? null
    : null;
  const remaining = Math.max(total - used, 0);
  const unitLabel = type === 'sms' ? 'SMS' : 'emailov';

  return (
    <div className="overflow-hidden rounded-[22px] border border-gray-100 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.04)]">
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-tight text-gray-950">{title}</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {formatCount(includedInPlan)} v paketu
              {addonActive > 0 && (
                <span className="font-medium text-[#6D5EF7]"> + {formatCount(addonActive)} iz dodatkov</span>
              )}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 tabular-nums">
            {Math.round(usagePercent)}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="h-0.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Porabljeno</p>
            <p className="mt-1 text-sm font-semibold text-gray-950 tabular-nums">{formatCount(used)}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Na voljo</p>
            <p className="mt-1 text-sm font-semibold text-gray-950 tabular-nums">{formatCount(remaining)}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Skupaj</p>
            <p className="mt-1 text-sm font-semibold text-gray-950 tabular-nums">{formatCount(total)}</p>
          </div>
        </div>
        {periodEnd && (
          <p className="mt-3 text-xs text-gray-400">Obdobje se obnovi: {fmtDate(periodEnd)}</p>
        )}
      </div>

      {/* Active addon */}
      {addonStripeItemId && (
        <div className="mx-5 mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-3">
          {addonCancelAtPeriodEnd ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
              <Warning className="w-3 h-3" weight="bold" />
              Preklic ob koncu obdobja
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#6D5EF7]/10 px-2.5 py-1 text-xs font-semibold text-[#6D5EF7]">
                <Check className="w-3 h-3" weight="bold" />
                Aktiven dodatek: +{formatCount(addonActive)} {unitLabel} | €{
                  packages.find((p) => p.quantity === addonActive)?.priceMonthly ?? '?'
                }/mesec
              </span>
              <button
                type="button"
                onClick={onCancel}
                disabled={canceling || disabled}
                className="text-xs font-medium text-red-500 transition-colors hover:text-red-700 disabled:opacity-50"
              >
                {canceling ? 'Prekličujem...' : 'Prekliči dodatek'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Package selector */}
      <div className="border-t border-gray-100 p-5 pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Dodatna kvota</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {packages.map((pkg) => {
            const isSelected = selectedPackage === pkg.key;
            const isActive = pkg.key === activePackageKey;
            const isEmphasized = isSelected || isActive;
            return (
              <button
                key={pkg.key}
                type="button"
                disabled={disabled}
                onClick={() => onSelectPackage(pkg.key)}
                className={`group relative min-h-[132px] rounded-[18px] p-[1.5px] text-left transition-all sm:aspect-[1.08/1] disabled:cursor-not-allowed disabled:opacity-40 ${
                  isEmphasized
                    ? `bg-gradient-to-r ${BRAND_GRADIENT} shadow-[0_12px_28px_rgba(109,94,247,0.16)]`
                    : `bg-gradient-to-r ${BRAND_GRADIENT} shadow-[0_8px_20px_rgba(15,23,42,0.04)] hover:shadow-[0_12px_26px_rgba(109,94,247,0.12)]`
                }`}
              >
                <span className="flex h-full min-h-[129px] flex-col justify-between rounded-[16px] bg-white px-4 py-3.5 transition-colors group-hover:bg-gray-50 sm:min-h-0">
                  <span>
                    <span className={`block text-2xl font-bold tracking-tight tabular-nums ${isEmphasized ? BRAND_TEXT_GRADIENT : 'text-gray-950'}`}>
                      +{formatCount(pkg.quantity)}
                    </span>
                    <span className="mt-1 block text-xs font-medium text-gray-500">{unitLabel}</span>
                  </span>
                  <span className={`flex items-end justify-between gap-2 rounded-xl px-2.5 py-2 ${
                    isEmphasized
                      ? 'bg-gradient-to-r from-violet-50 via-blue-50 to-cyan-50'
                      : 'bg-gradient-to-r from-violet-50/70 via-blue-50/70 to-cyan-50/70'
                  }`}>
                    <span className="text-sm font-semibold text-gray-950">€{pkg.priceMonthly}</span>
                    <span className="text-[11px] font-medium text-gray-400">/mesec</span>
                  </span>
                </span>
                {pkg.badge && !isActive && (
                  <span className="absolute -right-1.5 -top-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-semibold leading-tight text-white shadow-sm">
                    {pkg.badge}
                  </span>
                )}
                {isActive && (
                  <span className={`absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r ${BRAND_GRADIENT} shadow-sm`}>
                    <Check className="h-3 w-3 text-white" weight="bold" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Purchase button */}
        {selectedPackage && (
          <button
            type="button"
            onClick={onPurchase}
            disabled={purchasing || activeQtyMatchesSelected || disabled}
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r ${BRAND_GRADIENT} px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(109,94,247,0.18)] transition-all hover:shadow-[0_16px_32px_rgba(109,94,247,0.24)] disabled:opacity-50`}
          >
            {purchasing ? (
              <>
                <SpinnerGap className="w-4 h-4 animate-spin" weight="bold" />
                Aktiviram...
              </>
            ) : activeQtyMatchesSelected ? (
              'Že aktiven'
            ) : (
              `Aktiviraj +${formatCount(selectedPkg?.quantity ?? 0)} ${unitLabel} za €${selectedPkg?.priceMonthly}/mesec`
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── EmployeesCard ────────────────────────────────────────────────────────────

type EmployeesCardProps = {
  includedInPlan: number;
  extraUsers: number;
  maxUsers: number;
  activeCount: number;
  extraEmployees: number;
  onExtraChange: (n: number) => void;
  stripeItemId: string | null;
  cancelAtPeriodEnd: boolean;
  onUpdate: () => void;
  onCancel: () => void;
  purchasing: boolean;
  canceling: boolean;
  disabled: boolean;
};

function EmployeesCard({
  includedInPlan,
  extraUsers,
  maxUsers,
  activeCount,
  extraEmployees,
  onExtraChange,
  stripeItemId,
  cancelAtPeriodEnd,
  onUpdate,
  onCancel,
  purchasing,
  canceling,
  disabled,
}: EmployeesCardProps) {
  const noChange = extraEmployees === extraUsers;
  const projectedMax = includedInPlan + extraEmployees;
  const overQuota = activeCount > projectedMax;
  const sliderPercent = (extraEmployees / 20) * 100;

  return (
    <div className="overflow-hidden rounded-[22px] border border-gray-100 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.04)]">
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-tight text-gray-950">Zaposleni</h3>
            <p className="mt-0.5 text-xs text-gray-500">Razširite število aktivnih uporabnikov v ekipi.</p>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700">
            {activeCount} / {maxUsers}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">V paketu</p>
            <p className="mt-1 text-sm font-semibold text-gray-950 tabular-nums">{includedInPlan}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Dodatni</p>
            <p className={`mt-1 text-sm font-semibold tabular-nums ${extraEmployees > 0 ? BRAND_TEXT_GRADIENT : 'text-gray-950'}`}>
              {extraEmployees}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Skupaj</p>
            <p className="mt-1 text-sm font-semibold text-gray-950 tabular-nums">{projectedMax}</p>
          </div>
        </div>
      </div>

      {/* Active addon */}
      {stripeItemId && (
        <div className="mx-5 mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-3">
          {cancelAtPeriodEnd ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
              <Warning className="w-3 h-3" weight="bold" />
              Preklic ob koncu obdobja
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#6D5EF7]/10 px-2.5 py-1 text-xs font-semibold text-[#6D5EF7]">
                <Check className="w-3 h-3" weight="bold" />
                +{extraUsers} dodatnih zaposlenih | €{extraUsers * 6}/mesec
              </span>
              <button
                type="button"
                onClick={onCancel}
                disabled={canceling || disabled}
                className="text-xs font-medium text-red-500 transition-colors hover:text-red-700 disabled:opacity-50"
              >
                {canceling ? 'Prekličujem...' : 'Prekliči dodatek'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Slider */}
      <div className="border-t border-gray-100 p-5 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Dodatni zaposleni</p>
          <span className={`text-lg font-bold tabular-nums ${BRAND_TEXT_GRADIENT}`}>{extraEmployees}</span>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <input
            type="range"
            min={0}
            max={20}
            step={1}
            value={extraEmployees}
            onChange={(e) => onExtraChange(Number(e.target.value))}
            disabled={disabled}
            className={RANGE_INPUT_CLASS}
            style={{
              accentColor: '#6D5EF7',
              background: `linear-gradient(to right, #6D5EF7 0%, #2F80ED ${sliderPercent / 2}%, #2AD4C5 ${sliderPercent}%, #e5e7eb ${sliderPercent}%, #e5e7eb 100%)`,
            }}
          />
          <div className="mt-2 flex items-center justify-between text-[10px] font-medium text-gray-400">
            <span>0</span>
            <span>20</span>
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          Skupaj: <span className="font-medium text-gray-700">{projectedMax} zaposlenih</span>
          {' '}(v paketu {includedInPlan} + dodatnih {extraEmployees})
        </p>

        {extraEmployees > 0 && (
          <p className="mt-1 text-xs font-semibold text-[#6D5EF7]">
            €{extraEmployees * 6}/mesec za {extraEmployees} dodatnih zaposlenih
          </p>
        )}

        {extraEmployees === 0 && stripeItemId && !cancelAtPeriodEnd && (
          <p className="mt-1 text-xs text-amber-600">
            Odstranitev dodatkov: ob potrditvi bo dodatek preklican.
          </p>
        )}

        {/* Over-quota warning */}
        {overQuota && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
            <Warning className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" weight="bold" />
            <p className="text-xs text-amber-700">
              <span className="font-semibold">Pozor:</span> Imate {activeCount - projectedMax} zaposlenih nad kvoto. Ob zmanjšanju bodo označeni kot neaktivni. Sami izberite, katere obdržite.
            </p>
          </div>
        )}

        {/* Update button */}
        <button
          type="button"
          onClick={onUpdate}
          disabled={noChange || disabled || purchasing}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-950 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
        >
          {purchasing ? (
            <>
              <SpinnerGap className="w-4 h-4 animate-spin" weight="bold" />
              Posodabljam...
            </>
          ) : (
            'Posodobi zaposlene'
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AddoniPage() {
  const { companyUuid } = useCompany();

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [smsUsage, setSmsUsage] = useState<UsageData | null>(null);
  const [emailUsage, setEmailUsage] = useState<UsageData | null>(null);
  const [employeeLimits, setEmployeeLimits] = useState<EmployeeLimitsData | null>(null);
  const [activeEmployeeCount, setActiveEmployeeCount] = useState(0);

  const [selectedSmsPackage, setSelectedSmsPackage] = useState<string | null>(null);
  const [selectedEmailPackage, setSelectedEmailPackage] = useState<string | null>(null);
  const [extraEmployees, setExtraEmployees] = useState(0);

  const [purchasingActions, setPurchasingActions] = useState<Set<string>>(new Set());

  const startAction = useCallback((key: string) => {
    setPurchasingActions((prev) => new Set(prev).add(key));
  }, []);
  const endAction = useCallback((key: string) => {
    setPurchasingActions((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  const fetchData = useCallback(async () => {
    if (!companyUuid) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/addons/status?company_id=${companyUuid}`);
      const data = await res.json();
      setSubscription(data.subscription);
      setSmsUsage(data.smsUsage);
      setEmailUsage(data.emailUsage);
      setEmployeeLimits(data.employeeLimits);
      setActiveEmployeeCount(data.activeEmployeeCount ?? 0);
      setExtraEmployees(data.employeeLimits?.extra_users ?? 0);
    } catch {
      showToast('Napaka pri nalaganju podatkov', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyUuid, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalSmsQuota =
    subscription?.sms_quota_override ??
    ((subscription?.plan?.sms_quota_monthly ?? 0) + (subscription?.sms_addon_monthly ?? 0));
  const totalEmailQuota =
    subscription?.email_quota_override ??
    ((subscription?.plan?.email_quota_monthly ?? 0) + (subscription?.email_addon_monthly ?? 0));
  const smsUsed = smsUsage?.sent_count ?? 0;
  const emailUsed = emailUsage?.sent_count ?? 0;
  const smsPercent = totalSmsQuota > 0 ? Math.min((smsUsed / totalSmsQuota) * 100, 100) : 0;
  const emailPercent = totalEmailQuota > 0 ? Math.min((emailUsed / totalEmailQuota) * 100, 100) : 0;
  const includedEmployees = subscription?.plan?.max_employees ?? 1;
  const maxEmployees = includedEmployees + (employeeLimits?.extra_users ?? 0);
  const hasStripeSubscription = !!subscription?.provider_subscription_id;

  const handlePurchase = async (
    addonType: 'sms' | 'email' | 'employees',
    packageKey?: string,
    quantity?: number
  ) => {
    if (!hasStripeSubscription) {
      showToast('Za nakup dodatkov potrebujete aktivno naročnino s plačilnim metodom', 'error');
      return;
    }
    startAction(addonType);
    try {
      const res = await fetch('/api/addons/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyUuid, addon_type: addonType, package_key: packageKey, quantity }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? 'Napaka pri nakupu');
      showToast('Addon uspešno aktiviran! Spremembe bodo vidne v trenutku.');
      setSelectedSmsPackage(null);
      setSelectedEmailPackage(null);
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) ?? 'Napaka pri nakupu', 'error');
    } finally {
      endAction(addonType);
    }
    // Refetch outside the purchase try/catch so a transient refetch failure
    // doesn't overwrite the purchase success toast with an error.
    await fetchData();
  };

  const handleCancel = async (addonType: 'sms' | 'email' | 'employees') => {
    const key = `cancel-${addonType}`;
    startAction(key);
    try {
      const res = await fetch('/api/addons/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyUuid, addon_type: addonType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Napaka pri preklicu');
      showToast('Addon bo preklican ob koncu obračunskega obdobja');
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) ?? 'Napaka pri preklicu', 'error');
    } finally {
      endAction(key);
    }
    // Refetch outside the cancel try/catch so a transient refetch failure
    // doesn't overwrite the cancel success toast with an error.
    await fetchData();
  };

  return (
    <div>
      <Link
        href="/nastavitve"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-4"
      >
        <CaretLeft className="w-3.5 h-3.5" weight="regular" />
        Nastavitve
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dodatki in kvote</h1>
        <p className="text-sm text-gray-500 mt-1">Upravljajte SMS, e-pošto in dodatne zaposlene.</p>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <div className="space-y-4">
          {/* Current plan */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <CurrentPlanCard subscription={subscription} />
          </motion.div>

          {/* No Stripe warning */}
          {!hasStripeSubscription && subscription && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.05 }}
              className="p-4 rounded-xl bg-amber-50 border border-amber-200"
            >
              <div className="flex items-start gap-2">
                <Warning className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" weight="bold" />
                <p className="text-sm text-amber-800">
                  Vaša naročnina ni upravljana prek Stripe — nakup addonov ni možen. Kontaktirajte podporo.
                </p>
              </div>
            </motion.div>
          )}

          {/* SMS */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
          >
            <QuotaCard
              type="sms"
              title="SMS sporočila"
              includedInPlan={subscription?.plan?.sms_quota_monthly ?? 0}
              addonActive={subscription?.sms_addon_monthly ?? 0}
              addonStripeItemId={subscription?.sms_addon_stripe_item_id ?? null}
              addonCancelAtPeriodEnd={subscription?.sms_addon_cancel_at_period_end ?? false}
              used={smsUsed}
              total={totalSmsQuota}
              usagePercent={smsPercent}
              packages={SMS_PACKAGES_LIST}
              selectedPackage={selectedSmsPackage}
              onSelectPackage={setSelectedSmsPackage}
              onPurchase={() => selectedSmsPackage && handlePurchase('sms', selectedSmsPackage)}
              onCancel={() => handleCancel('sms')}
              purchasing={purchasingActions.has('sms')}
              canceling={purchasingActions.has('cancel-sms')}
              disabled={!hasStripeSubscription}
              periodEnd={smsUsage?.period_end}
            />
          </motion.div>

          {/* Email */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.15 }}
          >
            <QuotaCard
              type="email"
              title="E-pošta"
              includedInPlan={subscription?.plan?.email_quota_monthly ?? 0}
              addonActive={subscription?.email_addon_monthly ?? 0}
              addonStripeItemId={subscription?.email_addon_stripe_item_id ?? null}
              addonCancelAtPeriodEnd={subscription?.email_addon_cancel_at_period_end ?? false}
              used={emailUsed}
              total={totalEmailQuota}
              usagePercent={emailPercent}
              packages={EMAIL_PACKAGES_LIST}
              selectedPackage={selectedEmailPackage}
              onSelectPackage={setSelectedEmailPackage}
              onPurchase={() => selectedEmailPackage && handlePurchase('email', selectedEmailPackage)}
              onCancel={() => handleCancel('email')}
              purchasing={purchasingActions.has('email')}
              canceling={purchasingActions.has('cancel-email')}
              disabled={!hasStripeSubscription}
              periodEnd={emailUsage?.period_end}
            />
          </motion.div>

          {/* Employees */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.2 }}
          >
            <EmployeesCard
              includedInPlan={includedEmployees}
              extraUsers={employeeLimits?.extra_users ?? 0}
              maxUsers={maxEmployees}
              activeCount={activeEmployeeCount}
              extraEmployees={extraEmployees}
              onExtraChange={setExtraEmployees}
              stripeItemId={employeeLimits?.stripe_subscription_item_id ?? null}
              cancelAtPeriodEnd={employeeLimits?.cancel_at_period_end ?? false}
              onUpdate={() => handlePurchase('employees', undefined, extraEmployees)}
              onCancel={() => handleCancel('employees')}
              purchasing={purchasingActions.has('employees')}
              canceling={purchasingActions.has('cancel-employees')}
              disabled={!hasStripeSubscription}
            />
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
