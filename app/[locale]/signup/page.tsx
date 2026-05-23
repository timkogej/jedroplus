'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';
import { SpinnerGap } from '@phosphor-icons/react';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    confirmEmail: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName || !formData.email || !formData.confirmEmail || !formData.password) {
      toast.error('Izpolnite vsa polja');
      return;
    }

    if (formData.email !== formData.confirmEmail) {
      toast.error('Email naslova se ne ujemata');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Geslo mora biti dolgo vsaj 6 znakov');
      return;
    }

    try {
      setLoading(true);

      // Retry logic for transient network errors (AuthRetryableFetchError)
      let signUpData = null;
      const maxRetries = 3;

      const supabase = createClient();
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const { error, data } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
              data: {
                full_name: formData.fullName
              }
            }
          });

          if (error) {
            // Only retry on retryable fetch errors (network issues)
            if (error.name === 'AuthRetryableFetchError' && attempt < maxRetries - 1) {
              // Wait before retrying: 1s, 2s
              await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
              continue;
            }
            throw error;
          }

          signUpData = data;
          break;
        } catch (err: unknown) {
          const isRetryable = err instanceof Error &&
            (err.name === 'AuthRetryableFetchError' || err.message === 'Load failed');
          if (isRetryable && attempt < maxRetries - 1) {
            await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
            continue;
          }
          throw err;
        }
      }

      if (signUpData?.user) {
        toast.success('Račun ustvarjen!');
        // Redirect to the check-email screen so the user knows to confirm their inbox.
        // DO NOT redirect to /onboarding or /dashboard here — the account is not yet confirmed.
        window.location.href = '/auth/check-email';
      }

    } catch (error: unknown) {
      console.error('Signup error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Prišlo je do napake pri registraciji';
      if (errorMessage.includes('already registered')) {
        toast.error('Ta email naslov je že registriran');
      } else if (error instanceof Error && (error.name === 'AuthRetryableFetchError' || error.message === 'Load failed')) {
        toast.error('Prišlo je do napake pri povezavi. Prosimo, poskusite znova.');
      } else {
        toast.error(errorMessage);
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">
        {/* Heading */}
        <div className="text-center mb-8">
          <h1
            className="text-4xl font-bold tracking-tight mb-2"
            style={{
              background: 'linear-gradient(to right, #8B5CF6, #3B82F6, #06B6D4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Jedro+
          </h1>
          <p className="text-gray-600">Ustvarite nov račun</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSignup} className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 p-8 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Ime in priimek</label>
            <Input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              placeholder="Janez Novak"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Email</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              placeholder="janez@podjetje.si"
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Potrdi email</label>
            <Input
              type="email"
              value={formData.confirmEmail}
              onChange={(e) => setFormData({...formData, confirmEmail: e.target.value})}
              placeholder="janez@podjetje.si"
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Geslo</label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              placeholder="••••••••"
              disabled={loading}
              autoComplete="new-password"
            />
            <p className="text-xs text-gray-500 mt-1">Najmanj 6 znakov</p>
          </div>

          <Button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full h-12 text-white font-medium transition-all duration-300 ease-in-out hover:opacity-90 hover:shadow-lg"
            style={{
              background: 'linear-gradient(to right, #8B5CF6, #06B6D4)',
            }}
          >
            {loading ? (
              <>
                <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                Ustvarjam račun...
              </>
            ) : 'Registracija'}
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">ali</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Google button */}
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={loading || googleLoading}
            className="w-full flex items-center justify-center gap-3 h-12 px-6 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium text-sm shadow-sm hover:bg-gray-50 hover:shadow-md transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 flex-shrink-0">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            {googleLoading ? 'Prijavljam...' : 'Registracija z Google'}
          </button>
        </form>

        {/* Login Link */}
        <p className="text-center mt-6 text-sm text-gray-600">
          Že imate račun?{' '}
          <Link href="/login" className="font-semibold text-violet-600 hover:text-violet-700 transition-colors">
            Prijavite se
          </Link>
        </p>
      </div>
    </div>
  );
}
