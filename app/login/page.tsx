'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';

const STORAGE_KEY = "jedroplus_company_id";

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Izpolnite vsa polja');
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();

      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      toast.success('Prijavljeni!');

      if (authData.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('default_company_id')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (profile?.default_company_id) {
          const { data: company } = await supabase
            .from('companies')
            .select('id, company_id, name')
            .eq('id', profile.default_company_id)
            .maybeSingle();

          if (company?.company_id) {
            localStorage.setItem(STORAGE_KEY, company.company_id);
            document.cookie = `company_id=${company.company_id}; path=/; max-age=31536000`;
            setTimeout(() => { window.location.href = '/dashboard'; }, 500);
          } else {
            setTimeout(() => { window.location.href = '/onboarding'; }, 500);
          }
        } else {
          setTimeout(() => { window.location.href = '/onboarding'; }, 500);
        }
      }
    } catch (error: unknown) {
      console.error('Login error:', error);
      toast.error('Napačen email ali geslo');
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    // Page will redirect — no need to reset loading state
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
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
            }}
          >
            Jedro+
          </h1>
          <p className="text-gray-600">Prijava v sistem</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 p-8 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="janez@podjetje.si"
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Geslo</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <Button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full h-12 text-white font-medium transition-all duration-300 ease-in-out hover:opacity-90 hover:shadow-lg"
            style={{
              background: 'linear-gradient(to right, #8B5CF6, #06B6D4)',
            }}
          >
            {loading ? 'Prijavljam...' : 'Prijava'}
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
            onClick={handleGoogleLogin}
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
            {googleLoading ? 'Prijavljam...' : 'Prijava z Google'}
          </button>
        </form>

        {/* Signup Link */}
        <p className="text-center mt-6 text-sm text-gray-600">
          Nimate računa?{' '}
          <Link href="/signup" className="font-semibold text-violet-600 hover:text-violet-700 transition-colors">
            Registrirajte se
          </Link>
        </p>
      </div>
    </div>
  );
}
