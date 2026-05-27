'use client';

import { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Crown, ArrowRight } from '@phosphor-icons/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCompany } from '@/app/company-context';

// Feature requirements by plan level
const PLAN_LEVELS: Record<string, number> = {
  free: 0,
  basic: 1,
  pro: 2,
  premium: 3,
};

// Features and their minimum required plan
const FEATURE_REQUIREMENTS: Record<string, string> = {
  // Basic features (free)
  'calendar.view': 'free',
  'clients.view': 'free',
  'clients.create': 'free',
  'bookings.view': 'free',
  'bookings.create': 'free',

  // Basic plan features
  'bookings.online': 'basic',
  'reports.basic': 'basic',
  'reminders.email': 'basic',
  'reminders.sms': 'basic',

  // Pro features
  'analytics.advanced': 'pro',
  'api.access': 'pro',
  'webhooks': 'pro',
  'lost_leads': 'pro',
  'staff.unlimited': 'pro',

  // Premium features
  'analytics.custom': 'premium',
  'whitelabel': 'premium',
  'dedicated_support': 'premium',
};

interface FeatureGateProps {
  feature: keyof typeof FEATURE_REQUIREMENTS | string;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
}

/**
 * Component that gates features based on subscription plan.
 * If user's plan doesn't include the feature, shows upgrade prompt or fallback.
 */
export function FeatureGate({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
}: FeatureGateProps) {
  const { planCode, isPlanActive } = useCompany();

  const requiredPlan = FEATURE_REQUIREMENTS[feature] || 'free';
  const userPlanLevel = PLAN_LEVELS[planCode] ?? 0;
  const requiredPlanLevel = PLAN_LEVELS[requiredPlan] ?? 0;

  const hasAccess = isPlanActive && userPlanLevel >= requiredPlanLevel;

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  return (
    <UpgradePrompt
      requiredPlan={requiredPlan}
      feature={feature}
    />
  );
}

interface UpgradePromptProps {
  requiredPlan: string;
  feature: string;
}

function UpgradePrompt({ requiredPlan, feature }: UpgradePromptProps) {
  const t = useTranslations('billing');

  const getPlanDisplayName = (code: string): string => {
    const names: Record<string, string> = {
      free:    t('featureGate.planNames.free'),
      basic:   t('featureGate.planNames.basic'),
      pro:     t('featureGate.planNames.pro'),
      premium: t('featureGate.planNames.premium'),
    };
    return names[code] ?? code;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-violet-50 to-cyan-50 border-2 border-violet-200 rounded-2xl p-6 text-center"
    >
      <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-2xl mb-4">
        <Crown className="h-7 w-7 text-white" weight="fill" />
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {t('featureGate.upgradeRequired')}
      </h3>

      <p className="text-sm text-gray-600 mb-4">
        {t('featureGate.requiresPlan', { plan: getPlanDisplayName(requiredPlan) })}
      </p>

      <Link
        href="/nastavitve/paketi"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-cyan-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-shadow"
      >
        {t('featureGate.viewPlans')}
        <ArrowRight className="h-4 w-4" weight="bold" />
      </Link>
    </motion.div>
  );
}

/**
 * Hook to check if a feature is available
 */
export function useFeatureAccess(feature: string) {
  const { planCode, isPlanActive } = useCompany();

  const requiredPlan = FEATURE_REQUIREMENTS[feature] || 'free';
  const userPlanLevel = PLAN_LEVELS[planCode] ?? 0;
  const requiredPlanLevel = PLAN_LEVELS[requiredPlan] ?? 0;

  const hasAccess = isPlanActive && userPlanLevel >= requiredPlanLevel;

  return {
    hasAccess,
    requiredPlan,
    currentPlan: planCode,
    isPlanActive,
  };
}

/**
 * Check multiple features at once
 */
export function useFeatureAccessMultiple(features: string[]) {
  const { planCode, isPlanActive } = useCompany();
  const userPlanLevel = PLAN_LEVELS[planCode] ?? 0;

  return features.reduce((acc, feature) => {
    const requiredPlan = FEATURE_REQUIREMENTS[feature] || 'free';
    const requiredPlanLevel = PLAN_LEVELS[requiredPlan] ?? 0;
    acc[feature] = isPlanActive && userPlanLevel >= requiredPlanLevel;
    return acc;
  }, {} as Record<string, boolean>);
}
