'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { joinCompany, type JoinCompanyResult } from '@/lib/api/billingClient';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import PublicLanguageToggle from '@/components/shared/PublicLanguageToggle';
import { Link as LocaleLink } from '@/i18n/navigation';
import {
  clearPendingInvite,
  loadPendingInvite,
  readInviteFromUrl,
  savePendingInvite,
  type PendingInvite,
} from '@/lib/team/invite';

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
  const t = useTranslations('onboarding');
  const [selectedRole, setSelectedRole] = useState<JoinRole>(null);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Invite link (?code=…&p=…&c=…) or an invite remembered from before sign-up.
  const [invite, setInvite] = useState<PendingInvite | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const fromUrl = readInviteFromUrl(window.location.search);
    const found = fromUrl ?? loadPendingInvite();
    if (found) {
      savePendingInvite(found);
      setInvite(found);
      setJoinCode(found.code);
      setSelectedRole('employee');
    }
    supabase.auth.getUser().then(({ data: { user } }) => setSignedIn(Boolean(user)));
  }, []);

  const handleJoin = async () => {
    if (!joinCode.trim()) {
      toast.error(selectedRole === 'admin' ? t('join.toasts.noCode') : t('join.toasts.noCodeEmployee'));
      return;
    }

    try {
      setLoading(true);

      const normalizedJoinCode = joinCode.toUpperCase().trim();

      const result = await joinCompany(normalizedJoinCode);

      if (result.code === 'NO_FREE_USER_SLOT') {
        const redirectUrl = result.redirect_url || 'https://app.jedroplus.com/sl/nastavitve/paketi';
        toast.error(result.message || t('join.toasts.noFreeSlot'));
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 1500);
        return;
      }

      if (result.ok) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error(t('join.toasts.notLoggedIn'));
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

            if (profileLookup.uuid) {
              companyUUID = profileLookup.uuid;
            } else {
              toast.error(t('join.toasts.profileNotLinked'));
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
          toast.error(t('join.toasts.errorJoin'));
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
            toast.error(t('join.toasts.errorProfile'));
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
            companyPublicId = initialPublicId || null;
          }

          if (company?.company_id) {
            companyPublicId = company.company_id;
            companyName = companyName || company.name || '';
          }
        }

        if (!companyPublicId) {
          toast.error(t('join.toasts.errorLoad'));
          setLoading(false);
          return;
        }

        // Invite for a specific staff card: link this login to it right away,
        // so "my appointments" works on the first visit.
        if (invite?.personId) {
          try {
            await fetch('https://n8n.jedroplus.com/webhook/connect-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: user.id,
                person_id: invite.personId,
                company_id: companyPublicId,
                company_uuid: companyUUID,
              }),
            });
          } catch (connectError) {
            // Not fatal: the owner can still link the card in Zaposleni.
            console.warn('Join company: linking staff card failed', connectError);
          }
        }
        clearPendingInvite();
        supabase.auth
          .updateUser({ data: { pending_join_code: null, pending_person_id: null, pending_company_name: null } })
          .catch(() => {});

        // Store the 6-char public ID (used for filtering business tables)
        localStorage.setItem(STORAGE_KEY, companyPublicId);
        localStorage.setItem(STORAGE_KEY_UUID, companyUUID);
        document.cookie = `company_id=${companyPublicId}; path=/; max-age=31536000`;

        if (companyName) {
          toast.success(t('join.toasts.successWithName', { name: companyName }));
        } else {
          toast.success(t('join.toasts.success'));
        }
        setTimeout(() => {
          window.location.href = `/${window.location.pathname.split('/')[1] || 'sl'}/dashboard`;
        }, 500);
      } else {
        if (result.reason === 'invalid_join_code') {
          toast.error(t('join.toasts.invalidCode'));
        } else if (result.reason === 'company_not_found') {
          toast.error(t('join.toasts.companyNotFound'));
        } else {
          // Never show raw backend codes to the user.
          const reason = String(result.reason ?? '').toLowerCase();
          toast.error(
            /seat|slot|limit|mest/.test(reason) ? t('join.toasts.noFreeSlot') : t('join.toasts.errorJoin')
          );
        }
        setLoading(false);
      }
    } catch (error) {
      console.error('Join company error:', error);
      toast.error(t('join.toasts.errorJoin'));
      setLoading(false);
    }
  };

  // Invite link opened while signed out: explain and send them to sign up.
  if (invite && signedIn === false) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-white p-4">
        <PublicLanguageToggle className="absolute right-4 top-4" />
        <div className="w-full max-w-md text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">{t('join.invite.eyebrow')}</p>
          <h1 className="mt-3 text-3xl font-bold text-gray-900">
            {invite.companyName
              ? t('join.invite.titleWithName', { name: invite.companyName })
              : t('join.invite.title')}
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">{t('join.invite.body')}</p>
          <div className="mt-8 space-y-3">
            <LocaleLink
              href="/signup"
              className="flex h-12 w-full items-center justify-center rounded-xl font-semibold text-white"
              style={{ background: 'linear-gradient(to right, #8B5CF6, #06B6D4)' }}
            >
              {t('join.invite.signUp')}
            </LocaleLink>
            <LocaleLink
              href="/login"
              className="flex h-12 w-full items-center justify-center rounded-xl border-2 border-gray-200 font-semibold text-gray-700 hover:bg-gray-50"
            >
              {t('join.invite.logIn')}
            </LocaleLink>
          </div>
        </div>
      </div>
    );
  }

  // Role selection view
  if (!selectedRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">
              {t('join.title')}
            </h1>
            <p className="text-lg text-gray-600">
              {t('join.subtitle')}
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
                  {t('join.admin.title')}
                </h3>
                <p className="text-gray-600 mb-4">
                  {t('join.admin.description')}
                </p>
                <p className="text-xs text-gray-400 mb-6">
                  {t('join.admin.note')}
                </p>
                <div className="text-violet-600 font-semibold group-hover:translate-x-2 transition-transform duration-300 inline-flex items-center gap-2">
                  {t('join.admin.cta')}
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
                  {t('join.employee.title')}
                </h3>
                <p className="text-gray-600 mb-4">
                  {t('join.employee.description')}
                </p>
                <p className="text-xs text-gray-400 mb-6">
                  {t('join.employee.note')}
                </p>
                <div className="text-cyan-600 font-semibold group-hover:translate-x-2 transition-transform duration-300 inline-flex items-center gap-2">
                  {t('join.employee.cta')}
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
              {t('join.back')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Join form view (admin or employee)
  const isAdmin = selectedRole === 'admin';

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-white p-4">
      <PublicLanguageToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-2 text-center text-gray-900">
          {invite
            ? invite.companyName
              ? t('join.invite.titleWithName', { name: invite.companyName })
              : t('join.invite.title')
            : isAdmin
            ? t('join.form.adminTitle')
            : t('join.form.employeeTitle')}
        </h1>
        <p className="text-center text-gray-500 mb-8 text-sm">
          {invite ? t('join.invite.readyBody') : isAdmin ? t('join.form.adminSubtitle') : t('join.form.employeeSubtitle')}
        </p>

        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 p-8 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              {isAdmin ? t('join.form.adminCodeLabel') : t('join.form.employeeCodeLabel')}
            </label>
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="••••••"
              maxLength={8}
              disabled={loading}
              className="text-2xl font-mono text-center tracking-widest uppercase"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            {!invite && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                {isAdmin ? t('join.form.adminCodeHint') : t('join.form.employeeCodeHint')}
              </p>
            )}
          </div>

          <button
            onClick={handleJoin}
            disabled={loading || !joinCode.trim()}
            className="w-full h-12 text-white font-semibold rounded-xl transition-all duration-300 hover:opacity-90 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: isAdmin
                ? 'linear-gradient(to right, #8B5CF6, #06B6D4)'
                : 'linear-gradient(to right, #06B6D4, #8B5CF6)',
            }}
          >
            {loading ? t('join.form.submitting') : t('join.form.submit')}
          </button>

          <button
            onClick={() => setSelectedRole(null)}
            disabled={loading}
            className="w-full h-12 bg-white border-2 border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('join.back')}
          </button>
        </div>
      </div>
    </div>
  );
}
