/**
 * Reset Password page (/auth/reset-password)
 *
 * Step 2 of the password reset flow. The user arrives here from the Supabase
 * recovery email. Supabase sends the link with `token_hash` and `type=recovery`
 * query params (email OTP flow). We verify the token via verifyOtp(), which
 * establishes a recovery session, then let the user set a new password.
 *
 * Flow:
 *   1. Read `token_hash` + `type` from URL search params on mount.
 *   2. Validate that type === "recovery" and token_hash is present.
 *   3. Call supabase.auth.verifyOtp({ token_hash, type: "recovery" }).
 *   4. On success, render the new-password form.
 *   5. On submit, call supabase.auth.updateUser({ password }).
 *   6. Sign out (clears recovery session) and redirect to /login.
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { CheckCircle, WarningCircle, LockKey, ArrowLeft } from '@phosphor-icons/react';

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Inner component — needs access to useSearchParams()                        */
/* ─────────────────────────────────────────────────────────────────────────── */

function ResetPasswordForm() {
  const searchParams = useSearchParams();

  // Token verification state
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState('');

  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // ── Verify the recovery token from the email link on mount ───────────────
  useEffect(() => {
    const tokenHash = searchParams.get('token_hash');
    const type = searchParams.get('type');

    // Guard: both params must be present and type must be "recovery"
    if (!tokenHash || type !== 'recovery') {
      setSessionError(
        'Povezava za ponastavitev gesla je neveljavna ali je potekla. Zahtevajte novo povezavo.'
      );
      return;
    }

    const supabase = createClient();

    // verifyOtp establishes a short-lived recovery session that allows
    // updateUser() to change the password without the old one being known.
    supabase.auth
      .verifyOtp({ token_hash: tokenHash, type: 'recovery' })
      .then(({ error }) => {
        if (error) {
          console.error('Token verification error:', error.message);
          setSessionError(
            'Povezava za ponastavitev gesla je neveljavna ali je potekla. Zahtevajte novo povezavo.'
          );
        } else {
          setSessionReady(true);
        }
      });
  }, [searchParams]);

  // ── Submit new password ──────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!password || !confirmPassword) {
      setFormError('Izpolnite obe polji.');
      return;
    }

    if (password.length < 6) {
      setFormError('Geslo mora biti dolgo vsaj 6 znakov.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Gesli se ne ujemata.');
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();

      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        console.error('Password update error:', error.message);
        setFormError('Napaka pri posodobitvi gesla. Prosimo, poskusite znova.');
        return;
      }

      // Clear the recovery session — user must log in with the new password.
      await supabase.auth.signOut();

      setSuccess(true);

      // Redirect after a short delay so the user can read the success message.
      setTimeout(() => {
        window.location.href = '/login';
      }, 2500);
    } catch (err) {
      console.error('Unexpected error:', err);
      setFormError('Prišlo je do napake. Prosimo, poskusite znova.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  // Invalid / expired link
  if (sessionError) {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <WarningCircle size={32} weight="fill" className="text-red-400" />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Neveljavna povezava</h2>
          <p className="text-sm text-gray-600 leading-relaxed">{sessionError}</p>
        </div>
        <Link
          href="/forgot-password"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors mt-2"
        >
          Zahtevaj novo povezavo
        </Link>
      </div>
    );
  }

  // Verifying token (not yet ready and no error)
  if (!sessionReady) {
    return (
      <div className="text-center py-4">
        <div className="flex justify-center mb-4">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-sm text-gray-500">Preverjamo povezavo za ponastavitev gesla ...</p>
      </div>
    );
  }

  // Password updated successfully
  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
            <CheckCircle size={32} weight="fill" className="text-green-500" />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Geslo posodobljeno</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Geslo je bilo uspešno posodobljeno. Preusmerjamo vas na prijavo...
          </p>
        </div>
        <div className="flex justify-center">
          <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin mt-1" />
        </div>
      </div>
    );
  }

  // New password form
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Nastavite novo geslo</h2>
        <p className="text-sm text-gray-500">Vnesite novo geslo za svoj račun.</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Novo geslo</label>
        <div className="relative">
          <LockKey
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <Input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFormError('');
            }}
            placeholder="••••••••"
            disabled={loading}
            autoComplete="new-password"
            className="pl-9"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">Najmanj 6 znakov</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Potrdi geslo</label>
        <div className="relative">
          <LockKey
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setFormError('');
            }}
            placeholder="••••••••"
            disabled={loading}
            autoComplete="new-password"
            className="pl-9"
          />
        </div>
      </div>

      {formError && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <WarningCircle size={16} weight="fill" className="text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-600">{formError}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-12 text-white font-medium transition-all duration-300 ease-in-out hover:opacity-90 hover:shadow-lg"
        style={{
          background: 'linear-gradient(to right, #8B5CF6, #06B6D4)',
        }}
      >
        {loading ? 'Shranjujem...' : 'Nastavi novo geslo'}
      </Button>
    </form>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Page wrapper — Suspense required because useSearchParams() needs it        */
/* ─────────────────────────────────────────────────────────────────────────── */

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">
        {/* Brand heading */}
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
          <p className="text-gray-600">Ponastavitev gesla</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 p-8">
          <Suspense
            fallback={
              <div className="text-center py-4">
                <div className="flex justify-center mb-4">
                  <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-sm text-gray-500">Nalagam...</p>
              </div>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </div>

        {/* Back to login */}
        <p className="text-center mt-6 text-sm text-gray-600">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-semibold text-violet-600 hover:text-violet-700 transition-colors"
          >
            <ArrowLeft size={14} />
            Nazaj na prijavo
          </Link>
        </p>
      </div>
    </div>
  );
}
