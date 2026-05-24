/**
 * /auth/confirm-error — Shown when Supabase email confirmation fails.
 *
 * This can happen when:
 *  - The confirmation link has expired (default Supabase expiry is 24 h)
 *  - The link was already used (tokens are single-use)
 *  - The URL was tampered with or is malformed
 *
 * The user is redirected here from /auth/confirm when verifyOtp() returns
 * an error. They can go back to /login or try registering again at /signup.
 */

import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { getTranslations } from 'next-intl/server';

const GRADIENT = 'linear-gradient(to right, #7C75FC, #4F8CFF, #50C3D2)';

export default async function ConfirmErrorPage() {
  const t = await getTranslations('auth.confirmError');

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
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 p-8 flex flex-col items-center text-center gap-6">

          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center shadow-sm">
            <WarningCircle size={32} weight="duotone" className="text-red-400" />
          </div>

          {/* Eyebrow */}
          <p className="text-xs font-semibold uppercase tracking-widest text-red-400 -mb-2">
            {t('eyebrow')}
          </p>

          {/* Heading */}
          <h2 className="text-2xl font-bold text-gray-900 leading-snug">
            {t('heading')}{' '}
            <span
              style={{
                background: GRADIENT,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
              }}
            >
              {t('headingHighlight')}
            </span>
          </h2>

          {/* Body */}
          <p className="text-sm text-gray-600 leading-relaxed">
            {t('body')}
          </p>

          {/* Reason list */}
          <ul className="w-full text-left space-y-2 -mt-2">
            {[
              t('reasons.expired'),
              t('reasons.alreadyUsed'),
              t('reasons.tampered'),
            ].map((reason) => (
              <li
                key={reason}
                className="flex items-start gap-2 text-sm text-gray-500"
              >
                <span
                  className="mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: GRADIENT, minWidth: '6px', minHeight: '6px' }}
                />
                {reason}
              </li>
            ))}
          </ul>

          {/* Divider */}
          <div className="w-full h-px bg-gray-100" />

          {/* Actions */}
          <div className="w-full flex flex-col gap-3">
            <Link href="/login" className="w-full">
              <Button
                className="w-full h-12 text-white font-medium transition-all duration-300 ease-in-out hover:opacity-90 hover:shadow-lg"
                style={{ background: GRADIENT }}
              >
                {t('backToLoginButton')}
              </Button>
            </Link>

            <Link href="/signup" className="w-full">
              <Button
                variant="outline"
                className="w-full h-12 font-medium text-gray-700 border-gray-200 hover:bg-gray-50 transition-colors"
              >
                {t('tryAgainButton')}
              </Button>
            </Link>
          </div>

          {/* Support */}
          <p className="text-xs text-gray-400 leading-relaxed">
            {t('support')}{' '}
            <a
              href="mailto:help@jedroplus.com"
              className="font-medium text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors"
            >
              help@jedroplus.com
            </a>
          </p>
        </div>

        {/* Back to home */}
        <p className="text-center mt-6 text-sm text-gray-500">
          <Link
            href="/"
            className="hover:text-gray-700 transition-colors underline underline-offset-2"
          >
            {t('backToStart')}
          </Link>
        </p>

      </div>
    </div>
  );
}
