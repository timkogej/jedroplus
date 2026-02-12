'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const STORAGE_KEY = "jedroplus_company_id";

export default function OnboardingPage() {
  const router = useRouter();
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
            router.replace('/dashboard');
            return;
          }
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

  // Show loading while checking - minimalist white bg + gradient spinner
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
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
          <p className="text-gray-500 text-sm">Preverjam...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-4xl">
        {/* Header - no J+ symbol, just text */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Dobrodošli v{' '}
            <span
              style={{
                background: 'linear-gradient(to right, #8B5CF6, #3B82F6, #06B6D4)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Jedro+
            </span>
          </h1>
          <p className="text-lg text-gray-600">
            Začnite z ustvarjanjem ali pridružitvijo podjetju
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* CREATE COMPANY */}
          <button
            onClick={() => router.push('/onboarding/create')}
            className="group relative bg-white rounded-3xl shadow-xl border-2 border-gray-100 p-10 text-left hover:border-violet-300 hover:shadow-2xl transition-all duration-300"
          >
            <div className="absolute top-6 right-6 w-16 h-16 rounded-full bg-white border-2 border-gray-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <svg className="w-8 h-8 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>

            <div className="mt-16">
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Ustvari novo podjetje
              </h3>
              <p className="text-gray-600 mb-6">
                Začnite z novim podjetjem in povabite svoje zaposlene
              </p>
              <div className="text-violet-600 font-semibold group-hover:translate-x-2 transition-transform duration-300 inline-flex items-center gap-2">
                Začni
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </div>
          </button>

          {/* JOIN COMPANY */}
          <button
            onClick={() => router.push('/onboarding/join')}
            className="group relative bg-white rounded-3xl shadow-xl border-2 border-gray-100 p-10 text-left hover:border-cyan-300 hover:shadow-2xl transition-all duration-300"
          >
            <div className="absolute top-6 right-6 w-16 h-16 rounded-full bg-white border-2 border-gray-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <svg className="w-8 h-8 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>

            <div className="mt-16">
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Pridruži se podjetju
              </h3>
              <p className="text-gray-600 mb-6">
                Imate ID in kodo podjetja? Pridružite se obstoječemu podjetju
              </p>
              <div className="text-cyan-600 font-semibold group-hover:translate-x-2 transition-transform duration-300 inline-flex items-center gap-2">
                Pridruži se
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
