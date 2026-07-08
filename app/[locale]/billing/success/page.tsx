'use client';

import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { SpinnerGap, ArrowRight, Warning } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { getBillingStatus } from '@/lib/api/billingClient';

const MAX_POLL_TIME_MS = 60000;
const POLL_INTERVAL_MS = 3000;

function getSafeReturnPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/nastavitve/paketi';
  }
  return value;
}

// Plan features mapping — keys map to billing.json plans.{key}.features
const PLAN_FEATURE_KEYS: Record<string, string> = {
  JEDRO_PLUS:    'jedroPlus',
  JEDRO_PRO:     'jedroPro',
  JEDRO_PREMIUM: 'jedroPremium',
};

// Confetti implementation
function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#8B5CF6', '#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];
    const confettiPieces: { x: number; y: number; w: number; h: number; color: string; vx: number; vy: number; rotation: number; rotationSpeed: number; opacity: number }[] = [];

    for (let i = 0; i < 150; i++) {
      confettiPieces.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.5,
        w: Math.random() * 8 + 4,
        h: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1,
      });
    }

    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let allDone = true;

      for (const p of confettiPieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.rotation += p.rotationSpeed;

        if (p.y > canvas.height) {
          p.opacity -= 0.02;
        }

        if (p.opacity > 0) {
          allDone = false;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      }

      if (!allDone) {
        animationId = requestAnimationFrame(animate);
      }
    };

    animate();
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
    />
  );
}

// Gradient checkmark SVG
function GradientCheck({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="check-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <path
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        stroke="url(#check-gradient)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BillingSuccessContent() {
  const t = useTranslations('billing');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshSubscription } = useCompany();
  const { user } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'timeout' | 'error'>('verifying');
  const [pollCount, setPollCount] = useState(0);
  const [activePlanCode, setActivePlanCode] = useState<string | null>(null);
  const [activePlanName, setActivePlanName] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const pollStartTime = useRef<number>(Date.now());
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasSucceeded = useRef(false);

  const sessionId = searchParams.get('session_id');
  const returnPath = getSafeReturnPath(searchParams.get('return_to'));

  const pollSubscription = useCallback(async () => {
    if (hasSucceeded.current) return;

    const elapsedTime = Date.now() - pollStartTime.current;
    if (elapsedTime >= MAX_POLL_TIME_MS) {
      setStatus('timeout');
      return;
    }

    try {
      console.log('Polling subscription status...');
      setPollCount(prev => prev + 1);

      const result = await getBillingStatus(false);

      console.log('Billing status result:', result);

      if (result.ok && result.subscription && result.plan) {
        const isActive = result.subscription.status === 'active';
        const planCode = result.plan.code;
        const isPaidPlan = planCode && planCode !== 'FREE';

        console.log('Status check:', { isActive, planCode, isPaidPlan });

        if (isActive && isPaidPlan) {
          hasSucceeded.current = true;
          setActivePlanCode(planCode);
          setActivePlanName(result.plan.name || planCode);
          setStatus('success');
          setShowConfetti(true);

          await refreshSubscription();
          return;
        }
      }

      pollTimeoutRef.current = setTimeout(pollSubscription, POLL_INTERVAL_MS);
    } catch (error) {
      console.error('Error polling subscription:', error);
      pollTimeoutRef.current = setTimeout(pollSubscription, POLL_INTERVAL_MS);
    }
  }, [refreshSubscription]);

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      return;
    }

    const initialDelay = setTimeout(() => {
      pollStartTime.current = Date.now();
      pollSubscription();
    }, 2000);

    return () => {
      clearTimeout(initialDelay);
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [sessionId, pollSubscription]);

  const handleContinue = () => {
    router.push(returnPath);
  };

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  const handleRetry = () => {
    hasSucceeded.current = false;
    setStatus('verifying');
    setPollCount(0);
    pollStartTime.current = Date.now();
    pollSubscription();
  };

  const planFeatureKey = activePlanCode
    ? (PLAN_FEATURE_KEYS[activePlanCode] || PLAN_FEATURE_KEYS['JEDRO_PLUS'])
    : null;
  const planFeatures = planFeatureKey
    ? (t.raw(`plans.${planFeatureKey}.features`) as string[])
    : [];

  // No session ID
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 p-8 max-w-md w-full text-center">
          <Warning className="h-16 w-16 text-amber-500 mx-auto mb-4" weight="fill" />
          <h1 className="text-xl font-semibold text-gray-900 mb-4">
            {t('success.missingSession.title')}
          </h1>
          <p className="text-gray-600 mb-6">
            {t('success.missingSession.message')}
          </p>
          <button
            onClick={() => router.push(returnPath)}
            className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-900 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
          >
            {t('success.missingSession.backButton')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      {showConfetti && <Confetti />}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 p-8 max-w-lg w-full"
      >
        {status === 'verifying' && (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-6">
              <svg className="w-12 h-12 animate-spin" viewBox="0 0 50 50">
                <defs>
                  <linearGradient id="verify-spinner" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="50%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#06B6D4" />
                  </linearGradient>
                </defs>
                <circle cx="25" cy="25" r="20" fill="none" stroke="url(#verify-spinner)" strokeWidth="3" strokeLinecap="round" strokeDasharray="80 50" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {t('success.verifying.title')}
            </h2>
            <p className="text-gray-600 mb-4">
              {t('success.verifying.message')}
            </p>
            <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
              <motion.div
                className="h-2 rounded-full"
                style={{ background: 'linear-gradient(to right, #8B5CF6, #3B82F6, #06B6D4)' }}
                initial={{ width: '0%' }}
                animate={{ width: `${Math.min((pollCount * POLL_INTERVAL_MS / MAX_POLL_TIME_MS) * 100, 100)}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="text-xs text-gray-400">
              {t('success.verifying.progressLabel')} ({t('success.verifying.timeRemaining', { seconds: Math.max(0, Math.ceil((MAX_POLL_TIME_MS - (Date.now() - pollStartTime.current)) / 1000)) })})
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            {/* Success Animation */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="inline-block"
            >
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center mx-auto"
                style={{
                  background: 'linear-gradient(135deg, #10B981 0%, #34D399 50%, #6EE7B7 100%)',
                }}
              >
                <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold text-gray-900 mt-6 mb-2"
            >
              {t('success.complete.title')}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-gray-600 mb-2"
            >
              {t('success.complete.subtitle')}
            </motion.p>

            {/* Plan badge */}
            {(activePlanCode || activePlanName) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-100 rounded-full text-sm font-medium mb-6"
              >
                <span className="text-gray-600">{t('success.complete.yourPlan')}</span>
                <span
                  className="font-bold"
                  style={{
                    background: 'linear-gradient(to right, #8B5CF6, #3B82F6, #06B6D4)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {activePlanName || activePlanCode}
                </span>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-4"
            >
              <div className="p-4 bg-gray-50 rounded-xl text-left">
                <h3 className="font-semibold text-gray-900 mb-3">{t('success.complete.whatsNext')}</h3>
                <ul className="space-y-2.5 text-sm text-gray-600">
                  {planFeatures.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex-shrink-0">
                        <GradientCheck size={18} />
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                  <li className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex-shrink-0">
                      <GradientCheck size={18} />
                    </span>
                    <span>{t('success.complete.emailConfirmation', { email: user?.email ?? '' })}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex-shrink-0">
                      <GradientCheck size={18} />
                    </span>
                    <span>{t('success.complete.smsReset')}</span>
                  </li>
                </ul>
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleContinue}
                  className="flex-1 py-3 px-4 bg-white border-2 border-gray-200 text-gray-900 rounded-xl font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  {t('success.complete.backToBilling')}
                  <ArrowRight className="h-4 w-4" weight="bold" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleGoToDashboard}
                  className="flex-1 py-3 px-4 bg-white border-2 border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <span
                    style={{
                      background: 'linear-gradient(to right, #8B5CF6, #3B82F6, #06B6D4)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {t('success.complete.dashboard')}
                  </span>
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}

        {status === 'timeout' && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-6">
              <SpinnerGap className="h-8 w-8 text-amber-600" weight="bold" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {t('success.timeout.title')}
            </h2>
            <p className="text-gray-600 mb-6">
              {t('success.timeout.message')}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleRetry}
                className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-900 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                {t('success.timeout.retryButton')}
              </button>
              <button
                onClick={() => router.push(returnPath)}
                className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                {t('success.timeout.backButton')}
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-8">
            <Warning className="h-16 w-16 text-red-500 mx-auto mb-4" weight="fill" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {t('success.error.title')}
            </h2>
            <p className="text-gray-600 mb-6">
              {t('success.error.message')}
            </p>
            <button
              onClick={() => router.push(returnPath)}
              className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-900 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
            >
              {t('success.error.backButton')}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function LoadingFallback() {
  const t = useTranslations('billing');
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-10 h-10 mx-auto mb-4">
          <svg className="w-10 h-10 animate-spin" viewBox="0 0 50 50">
            <defs>
              <linearGradient id="loading-spinner" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="50%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
            <circle cx="25" cy="25" r="20" fill="none" stroke="url(#loading-spinner)" strokeWidth="3" strokeLinecap="round" strokeDasharray="80 50" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm">{t('success.loading')}</p>
      </div>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <BillingSuccessContent />
    </Suspense>
  );
}
