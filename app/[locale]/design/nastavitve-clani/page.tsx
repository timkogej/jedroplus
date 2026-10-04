'use client';

/**
 * ZAČASNA predogledna stran za Nastavitve → Člani (in okence za povabilo).
 * Prava stran z izmišljenim lastnikom in podjetjem (samo v tem drevesu,
 * brez piškotkov), izmišljenimi člani in dovoljenji. Shranjevanje je
 * blokirano. Ko je redizajn potrjen, se mapa `design` zbriše.
 */

import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { CompanyContext, useCompany } from '@/app/company-context';
import { AuthContext, useAuth } from '@/app/auth-context';
import ClaniPage from '../../nastavitve/clani/page';

const OWNER_ID = 'u-owner';

const MEMBERS = {
  ok: true,
  members: [
    { id: 'cm1', user_id: OWNER_ID, role: 'owner' },
    { id: 'cm2', user_id: 'u-admin', role: 'admin' },
    { id: 'cm3', user_id: 'u-staff1', role: 'staff' },
    { id: 'cm4', user_id: 'u-staff2', role: 'staff' },
  ],
  users: {
    [OWNER_ID]: { display_name: 'Maja Novak', email: 'maja@salonmaja.si' },
    'u-admin': { display_name: 'Luka Zupan', email: 'luka@salonmaja.si' },
    'u-staff1': { display_name: 'Eva Kranjc', email: 'eva@salonmaja.si' },
    'u-staff2': { display_name: 'Tina Golob', email: 'tina@salonmaja.si' },
  },
};

const ON = [
  'can_view_all_appointments', 'can_edit_only_own_appointments', 'can_create_appointments',
  'can_view_clients', 'can_edit_clients', 'can_create_clients', 'can_view_services', 'can_view_staff',
  'can_access_opomniki', 'can_access_rezervacije',
];
const ALL = [
  'can_access_asistent_plus', 'can_access_chatbot_plus', 'can_access_komunikacija', 'can_access_lost_leads',
  'can_access_opomniki', 'can_access_rezervacije', 'can_create_appointments', 'can_create_clients',
  'can_create_ghost_termin', 'can_create_services', 'can_delete_appointments', 'can_delete_clients',
  'can_delete_services', 'can_edit_all_appointments', 'can_edit_clients', 'can_edit_only_own_appointments',
  'can_edit_services', 'can_edit_staff', 'can_manage_chatbot_plus_settings', 'can_manage_lost_leads',
  'can_manage_opomniki', 'can_manage_rezervacije', 'can_view_all_appointments', 'can_view_analytics',
  'can_view_clients', 'can_view_only_own_appointments', 'can_view_services', 'can_view_staff', 'can_view_zgodovina',
];
const PERMISSIONS = Object.fromEntries([['company_id', 'preview-uuid'], ...ALL.map((k) => [k, ON.includes(k)])]);

type Patched = { __claniPreview?: boolean };

if (typeof window !== 'undefined' && !(window as unknown as Patched).__claniPreview) {
  (window as unknown as Patched).__claniPreview = true;

  const realFrom = supabase.from.bind(supabase);
  (supabase as unknown as Record<string, unknown>).from = (table: string) => {
    const rows: Record<string, unknown> = {
      staff_role_permissions: PERMISSIONS,
      company_user_limits: { max_users: 5 },
    };
    if (!(table in rows)) return realFrom(table);
    const result = { data: rows[table], error: null };
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'limit']) chain[m] = () => chain;
    chain.maybeSingle = async () => result;
    return chain;
  };

  const json = (body: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } }));
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/members')) return json(MEMBERS);
    if (url.includes('/api/company/join-codes')) return json({ ok: true, adminCode: 'ADM123', staffCode: 'STF456' });
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url.includes('/api/') && method !== 'GET') return json({ ok: true });
    return realFetch(input, init);
  };
}

export default function NastavitveClaniPreview() {
  const company = useCompany();
  const auth = useAuth();
  const fakeUser = { id: OWNER_ID, email: 'maja@salonmaja.si' } as User;

  return (
    <AuthContext.Provider value={{ ...auth, user: fakeUser, loading: false }}>
      <CompanyContext.Provider
        value={{
          ...company,
          companyId: 'PREVIEW',
          companyUuid: 'preview-uuid',
          planCode: 'PRO',
          companySettings: { ...(company.companySettings ?? {}), companyName: 'Salon Maja' } as typeof company.companySettings,
        }}
      >
        <div className="min-h-screen bg-white">
          <div className="mx-auto max-w-2xl px-4 py-7 sm:px-6 sm:py-9">
            <div className="mb-3 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              predogled — shranjevanje ne shrani ničesar
            </div>
            <ClaniPage />
          </div>
        </div>
      </CompanyContext.Provider>
    </AuthContext.Provider>
  );
}
