'use client';

/**
 * ZAČASNA predogledna stran za onboarding.
 *
 * Onboarding se pokaže samo prijavljenemu uporabniku brez podjetja, zato ta
 * stran prave strani prikaže z lažnim »novim uporabnikom«. Vsi zapisovalni
 * klici so tu blokirani (POST na /api/*, pisanje v Supabase), tako da v
 * predogledu ni mogoče ničesar ustvariti. Ko je redizajn potrjen, se mapa
 * `design` zbriše.
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import OnboardingPage from '../../onboarding/page';
import CreateCompanyPage from '../../onboarding/create/page';
import JoinCompanyPage from '../../onboarding/join/page';

type Patched = { __onboardingPreview?: boolean };

if (typeof window !== 'undefined' && !(window as unknown as Patched).__onboardingPreview) {
  (window as unknown as Patched).__onboardingPreview = true;

  const fakeUser = {
    id: 'preview-user',
    email: 'nov.uporabnik@example.com',
    user_metadata: { full_name: 'Nov Uporabnik' },
  };

  // Prijavljen uporabnik brez podjetja.
  const auth = supabase.auth as unknown as Record<string, unknown>;
  auth.getUser = async () => ({ data: { user: fakeUser }, error: null });
  auth.updateUser = async () => ({ data: { user: fakeUser }, error: null });

  // Vsaka poizvedba vrne »nič« — ni profila s podjetjem, nič se ne zapiše.
  const empty = { data: null, error: null };
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'in', 'order', 'limit', 'update', 'insert', 'upsert', 'delete', 'match']) {
    chain[m] = () => chain;
  }
  chain.maybeSingle = async () => empty;
  chain.single = async () => empty;
  chain.then = (resolve: (v: typeof empty) => unknown) => Promise.resolve(empty).then(resolve);
  (supabase as unknown as Record<string, unknown>).from = () => chain;

  // Ustvarjanje podjetja / pridružitev gresta prek /api — tu blokirano.
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (url.includes('/api/') && method !== 'GET') {
      return Promise.resolve(
        new Response(JSON.stringify({ ok: false, error: 'Predogled — nič se ne shrani.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }
    return realFetch(input, init);
  };
}

const STEPS = [
  { key: 'entry', label: 'Vstop' },
  { key: 'create', label: 'Ustvari podjetje' },
  { key: 'join', label: 'Pridruži se' },
] as const;

export default function OnboardingPreview() {
  const [step, setStep] = useState<(typeof STEPS)[number]['key']>('entry');

  return (
    <>
      <div className="fixed left-1/2 top-3 z-[60] flex -translate-x-1/2 items-center gap-1 rounded-full border border-amber-200 bg-amber-50/95 p-1 text-xs shadow-sm backdrop-blur">
        <span className="px-2 font-semibold uppercase tracking-wide text-amber-800">Predogled</span>
        {STEPS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStep(s.key)}
            className={`rounded-full px-2.5 py-1 font-medium ${
              step === s.key ? 'bg-amber-800 text-white' : 'text-amber-900 hover:bg-amber-100'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {step === 'entry' && <OnboardingPage />}
      {step === 'create' && <CreateCompanyPage />}
      {step === 'join' && <JoinCompanyPage />}
    </>
  );
}
