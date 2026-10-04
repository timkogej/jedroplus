'use client';

/**
 * ZAČASNA predogledna stran za Nastavitve → Zgodovina. Prava stran z
 * izmišljenim podjetjem in vlogo lastnika (samo v tem drevesu) in
 * izmišljenimi zapisi iz »zgodovina«. Ko je redizajn potrjen, se mapa
 * `design` zbriše.
 */

import { supabase } from '@/lib/supabaseClient';
import { CompanyContext, useCompany } from '@/app/company-context';
import { RolePermissionContext } from '@/app/role-permission-context';
import ZgodovinaPage from '../../nastavitve/zgodovina/page';

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

const base = { 'ID podjetja': 'PREVIEW', 'ID termina': null, 'ID stranke': null };

const ROWS = [
  {
    ...base, id: 1, tip_entitete: 'termin', 'ID entitete': 'T-20481', akcija: 'prestavljen',
    izvedel: 'maja@salonmaja.si', izvedel_tip: 'uporabnik', 'ID termina': 'T-20481', 'ID stranke': 'S-1042',
    spremembe: { prej: { datum: '2026-10-08', cas: '15:00', storitev: 'Žensko striženje' }, potem: { datum: '2026-10-09', cas: '16:30', storitev: 'Žensko striženje' } },
    created_at: hoursAgo(1),
  },
  {
    ...base, id: 2, tip_entitete: 'termin', 'ID entitete': 'T-20482', akcija: 'online_rezervacija',
    izvedel: 'Ana Kovač', izvedel_tip: 'stranka', 'ID termina': 'T-20482', spremembe: null, created_at: hoursAgo(3),
  },
  {
    ...base, id: 3, tip_entitete: 'stranka', 'ID entitete': 'S-1043', akcija: 'stranka_dodana',
    izvedel: 'luka@salonmaja.si', izvedel_tip: 'uporabnik', 'ID stranke': 'S-1043', spremembe: null, created_at: hoursAgo(20),
  },
  {
    ...base, id: 4, tip_entitete: 'stranka', 'ID entitete': 'S-1042', akcija: 'stranka_posodobljena',
    izvedel: 'maja@salonmaja.si', izvedel_tip: 'uporabnik', 'ID stranke': 'S-1042',
    spremembe: { prej: { telefon: '041 234 567', email: 'ana@example.com' }, potem: { telefon: '041 234 567', email: 'ana.kovac@example.com' } },
    created_at: hoursAgo(30),
  },
  {
    ...base, id: 5, tip_entitete: 'termin', 'ID entitete': 'T-20460', akcija: 'zakljucen',
    izvedel: null, izvedel_tip: 'sistem', 'ID termina': 'T-20460', spremembe: null, created_at: hoursAgo(52),
  },
  {
    ...base, id: 6, tip_entitete: 'termin', 'ID entitete': 'T-20455', akcija: 'odpovedan',
    izvedel: 'Eva Kranjc', izvedel_tip: 'stranka', 'ID termina': 'T-20455', spremembe: null, created_at: hoursAgo(75),
  },
];

type Patched = { __zgodovinaPreview?: boolean };

if (typeof window !== 'undefined' && !(window as unknown as Patched).__zgodovinaPreview) {
  (window as unknown as Patched).__zgodovinaPreview = true;
  const realFrom = supabase.from.bind(supabase);
  (supabase as unknown as Record<string, unknown>).from = (table: string) => {
    if (table !== 'zgodovina') return realFrom(table);
    const result = { data: ROWS, count: 120, error: null };
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'gte', 'lte', 'order', 'range']) chain[m] = () => chain;
    chain.then = (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve);
    return chain;
  };
}

export default function NastavitveZgodovinaPreview() {
  const company = useCompany();
  return (
    <RolePermissionContext.Provider value={{ role: 'owner', personId: null, permissions: null, loading: false }}>
      <CompanyContext.Provider value={{ ...company, companyId: 'PREVIEW' }}>
        <div className="min-h-screen bg-white">
          <div className="mx-auto max-w-2xl px-4 py-7 sm:px-6 sm:py-9">
            <div className="mb-3 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              predogled
            </div>
            <ZgodovinaPage />
          </div>
        </div>
      </CompanyContext.Provider>
    </RolePermissionContext.Provider>
  );
}
