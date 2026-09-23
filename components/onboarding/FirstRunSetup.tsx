'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CheckCircle, CircleNotch, WarningCircle, X, Plus } from '@phosphor-icons/react';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { useRolePermissions } from '@/app/role-permission-context';
import {
  clearSeedPlan,
  clearSetupReady,
  isSetupReady,
  isSeedComplete,
  markSetupReady,
  loadSeedPlan,
  runSeedPlan,
  saveSeedPlan,
  type SeedStep,
} from '@/lib/onboarding/firstRunSeed';

type Phase = 'idle' | 'running' | 'done' | 'error';

interface FirstRunSetupProps {
  /** Opens the dashboard's "new appointment" modal. */
  onCreateAppointment: () => void;
  /** Lets the dashboard reload services/staff once they exist. */
  onSeeded?: () => void;
}

const STEPS: Exclude<SeedStep, 'done'>[] = ['services', 'owner', 'connect'];

// One setup per company at a time, even if the dashboard remounts this card
// mid-run (it does while reloading) — a second run would duplicate services.
const inFlight = new Map<string, Promise<boolean>>();

/**
 * Finishes the account setup chosen in onboarding (starter services, owner as
 * first staff member) and then points the owner at their first appointment.
 * Renders nothing for accounts without a pending setup.
 */
export default function FirstRunSetup({ onCreateAppointment, onSeeded }: FirstRunSetupProps) {
  const t = useTranslations('dashboard.firstRun');
  const { companyId, companyUuid, companySettings } = useCompany();
  const { user } = useAuth();
  const { role } = useRolePermissions();

  const [phase, setPhase] = useState<Phase>('idle');
  const [step, setStep] = useState<SeedStep>('services');
  const [includesOwner, setIncludesOwner] = useState(true);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    if (!companyId || !companyUuid || !user?.id || !user.email) return;

    let job = inFlight.get(companyUuid);
    if (!job) {
      const plan = loadSeedPlan(companyUuid);
      if (!plan) return;
      if (isSeedComplete(plan)) {
        clearSeedPlan(companyUuid);
        return;
      }
      setIncludesOwner(plan.addOwnerAsStaff);
      const ctx = {
        companyId,
        companyUuid,
        companySettings: (companySettings as Record<string, unknown> | null) ?? null,
        userId: user.id,
        userEmail: user.email,
      };
      job = runSeedPlan(plan, ctx, (s) => mounted.current && setStep(s), saveSeedPlan)
        .then(() => {
          clearSeedPlan(companyUuid);
          markSetupReady(companyUuid);
          // Welcome email — once per company, sent by n8n.
          fetch('/api/email/welcome', { method: 'POST' }).catch(() => {});
          return true;
        })
        .catch((error) => {
          console.error('[FirstRunSetup] setup failed:', error);
          return false;
        })
        .finally(() => inFlight.delete(companyUuid));
      inFlight.set(companyUuid, job);
    }

    setPhase('running');
    const ok = await job;
    if (!mounted.current) return;
    setPhase(ok ? 'done' : 'error');
    if (ok) onSeeded?.();
  }, [companyId, companyUuid, companySettings, user?.id, user?.email, onSeeded]);

  useEffect(() => {
    if (role !== 'owner') return;
    if (isSetupReady(companyUuid)) {
      setPhase('done');
      return;
    }
    run();
  }, [role, run, companyUuid]);

  const closeReady = () => {
    if (companyUuid) clearSetupReady(companyUuid);
    setPhase('idle');
  };

  if (phase === 'idle') return null;

  const visibleSteps = includesOwner ? STEPS : STEPS.filter((s) => s === 'services');
  const currentIndex = step === 'done' ? visibleSteps.length : visibleSteps.indexOf(step as Exclude<SeedStep, 'done'>);

  return (
    <section
      aria-live="polite"
      className="mb-8 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/70 to-cyan-50/50 p-5 sm:p-6"
    >
      {phase === 'running' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('preparingTitle')}</h2>
          <ol className="space-y-2">
            {visibleSteps.map((s, i) => {
              const done = i < currentIndex;
              const active = i === currentIndex;
              return (
                <li key={s} className="flex items-center gap-2.5 text-sm">
                  {done ? (
                    <CheckCircle size={18} weight="fill" className="text-emerald-500" aria-hidden="true" />
                  ) : active ? (
                    <CircleNotch size={18} weight="bold" className="animate-spin text-violet-500" aria-hidden="true" />
                  ) : (
                    <span className="h-[18px] w-[18px] rounded-full border-2 border-gray-200" aria-hidden="true" />
                  )}
                  <span className={done ? 'text-gray-500' : active ? 'font-medium text-gray-900' : 'text-gray-400'}>
                    {t(`steps.${s}`)}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {phase === 'done' && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle size={24} weight="fill" className="mt-0.5 shrink-0 text-emerald-500" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('doneTitle')}</h2>
              <p className="mt-1 max-w-xl text-sm text-gray-600">{t('doneBody')}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                closeReady();
                onCreateAppointment();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/25"
            >
              <Plus size={16} weight="bold" />
              {t('cta')}
            </button>
            <button
              type="button"
              onClick={closeReady}
              aria-label={t('dismiss')}
              className="rounded-lg p-2 text-gray-400 hover:bg-white/60 hover:text-gray-700"
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <WarningCircle size={24} weight="fill" className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('errorTitle')}</h2>
              <p className="mt-1 max-w-xl text-sm text-gray-600">{t('errorBody')}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={run}
              className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              {t('retry')}
            </button>
            <Link
              href="/storitve"
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('openServices')}
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
