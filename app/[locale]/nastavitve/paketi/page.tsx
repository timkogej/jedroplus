'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  CaretLeft,
  ChatCircleText,
  EnvelopeSimple,
  UsersThree,
  AddressBook,
  CalendarBlank,
  Check,
  X,
  CreditCard,
  SpinnerGap,
  Warning,
} from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';
import { supabase } from '@/lib/supabaseClient';
import { getCustomerPortal, startCheckout } from '@/lib/api/billingClient';
import { Input } from '@/components/settings';

// ─── Plan definitions ───────────────────────────────────────────────────────

type BillingPeriod = 'monthly' | 'annual';

interface PlanPrice {
  monthly: number;
  annual: number;
}

interface PlanDef {
  id: string;
  name: string;
  price: PlanPrice | null;
  recommended?: boolean;
}

const PLANS: PlanDef[] = [
  { id: 'JEDRO_PLUS',  name: 'Jedro Plus',  price: { monthly: 19, annual: 15 } },
  { id: 'JEDRO_PRO',   name: 'Jedro Pro',   price: { monthly: 39, annual: 31 }, recommended: true },
  { id: 'ENTERPRISE',  name: 'Enterprise',  price: null },
];

function normalizePlanId(code: string): string {
  const c = code.toUpperCase().replace(/[\s-]+/g, '_');
  if (c.includes('ENTERPRISE')) return 'ENTERPRISE';
  if (c.includes('PRO')) return 'JEDRO_PRO';
  if (c.includes('PLUS')) return 'JEDRO_PLUS';
  return c;
}

function planKey(id: string): 'jedroPlus' | 'jedroPro' | 'enterprise' {
  const map: Record<string, 'jedroPlus' | 'jedroPro' | 'enterprise'> = {
    JEDRO_PLUS:  'jedroPlus',
    JEDRO_PRO:   'jedroPro',
    ENTERPRISE:  'enterprise',
  };
  return map[id] || 'jedroPlus';
}

// ─── Quota item ─────────────────────────────────────────────────────────────

interface QuotaItem {
  icon: React.ReactNode;
  label: string;
  used: number;
  total: number | null;
}

function QuotaRow({ item, loading }: { item: QuotaItem; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-1.5 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 bg-gray-100 rounded" />
          <div className="h-4 w-16 bg-gray-100 rounded" />
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full" />
      </div>
    );
  }

  const pct = item.total ? Math.round((item.used / item.total) * 100) : 0;
  const barColor =
    item.total === null
      ? 'bg-gray-200'
      : pct > 95
      ? 'bg-red-500'
      : pct > 80
      ? 'bg-amber-400'
      : 'bg-[#6D5EF7]';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-gray-400 flex-shrink-0">{item.icon}</span>
          <span className="text-sm font-medium text-gray-900 truncate">{item.label}</span>
        </div>
        <span className="text-sm tabular-nums whitespace-nowrap">
          <span className="text-gray-900 font-medium">{item.used}</span>
          <span className="text-gray-400"> / {item.total ?? '∞'}</span>
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: item.total === null ? '20%' : `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Plan card ───────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  isCurrent,
  loading,
  ctaLoading,
  disabled,
  billingPeriod,
  onCta,
  t,
}: {
  plan: PlanDef;
  isCurrent: boolean;
  loading: boolean;
  ctaLoading: boolean;
  disabled: boolean;
  billingPeriod: BillingPeriod;
  onCta: (plan: PlanDef) => void;
  t: ReturnType<typeof useTranslations<'billing'>>;
}) {
  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse space-y-3">
        <div className="h-5 w-24 bg-gray-100 rounded" />
        <div className="h-8 w-20 bg-gray-100 rounded" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-3 bg-gray-100 rounded w-full" />
          ))}
        </div>
        <div className="h-9 bg-gray-100 rounded-lg" />
      </div>
    );
  }

  const features = t.raw(`paketi.plans.${planKey(plan.id)}.features`) as string[];

  return (
    <div
      className={`bg-white border rounded-2xl p-5 flex flex-col ${
        isCurrent
          ? 'border-[#6D5EF7]/40 ring-1 ring-[#6D5EF7]/20'
          : 'border-gray-100'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-base font-semibold text-gray-900">{plan.name}</h3>
        {isCurrent ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-[#6D5EF7]/10 text-[#6D5EF7]">
            {t('paketi.currentBadge')}
          </span>
        ) : plan.recommended ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-700">
            {t('paketi.recommendedBadge')}
          </span>
        ) : null}
      </div>

      {/* Price */}
      {plan.price !== null ? (
        <div className="mb-5">
          <div className="flex items-baseline">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={billingPeriod}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="text-3xl font-bold gradient-text tracking-tight"
              >
                {plan.price[billingPeriod]}€
              </motion.span>
            </AnimatePresence>
            <span className="text-sm text-gray-500 ml-1">/mesec</span>
          </div>
          <p className="text-xs text-gray-400 mt-1 h-4">
            {billingPeriod === 'annual' ? t('paketi.billingPeriod.billedYearly') : ' '}
          </p>
        </div>
      ) : (
        <div className="mb-5">
          <span className="text-lg font-semibold text-gray-500">{t('paketi.customPricing')}</span>
          <p className="text-xs text-gray-400 mt-1 h-4">&nbsp;</p>
        </div>
      )}

      {/* Features */}
      <ul className="space-y-2 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
            <Check weight="bold" className="w-4 h-4 text-[#6D5EF7] flex-shrink-0 mt-0.5" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        type="button"
        onClick={() => onCta(plan)}
        disabled={isCurrent || ctaLoading || disabled}
        className={`mt-6 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isCurrent
            ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
            : ctaLoading
            ? 'bg-[#0a0a0a] text-white cursor-wait'
            : disabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : plan.id === 'ENTERPRISE'
            ? 'bg-white border border-gray-200 text-gray-900 hover:border-gray-300 hover:bg-gray-50'
            : 'bg-[#0a0a0a] text-white hover:bg-[#1f1f1f]'
        }`}
      >
        {ctaLoading
          ? (
            <span className="inline-flex items-center justify-center gap-2">
              <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
              {t('plans.ctaLoading')}
            </span>
          )
          : isCurrent
          ? t('paketi.planButtons.active')
          : plan.id === 'ENTERPRISE'
          ? t('paketi.planButtons.sendInquiry')
          : t('paketi.planButtons.upgrade')}
      </button>
    </div>
  );
}

// ─── Enterprise modal ────────────────────────────────────────────────────────

interface InquiryForm {
  name: string;
  email: string;
  phone: string;
  message: string;
}

function EnterpriseModal({
  open,
  onClose,
  defaultEmail,
  onSuccess,
  t,
}: {
  open: boolean;
  onClose: () => void;
  defaultEmail: string;
  onSuccess: () => void;
  t: ReturnType<typeof useTranslations<'billing'>>;
}) {
  const [form, setForm] = useState<InquiryForm>({
    name: '',
    email: defaultEmail,
    phone: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setForm((f) => ({ ...f, email: defaultEmail }));
  }, [open, defaultEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setSubmitting(true);
    try {
      await fetch('/api/enterprise-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      onSuccess();
      onClose();
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t('paketi.enterpriseModal.title')}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {t('paketi.enterpriseModal.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" weight="bold" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('paketi.enterpriseModal.fields.fullName')} <span className="text-red-500">*</span>
            </label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Jana Novak"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('paketi.enterpriseModal.fields.email')} <span className="text-red-500">*</span>
            </label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="jana@podjetje.si"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('paketi.enterpriseModal.fields.phone')}
            </label>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+386 40 123 456"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('paketi.enterpriseModal.fields.message')} <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              placeholder={t('paketi.enterpriseModal.fields.messagePlaceholder')}
              required
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-[#6D5EF7]/30 focus:border-[#6D5EF7]/40 placeholder:text-gray-400"
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-[#0a0a0a] text-white hover:bg-[#1f1f1f] disabled:opacity-60 transition-colors"
            >
              {submitting ? t('paketi.enterpriseModal.submittingButton') : t('paketi.enterpriseModal.submitButton')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              {t('paketi.enterpriseModal.cancelButton')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 32 }}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#0a0a0a] text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium"
    >
      <Check className="w-4 h-4 text-emerald-400" weight="bold" />
      {message}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PaketiPage() {
  const t = useTranslations('billing');
  const router = useRouter();
  const { companyId, companyUuid, planCode, subscription, smsQuota, isPlanActive } = useCompany();
  const { user } = useAuth();

  const [loadingQuotas, setLoadingQuotas] = useState(true);
  const [loadingPlans] = useState(false);

  const [emailUsed, setEmailUsed] = useState(0);
  const [emailTotal, setEmailTotal] = useState(0);
  const [smsTotal, setSmsTotal] = useState(0);
  const [teamMemberTotal, setTeamMemberTotal] = useState<number | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [clientCount, setClientCount] = useState(0);
  const [terminiCount, setTerminiCount] = useState(0);

  const [renewalDate, setRenewalDate] = useState('—');

  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('annual');

  const [enterpriseOpen, setEnterpriseOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const currentPlanId = normalizePlanId(planCode || 'FREE');

  const currentPlan = PLANS.find((p) => p.id === currentPlanId);
  const planLabel = currentPlan
    ? currentPlanId === 'ENTERPRISE'
      ? 'Enterprise'
      : currentPlanId === 'JEDRO_PRO'
      ? 'Pro'
      : 'Plus'
    : 'Free';
  const planFullName = currentPlan?.name ?? t('currentPlan.freeLabel');

  const planDescriptionKey = currentPlanId === 'JEDRO_PLUS'
    ? 'jedroPlus'
    : currentPlanId === 'JEDRO_PRO'
    ? 'jedroPro'
    : currentPlanId === 'ENTERPRISE'
    ? 'enterprise'
    : 'free';
  const planDescription = t(`paketi.planDescriptions.${planDescriptionKey}`);

  const canUpgrade = currentPlanId !== 'ENTERPRISE';

  useEffect(() => {
    if (subscription?.current_period_end) {
      setRenewalDate(
        new Date(subscription.current_period_end).toLocaleDateString('sl-SI', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      );
    }
  }, [subscription]);

  const fetchQuotas = useCallback(async () => {
    if (!companyUuid) return;
    setLoadingQuotas(true);
    try {
      const [emailRes, membersRes] = await Promise.all([
        supabaseReadOnly
          .from('company_email_usage')
          .select('sent_count, period_end')
          .eq('company_id', companyUuid)
          .maybeSingle(),
        supabaseReadOnly
          .from('company_members')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyUuid),
      ]);

      const emailSent = emailRes.data?.sent_count ?? 0;
      setEmailUsed(emailSent);

      const { data: subData } = await supabaseReadOnly
        .from('company_subscriptions')
        .select('plan_id, sms_addon_monthly, email_addon_monthly, sms_quota_override, email_quota_override')
        .eq('company_id', companyUuid)
        .maybeSingle();
      if (subData?.plan_id) {
        const { data: planData } = await supabaseReadOnly
          .from('plans')
          .select('email_quota_monthly, sms_quota_monthly, max_employees')
          .eq('id', subData.plan_id)
          .maybeSingle();
        setEmailTotal(
          subData.email_quota_override ??
            ((planData?.email_quota_monthly ?? 0) + (subData.email_addon_monthly ?? 0))
        );
        setSmsTotal(
          subData.sms_quota_override ??
            ((planData?.sms_quota_monthly ?? 0) + (subData.sms_addon_monthly ?? 0))
        );
        setTeamMemberTotal(planData?.max_employees ?? null);
      }

      setMemberCount(membersRes.count ?? 0);

      try {
        const { count: cCount } = await supabaseReadOnly
          .from('Stranke')
          .select('id', { count: 'exact', head: true });
        setClientCount(cCount ?? 0);
      } catch { /* table may not exist */ }

      try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const { count: tCount } = await supabaseReadOnly
          .from('Termini')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startOfMonth.toISOString());
        setTerminiCount(tCount ?? 0);
      } catch { /* table may not exist */ }
    } catch (err) {
      console.error('Error fetching quotas:', err);
    } finally {
      setLoadingQuotas(false);
    }
  }, [companyUuid]);

  useEffect(() => {
    fetchQuotas();
  }, [fetchQuotas]);

  const quotas: QuotaItem[] = [
    {
      icon: <ChatCircleText className="w-4 h-4" weight="regular" />,
      label: t('paketi.quotaLabels.sms'),
      used: smsQuota?.used_current_month ?? 0,
      total: (smsTotal || smsQuota?.quota_effective || 0) > 0
        ? (smsTotal || smsQuota?.quota_effective!)
        : null,
    },
    {
      icon: <EnvelopeSimple className="w-4 h-4" weight="regular" />,
      label: t('paketi.quotaLabels.email'),
      used: emailUsed,
      total: emailTotal || null,
    },
    {
      icon: <UsersThree className="w-4 h-4" weight="regular" />,
      label: t('paketi.quotaLabels.teamMembers'),
      used: memberCount,
      total: teamMemberTotal,
    },
    {
      icon: <AddressBook className="w-4 h-4" weight="regular" />,
      label: t('paketi.quotaLabels.clients'),
      used: clientCount,
      total: null,
    },
    {
      icon: <CalendarBlank className="w-4 h-4" weight="regular" />,
      label: t('paketi.quotaLabels.appointments'),
      used: terminiCount,
      total: null,
    },
  ];

  const handleManageSubscription = async () => {
    if (!companyUuid) {
      setPortalError(t('errors.companyNotSet'));
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.assign('/login');
      return;
    }
    setIsLoadingPortal(true);
    setPortalError(null);
    try {
      const result = await getCustomerPortal(companyUuid, '/nastavitve/paketi');
      const portalUrl = result.url || result.portal_url;
      if (result.ok && portalUrl && portalUrl.startsWith('http')) {
        window.location.assign(portalUrl);
      } else {
        setPortalError(t('errors.portalError'));
      }
    } catch {
      setPortalError(t('errors.serverError'));
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const handleCta = async (plan: PlanDef) => {
    if (plan.id === 'ENTERPRISE') {
      setEnterpriseOpen(true);
      return;
    }

    if (!companyId || !user?.email) {
      router.push('/login');
      return;
    }

    if (plan.id === currentPlanId && isPlanActive) return;

    setLoadingPlan(plan.id);
    setCheckoutError(null);

    try {
      let checkoutCompanyUuid = companyUuid;

      if (!checkoutCompanyUuid) {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('id')
          .eq('company_id', companyId)
          .single();

        if (companyError || !companyData?.id) {
          setCheckoutError(t('errors.companyDataError'));
          setLoadingPlan(null);
          return;
        }

        checkoutCompanyUuid = companyData.id;
      }

      if (!checkoutCompanyUuid) {
        setCheckoutError(t('errors.companyDataError'));
        setLoadingPlan(null);
        return;
      }

      const result = await startCheckout(
        checkoutCompanyUuid,
        plan.id,
        user.email,
        billingPeriod === 'annual' ? 'yearly' : 'monthly',
        { returnTo: '/nastavitve/paketi' }
      );

      if (result.ok && result.checkout_url) {
        const checkoutUrl = result.checkout_url;
        if (!checkoutUrl.startsWith('http')) {
          setCheckoutError(t('errors.invalidCheckoutUrl'));
          setLoadingPlan(null);
          return;
        }
        window.location.assign(checkoutUrl);
      } else {
        setCheckoutError(t('errors.checkoutError'));
        setLoadingPlan(null);
      }
    } catch {
      setCheckoutError(t('errors.serverError'));
      setLoadingPlan(null);
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
        <h1 className="text-xl font-semibold text-gray-900">{t('paketi.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('paketi.subtitle')}</p>
      </div>

      {/* Section 1 — Current plan */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-[#6D5EF7]/10 text-[#6D5EF7]">
              {planLabel}
            </span>
            <h2 className="text-xl font-semibold text-gray-900 mt-3 tracking-tight">
              {planFullName}
            </h2>
            <p className="text-sm text-gray-500 mt-1">{planDescription}</p>
          </div>
          {canUpgrade && (
            <a
              href="#razpolozljivi-paketi"
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors flex-shrink-0"
            >
              {t('paketi.upgradeButton')}
            </a>
          )}
        </div>
        <div className="border-t border-gray-100 mt-5 pt-4 flex items-center justify-between">
          <span className="text-xs text-gray-500">{t('paketi.renewalLabel')}</span>
          <span className="text-xs font-medium text-gray-700">{renewalDate}</span>
        </div>

        {currentPlanId !== 'FREE' && (
          <div className="border-t border-gray-100 mt-4 pt-4">
            <button
              type="button"
              onClick={handleManageSubscription}
              disabled={isLoadingPortal}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0a0a0a] text-white rounded-lg text-sm font-medium hover:bg-[#1f1f1f] disabled:opacity-50 transition-colors"
            >
              {isLoadingPortal ? (
                <>
                  <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                  {t('portal.opening')}
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" weight="bold" />
                  {t('portal.button')}
                </>
              )}
            </button>
            {portalError && (
              <p className="mt-2 text-xs text-red-500">{portalError}</p>
            )}
            <p className="mt-2 text-xs text-gray-400">{t('portal.note')}</p>
          </div>
        )}
      </div>

      {/* Section 2 — User limit banner */}
      {/* (maxUsers banner rendered by parent if needed) */}

      {/* Section 3 — Usage this month */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          {t('paketi.usageTitle')}
        </p>
        <div className="space-y-5">
          {quotas.map((q, i) => (
            <QuotaRow key={i} item={q} loading={loadingQuotas} />
          ))}
        </div>
      </div>

      {/* Section 4 — Available plans */}
      <div id="razpolozljivi-paketi" className="mb-5 scroll-mt-20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {t('paketi.availablePlans')}
          </p>
          <div className="inline-flex border border-gray-200 rounded-lg overflow-hidden bg-white self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setBillingPeriod('monthly')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                billingPeriod === 'monthly'
                  ? 'bg-[#0a0a0a] text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t('paketi.billingPeriod.monthly')}
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod('annual')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
                billingPeriod === 'annual'
                  ? 'bg-[#0a0a0a] text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t('paketi.billingPeriod.yearly')}
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none ${
                  billingPeriod === 'annual'
                    ? 'bg-white/15 text-white'
                    : 'bg-[#6D5EF7]/10 text-[#6D5EF7]'
                }`}
              >
                −21%
              </span>
            </button>
          </div>
        </div>
        {checkoutError && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            <Warning className="h-4 w-4 flex-shrink-0 mt-0.5" weight="fill" />
            <span>{checkoutError}</span>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === currentPlanId}
              loading={loadingPlans}
              ctaLoading={loadingPlan === plan.id}
              disabled={loadingPlan !== null}
              billingPeriod={billingPeriod}
              onCta={handleCta}
              t={t}
            />
          ))}
        </div>
      </div>

      {/* Enterprise modal */}
      <AnimatePresence>
        {enterpriseOpen && (
          <EnterpriseModal
            open={enterpriseOpen}
            onClose={() => setEnterpriseOpen(false)}
            defaultEmail={user?.email ?? ''}
            onSuccess={() => setToast(t('paketi.inquiryToast'))}
            t={t}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <Toast message={toast} onClose={() => setToast(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
