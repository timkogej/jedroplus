'use client';

import { Link } from '@/i18n/navigation';
import {
  ArrowRight,
  Bell,
  CalendarCheck,
  ChartLine,
  ChatCircleText,
  CheckCircle,
  Lock,
  TrendDown,
  Sparkle,
  type Icon,
} from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { PLAN_NAMES, type PlanCode } from '@/lib/planAccess';
import { getPlan } from '@/lib/billing/plans';

interface UpgradePlanGateProps {
  requiredPlan: PlanCode;
  hideUpgradeButton?: boolean;
  /** Path without locale, used to explain the specific feature. */
  pathname?: string;
}

type FeatureKey = 'reminders' | 'booking' | 'communication' | 'analytics' | 'lostLeads' | 'ai';

const FEATURES: { prefix: string; key: FeatureKey; icon: Icon }[] = [
  { prefix: '/reminders', key: 'reminders', icon: Bell },
  { prefix: '/rezervacije', key: 'booking', icon: CalendarCheck },
  { prefix: '/komunikacija', key: 'communication', icon: ChatCircleText },
  { prefix: '/analytics', key: 'analytics', icon: ChartLine },
  { prefix: '/lost-leads', key: 'lostLeads', icon: TrendDown },
  { prefix: '/asistent', key: 'ai', icon: Sparkle },
  { prefix: '/chatbot-plus', key: 'ai', icon: Sparkle },
];

/**
 * Shown instead of a page the current plan doesn't include. Explains what the
 * feature does and what it costs, so the lock reads as an offer, not a wall.
 */
export default function UpgradePlanGate({ requiredPlan, hideUpgradeButton, pathname = '' }: UpgradePlanGateProps) {
  const t = useTranslations('billing.upgradePlanGate');
  const planName = PLAN_NAMES[requiredPlan] || requiredPlan;
  const plan = getPlan(requiredPlan);
  const feature = FEATURES.find((f) => pathname === f.prefix || pathname.startsWith(f.prefix + '/'));
  const FeatureIcon = feature?.icon ?? Lock;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <FeatureIcon size={22} weight="duotone" aria-hidden="true" />
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600">
            <Lock size={12} weight="bold" aria-hidden="true" />
            {t('badge', { plan: planName })}
          </span>
        </div>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
          {feature ? t(`features.${feature.key}.title`) : t('heading', { plan: planName })}
        </h1>
        <p className="mt-3 text-base leading-7 text-gray-600">
          {feature ? t(`features.${feature.key}.lead`) : t('subtitle')}
        </p>

        {feature && (
          <ul className="mt-6 space-y-3">
            {(['p1', 'p2', 'p3'] as const).map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm leading-6 text-gray-700">
                <CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-emerald-500" aria-hidden="true" />
                {t(`features.${feature.key}.${p}`)}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 rounded-2xl border border-gray-200 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-sm font-semibold text-gray-900">{t('includedIn', { plan: planName })}</p>
            {plan?.price && (
              <p className="text-sm text-gray-600">
                {t('price', { monthly: plan.price.monthly, annual: plan.price.annual })}
              </p>
            )}
          </div>

          {hideUpgradeButton ? (
            <p className="mt-3 text-sm text-gray-500">{t('ownerOnly')}</p>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/nastavitve/paketi#razpolozljivi-paketi"
                className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
              >
                {t('comparePlans')}
                <ArrowRight size={16} weight="bold" aria-hidden="true" />
              </Link>
              <Link href="/dashboard" className="text-sm font-medium text-gray-500 hover:text-gray-800">
                {t('back')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
