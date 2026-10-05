/**
 * Post-signup "check your email" screen for the Supabase confirm-email flow.
 * Shown immediately after a successful email/password registration.
 * The user is redirected here from /signup once supabase.auth.signUp() succeeds.
 * They must confirm their email via the link sent by Supabase before continuing.
 */

'use client';

import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { EnvelopeSimple } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import AuroraBackground from '@/components/shared/AuroraBackground';
import PublicLanguageToggle from '@/components/shared/PublicLanguageToggle';
import { JedroLogo } from '@/components/brand/JedroLogo';

const GRADIENT = 'linear-gradient(to right, #7C75FC, #4F8CFF, #50C3D2)';

export default function CheckEmailPage() {
  const t = useTranslations('auth.checkEmail');
  const tCommon = useTranslations('common');

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
          <EnvelopeSimple size={44} weight="regular" className="text-[#7C78FA]" />

          {/* Eyebrow */}
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            {t('eyebrow')}
          </p>

          {/* Heading */}
          <h2 className="-mt-3 text-[22px] font-semibold leading-snug text-gray-900">
            {t('heading')}{' '}
            <span>{t('headingHighlight')}</span>
          </h2>

          {/* Body */}
          <p className="text-sm text-gray-600 leading-relaxed">
            {t('body')}
          </p>

          {/* Spam hint */}
          <p className="text-sm text-gray-500">
            {t('spamHint')}{' '}
            <span className="font-medium text-gray-700">{t('spamFolder')}</span> {tCommon('divider.or')}{' '}
            <span className="font-medium text-gray-700">{t('promotionsFolder')}</span>.
          </p>

          {/* Divider */}
          <div className="w-full h-px bg-gray-100" />

          {/* Actions */}
          <div className="w-full flex flex-col gap-3">
            {/* Primary — go to login */}
            <Link href="/login" className="w-full">
              <Button
                className="h-11 w-full rounded-xl font-medium text-white shadow-sm transition-opacity duration-200 hover:opacity-90 active:opacity-80"
                style={{ background: GRADIENT }}
              >
                {t('openLoginButton')}
              </Button>
            </Link>

            {/* Secondary — resend email (TODO: wire up Supabase resend logic) */}
            <Button
              type="button"
              variant="outline"
              disabled
              className="h-11 w-full cursor-not-allowed rounded-xl border-gray-200 font-medium text-gray-400"
              title={t('resendTooltip')}
            >
              {t('resendButton')}
            </Button>
          </div>

          {/* Muted note */}
          <p className="text-xs text-gray-400 leading-relaxed -mt-1">
            {t('afterConfirm')}
          </p>
        </div>

        {/* Back to home */}
        <p className="mt-6 text-center text-sm">
          <Link href="/" className="text-white/70 underline underline-offset-4 transition-colors hover:text-white">
            {t('backToStart')}
          </Link>
        </p>

      </div>
    </div>
  );
}
