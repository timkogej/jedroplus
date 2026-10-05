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
import { getTranslations, setRequestLocale } from 'next-intl/server';
import AuroraBackground from '@/components/shared/AuroraBackground';
import PublicLanguageToggle from '@/components/shared/PublicLanguageToggle';
import { JedroLogo } from '@/components/brand/JedroLogo';

const GRADIENT = 'linear-gradient(to right, #7C75FC, #4F8CFF, #50C3D2)';

export default async function ConfirmErrorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // Jezik iz naslova strani — brez tega se vnaprej zgrajena stran vedno
  // prikaže v privzeti slovenščini.
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'auth.confirmError' });

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#05060f] px-4 py-16">
      <AuroraBackground />
      <PublicLanguageToggle className="absolute right-4 top-4 z-20" />
      <div className="relative z-10 w-full max-w-[400px]">

        {/* Logo Jedro+ (components/brand/JedroLogo) */}
        <div className="mb-8 flex justify-center">
          <h1>
            <JedroLogo height={44} tone="onDark" title="Jedro+" />
          </h1>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-white/40 bg-white/90 shadow-[0_30px_80px_-20px_rgba(10,8,40,0.65)] backdrop-blur-2xl flex flex-col items-center gap-6 p-7 text-center sm:p-8">

          {/* Icon */}
          <WarningCircle size={44} weight="regular" className="text-red-500" />

          {/* Eyebrow */}
          <p className="-mb-2 text-[11px] font-semibold uppercase tracking-wider text-red-500">
            {t('eyebrow')}
          </p>

          {/* Heading */}
          <h2 className="text-[22px] font-semibold leading-snug text-gray-900">
            {t('heading')}{' '}
            <span>{t('headingHighlight')}</span>
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
                  className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-300"
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
                className="h-11 w-full rounded-xl font-medium text-white shadow-sm transition-opacity duration-200 hover:opacity-90 active:opacity-80"
                style={{ background: GRADIENT }}
              >
                {t('backToLoginButton')}
              </Button>
            </Link>

            <Link href="/signup" className="w-full">
              <Button
                variant="outline"
                className="h-11 w-full rounded-xl border-gray-200 font-medium text-gray-900 transition-colors hover:bg-gray-50"
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
        <p className="mt-6 text-center text-sm">
          <Link
            href="/"
            className="text-white/70 underline underline-offset-4 transition-colors hover:text-white"
          >
            {t('backToStart')}
          </Link>
        </p>

      </div>
    </div>
  );
}
