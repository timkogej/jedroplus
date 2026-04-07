'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  CalendarBlank,
  EnvelopeSimple,
  ChatCircleText
} from '@phosphor-icons/react';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { startCheckout, getBillingStatus } from '@/lib/api/billingClient';
import { supabase } from '@/lib/supabaseClient';

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
  features: string[];
  popular?: boolean;
  isEnterprise?: boolean;
  note?: string;
}

const PLANS: Plan[] = [
  {
    code: 'JEDRO_PLUS',
    name: 'Jedro Plus',
    price: '19 €',
    period: '/ mesec',
    description: 'Osnovni paket za urejene termine in komunikacijo.',
    features: [
      'baza strank',
      'baza terminov',
      'baza storitev in osebja',
      'personalizirani opomniki pred in po terminu',
      'email pošiljanje',
      'celotna analitika',
      'booking link',
    ],
  },
  {
    code: 'JEDRO_PRO',
    name: 'Jedro Pro',
    price: '39 €',
    period: '/ mesec',
    description: 'Napredne AI funkcije in Lost Leads za več zasedenosti.',
    popular: true,
    features: [
      'vse iz Jedro Plus',
      'Asistent+',
      'Lost Leads sistem',
      'sms pošiljanje',
      'email pošiljanje',
    ],
  },
  {
    code: 'JEDRO_PREMIUM',
    name: 'Jedro Premium',
    price: '',
    period: '',
    description: 'Največ avtomatizacije in AI funkcij.',
    features: [
      'vse iz Jedro Pro',
      'Receptionist+',
      'Chatbot+',
      'SMS pošiljanje (višja kvota)',
      'Email pošiljanje (višja kvota)',
    ],
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    price: 'po dogovoru',
    period: '',
    description: 'Prilagoditve funkcij in AI po meri podjetja.',
    isEnterprise: true,
    note: 'Za Enterprise pripravimo ponudbo po meri.',
    features: [
      'Custom AI funkcije prilagojene podjetju',
      'Premium booking page',
      'SMS in Email pošiljanje po meri',
      'Integracije z drugimi orodji',
    ],
  },
];

export default function PlansPage() {
  const router = useRouter();
  const { companyId, companyUuid, planCode: contextPlanCode, isPlanActive, subscription, smsQuota } = useCompany();
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [currentPlanData, setCurrentPlanData] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isYearly, setIsYearly] = useState(false);
  const [hasUsedTrial, setHasUsedTrial] = useState<boolean>(true); // default true = don't show trial button

  // Fetch current plan from n8n billing status endpoint + has_used_trial
  useEffect(() => {
    const fetchCurrentPlan = async () => {
      if (!companyId) {
        setLoading(false);
        return;
      }

      try {
        // Use n8n billing status endpoint which has proper access
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

        // Check has_used_trial from companies table
        const { data: companyData } = await supabase
          .from('companies')
          .select('has_used_trial')
          .eq('company_id', companyId)
          .maybeSingle();
        if (companyData && companyData.has_used_trial === false) {
          setHasUsedTrial(false);
        }
      } catch (error) {
        console.error('Error fetching plan:', error);
        setCurrentPlanData({ id: '', code: 'FREE', name: 'Brezplačni' });
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentPlan();
  }, [companyId]);

  const handleSelectPlan = async (planCode: string) => {
    // Enterprise button does nothing for now
    if (planCode === 'ENTERPRISE') {
      return;
    }

    if (!companyId || !user?.email) {
      router.push('/login');
      return;
    }

    // If selecting free plan, no checkout needed
    if (planCode === 'FREE') {
      return;
    }

    // If already on this plan, don't do anything
    const currentCode = currentPlanData?.code || contextPlanCode;
    if (planCode === currentCode && isPlanActive) {
      return;
    }

    setLoadingPlan(planCode);

    try {
      // Fetch the long UUID from companies table using short company_id
      const { data: companyData, error } = await supabase
        .from('companies')
        .select('id')
        .eq('company_id', companyId)
        .single();

      if (error || !companyData?.id) {
        console.error('Failed to fetch company UUID:', error);
        return;
      }

      const companyUuidValue = companyData.id;
      const result = await startCheckout(companyUuidValue, planCode, user.email);

      if (result.ok && result.checkout_url) {
        const checkoutUrl = result.checkout_url;
        if (!checkoutUrl.startsWith('http')) {
          console.error('Invalid checkout URL received:', checkoutUrl);
          alert('Napaka: Neveljaven URL za plačilo. Prosimo, poskusite znova.');
          return;
        }
        window.location.assign(checkoutUrl);
      } else {
        console.error('Failed to start checkout:', result.error);
        alert(result.error || 'Napaka pri ustvarjanju plačilne seje');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Napaka pri povezavi s strežnikom');
    } finally {
      setLoadingPlan(null);
    }
  };

  const currentCode = currentPlanData?.code || contextPlanCode || 'FREE';

  const getPlanPrice = (plan: Plan) => {
    if (plan.code === 'JEDRO_PREMIUM' || plan.isEnterprise) return null;
    if (isYearly) {
      if (plan.code === 'JEDRO_PLUS') return '15 €';
      if (plan.code === 'JEDRO_PRO') return '31 €';
    }
    return plan.price || null;
  };

  const isCurrentPlan = (planCode: string) => {
    return planCode === currentCode && isPlanActive;
  };

  // Get display name for current plan
  const getCurrentPlanDisplayName = () => {
    switch (currentCode) {
      case 'FREE':
        return 'FREE';
      case 'JEDRO_PLUS':
        return 'JEDRO PLUS';
      case 'JEDRO_PRO':
        return 'JEDRO PRO';
      case 'JEDRO_PREMIUM':
        return 'JEDRO PREMIUM';
      case 'ENTERPRISE':
        return 'ENTERPRISE';
      default:
        return currentCode;
    }
  };

  // Determine styling based on current plan
  const isPremium = currentCode === 'JEDRO_PREMIUM';
  const isGradientPlan = currentCode === 'JEDRO_PLUS' || currentCode === 'JEDRO_PRO';

  // Format date
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('sl-SI', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-gray-900 mb-4"
          >
            Plani
          </motion.h1>
        </div>

        {/* Current Plan Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-white rounded-2xl shadow-lg overflow-hidden mb-12 ${
            isGradientPlan
              ? 'ring-2'
              : isPremium
                ? 'ring-2'
                : 'border border-gray-200'
          }`}
          style={
            isGradientPlan
              ? {
                  borderImage: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4) 1',
                  borderImageSlice: 1,
                }
              : isPremium
                ? { borderColor: '#D4AF37' }
                : {}
          }
        >
          {/* Top section - Current Plan Name */}
          <div className="p-6 bg-white border-b border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Trenutni paket</p>
            {loading ? (
              <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
            ) : (
              <h2
                className={`text-2xl font-bold ${
                  isPremium
                    ? 'text-amber-500'
                    : currentCode === 'FREE'
                      ? 'bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent'
                      : 'bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent'
                }`}
              >
                {getCurrentPlanDisplayName()}
              </h2>
            )}
          </div>

          {/* Bottom section - Details */}
          <div className="p-6 bg-gray-50">
            <div className="grid sm:grid-cols-3 gap-6">
              {/* Subscription Details */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <CalendarBlank className="h-5 w-5 text-violet-500" />
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
                  <ChatCircleText className="h-5 w-5 text-violet-500" />
                  SMS kvota
                </h3>
                {smsQuota ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Porabljeno</span>
                      <span className="font-medium text-gray-900">
                        {smsQuota.used_current_month} / {smsQuota.quota_effective}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Preostalo</span>
                      <span className="font-medium text-gray-900">{smsQuota.remaining}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">SMS ni vključen</p>
                )}
              </div>

              {/* Email Quota */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <EnvelopeSimple className="h-5 w-5 text-violet-500" />
                  Email kvota
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className="font-medium text-gray-900">
                      {currentCode !== 'FREE' ? 'Vključeno' : 'Ni vključeno'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <span className={`text-sm font-medium ${!isYearly ? 'text-gray-900' : 'text-gray-400'}`}>Mesečno</span>
          <button
            onClick={() => setIsYearly(!isYearly)}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${isYearly ? 'bg-violet-500' : 'bg-gray-300'}`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${isYearly ? 'translate-x-6' : 'translate-x-0'}`}
            />
          </button>
          <span className={`text-sm font-medium ${isYearly ? 'text-gray-900' : 'text-gray-400'}`}>
            Letno
          </span>
        </div>

        {/* Plans Grid */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PLANS.map((plan, index) => {
              const isCurrent = isCurrentPlan(plan.code);
              const isLoading = loadingPlan === plan.code;

              return (
                <motion.div
                  key={plan.code}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative bg-white rounded-3xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 ${
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
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {plan.name}
                  </h3>

                  {/* Price */}
                  <div className="text-3xl font-bold bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent mb-3 min-h-[44px] flex items-center">
                    {plan.isEnterprise ? (
                      <span>{plan.price}</span>
                    ) : getPlanPrice(plan) ? (
                      <motion.span
                        key={isYearly ? 'yearly' : 'monthly'}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className="flex items-baseline gap-1"
                      >
                        {getPlanPrice(plan)}
                        <span className="text-lg font-normal text-gray-500"> / mesec</span>
                      </motion.span>
                    ) : (
                      <span className="text-gray-400">??</span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-gray-600 mb-6">
                    {plan.description}
                  </p>

                  {/* Features */}
                  <ul className="space-y-2 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <li
                        key={featureIndex}
                        className="flex items-start gap-2 text-sm text-gray-600"
                      >
                        <span>•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  {plan.code === 'JEDRO_PREMIUM' ? (
                    <a
                      href="mailto:info@jedroplus.com"
                      className="block w-full rounded-xl px-6 py-3 font-semibold text-center bg-gray-100 text-gray-900 hover:bg-gray-200 hover:shadow-md transition-all"
                    >
                      Kontaktiraj nas
                    </a>
                  ) : (
                    <motion.button
                      whileHover={{ scale: isCurrent ? 1 : 1.05 }}
                      whileTap={{ scale: isCurrent ? 1 : 0.98 }}
                      onClick={() => handleSelectPlan(plan.code)}
                      disabled={isCurrent || isLoading}
                      className={`w-full rounded-xl px-6 py-3 font-semibold transition-all ${
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
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent inline-block" />
                          Nalagam...
                        </span>
                      ) : isCurrent ? (
                        <span className="bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent font-semibold">
                          Trenutni paket
                        </span>
                      ) : plan.isEnterprise ? (
                        'Pošlji povpraševanje'
                      ) : plan.code === 'JEDRO_PLUS' && !hasUsedTrial ? (
                        'Preizkusi Brezplačno'
                      ) : (
                        'Izberi paket'
                      )}
                    </motion.button>
                  )}

                  {/* Enterprise Note */}
                  {plan.note && (
                    <p className="text-xs text-gray-500 mt-4 text-center">
                      {plan.note}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Contact */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-16 text-center"
        >
          <p className="text-gray-600">
            Imate vprašanja? Kontaktirajte nas na{' '}
            <a
              href="mailto:help@jedroplus.com"
              className="text-violet-600 hover:text-violet-700 font-medium"
            >
              help@jedroplus.com
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
