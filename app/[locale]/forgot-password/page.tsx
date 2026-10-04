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
import { Link } from '@/i18n/navigation';
import AuroraBackground from '@/components/shared/AuroraBackground';
import PublicLanguageToggle from '@/components/shared/PublicLanguageToggle';
import { JedroLogo } from '@/components/brand/JedroLogo';
import { EnvelopeSimple, ArrowLeft, CheckCircle } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgotPassword');
  const tCommon = useTranslations('common');

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmed = email.trim();
    if (!trimmed) {
      setError(t('errors.emptyEmail'));
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
      setError(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#05060f] p-4">
      <AuroraBackground />
      <PublicLanguageToggle className="absolute right-4 top-4 z-20" />
      <div className="relative z-10 w-full max-w-[400px]">
        {/* Brand heading — logotip Jedro+ (components/brand/JedroLogo) */}
        <div className="mb-8 flex flex-col items-center text-center">
          <h1 className="mb-3">
            <JedroLogo height={44} tone="onDark" title="Jedro+" />
          </h1>
          <p className="text-[15px] text-white/70">{t('subtitle')}</p>
        </div>

        <div className="rounded-3xl border border-white/40 bg-white/90 p-7 shadow-[0_30px_80px_-20px_rgba(10,8,40,0.65)] backdrop-blur-2xl sm:p-8">
          {submitted ? (
            /* ── Success state ── */
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle size={44} weight="regular" className="text-green-500" />
              </div>
              <div>
                <h2 className="mb-1.5 text-[17px] font-semibold text-gray-900">{t('success.title')}</h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {t('success.message')}
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors mt-2"
              >
                <ArrowLeft size={14} />
                {t('backToLogin')}
              </Link>
            </div>
          ) : (
            /* ── Request form ── */
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h2 className="mb-1 text-[17px] font-semibold text-gray-900">{t('title')}</h2>
                <p className="text-sm text-gray-500">
                  {t('description')}
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-900">
                  {t('emailLabel')}
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
                    placeholder={tCommon('placeholders.email')}
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
                className="h-11 w-full rounded-xl font-medium text-white shadow-sm transition-opacity duration-200 hover:opacity-90 active:opacity-80"
                style={{
                  background: 'linear-gradient(to right, #8B5CF6, #06B6D4)',
                }}
              >
                {loading ? t('submittingButton') : t('submitButton')}
              </Button>
            </form>
          )}
        </div>

        {/* Back to login */}
        {!submitted && (
          <p className="mt-6 text-center text-sm text-white/70">
            {t('rememberPassword')}{' '}
            <Link
              href="/login"
              className="font-semibold text-white underline-offset-4 transition-colors hover:underline"
            >
              {t('loginLink')}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
