'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import {
  CaretLeft,
  ChatCircleText,
  EnvelopeSimple,
  UsersThree,
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
  { key: 'sms-50',   quantity: 50,   priceMonthly: 6  },
  { key: 'sms-100',  quantity: 100,  priceMonthly: 11 },
  { key: 'sms-200',  quantity: 200,  priceMonthly: 20 },
  { key: 'sms-500',  quantity: 500,  priceMonthly: 45 },
  { key: 'sms-1000', quantity: 1000, priceMonthly: 80 },
];

const EMAIL_PACKAGES_LIST = [
  { key: 'email-500',  quantity: 500,  priceMonthly: 4  },
  { key: 'email-1000', quantity: 1000, priceMonthly: 7  },
  { key: 'email-2500', quantity: 2500, priceMonthly: 15 },
  { key: 'email-5000', quantity: 5000, priceMonthly: 25 },
];

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
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#6D5EF7] via-[#2F80ED] to-[#2AD4C5] text-white">
        <p className="text-sm opacity-80">Brez aktivne naročnine</p>
        <p className="text-lg font-semibold mt-1">—</p>
      </div>
    );
  }

  const plan = subscription.plan;
  const priceEur = plan.price_monthly_cents / 100;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('sl-SI', { day: 'numeric', month: 'numeric', year: 'numeric' });

  return (
    <div className="rounded-2xl p-6 bg-gradient-to-r from-[#6D5EF7] via-[#2F80ED] to-[#2AD4C5] text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-white/20">
            {plan.code}
          </span>
          <h2 className="text-2xl font-bold mt-2 tracking-tight">{plan.name}</h2>
          <p className="text-sm opacity-80 mt-0.5">{priceEur.toFixed(0)}€ / mesec</p>
        </div>
      </div>
      <p className="text-xs opacity-70 mt-4">
        Obračunsko obdobje: {fmtDate(subscription.current_period_start)} – {fmtDate(subscription.current_period_end)}
      </p>
    </div>
  );
}

// ─── QuotaCard ────────────────────────────────────────────────────────────────

type QuotaCardProps = {
  type: 'sms' | 'email';
  icon: React.ReactNode;
  title: string;
  includedInPlan: number;
  addonActive: number;
  addonStripeItemId: string | null;
  addonCancelAtPeriodEnd: boolean;
  used: number;
  total: number;
  usagePercent: number;
  packages: { key: string; quantity: number; priceMonthly: number }[];
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
  icon,
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
      : 'bg-gradient-to-r from-[#6D5EF7] via-[#2F80ED] to-[#2AD4C5]';

  const selectedPkg = packages.find((p) => p.key === selectedPackage);
  const activeQtyMatchesSelected =
    selectedPackage !== null && addonActive > 0 &&
    packages.find((p) => p.key === selectedPackage)?.quantity === addonActive;

  const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString('sl-SI', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '—';

  const activePackageKey = addonActive > 0
    ? packages.find((p) => p.quantity === addonActive)?.key ?? null
    : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-gray-400">{icon}</span>
          <span className="text-sm font-semibold text-gray-900">{title}</span>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gray-100 text-xs font-medium text-gray-700 tabular-nums">
          {used} / {total} {type === 'sms' ? 'SMS' : 'email'}
        </span>
      </div>

      {/* Breakdown */}
      <p className="text-xs text-gray-500 mb-3">
        Vključeno v paketu: <span className="font-medium text-gray-700">{includedInPlan}</span>
        {addonActive > 0 && (
          <> + <span className="font-medium text-[#6D5EF7]">+{addonActive} iz addon-a</span></>
        )}
      </p>

      {/* Progress bar */}
      <div className="mb-1">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>Porabljeno {used} od {total}</span>
        <span>Ostalo: {Math.max(total - used, 0)}</span>
      </div>
      {periodEnd && (
        <p className="text-xs text-gray-400 mb-4">Obdobje se obnovi: {fmtDate(periodEnd)}</p>
      )}

      {/* Active addon */}
      {addonStripeItemId && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {addonCancelAtPeriodEnd ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
              <Warning className="w-3 h-3" weight="bold" />
              Preklic ob koncu obdobja
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#6D5EF7]/10 text-[#6D5EF7] text-xs font-semibold">
                <Check className="w-3 h-3" weight="bold" />
                Aktiven addon: +{addonActive}/{type === 'sms' ? 'mesec SMS' : 'mesec email'} | €{
                  packages.find((p) => p.quantity === addonActive)?.priceMonthly ?? '?'
                }/mesec
              </span>
              <button
                type="button"
                onClick={onCancel}
                disabled={canceling || disabled}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
              >
                {canceling ? 'Prekličujem...' : 'Prekliči addon'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Package selector */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-700 mb-2">Izberite dodatno kvoto:</p>
        <div className="flex flex-wrap gap-2">
          {packages.map((pkg) => {
            const isSelected = selectedPackage === pkg.key;
            const isActive = pkg.key === activePackageKey;
            return (
              <button
                key={pkg.key}
                type="button"
                disabled={disabled}
                onClick={() => onSelectPackage(pkg.key)}
                className={`relative flex flex-col items-center px-3 py-2 rounded-xl border text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  isSelected
                    ? 'border-[#6D5EF7] bg-[#6D5EF7]/5 text-[#6D5EF7]'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className="font-semibold">+{pkg.quantity}</span>
                <span className="text-[10px] opacity-70">€{pkg.priceMonthly}/mes</span>
                {isActive && (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[#6D5EF7] flex items-center justify-center">
                    <Check className="w-2 h-2 text-white" weight="bold" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Purchase button */}
      {selectedPackage && (
        <button
          type="button"
          onClick={onPurchase}
          disabled={purchasing || activeQtyMatchesSelected || disabled}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-[#6D5EF7] via-[#2F80ED] to-[#2AD4C5] text-white disabled:opacity-50 transition-opacity"
        >
          {purchasing ? (
            <>
              <SpinnerGap className="w-4 h-4 animate-spin" weight="bold" />
              Aktiviram...
            </>
          ) : activeQtyMatchesSelected ? (
            'Že aktiven'
          ) : (
            `Aktiviraj +${selectedPkg?.quantity} ${type === 'sms' ? 'SMS' : 'email'} za €${selectedPkg?.priceMonthly}/mesec`
          )}
        </button>
      )}
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

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <UsersThree className="w-4 h-4 text-gray-400" weight="regular" />
          <span className="text-sm font-semibold text-gray-900">Zaposleni</span>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gray-100 text-xs font-medium text-gray-700">
          {activeCount} / {maxUsers} aktivnih
        </span>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Vključeno v paketu: <span className="font-medium text-gray-700">{includedInPlan} zaposlenih</span>
      </p>

      {/* Active addon */}
      {stripeItemId && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {cancelAtPeriodEnd ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
              <Warning className="w-3 h-3" weight="bold" />
              Preklic ob koncu obdobja
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#6D5EF7]/10 text-[#6D5EF7] text-xs font-semibold">
                <Check className="w-3 h-3" weight="bold" />
                +{extraUsers} dodatnih zaposlenih | €{extraUsers * 6}/mesec
              </span>
              <button
                type="button"
                onClick={onCancel}
                disabled={canceling || disabled}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
              >
                {canceling ? 'Prekličujem...' : 'Prekliči addon'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Slider */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-700">Dodatni zaposleni:</p>
          <span className="text-xs font-semibold text-[#6D5EF7]">{extraEmployees}</span>
        </div>
        <input
          type="range"
          min={0}
          max={20}
          step={1}
          value={extraEmployees}
          onChange={(e) => onExtraChange(Number(e.target.value))}
          disabled={disabled}
          className="w-full h-2 rounded-full appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: `linear-gradient(to right, #6D5EF7 0%, #6D5EF7 ${extraEmployees * 5}%, #e5e7eb ${extraEmployees * 5}%, #e5e7eb 100%)`,
          }}
        />
        <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
          <span>0</span>
          <span>20</span>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Skupaj: <span className="font-medium text-gray-700">{projectedMax} zaposlenih</span>
          {' '}(vključenih {includedInPlan} + dodatnih {extraEmployees})
        </p>

        {extraEmployees > 0 && (
          <p className="text-xs font-medium text-[#6D5EF7] mt-1">
            €{extraEmployees * 6}/mesec za {extraEmployees} dodatnih zaposlenih
          </p>
        )}

        {extraEmployees === 0 && stripeItemId && !cancelAtPeriodEnd && (
          <p className="text-xs text-amber-600 mt-1">
            Odstranitev addonov — ob potrditvi bo addon preklican
          </p>
        )}
      </div>

      {/* Over-quota warning */}
      {overQuota && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <Warning className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" weight="bold" />
          <p className="text-xs text-amber-700">
            <span className="font-semibold">Pozor:</span> Imate {activeCount - projectedMax} zaposlenih nad kvoto. Ob zmanjšanju bodo označeni kot neaktivni. Sami izberite katere obdržite.
          </p>
        </div>
      )}

      {/* Update button */}
      <button
        type="button"
        onClick={onUpdate}
        disabled={noChange || disabled || purchasing}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-900 text-white disabled:opacity-40 hover:bg-gray-800 transition-colors"
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

  const [purchasing, setPurchasing] = useState<string | null>(null);

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
    setPurchasing(addonType);
    try {
      const res = await fetch('/api/addons/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyUuid, addon_type: addonType, package_key: packageKey, quantity }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? 'Napaka pri nakupu');
      showToast('Addon uspešno aktiviran! Spremembe bodo vidne v trenutku.');
      await fetchData();
      setSelectedSmsPackage(null);
      setSelectedEmailPackage(null);
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) ?? 'Napaka pri nakupu', 'error');
    } finally {
      setPurchasing(null);
    }
  };

  const handleCancel = async (addonType: 'sms' | 'email' | 'employees') => {
    setPurchasing(`cancel-${addonType}`);
    try {
      const res = await fetch('/api/addons/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyUuid, addon_type: addonType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Napaka pri preklicu');
      showToast('Addon bo preklican ob koncu obračunskega obdobja');
      await fetchData();
    } catch (e: unknown) {
      showToast((e instanceof Error ? e.message : null) ?? 'Napaka pri preklicu', 'error');
    } finally {
      setPurchasing(null);
    }
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
        <p className="text-sm text-gray-500 mt-1">Upravljajte SMS, e-pošta in zaposleni dodatke</p>
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
              icon={<ChatCircleText className="w-4 h-4" weight="regular" />}
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
              purchasing={purchasing === 'sms'}
              canceling={purchasing === 'cancel-sms'}
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
              icon={<EnvelopeSimple className="w-4 h-4" weight="regular" />}
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
              purchasing={purchasing === 'email'}
              canceling={purchasing === 'cancel-email'}
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
              purchasing={purchasing === 'employees'}
              canceling={purchasing === 'cancel-employees'}
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
