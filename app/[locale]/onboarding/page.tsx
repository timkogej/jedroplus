'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabaseClient';
import PublicLanguageToggle from '@/components/shared/PublicLanguageToggle';
import AuroraBackground from '@/components/shared/AuroraBackground';
import { JedroLogo } from '@/components/brand/JedroLogo';
import { inviteFromMetadata, joinPath, loadPendingInvite } from '@/lib/team/invite';

const STORAGE_KEY = "jedroplus_company_id";

export default function OnboardingPage() {
  const router = useRouter();
  const t = useTranslations('onboarding');
  const [checking, setChecking] = useState(true);

  // Check if user already has a company
  useEffect(() => {
    const checkUserCompany = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          // Not logged in - redirect to login
          router.replace('/login');
          return;
        }

        // Check if user has a company in their profile
        // Use maybeSingle() instead of single() to avoid errors when profile doesn't exist yet
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('default_company_id')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          console.warn('Profile query error (may not exist yet):', profileError.message);
          // Profile might not exist yet for newly registered users - show onboarding
          setChecking(false);
          return;
        }

        if (profile?.default_company_id) {
          // User has a company UUID - fetch the company to get the 6-char public ID
          const { data: company } = await supabase
            .from('companies')
            .select('id, company_id, name')
            .eq('id', profile.default_company_id)
            .maybeSingle();

          if (company?.company_id) {
            // Store the 6-char public ID (used for filtering business tables)
            localStorage.setItem(STORAGE_KEY, company.company_id);
            document.cookie = `company_id=${company.company_id}; path=/; max-age=31536000`;
            // Use a hard navigation so CompanyProvider re-initialises from localStorage
            // (soft router.replace would keep the same provider instance with stale null state)
            window.location.href = '/dashboard';
            return;
          }
        }

        // Invited (link opened before sign-up, possibly on another device):
        // go straight to joining instead of the create/join choice.
        const pending = loadPendingInvite() ?? inviteFromMetadata(user.user_metadata as Record<string, unknown>);
        if (pending) {
          router.replace(joinPath(pending));
          return;
        }

        // User has no company - show onboarding options
        setChecking(false);
      } catch (error) {
        console.error('Error checking user company:', error);
        setChecking(false);
      }
    };

    checkUserCompany();
  }, [router]);

  if (checking) {
    return (
      <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-white">
        <AuroraBackground tone="light" />
        <div className="relative z-10 text-center">
          <div className="w-10 h-10 mx-auto mb-4">
            <svg className="w-10 h-10 animate-spin" viewBox="0 0 50 50">
              <defs>
                <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="50%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#06B6D4" />
                </linearGradient>
              </defs>
              <circle cx="25" cy="25" r="20" fill="none" stroke="url(#spinner-gradient)" strokeWidth="3" strokeLinecap="round" strokeDasharray="80 50" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">{t('entry.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-white px-4 py-16">
      <AuroraBackground tone="light" />
      <PublicLanguageToggle className="absolute right-4 top-4 z-20" />
      <div className="relative z-10 w-full max-w-3xl">
        {/* Glava — logotip Jedro+ (components/brand/JedroLogo) */}
        <div className="mb-10 flex flex-col items-center text-center">
          <JedroLogo height={36} className="mb-6" title="Jedro+" />
          <h1 className="mb-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
            {t('entry.title')} JedroPlus
          </h1>
          <p className="text-[17px] text-gray-500">
            {t('entry.subtitle')}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 md:gap-5">
          {/* CREATE COMPANY */}
          <button
            onClick={() => router.push('/onboarding/create')}
            className="group relative rounded-2xl border border-gray-200/70 bg-white/80 p-7 text-left shadow-[0_20px_50px_-25px_rgba(60,50,140,0.35)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-[0_28px_60px_-25px_rgba(60,50,140,0.45)] sm:p-8"
          >
            <div className="mb-8">
              <svg className="h-8 w-8 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>

            <div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">
                {t('entry.create.title')}
              </h3>
              <p className="mb-6 text-[15px] leading-relaxed text-gray-500">
                {t('entry.create.description')}
              </p>
              <div className="text-violet-600 font-semibold group-hover:translate-x-2 transition-transform duration-300 inline-flex items-center gap-2">
                {t('entry.create.cta')}
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </div>
          </button>

          {/* JOIN COMPANY */}
          <button
            onClick={() => router.push('/onboarding/join')}
            className="group relative rounded-2xl border border-gray-200/70 bg-white/80 p-7 text-left shadow-[0_20px_50px_-25px_rgba(60,50,140,0.35)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-[0_28px_60px_-25px_rgba(60,50,140,0.45)] sm:p-8"
          >
            <div className="mb-8">
              <svg className="h-8 w-8 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>

            <div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">
                {t('entry.join.title')}
              </h3>
              <p className="mb-6 text-[15px] leading-relaxed text-gray-500">
                {t('entry.join.description')}
              </p>
              <div className="text-cyan-600 font-semibold group-hover:translate-x-2 transition-transform duration-300 inline-flex items-center gap-2">
                {t('entry.join.cta')}
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
