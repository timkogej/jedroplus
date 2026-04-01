'use client';

import Link from 'next/link';
import { RocketLaunch } from '@phosphor-icons/react';
import { PLAN_NAMES, type PlanCode } from '@/lib/planAccess';

interface UpgradePlanGateProps {
  requiredPlan: PlanCode;
  hideUpgradeButton?: boolean;
}

export default function UpgradePlanGate({ requiredPlan, hideUpgradeButton }: UpgradePlanGateProps) {
  const planName = PLAN_NAMES[requiredPlan] || requiredPlan;

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] bg-white px-4">
      <div className="max-w-lg w-full text-center">
        {/* Heading with gradient */}
        <h1 className="text-3xl font-bold mb-3">
          <span className="text-black">Ta funkcija zahteva paket </span>
          <span
            style={{
              background: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {planName}
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-gray-500 text-lg mb-10 leading-relaxed">
          Nadgradite svoj paket, da odklenete to funkcijo in
          <span
            className="font-semibold"
            style={{
              background: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {' '}izkoristite celoten potencial
          </span>{' '}
          platforme Jedro+.
        </p>

        {/* Upgrade button — hidden for staff/admin who cannot manage billing */}
        {!hideUpgradeButton && (
          <Link
            href="/billing"
            className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl text-white font-semibold text-base shadow-lg shadow-violet-200 transition-all duration-200 hover:shadow-xl hover:shadow-violet-300 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
            }}
          >
            <RocketLaunch className="w-5 h-5" weight="bold" />
            Nadgradi paket
          </Link>
        )}

        {/* Current plan hint */}
        <p className="mt-6 text-sm text-gray-400">
          Oglejte si vse razpoložljive pakete in izberite tistega, ki vam ustreza.
        </p>
      </div>
    </div>
  );
}
