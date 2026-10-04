'use client';

/**
 * ZAČASNA predogledna stran za Nastavitve → Podjetje.
 *
 * Prava stran potrebuje prijavljeno podjetje, zato jo tu prikažemo z
 * izmišljenim podjetjem (samo v tem drevesu, brez piškotkov) in izmišljenimi
 * podatki iz »Podatki podjetij«. Shranjevanje (POST na /api/*) je blokirano.
 * Ko je redizajn potrjen, se mapa `design` zbriše.
 */

import { supabase } from '@/lib/supabaseClient';
import { CompanyContext, useCompany } from '@/app/company-context';
import CompanySettingsPage from '../../nastavitve/podjetje/page';

const COMPANY_ROW = {
  'Naziv podjetja': 'Salon Maja d.o.o.',
  'Panoga': 'Frizerski salon',
  'Davčna številka': 'SI12345678',
  'Naslov podjetja': 'Slovenska cesta 12, 1000 Ljubljana',
  'Kontaktni telefon': '+386 1 234 5678',
  'Kontaktni_email': 'info@salonmaja.si',
  'Spletna stran': 'https://www.salonmaja.si',
  logo_url: null,
  Urnik: {
    Ponedeljek: { enabled: true, intervals: [{ start: '08:00', end: '12:00' }, { start: '13:00', end: '19:00' }] },
    Torek: { enabled: true, intervals: [{ start: '08:00', end: '19:00' }] },
    Sreda: { enabled: true, intervals: [{ start: '08:00', end: '19:00' }] },
    Četrtek: { enabled: true, intervals: [{ start: '10:00', end: '20:00' }] },
    Petek: { enabled: true, intervals: [{ start: '08:00', end: '17:00' }] },
    Sobota: { enabled: true, intervals: [{ start: '08:00', end: '13:00' }] },
    Nedelja: { enabled: false, intervals: [{ start: '08:00', end: '17:00' }] },
  },
};

type Patched = { __settingsPreview?: boolean };

if (typeof window !== 'undefined' && !(window as unknown as Patched).__settingsPreview) {
  (window as unknown as Patched).__settingsPreview = true;

  const realFrom = supabase.from.bind(supabase);
  (supabase as unknown as Record<string, unknown>).from = (table: string) => {
    if (table !== 'Podatki podjetij') return realFrom(table);
    const result = { data: COMPANY_ROW, error: null };
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'limit', 'order']) chain[m] = () => chain;
    chain.maybeSingle = async () => result;
    chain.single = async () => result;
    return chain;
  };

  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (url.includes('/api/') && method !== 'GET') {
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } }));
    }
    return realFetch(input, init);
  };
}

export default function NastavitvePodjetjePreview() {
  const real = useCompany();
  return (
    <CompanyContext.Provider value={{ ...real, companyId: 'PREVIEW' }}>
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-2xl px-4 py-7 sm:px-6 sm:py-9">
          <div className="mb-3 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            predogled — shranjevanje ne shrani ničesar
          </div>
          <CompanySettingsPage />
        </div>
      </div>
    </CompanyContext.Provider>
  );
}
