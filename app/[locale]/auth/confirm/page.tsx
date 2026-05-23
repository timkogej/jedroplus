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
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const GRADIENT = 'linear-gradient(to right, #7C75FC, #4F8CFF, #50C3D2)';

function ConfirmInner() {
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
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1
            className="text-4xl font-bold tracking-tight mb-2"
            style={{
              background: 'linear-gradient(to right, #8B5CF6, #3B82F6, #06B6D4)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
            }}
          >
            Jedro+
          </h1>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 p-10 flex flex-col items-center text-center gap-6">

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
          <p
            className="text-xs font-semibold uppercase tracking-widest"
            style={{
              background: GRADIENT,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
            }}
          >
            Potrjevanje
          </p>

          {/* Main message */}
          <h2 className="text-xl font-bold text-gray-900 -mt-2">
            Potrjujemo vaš email&nbsp;&hellip;
          </h2>

          <p className="text-sm text-gray-500 leading-relaxed">
            Prosimo, počakajte trenutek.
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
