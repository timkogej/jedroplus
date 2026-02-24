'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';

const STORAGE_KEY = "jedroplus_company_id";

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Izpolnite vsa polja');
      return;
    }

    try {
      setLoading(true);

      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      toast.success('Prijavljeni!');

      // Check if user has a company in their profile
      if (authData.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('default_company_id')
          .eq('id', authData.user.id)
          .maybeSingle();

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

            setTimeout(() => {
              window.location.href = '/dashboard';
            }, 500);
          } else {
            // Company not found - go to onboarding
            setTimeout(() => {
              window.location.href = '/onboarding';
            }, 500);
          }
        } else {
          // User has no company - go to onboarding
          setTimeout(() => {
            window.location.href = '/onboarding';
          }, 500);
        }
      }

    } catch (error: unknown) {
      console.error('Login error:', error);
      toast.error('Napačen email ali geslo');
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
            disabled={loading}
            className="w-full h-12 text-white font-medium transition-all duration-300 ease-in-out hover:opacity-90 hover:shadow-lg"
            style={{
              background: 'linear-gradient(to right, #8B5CF6, #06B6D4)',
            }}
          >
            {loading ? 'Prijavljam...' : 'Prijava'}
          </Button>
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
