'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  CreditCard,
  SpinnerGap,
  CalendarBlank,
  Warning,
  ChatCircleText,
  EnvelopeSimple,
  X,
} from '@phosphor-icons/react';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { getCustomerPortal, startCheckout, getBillingStatus } from '@/lib/api/billingClient';
import { supabase } from '@/lib/supabaseClient';
import ProtectedLayout from '@/components/ProtectedLayout';
import { sendWebhook } from '@/components/utils/webhookUtils';

interface PlanData {
  id: string;
  code: string;
  name: string;
}

interface Plan {
  code: string;
  name: string;
  price: string;
  period: string;
  description: string;
  tagline: string;
  features: string[];
  popular?: boolean;
  isEnterprise?: boolean;
}

const PLANS: Plan[] = [
  {
    code: 'JEDRO_PLUS',
    name: 'Jedro Plus',
    price: '19 €',
    period: '/ mesec',
    description: 'Za podjetja, ki želijo urejen sistem in jasen pregled',
    tagline: 'Koledar, baze in opomniki, ki brez zapletov uredijo vsakdan.',
    features: [
      'Baza strank in terminov',
      'Baza storitev in osebja',
      'Personalizirani opomniki pred in po terminu',
      'Email pošiljanje',
      'Celotna analitika',
      'Spletno Naročanje',
      'Različni dizajni spletnega naročanja',
      'Asistent+',
    ],
  },
  {
    code: 'JEDRO_PRO',
    name: 'Jedro Pro',
    price: '39 €',
    period: '/ mesec',
    description: 'Za podjetja, ki želijo več zasedenosti in manj praznih terminov',
    tagline: 'Vključuje AI pomočnike, Lost Leads in SMS opomnike.',
    popular: true,
    features: [
      'Vse iz Jedro Plus',
      'Chatbot+',
      'Lost Leads sistem',
      'SMS pošiljanje',
      'Email pošiljanje',
      'Dodatni dizajni spletnega naročanja',
    ],
  },
  {
    code: 'JEDRO_PREMIUM',
    name: 'Jedro Premium',
    price: '99 €',
    period: '/ mesec',
    description: 'Za podjetja, ki želijo maksimalno avtomatizacijo',
    tagline: 'Celoten nabor AI funkcij za rast in komunikacijo.',
    features: [
      'Vse iz Jedro Pro',
      'Receptionist+',
      'SMS pošiljanje (višja kvota)',
      'Email pošiljanje (višja kvota)',
      'Premium dizajn spletnega naročanja',
      'Premium chatbot dizajn',
    ],
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    price: 'po dogovoru',
    period: '',
    description: 'Za podjetja s posebnimi zahtevami in prilagoditvami',
    tagline: 'Prilagoditve funkcij, AI in booking okolja po meri.',
    isEnterprise: true,
    features: [
      'Custom AI funkcije prilagojene podjetju',
      'Premium booking page',
      'Različni booking linki',
      'Dodatne zahteve po meri',
    ],
  },
];

interface EnterpriseFormData {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  companyName: string;
  employeeCount: string;
  requirements: string;
}

function EnterpriseModal({
  isOpen,
  onClose,
  companyId,
  userEmail,
}: {
  isOpen: boolean;
  onClose: () => void;
  companyId: string | null;
  userEmail: string;
}) {
  const [form, setForm] = useState<EnterpriseFormData>({
    contactName: '',
    contactEmail: userEmail,
    contactPhone: '',
    companyName: '',
    employeeCount: '',
    requirements: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSending(true);

    try {
      await sendWebhook({
        event: 'ENTERPRISE_PAKET',
        entity: 'billing',
        company_id: companyId,
        actor: userEmail || 'unknown',
        timestamp: new Date().toISOString(),
        data: {
          inquiry: {
            contact_name: form.contactName,
            contact_email: form.contactEmail,
            contact_phone: form.contactPhone,
            company_name: form.companyName,
            employee_count: form.employeeCount,
            requirements: form.requirements,
          },
        },
      });
      setSent(true);
    } catch (err) {
      console.error('Error sending enterprise inquiry:', err);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSent(false);
    setForm({ contactName: '', contactEmail: userEmail, contactPhone: '', companyName: '', employeeCount: '', requirements: '' });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Enterprise povpraševanje</h2>
                <p className="text-sm text-gray-500 mt-0.5">Pošljite nam vaše zahteve in se vam oglasimo</p>
              </div>
              <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" weight="bold" />
              </button>
            </div>

            {sent ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Povpraševanje poslano!</h3>
                <p className="text-gray-500 mb-6">Kontaktirali vas bomo v najkrajšem možnem času.</p>
                <button
                  onClick={handleClose}
                  className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
                >
                  Zapri
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ime in priimek *</label>
                    <input
                      type="text"
                      required
                      value={form.contactName}
                      onChange={(e) => setForm(f => ({ ...f, contactName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="Jan Novak"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={form.contactEmail}
                      onChange={(e) => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="jan@podjetje.si"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                    <input
                      type="tel"
                      value={form.contactPhone}
                      onChange={(e) => setForm(f => ({ ...f, contactPhone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="+386 40 123 456"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ime podjetja *</label>
                    <input
                      type="text"
                      required
                      value={form.companyName}
                      onChange={(e) => setForm(f => ({ ...f, companyName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="Podjetje d.o.o."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Število zaposlenih</label>
                  <input
                    type="text"
                    value={form.employeeCount}
                    onChange={(e) => setForm(f => ({ ...f, employeeCount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="npr. 10–50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vaše zahteve in potrebe *</label>
                  <textarea
                    required
                    rows={4}
                    value={form.requirements}
                    onChange={(e) => setForm(f => ({ ...f, requirements: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                    placeholder="Opišite vaše specifične potrebe, integracije, prilagoditve..."
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
                  >
                    Prekliči
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-cyan-500 text-white rounded-xl font-medium hover:shadow-lg transition-all text-sm disabled:opacity-50"
                  >
                    {sending ? (
                      <>
                        <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                        Pošiljam...
                      </>
                    ) : (
                      'Pošlji povpraševanje'
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BillingPageContent() {
  const router = useRouter();
  const { companyId, companyUuid, subscription, smsQuota, planCode: contextPlanCode, isPlanActive } = useCompany();
  const { user } = useAuth();
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPlanData, setCurrentPlanData] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);
  const [emailUsed, setEmailUsed] = useState(0);
  const [emailTotal, setEmailTotal] = useState(0);
  const [smsUsed, setSmsUsed] = useState(0);
  const [smsTotal, setSmsTotal] = useState(0);

  useEffect(() => {
    const fetchCurrentPlan = async () => {
      if (!companyId) {
        setLoading(false);
        return;
      }

      try {
        const result = await getBillingStatus(false);

        if (result.ok && result.plan) {
          setCurrentPlanData({
            id: result.subscription?.plan_id || '',
            code: result.plan.code || 'FREE',
            name: result.plan.name || 'Brezplačni',
          });
        } else {
          setCurrentPlanData({ id: '', code: 'FREE', name: 'Brezplačni' });
        }
      } catch (err) {
        console.error('Error fetching plan:', err);
        setCurrentPlanData({ id: '', code: 'FREE', name: 'Brezplačni' });
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentPlan();
  }, [companyId]);

  useEffect(() => {
    const fetchQuotas = async () => {
      if (!companyId) return;

      try {
        // Get company UUID
        const { data: companyData } = await supabase
          .from('companies')
          .select('id')
          .eq('company_id', companyId)
          .maybeSingle();

        if (!companyData?.id) return;
        const companyUuidLocal = companyData.id;

        // Get usage
        const [emailUsageRes, smsUsageRes, subRes] = await Promise.all([
          supabase.from('company_email_usage').select('sent_count').eq('company_id', companyUuidLocal).maybeSingle(),
          supabase.from('company_sms_usage').select('sent_count').eq('company_id', companyUuidLocal).maybeSingle(),
          supabase.from('company_subscriptions').select('plan_id').eq('company_id', companyUuidLocal).maybeSingle(),
        ]);

        setEmailUsed(emailUsageRes.data?.sent_count ?? 0);
        setSmsUsed(smsUsageRes.data?.sent_count ?? 0);

        if (subRes.data?.plan_id) {
          const { data: planData } = await supabase
            .from('plans')
            .select('email_quota_monthly, sms_quota_monthly')
            .eq('id', subRes.data.plan_id)
            .maybeSingle();

          setEmailTotal(planData?.email_quota_monthly ?? 0);
          setSmsTotal(planData?.sms_quota_monthly ?? 0);
        }
      } catch (err) {
        console.error('Error fetching quotas:', err);
      }
    };

    fetchQuotas();
  }, [companyId]);

  const handleManageSubscription = async () => {
    if (!companyId) return;

    setIsLoadingPortal(true);
    setError(null);
    try {
      const result = await getCustomerPortal(companyId);
      if (result.ok && result.portal_url) {
        window.location.href = result.portal_url;
      } else {
        setError(result.error || 'Napaka pri pridobivanju portala za plačila');
      }
    } catch (err) {
      setError('Napaka pri povezavi s strežnikom');
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const handleSelectPlan = async (planCode: string) => {
    if (planCode === 'ENTERPRISE') {
      setShowEnterpriseModal(true);
      return;
    }

    if (!companyId || !user?.email) {
      router.push('/login');
      return;
    }

    if (planCode === 'FREE') return;

    const currentCode = currentPlanData?.code || contextPlanCode;
    if (planCode === currentCode && isPlanActive) return;

    setLoadingPlan(planCode);
    setError(null);

    try {
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('company_id', companyId)
        .single();

      if (companyError || !companyData?.id) {
        setError('Napaka pri pridobivanju podatkov podjetja');
        setLoadingPlan(null);
        return;
      }

      const companyUuidValue = companyData.id;
      const result = await startCheckout(companyUuidValue, planCode, user.email);

      if (result.ok && result.checkout_url) {
        const checkoutUrl = result.checkout_url;
        if (!checkoutUrl.startsWith('http')) {
          setError('Neveljaven URL za plačilo. Prosimo, poskusite znova.');
          setLoadingPlan(null);
          return;
        }
        window.location.assign(checkoutUrl);
      } else {
        setError(result.error || 'Napaka pri ustvarjanju plačilne seje');
        setLoadingPlan(null);
      }
    } catch (err) {
      setError('Napaka pri povezavi s strežnikom');
      setLoadingPlan(null);
    }
  };

  const currentCode = currentPlanData?.code || contextPlanCode || 'FREE';
  const isCurrentPlan = (code: string) => code === currentCode && isPlanActive;

  const getCurrentPlanDisplayName = () => {
    switch (currentCode) {
      case 'FREE': return 'FREE';
      case 'JEDRO_PLUS': return 'JEDRO PLUS';
      case 'JEDRO_PRO': return 'JEDRO PRO';
      case 'JEDRO_PREMIUM': return 'JEDRO PREMIUM';
      case 'ENTERPRISE': return 'ENTERPRISE';
      default: return currentCode;
    }
  };

  const isPremium = currentCode === 'JEDRO_PREMIUM';
  const isGradientPlan = currentCode === 'JEDRO_PLUS' || currentCode === 'JEDRO_PRO';

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('sl-SI', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Paketi in kvote</h1>
        </div>

        {/* Error Toast */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"
          >
            <Warning className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" weight="fill" />
            <div className="flex-1">
              <p className="text-red-800 font-medium">Napaka</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">&times;</button>
          </motion.div>
        )}

        <div className="grid gap-6">
          {/* Current Plan Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl shadow-lg overflow-hidden ${isPremium ? '' : 'bg-white'}`}
            style={
              isGradientPlan
                ? {
                    border: '2px solid transparent',
                    backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)',
                    backgroundOrigin: 'border-box',
                    backgroundClip: 'padding-box, border-box',
                  }
                : isPremium
                  ? {
                      background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(59,130,246,0.05) 50%, rgba(6,182,212,0.08) 100%)',
                      border: '1px solid rgba(139,92,246,0.15)',
                    }
                  : { border: '1px solid #E5E7EB' }
            }
          >
            {/* Top section */}
            <div className={`p-6 border-b ${isPremium ? 'bg-transparent border-violet-100' : 'bg-white border-gray-200'}`}>
              <p className="text-sm text-black font-medium mb-1">Trenutni paket</p>
              {loading ? (
                <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
              ) : (
                <h2 className="text-2xl font-bold text-gray-900">
                  {getCurrentPlanDisplayName()}
                </h2>
              )}
            </div>

            {/* Bottom section */}
            <div className={`p-6 ${isPremium ? 'bg-transparent' : 'bg-gray-50'}`}>
              <div className="grid sm:grid-cols-3 gap-6">
                {/* Subscription Details */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <CalendarBlank className="h-5 w-5 text-black" />
                    Podrobnosti naročnine
                  </h3>
                  {subscription ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Status</span>
                        <span className="font-medium text-gray-900 capitalize">
                          {subscription.status === 'active' ? 'Aktivna' : subscription.status}
                        </span>
                      </div>
                      {subscription.current_period_end && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Naslednja obnova</span>
                          <span className="font-medium text-gray-900">
                            {formatDate(subscription.current_period_end)}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Brezplačni paket</p>
                  )}
                </div>

                {/* SMS Quota */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <ChatCircleText className="h-5 w-5 text-black" />
                    SMS kvota
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Porabljeno</span>
                      <span className="font-semibold text-gray-900 text-lg">{smsUsed}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Na voljo</span>
                      <span className="font-semibold text-gray-900 text-lg">{smsTotal}</span>
                    </div>
                    {smsTotal > 0 && (
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 transition-all"
                          style={{ width: `${Math.min(100, (smsUsed / smsTotal) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Email Quota */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <EnvelopeSimple className="h-5 w-5 text-black" />
                    Email kvota
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Porabljeno</span>
                      <span className="font-semibold text-gray-900 text-lg">{emailUsed}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Na voljo</span>
                      <span className="font-semibold text-gray-900 text-lg">{emailTotal}</span>
                    </div>
                    {emailTotal > 0 && (
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 transition-all"
                          style={{ width: `${Math.min(100, (emailUsed / emailTotal) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Manage Subscription Button */}
              {subscription && subscription.status !== 'pending' && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleManageSubscription}
                    disabled={isLoadingPortal}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    {isLoadingPortal ? (
                      <>
                        <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                        Nalagam...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4" weight="bold" />
                        Upravljaj plačila
                      </>
                    )}
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>

          {/* Plan Selector Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
                {PLANS.map((plan, index) => {
                  const isCurrent = isCurrentPlan(plan.code);
                  const isLoading = loadingPlan === plan.code;

                  return (
                    <motion.div
                      key={plan.code}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`relative bg-white rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col ${
                        plan.popular
                          ? 'border-2 border-violet-500 ring-4 ring-violet-500/10'
                          : 'border border-gray-100'
                      }`}
                    >
                      {/* Popular Badge */}
                      {plan.popular && (
                        <div className="absolute -top-4 right-6 bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full">
                          Najbolj priljubljen
                        </div>
                      )}

                      {/* Plan Name */}
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>

                      {/* Price */}
                      <div className="mb-2">
                        <span className="text-3xl font-bold bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                          {plan.price}
                        </span>
                        {plan.period && (
                          <span className="text-base font-normal text-gray-500 ml-1">{plan.period}</span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-sm text-gray-700 font-medium mb-1">{plan.description}</p>

                      {/* Tagline */}
                      <p className="text-xs text-gray-500 italic mb-5">&ldquo;{plan.tagline}&rdquo;</p>

                      {/* Features */}
                      <ul className="space-y-2 mb-6 flex-1">
                        {plan.features.map((feature, featureIndex) => (
                          <li key={featureIndex} className="flex items-start gap-2 text-sm text-gray-600">
                            <span className="text-gray-400 flex-shrink-0 mt-0.5">•</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      {/* CTA Button */}
                      <motion.button
                        whileHover={{ scale: isCurrent ? 1 : 1.05 }}
                        whileTap={{ scale: isCurrent ? 1 : 0.98 }}
                        onClick={() => handleSelectPlan(plan.code)}
                        disabled={isCurrent || isLoading}
                        className={`w-full rounded-xl px-6 py-3 font-semibold transition-all text-sm ${
                          plan.isEnterprise
                            ? 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white hover:shadow-lg'
                            : isCurrent
                              ? 'relative bg-white cursor-default'
                              : 'bg-gray-100 text-gray-900 hover:bg-gray-200 hover:shadow-md'
                        }`}
                        style={isCurrent && !plan.isEnterprise ? {
                          background: 'linear-gradient(white, white) padding-box, linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4) border-box',
                          border: '2px solid transparent',
                        } : undefined}
                      >
                        {isLoading ? (
                          <span className="flex items-center justify-center gap-2">
                            <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                            Nalagam...
                          </span>
                        ) : isCurrent ? (
                          <span className="bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent font-semibold">
                            Trenutni paket
                          </span>
                        ) : plan.isEnterprise ? (
                          'Pošlji Povpraševanje'
                        ) : (
                          'Izberi paket'
                        )}
                      </motion.button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* Footer note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center pt-6"
          >
            <p className="text-gray-600">
              Imate vprašanja? Kontaktirajte nas na{' '}
              <a href="mailto:podpora@jedroplus.com" className="text-violet-600 hover:text-violet-700 font-medium">
                podpora@jedroplus.com
              </a>
            </p>
          </motion.div>
        </div>
      </div>

      {/* Enterprise Inquiry Modal */}
      <EnterpriseModal
        isOpen={showEnterpriseModal}
        onClose={() => setShowEnterpriseModal(false)}
        companyId={companyId}
        userEmail={user?.email || ''}
      />
    </div>
  );
}

export default function BillingPage() {
  return (
    <ProtectedLayout>
      <BillingPageContent />
    </ProtectedLayout>
  );
}
