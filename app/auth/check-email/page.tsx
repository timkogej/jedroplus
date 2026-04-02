/**
 * Post-signup "check your email" screen for the Supabase confirm-email flow.
 * Shown immediately after a successful email/password registration.
 * The user is redirected here from /signup once supabase.auth.signUp() succeeds.
 * They must confirm their email via the link sent by Supabase before continuing.
 */

'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EnvelopeSimple } from '@phosphor-icons/react';

const GRADIENT = 'linear-gradient(to right, #7C75FC, #4F8CFF, #50C3D2)';

export default function CheckEmailPage() {
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
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-md"
            style={{ background: GRADIENT }}
          >
            <EnvelopeSimple size={32} weight="bold" color="white" />
          </div>

          {/* Eyebrow */}
          <p
            className="text-xs font-semibold uppercase tracking-widest"
            style={{
              background: GRADIENT,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
            }}
          >
            Skoraj končano
          </p>

          {/* Heading */}
          <h2 className="text-2xl font-bold text-gray-900 leading-snug -mt-2">
            Na vaš email smo poslali{' '}
            <span
              style={{
                background: GRADIENT,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
              }}
            >
              potrditveno povezavo
            </span>
          </h2>

          {/* Body */}
          <p className="text-sm text-gray-600 leading-relaxed">
            Za dokončanje registracije odprite svoj email in kliknite potrditveno
            povezavo. Ko potrdite svoj email, boste lahko nadaljevali z uporabo
            aplikacije.
          </p>

          {/* Spam hint */}
          <p className="text-sm text-gray-500">
            Če sporočila ne najdete, preverite tudi{' '}
            <span className="font-medium text-gray-700">vsiljeno pošto</span> ali{' '}
            <span className="font-medium text-gray-700">promocije</span>.
          </p>

          {/* Divider */}
          <div className="w-full h-px bg-gray-100" />

          {/* Actions */}
          <div className="w-full flex flex-col gap-3">
            {/* Primary — go to login */}
            <Link href="/login" className="w-full">
              <Button
                className="w-full h-12 text-white font-medium transition-all duration-300 ease-in-out hover:opacity-90 hover:shadow-lg"
                style={{ background: GRADIENT }}
              >
                Odpri prijavo
              </Button>
            </Link>

            {/* Secondary — resend email (TODO: wire up Supabase resend logic) */}
            <Button
              type="button"
              variant="outline"
              disabled
              className="w-full h-12 font-medium text-gray-400 border-gray-200 cursor-not-allowed"
              title="Funkcija bo na voljo kmalu"
            >
              Ponovno pošlji email
            </Button>
          </div>

          {/* Muted note */}
          <p className="text-xs text-gray-400 leading-relaxed -mt-1">
            Ko potrdite email, se lahko vrnete v aplikacijo in nadaljujete.
          </p>
        </div>

        {/* Back to home */}
        <p className="text-center mt-6 text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-700 transition-colors underline underline-offset-2">
            Nazaj na začetek
          </Link>
        </p>

      </div>
    </div>
  );
}
