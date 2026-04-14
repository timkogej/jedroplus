/**
 * Forgot Password page (/forgot-password)
 *
 * Step 1 of the password reset flow. The user enters their email address and
 * Supabase sends a recovery link. The link points to /auth/reset-password where
 * the user completes the password update.
 */

'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { EnvelopeSimple, ArrowLeft, CheckCircle } from '@phosphor-icons/react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmed = email.trim();
    if (!trimmed) {
      setError('Vnesite email naslov.');
      return;
    }

    try {
      setLoading(true);

      const supabase = createClient();
      const { error: supabaseError } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: 'https://app.jedroplus.com/auth/reset-password',
      });

      // Do not expose whether the email exists — show success regardless.
      if (supabaseError) {
        console.error('Password reset error:', supabaseError.message);
      }

      setSubmitted(true);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Prišlo je do napake. Prosimo, poskusite znova.');
    } finally {
      setLoading(false);
    }
  };

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
          {submitted ? (
            /* ── Success state ── */
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                  <CheckCircle size={32} weight="fill" className="text-green-500" />
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Preverite svojo pošto</h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Če račun s tem email naslovom obstaja, smo vam poslali povezavo za ponastavitev gesla.
                  Preverite tudi mapo z neželeno pošto.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors mt-2"
              >
                <ArrowLeft size={14} />
                Nazaj na prijavo
              </Link>
            </div>
          ) : (
            /* ── Request form ── */
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Pozabljeno geslo</h2>
                <p className="text-sm text-gray-500">
                  Vnesite svoj email naslov in poslali vam bomo povezavo za ponastavitev gesla.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Email naslov
                </label>
                <div className="relative">
                  <EnvelopeSimple
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    placeholder="janez@podjetje.si"
                    disabled={loading}
                    autoComplete="email"
                    className="pl-9"
                  />
                </div>
                {error && (
                  <p className="text-xs text-red-500 mt-1.5">{error}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-white font-medium transition-all duration-300 ease-in-out hover:opacity-90 hover:shadow-lg"
                style={{
                  background: 'linear-gradient(to right, #8B5CF6, #06B6D4)',
                }}
              >
                {loading ? 'Pošiljam...' : 'Pošlji povezavo za ponastavitev'}
              </Button>
            </form>
          )}
        </div>

        {/* Back to login */}
        {!submitted && (
          <p className="text-center mt-6 text-sm text-gray-600">
            Ste se spomnili gesla?{' '}
            <Link
              href="/login"
              className="font-semibold text-violet-600 hover:text-violet-700 transition-colors"
            >
              Prijavite se
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
