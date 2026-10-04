/**
 * /auth/confirm — Supabase email confirmation handler.
 *
 * Supabase sends the user here after they click the confirmation link in their
 * inbox. The URL contains `token_hash`, `type`, and optionally `next`.
 *
 * This page:
 *  1. Shows a brief loading state so the user isn't staring at a blank screen.
 *  2. Calls supabase.auth.verifyOtp() to exchange the token for a live session.
 *  3. On success → redirects to `next` (default: /onboarding).
 *  4. On failure → redirects to /auth/confirm-error.
 *
 * NOTE: verifyOtp() is called via createBrowserClient (lib/supabase/client.ts),
 * which writes the session cookies into the browser automatically — the same
 * cookies that Next.js middleware reads on every subsequent request.
 */

'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';
import AuroraBackground from '@/components/shared/AuroraBackground';
import PublicLanguageToggle from '@/components/shared/PublicLanguageToggle';
import { JedroLogo } from '@/components/brand/JedroLogo';

function ConfirmInner() {
  const t = useTranslations('auth.confirm');
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token_hash = params.get('token_hash');
    const type = params.get('type') as 'email' | 'signup' | 'recovery' | null;
    const next = params.get('next') ?? '/onboarding';

    if (!token_hash || !type) {
      // Missing params — treat as a failed confirmation
      router.replace('/auth/confirm-error');
      return;
    }

    const supabase = createClient();

    supabase.auth
      .verifyOtp({ token_hash, type })
      .then(({ error }) => {
        if (error) {
          console.error('[auth/confirm] verifyOtp error:', error.message);
          router.replace('/auth/confirm-error');
        } else {
          // Session is now set in browser cookies — safe to navigate forward
          router.replace(next);
        }
      });
  }, [params, router]);

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#05060f] px-4 py-16">
      <AuroraBackground />
      <PublicLanguageToggle allLanguages className="absolute right-4 top-4 z-20" />
      <div className="relative z-10 w-full max-w-[400px]">

        {/* Logo Jedro+ (components/brand/JedroLogo) */}
        <div className="mb-8 flex justify-center">
          <h1>
            <JedroLogo height={44} tone="onDark" title="Jedro+" />
          </h1>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-white/40 bg-white/90 shadow-[0_30px_80px_-20px_rgba(10,8,40,0.65)] backdrop-blur-2xl flex flex-col items-center gap-6 p-10 text-center">

          {/* Spinner */}
          <div className="relative w-14 h-14">
            <div
              className="absolute inset-0 rounded-full animate-spin"
              style={{
                background: `conic-gradient(from 0deg, transparent 70%, #7C75FC)`,
                WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))',
                mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))',
              }}
            />
            <div
              className="absolute inset-[3px] rounded-full"
              style={{ background: 'white' }}
            />
          </div>

          {/* Eyebrow */}
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            {t('eyebrow')}
          </p>

          {/* Main message */}
          <h2 className="-mt-3 text-[20px] font-semibold text-gray-900">
            {t('heading')}
          </h2>

          <p className="text-sm text-gray-500 leading-relaxed">
            {t('waitMessage')}
          </p>
        </div>
      </div>
    </div>
  );
}

// useSearchParams() requires a Suspense boundary in Next.js App Router
export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmInner />
    </Suspense>
  );
}
