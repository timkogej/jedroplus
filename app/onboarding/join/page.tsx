'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { joinCompany, type JoinCompanyResult } from '@/lib/api/billingClient';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

const STORAGE_KEY = "jedroplus_company_id";
const STORAGE_KEY_UUID = "jedroplus_company_uuid";

const isUuid = (value?: string | null) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const normalizeJoinCompanyIds = (result: JoinCompanyResult) => {
  const anyResult = result as JoinCompanyResult & {
    company_uuid?: string;
    company_public_id?: string;
  };

  const rawCompanyId = result.company_id?.trim();
  const rawCompanyUuid = anyResult.company_uuid?.trim();
  const rawCompanyPublicId = anyResult.company_public_id?.trim();

  const companyUuid = rawCompanyUuid || (isUuid(rawCompanyId) ? rawCompanyId : null);
  const companyPublicId = rawCompanyPublicId || (!isUuid(rawCompanyId) ? rawCompanyId : null);

  return {
    companyUuid,
    companyPublicId: companyPublicId ? companyPublicId.toUpperCase() : null,
  };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchProfileCompanyUuid = async (userId: string) => {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('default_company_id')
    .eq('id', userId)
    .single();

  if (error) {
    return { uuid: null as string | null, error };
  }

  const uuid = profile?.default_company_id;
  return { uuid: isUuid(uuid) ? uuid : null, error: null };
};

const fetchProfileCompanyUuidWithRetry = async (userId: string) => {
  const first = await fetchProfileCompanyUuid(userId);
  if (first.uuid) return first;

  for (const delay of [300, 900]) {
    await sleep(delay);
    const next = await fetchProfileCompanyUuid(userId);
    if (next.uuid) return next;
  }

  return first;
};

type JoinRole = null | 'admin' | 'employee';

export default function JoinCompanyPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<JoinRole>(null);
  const [companyPublicId, setCompanyPublicId] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!companyPublicId.trim()) {
      toast.error('Vnesite ID podjetja');
      return;
    }
    if (!joinCode.trim()) {
      toast.error(selectedRole === 'admin' ? 'Vnesite kodo za admine' : 'Vnesite kodo za zaposlene');
      return;
    }

    try {
      setLoading(true);

      const normalizedCompanyPublicId = companyPublicId.trim().toUpperCase();
      const normalizedJoinCode = joinCode.toUpperCase().trim();

      // Send the 6-char public ID to n8n
      const result = await joinCompany(normalizedCompanyPublicId, normalizedJoinCode);

      if (result.ok) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error('Niste prijavljeni');
          setLoading(false);
          return;
        }

        const { companyUuid: initialUuid, companyPublicId: initialPublicId } = normalizeJoinCompanyIds(result);
        let companyUUID = initialUuid;
        let companyPublicId = initialPublicId;
        let companyName = result.company_name || '';

        const profileLookup = await fetchProfileCompanyUuidWithRetry(user.id);
        if (!companyUUID && profileLookup.uuid) {
          companyUUID = profileLookup.uuid;
        }

        if (!companyUUID && companyPublicId) {
          const { data: company, error: companyError } = await supabase
            .from('companies')
            .select('id, company_id, name')
            .eq('company_id', companyPublicId)
            .maybeSingle();

          if (companyError || !company?.id) {
            console.error('Join company: failed to resolve UUID by public ID', {
              companyPublicId,
              companyError,
            });

            if (!companyUUID && profileLookup.uuid) {
              companyUUID = profileLookup.uuid;
            } else {
              toast.error('Podjetje še ni povezano s profilom. Poskusite znova čez nekaj sekund.');
              setLoading(false);
              return;
            }
          } else {
            companyUUID = company.id;
            companyPublicId = company.company_id;
            companyName = companyName || company.name || '';
          }
        }

        if (!companyUUID) {
          console.error('Join company: missing company UUID in response', result);
          toast.error('Napaka pri pridruževanju');
          setLoading(false);
          return;
        }

        if (isUuid(companyUUID) && (!profileLookup.uuid || profileLookup.uuid !== companyUUID)) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ default_company_id: companyUUID })
            .eq('id', user.id);

          if (profileError) {
            console.error('Join company: failed to update profile', profileError);
            toast.error('Napaka pri shranjevanju profila');
            setLoading(false);
            return;
          }
        }

        if (!companyPublicId) {
          const { data: company, error: companyError } = await supabase
            .from('companies')
            .select('id, company_id, name')
            .eq('id', companyUUID)
            .maybeSingle();

          if (companyError || !company?.company_id) {
            console.error('Join company: failed to load company by UUID', companyError);
            companyPublicId = initialPublicId || normalizedCompanyPublicId || null;
          }

          if (company?.company_id) {
            companyPublicId = company.company_id;
            companyName = companyName || company.name || '';
          }
        }

        if (!companyPublicId) {
          toast.error('Napaka pri nalaganju podjetja');
          setLoading(false);
          return;
        }

        // Store the 6-char public ID (used for filtering business tables)
        localStorage.setItem(STORAGE_KEY, companyPublicId);
        localStorage.setItem(STORAGE_KEY_UUID, companyUUID);
        document.cookie = `company_id=${companyPublicId}; path=/; max-age=31536000`;

        if (companyName) {
          toast.success(`Pridružili ste se podjetju ${companyName}!`);
        } else {
          toast.success('Pridružili ste se podjetju!');
        }
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 500);
      } else {
        if (result.reason === 'invalid_join_code') {
          toast.error('Koda podjetja ni pravilna');
        } else if (result.reason === 'company_not_found') {
          toast.error('Podjetje s tem ID-jem ne obstaja');
        } else {
          toast.error(result.reason || result.error || 'Napaka pri pridruževanju');
        }
        setLoading(false);
      }
    } catch (error) {
      console.error('Join company error:', error);
      toast.error('Napaka pri pridruževanju');
      setLoading(false);
    }
  };

  // Role selection view
  if (!selectedRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">
              Pridruži se podjetju
            </h1>
            <p className="text-lg text-gray-600">
              Izberite način pridružitve
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* JOIN AS ADMIN */}
            <button
              onClick={() => setSelectedRole('admin')}
              className="group relative bg-white rounded-3xl shadow-xl border-2 border-gray-100 p-10 text-left hover:border-violet-300 hover:shadow-2xl transition-all duration-300"
            >
              <div className="absolute top-6 right-6 w-16 h-16 rounded-full bg-white border-2 border-gray-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <svg className="w-8 h-8 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>

              <div className="mt-16">
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  Pridruži se kot Admin
                </h3>
                <p className="text-gray-600 mb-4">
                  Imate enake privilegije kot lastnik. Dostop do vseh podatkov podjetja, nastavitev, zaposlenih in analitike.
                </p>
                <p className="text-xs text-gray-400 mb-6">
                  Potrebujete kodo za admine od lastnika podjetja.
                </p>
                <div className="text-violet-600 font-semibold group-hover:translate-x-2 transition-transform duration-300 inline-flex items-center gap-2">
                  Nadaljuj
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </div>
            </button>

            {/* JOIN AS EMPLOYEE */}
            <button
              onClick={() => setSelectedRole('employee')}
              className="group relative bg-white rounded-3xl shadow-xl border-2 border-gray-100 p-10 text-left hover:border-cyan-300 hover:shadow-2xl transition-all duration-300"
            >
              <div className="absolute top-6 right-6 w-16 h-16 rounded-full bg-white border-2 border-gray-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <svg className="w-8 h-8 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>

              <div className="mt-16">
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  Pridruži se kot Zaposleni
                </h3>
                <p className="text-gray-600 mb-4">
                  Vidite le svoje podatke, termine in stranke. Dostop je omejen in ga lahko administrator dodatno konfigurira.
                </p>
                <p className="text-xs text-gray-400 mb-6">
                  Potrebujete kodo za zaposlene od administratorja.
                </p>
                <div className="text-cyan-600 font-semibold group-hover:translate-x-2 transition-transform duration-300 inline-flex items-center gap-2">
                  Nadaljuj
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </div>
            </button>
          </div>

          {/* Back button */}
          <div className="text-center mt-8">
            <button
              onClick={() => router.push('/onboarding')}
              className="text-gray-500 hover:text-gray-700 font-medium transition-colors"
            >
              Nazaj
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Join form view (admin or employee)
  const isAdmin = selectedRole === 'admin';

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-2 text-center text-gray-900">
          {isAdmin ? 'Pridruži se kot Admin' : 'Pridruži se kot Zaposleni'}
        </h1>
        <p className="text-center text-gray-500 mb-8 text-sm">
          {isAdmin
            ? 'Vnesite ID podjetja in kodo za admine'
            : 'Vnesite ID podjetja in kodo za zaposlene'
          }
        </p>

        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 p-8 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">ID podjetja</label>
            <Input
              value={companyPublicId}
              onChange={(e) => setCompanyPublicId(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              disabled={loading}
              className="text-2xl font-mono text-center tracking-widest uppercase"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-2 text-center">
              6-mestni ID podjetja, ki ste ga prejeli od administratorja
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              {isAdmin ? 'Koda za admine' : 'Koda za zaposlene'}
            </label>
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABCD2345"
              maxLength={8}
              disabled={loading}
              className="text-2xl font-mono text-center tracking-widest uppercase"
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            <p className="text-xs text-gray-500 mt-2 text-center">
              {isAdmin ? '8-mestna koda za admine' : '8-mestna koda za zaposlene'}
            </p>
          </div>

          <button
            onClick={handleJoin}
            disabled={loading || !companyPublicId.trim() || !joinCode.trim()}
            className="w-full h-12 text-white font-semibold rounded-xl transition-all duration-300 hover:opacity-90 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: isAdmin
                ? 'linear-gradient(to right, #8B5CF6, #06B6D4)'
                : 'linear-gradient(to right, #06B6D4, #8B5CF6)',
            }}
          >
            {loading ? 'Pridružujem...' : 'Pridruži se'}
          </button>

          <button
            onClick={() => setSelectedRole(null)}
            disabled={loading}
            className="w-full h-12 bg-white border-2 border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            Nazaj
          </button>
        </div>
      </div>
    </div>
  );
}
