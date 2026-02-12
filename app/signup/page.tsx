'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    confirmEmail: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);

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
        window.location.href = '/onboarding';
      }

    } catch (error: unknown) {
      console.error('Signup error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Napaka pri registraciji';
      if (errorMessage.includes('already registered')) {
        toast.error('Ta email naslov je že registriran');
      } else if (error instanceof Error && (error.name === 'AuthRetryableFetchError' || error.message === 'Load failed')) {
        toast.error('Napaka pri povezavi. Prosimo, poskusite znova.');
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
            disabled={loading}
            className="w-full h-12 text-white font-medium transition-all duration-300 ease-in-out hover:opacity-90 hover:shadow-lg"
            style={{
              background: 'linear-gradient(to right, #8B5CF6, #06B6D4)',
            }}
          >
            {loading ? 'Ustvarjam račun...' : 'Registracija'}
          </Button>
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
