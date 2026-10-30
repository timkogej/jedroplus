'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  CaretLeft,
  Check,
  X,
  SpinnerGap,
  Warning,
  ChatCircleText,
  EnvelopeSimple,
  UsersThree,
  Signature,
  Minus,
  Plus,
} from '@phosphor-icons/react';
import { useCompany } from '@/app/company-context';
import { fetchBillingStatus } from '@/hooks/useBillingUsage';
import { computeBillingUsage, FREE_TRIAL, type BillingUsage } from '@/lib/billing/usage';
import { useFormat } from '@/hooks/useFormat';
import {
  SMS_PACKAGES_LIST,
  EMAIL_PACKAGES_LIST,
  SEAT_PRICE_EUR,
  MAX_EXTRA_SEATS,
  SENDER_ID_PRICE_EUR,
  type QuotaPackage,
} from '@/lib/billing/addons';
import { AddonGroup, AddonRow, StatusChip, UsageMeter } from '@/components/addons/AddonRow';
import { SenderIdPanel, useSenderIdStanje } from '@/components/addons/SenderIdPanel';

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

const SUPPORT_EMAIL = 'info@jedroplus.com';

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
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg backdrop-blur ${
        type === 'error' ? 'bg-red-600' : 'bg-gray-900/95'
      }`}
    >
      {type === 'error'
        ? <X className="w-4 h-4 text-red-200" weight="bold" />
        : <Check className="w-4 h-4 text-emerald-400" weight="bold" />}
      {message}
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[72, 180, 72, 72].map((h, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-gray-100 bg-white" style={{ height: h }} />
      ))}
    </div>
  );
}

// ─── Plan summary ─────────────────────────────────────────────────────────────

function PlanSummary({ subscription, isFree }: { subscription: SubscriptionData | null; isFree: boolean }) {
  const t = useTranslations('billing.addons');
  const f = useFormat();

  if (!subscription || isFree) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t('currentPlan')}</p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-gray-900">
            {isFree ? t('freeTitle') : t('noSubscription')}
          </p>
          <p className="mt-1 max-w-prose text-[13px] leading-5 text-gray-500">
            {isFree ? t('freeBody', { sms: FREE_TRIAL.sms, email: FREE_TRIAL.email }) : t('noSubscriptionBody')}
          </p>
        </div>
        {isFree && (
          <Link
            href="/nastavitve/paketi#razpolozljivi-paketi"
            className="inline-flex rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
          >
            {t('freeCta')}
          </Link>
        )}
      </div>
    );
  }

  const plan = subscription.plan;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border border-gray-200 bg-white px-4 py-4 sm:px-5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t('currentPlan')}</p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-3 text-lg font-semibold tracking-tight text-gray-900">
          <span className="truncate">{plan.name}</span>
          <span className="tnum text-sm font-medium text-gray-500">
            {t('perMonth', { price: f.money(plan.price_monthly_cents / 100, { whole: true }) })}
          </span>
        </p>
      </div>
      {subscription.current_period_start && subscription.current_period_end && (
        <p className="tnum text-[13px] text-gray-500">
          {t('period', {
            start: f.dateShort(subscription.current_period_start),
            end: f.dateShort(subscription.current_period_end),
          })}
        </p>
      )}
    </div>
  );
}

// ─── Cancel button (two steps so a stray click can't drop an add-on) ──────────

function CancelButton({
  confirming,
  setConfirming,
  onCancel,
  canceling,
  disabled,
}: {
  confirming: boolean;
  setConfirming: (v: boolean) => void;
  onCancel: () => void;
  canceling: boolean;
  disabled: boolean;
}) {
  const t = useTranslations('billing.addons');
  if (canceling) return <span className="text-xs font-medium text-gray-500">{t('canceling')}</span>;
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={disabled}
        className="text-xs font-medium text-red-500 transition-colors hover:text-red-700 disabled:opacity-50"
      >
        {t('cancel')}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className="font-medium text-gray-700">{t('cancelConfirm')}</span>
      <button
        type="button"
        onClick={() => {
          setConfirming(false);
          onCancel();
        }}
        className="rounded-lg bg-red-600 px-2.5 py-1 font-medium text-white transition-colors hover:bg-red-700"
      >
        {t('cancel')}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="font-medium text-gray-500 hover:text-gray-800">
        {t('cancelKeep')}
      </button>
    </span>
  );
}

/** Shared "active add-on + cancel" strip shown inside an open row. */
function ActiveStrip({
  scheduled,
  label,
  onCancel,
  canceling,
  disabled,
}: {
  scheduled: boolean;
  label: string;
  onCancel: () => void;
  canceling: boolean;
  disabled: boolean;
}) {
  const t = useTranslations('billing.addons');
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-[10px] border border-gray-200 bg-white px-3 py-2.5">
      {scheduled ? (
        <StatusChip tone="amber">
          <Warning className="h-3 w-3" weight="bold" />
          {t('cancelScheduled')}
        </StatusChip>
      ) : (
        <>
          <StatusChip>
            <Check className="h-3 w-3" weight="bold" />
            {label}
          </StatusChip>
          <CancelButton
            confirming={confirming}
            setConfirming={setConfirming}
            onCancel={onCancel}
            canceling={canceling}
            disabled={disabled}
          />
        </>
      )}
    </div>
  );
}

// ─── Message packages (SMS / e-mail) ──────────────────────────────────────────

type QuotaRowProps = {
  type: 'sms' | 'email';
  icon: typeof ChatCircleText;
  open: boolean;
  onToggle: () => void;
  includedInPlan: number;
  /** Free plan: `includedInPlan` is the one-time trial, not a monthly amount. */
  freeTrial: boolean;
  addonActive: number;
  addonStripeItemId: string | null;
  addonCancelAtPeriodEnd: boolean;
  used: number;
  total: number;
  packages: QuotaPackage[];
  selectedPackage: string | null;
  onSelectPackage: (key: string) => void;
  onPurchase: () => void;
  onCancel: () => void;
  purchasing: boolean;
  canceling: boolean;
  disabled: boolean;
  periodEnd?: string;
};

function QuotaRow({
  type,
  icon,
  open,
  onToggle,
  includedInPlan,
  freeTrial,
  addonActive,
  addonStripeItemId,
  addonCancelAtPeriodEnd,
  used,
  total,
  packages,
  selectedPackage,
  onSelectPackage,
  onPurchase,
  onCancel,
  purchasing,
  canceling,
  disabled,
  periodEnd,
}: QuotaRowProps) {
  const t = useTranslations('billing.addons');
  const f = useFormat();

  const selectedPkg = packages.find((p) => p.key === selectedPackage);
  const activeQtyMatchesSelected =
    selectedPackage !== null && addonActive > 0 && selectedPkg?.quantity === addonActive;
  const activePackage = addonActive > 0 ? packages.find((p) => p.quantity === addonActive) ?? null : null;
  const unit = t(`${type}.unit`);

  const includedLine = freeTrial
    ? includedInPlan > 0
      ? t('freeTrialIncluded', { count: f.count(includedInPlan) })
      : t('freeLocked')
    : includedInPlan > 0
    ? t('includedInPlan', { count: f.count(includedInPlan) })
    : addonActive > 0
    ? t('fromAddonsOnly', { count: f.count(addonActive) })
    : t('includedNone');

  return (
    <AddonRow
      id={type}
      icon={icon}
      title={t(`${type}.title`)}
      subtitle={
        <>
          {includedLine}
          {addonActive > 0 && includedInPlan > 0 && (
            <span className="font-medium text-[#6D5EF7]">{t('fromAddons', { count: f.count(addonActive) })}</span>
          )}
        </>
      }
      aside={<UsageMeter used={used} total={total} label={`${f.count(used)} / ${f.count(total)}`} />}
      open={open}
      onToggle={onToggle}
    >
      {addonStripeItemId && (
        <ActiveStrip
          scheduled={addonCancelAtPeriodEnd}
          label={t('activeAddon', {
            count: f.count(addonActive),
            unit,
            price: activePackage ? f.money(activePackage.priceMonthly, { whole: true }) : '—',
          })}
          onCancel={onCancel}
          canceling={canceling}
          disabled={disabled}
        />
      )}

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t('extraQuota')}</p>
        {periodEnd && !freeTrial && <p className="text-xs text-gray-400">{t('renews', { date: f.dateShort(periodEnd) })}</p>}
        {freeTrial && includedInPlan > 0 && <p className="text-xs text-gray-500">{t('freeLocked')}</p>}
      </div>

      <div role="radiogroup" aria-label={t('extraQuota')} className="grid gap-2 sm:grid-cols-2">
        {packages.map((pkg) => {
          const isSelected = selectedPackage === pkg.key;
          const isActive = pkg.key === activePackage?.key;
          const emphasized = isSelected || isActive;
          return (
            <button
              key={pkg.key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onSelectPackage(pkg.key)}
              className={`flex items-center gap-3 rounded-[10px] border bg-white px-3.5 py-2.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40 sm:[&:last-child:nth-child(odd)]:col-span-2 ${
                emphasized ? 'border-[#7C78FA] ring-1 ring-[#7C78FA]/40' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  emphasized ? 'border-[#6D5EF7] bg-[#6D5EF7]' : 'border-gray-300'
                }`}
                aria-hidden="true"
              >
                {emphasized && <Check className="h-2.5 w-2.5 text-white" weight="bold" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="tnum text-sm font-semibold text-gray-900">+{f.count(pkg.quantity)}</span>{' '}
                <span className="text-[13px] text-gray-500">{unit}</span>
              </span>
              {pkg.badge && !isActive && (
                <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">{pkg.badge}</span>
              )}
              <span className="tnum shrink-0 text-sm font-semibold text-gray-900">
                {f.money(pkg.priceMonthly, { whole: true })}
                <span className="ml-1 text-[11px] font-medium text-gray-400">{t('month')}</span>
              </span>
            </button>
          );
        })}
      </div>

      {selectedPackage && (
        <>
          <button
            type="button"
            onClick={onPurchase}
            disabled={purchasing || activeQtyMatchesSelected || disabled}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50 sm:w-auto sm:min-w-[260px]"
          >
            {purchasing ? (
              <>
                <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                {t('activating')}
              </>
            ) : activeQtyMatchesSelected ? (
              t('alreadyActive')
            ) : (
              t('activate', {
                count: f.count(selectedPkg?.quantity ?? 0),
                unit,
                price: f.money(selectedPkg?.priceMonthly ?? 0, { whole: true }),
              })
            )}
          </button>
          {!activeQtyMatchesSelected && <p className="mt-2 text-xs leading-5 text-gray-500">{t('purchaseNote')}</p>}
        </>
      )}
    </AddonRow>
  );
}

// ─── App logins (team seats) ──────────────────────────────────────────────────

type SeatsRowProps = {
  open: boolean;
  onToggle: () => void;
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

function SeatsRow({
  open,
  onToggle,
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
}: SeatsRowProps) {
  const t = useTranslations('billing.addons.seats');
  const f = useFormat();
  const noChange = extraEmployees === extraUsers;
  const projectedMax = includedInPlan + extraEmployees;
  const overQuota = activeCount > projectedMax;
  const free = Math.max(maxUsers - activeCount, 0);
  const atLimit = activeCount >= maxUsers;

  return (
    <AddonRow
      id="prijave"
      icon={UsersThree}
      title={t('title')}
      subtitle={
        atLimit ? (
          <span className="font-medium text-amber-700">{t('full')}</span>
        ) : (
          <>{t('free', { free })}</>
        )
      }
      aside={<UsageMeter used={activeCount} total={maxUsers} label={`${activeCount} / ${maxUsers}`} />}
      open={open}
      onToggle={onToggle}
    >
      <p className="mb-4 max-w-prose text-[13px] leading-5 text-gray-500">{t('body')}</p>

      {stripeItemId && (
        <ActiveStrip
          scheduled={cancelAtPeriodEnd}
          label={t('activeAddon', { count: extraUsers, price: f.money(extraUsers * SEAT_PRICE_EUR, { whole: true }) })}
          onCancel={onCancel}
          canceling={canceling}
          disabled={disabled}
        />
      )}

      {!atLimit && !stripeItemId && extraEmployees === 0 && (
        <p className="mb-3 text-xs text-gray-500">{t('hint', { price: f.money(SEAT_PRICE_EUR, { whole: true }) })}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-gray-200 bg-white px-3.5 py-2.5">
        <span id="extra-seats-label" className="text-sm font-medium text-gray-700">
          {t('sliderLabel')}
        </span>
        <div className="flex items-center gap-1" role="group" aria-labelledby="extra-seats-label">
          <button
            type="button"
            onClick={() => onExtraChange(Math.max(0, extraEmployees - 1))}
            disabled={disabled || extraEmployees <= 0}
            aria-label={t('decrease')}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            <Minus size={14} weight="bold" />
          </button>
          <span className="tnum w-10 text-center text-base font-semibold text-gray-900" aria-live="polite">
            {extraEmployees}
          </span>
          <button
            type="button"
            onClick={() => onExtraChange(Math.min(MAX_EXTRA_SEATS, extraEmployees + 1))}
            disabled={disabled || extraEmployees >= MAX_EXTRA_SEATS}
            aria-label={t('increase')}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            <Plus size={14} weight="bold" />
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        {t('summary', { total: projectedMax, included: includedInPlan, extra: extraEmployees })}
      </p>

      {extraEmployees > 0 && (
        <p className="mt-1 text-xs font-semibold text-[#6D5EF7]">
          {t('cost', {
            price: f.money(extraEmployees * SEAT_PRICE_EUR, { whole: true }),
            count: extraEmployees,
            unit: f.money(SEAT_PRICE_EUR, { whole: true }),
          })}
        </p>
      )}

      {extraEmployees === 0 && stripeItemId && !cancelAtPeriodEnd && (
        <p className="mt-1 text-xs text-amber-600">{t('removeNote')}</p>
      )}

      {overQuota && (
        <div className="mt-4 flex items-start gap-2 rounded-[10px] bg-amber-50 p-3">
          <Warning className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" weight="regular" />
          <p className="text-xs text-amber-700">
            <span className="font-semibold">{t('overTitle')}</span> {t('over', { count: activeCount - projectedMax })}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onUpdate}
        disabled={noChange || disabled || purchasing}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40 sm:w-auto sm:min-w-[260px]"
      >
        {purchasing ? (
          <>
            <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
            {t('updating')}
          </>
        ) : (
          t('update')
        )}
      </button>
    </AddonRow>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type RowKey = 'sms' | 'email' | 'prijave' | 'sender';

export default function AddoniPage() {
  const { companyUuid } = useCompany();
  const t = useTranslations('billing.addons');
  const f = useFormat();

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [smsUsage, setSmsUsage] = useState<UsageData | null>(null);
  const [emailUsage, setEmailUsage] = useState<UsageData | null>(null);
  const [employeeLimits, setEmployeeLimits] = useState<EmployeeLimitsData | null>(null);
  const [activeEmployeeCount, setActiveEmployeeCount] = useState(0);

  const [selectedSmsPackage, setSelectedSmsPackage] = useState<string | null>(null);
  const [selectedEmailPackage, setSelectedEmailPackage] = useState<string | null>(null);
  const [extraEmployees, setExtraEmployees] = useState(0);

  const [openRow, setOpenRow] = useState<RowKey | null>(null);
  const toggleRow = (key: RowKey) => setOpenRow((prev) => (prev === key ? null : key));

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

  const sender = useSenderIdStanje();

  // Deep links such as /nastavitve/addoni#sender-id open the matching row.
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'sender-id') setOpenRow('sender');
    else if (hash === 'sms' || hash === 'email' || hash === 'prijave') setOpenRow(hash);
  }, []);

  const fetchData = useCallback(async () => {
    if (!companyUuid) return;
    setLoading(true);
    try {
      // force=true: always fresh here, and refreshes the shared cache that the
      // quota banner and Paketi read from.
      // The route returns the full rows; this page uses the richer local types.
      const data = (await fetchBillingStatus(companyUuid, true)) as unknown as {
        subscription: SubscriptionData | null;
        smsUsage: UsageData | null;
        emailUsage: UsageData | null;
        employeeLimits: EmployeeLimitsData | null;
        memberCount?: number;
      } | null;
      if (!data) throw new Error('status unavailable');
      setSubscription(data.subscription);
      setSmsUsage(data.smsUsage);
      setEmailUsage(data.emailUsage);
      setEmployeeLimits(data.employeeLimits);
      // Seats count people with a login, not calendar staff.
      setActiveEmployeeCount(data.memberCount ?? 0);
      setExtraEmployees(data.employeeLimits?.extra_users ?? 0);
    } catch {
      showToast(t('loadError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [companyUuid, showToast, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const billingUsage: BillingUsage = computeBillingUsage({ subscription, smsUsage, emailUsage, employeeLimits });
  const isFree = billingUsage.isFree;
  const totalSmsQuota = billingUsage.sms.total;
  const totalEmailQuota = billingUsage.email.total;
  const smsUsed = billingUsage.sms.used;
  const emailUsed = billingUsage.email.used;
  const includedEmployees = subscription?.plan?.max_employees ?? 1;
  const maxEmployees = includedEmployees + (employeeLimits?.extra_users ?? 0);
  const hasStripeSubscription = !!subscription?.provider_subscription_id;

  const handlePurchase = async (
    addonType: 'sms' | 'email' | 'employees',
    packageKey?: string,
    quantity?: number
  ) => {
    if (!hasStripeSubscription) {
      showToast(t('toast.noStripe'), 'error');
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
      if (!res.ok || !data.success) throw new Error(data.message ?? t('toast.purchaseError'));
      showToast(t('toast.purchased'));
      setSelectedSmsPackage(null);
      setSelectedEmailPackage(null);
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) || t('toast.purchaseError'), 'error');
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
      if (!res.ok) throw new Error(data.message ?? t('toast.cancelError'));
      showToast(t('toast.canceled'));
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) || t('toast.cancelError'), 'error');
    } finally {
      endAction(key);
    }
    // Refetch outside the cancel try/catch so a transient refetch failure
    // doesn't overwrite the cancel success toast with an error.
    await fetchData();
  };

  // Sender ID summary for the closed row.
  const senderStatus = sender.stanje?.status ?? 'ni_zaproseno';
  const senderSubtitle = !sender.stanje
    ? t('senderId.rowDefault', { price: f.money(SENDER_ID_PRICE_EUR, { whole: true }) })
    : !sender.stanje.moze_kupiti && !sender.stanje.dovoljen
    ? t('senderId.rowLocked')
    : sender.stanje.ime && senderStatus === 'odobreno'
    ? t('senderId.status.odobreno', { ime: sender.stanje.ime })
    : sender.stanje.ime && senderStatus === 'v_obdelavi'
    ? t('senderId.rowPending', { ime: sender.stanje.ime })
    : t('senderId.rowDefault', { price: f.money(SENDER_ID_PRICE_EUR, { whole: true }) });

  const smsActive = subscription?.sms_addon_monthly ?? 0;
  const emailActive = subscription?.email_addon_monthly ?? 0;

  return (
    <div>
      <Link
        href="/nastavitve"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-gray-600"
      >
        <CaretLeft className="h-3.5 w-3.5" weight="regular" />
        {t('back')}
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">{t('title')}</h1>
        <p className="mt-1 max-w-prose text-sm text-gray-500">{t('subtitle')}</p>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <PlanSummary subscription={subscription} isFree={isFree} />
          </motion.div>

          {!hasStripeSubscription && subscription && !isFree && (
            <div className="rounded-xl bg-amber-50 p-4">
              <div className="flex items-start gap-2">
                <Warning className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" weight="regular" />
                <p className="text-sm text-amber-800">{t('noStripe', { email: SUPPORT_EMAIL })}</p>
              </div>
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 }}
            className="space-y-6"
          >
            <AddonGroup label={t('sections.messages')}>
              <QuotaRow
                type="sms"
                icon={ChatCircleText}
                open={openRow === 'sms'}
                onToggle={() => toggleRow('sms')}
                includedInPlan={billingUsage.sms.included}
                freeTrial={isFree}
                addonActive={smsActive}
                addonStripeItemId={subscription?.sms_addon_stripe_item_id ?? null}
                addonCancelAtPeriodEnd={subscription?.sms_addon_cancel_at_period_end ?? false}
                used={smsUsed}
                total={totalSmsQuota}
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
              <QuotaRow
                type="email"
                icon={EnvelopeSimple}
                open={openRow === 'email'}
                onToggle={() => toggleRow('email')}
                includedInPlan={billingUsage.email.included}
                freeTrial={isFree}
                addonActive={emailActive}
                addonStripeItemId={subscription?.email_addon_stripe_item_id ?? null}
                addonCancelAtPeriodEnd={subscription?.email_addon_cancel_at_period_end ?? false}
                used={emailUsed}
                total={totalEmailQuota}
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
            </AddonGroup>

            <AddonGroup label={t('sections.team')}>
              <SeatsRow
                open={openRow === 'prijave'}
                onToggle={() => toggleRow('prijave')}
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
            </AddonGroup>

            <AddonGroup label={t('sections.sender')}>
              <AddonRow
                id="sender-id"
                icon={Signature}
                title={t('senderId.title')}
                subtitle={senderSubtitle}
                aside={
                  sender.stanje?.dodatek ? (
                    <StatusChip tone={senderStatus === 'odobreno' ? 'green' : 'violet'}>
                      <Check className="h-3 w-3" weight="bold" />
                      {senderStatus === 'odobreno' ? t('senderId.chipActive') : t('senderId.chipPending')}
                    </StatusChip>
                  ) : (
                    <span className="tnum text-sm font-semibold text-gray-900">
                      {f.money(SENDER_ID_PRICE_EUR, { whole: true })}
                      <span className="ml-1 text-[11px] font-medium text-gray-400">{t('month')}</span>
                    </span>
                  )
                }
                open={openRow === 'sender'}
                onToggle={() => toggleRow('sender')}
              >
                <SenderIdPanel
                  stanje={sender.stanje}
                  canPurchase={hasStripeSubscription}
                  onChanged={sender.reload}
                  onToast={showToast}
                />
              </AddonRow>
            </AddonGroup>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
}
