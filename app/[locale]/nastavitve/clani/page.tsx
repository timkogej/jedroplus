'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  CaretLeft,
  Warning,
  CircleNotch,
  CheckCircle,
} from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { callN8nAction } from '@/src/lib/n8nClient';
import { GradientSpinner } from '@/components/ui/GradientSpinner';
import { useMarkVisited } from '@/hooks/useMarkVisited';
import InviteDialog from '@/components/team/InviteDialog';

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberRole = 'owner' | 'admin' | 'staff';

interface CompanyMember {
  id: string;
  user_id: string;
  role: MemberRole;
  display_name?: string;
  email?: string;
}

interface StaffPermissions {
  id?: string;
  company_id: string;
  // Termini
  can_view_all_appointments: boolean;
  can_view_only_own_appointments: boolean;
  can_edit_all_appointments: boolean;
  can_edit_only_own_appointments: boolean;
  can_create_appointments: boolean;
  can_delete_appointments: boolean;
  // Stranke
  can_view_clients: boolean;
  can_edit_clients: boolean;
  can_create_clients: boolean;
  can_delete_clients: boolean;
  // Storitve
  can_view_services: boolean;
  can_edit_services: boolean;
  can_create_services: boolean;
  can_delete_services: boolean;
  // Osebje
  can_view_staff: boolean;
  can_edit_staff: boolean;
  // Analitika
  can_view_analytics: boolean;
  // Moduli
  can_access_asistent_plus: boolean;
  can_access_komunikacija: boolean;
  can_access_chatbot_plus: boolean;
  can_manage_chatbot_plus_settings: boolean;
  can_access_opomniki: boolean;
  can_manage_opomniki: boolean;
  can_access_rezervacije: boolean;
  can_manage_rezervacije: boolean;
  can_access_lost_leads: boolean;
  can_manage_lost_leads: boolean;
  // Zgodovina
  can_view_zgodovina: boolean;
  // Ghost termini
  can_create_ghost_termin: boolean;
}

// ─── Permission config ────────────────────────────────────────────────────────

const permissionSections: {
  sectionKey: string;
  keys: { key: keyof StaffPermissions }[];
}[] = [
  {
    sectionKey: 'termini',
    keys: [
      { key: 'can_view_all_appointments' },
      { key: 'can_view_only_own_appointments' },
      { key: 'can_edit_all_appointments' },
      { key: 'can_edit_only_own_appointments' },
      { key: 'can_create_appointments' },
      { key: 'can_delete_appointments' },
      { key: 'can_create_ghost_termin' },
    ],
  },
  {
    sectionKey: 'stranke',
    keys: [
      { key: 'can_view_clients' },
      { key: 'can_edit_clients' },
      { key: 'can_create_clients' },
      { key: 'can_delete_clients' },
    ],
  },
  {
    sectionKey: 'storitve',
    keys: [
      { key: 'can_view_services' },
      { key: 'can_edit_services' },
      { key: 'can_create_services' },
      { key: 'can_delete_services' },
    ],
  },
  {
    sectionKey: 'osebje',
    keys: [
      { key: 'can_view_staff' },
      { key: 'can_edit_staff' },
    ],
  },
  {
    sectionKey: 'analitika',
    keys: [
      { key: 'can_view_analytics' },
      { key: 'can_view_zgodovina' },
    ],
  },
  {
    sectionKey: 'moduli',
    keys: [
      { key: 'can_access_asistent_plus' },
      { key: 'can_access_komunikacija' },
      { key: 'can_access_chatbot_plus' },
      { key: 'can_manage_chatbot_plus_settings' },
      { key: 'can_access_opomniki' },
      { key: 'can_manage_opomniki' },
      { key: 'can_access_rezervacije' },
      { key: 'can_manage_rezervacije' },
      { key: 'can_access_lost_leads' },
      { key: 'can_manage_lost_leads' },
    ],
  },
];

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: MemberRole }) {
  const tc = useTranslations('common');

  if (role === 'owner') {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-700">
        {tc('roles.owner')}
      </span>
    );
  }
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-indigo-50 text-indigo-700">
        {tc('roles.admin')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-700">
      {tc('roles.staff')}
    </span>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function PermissionToggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        value ? 'bg-gray-900' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          value ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClaniPage() {
  useMarkVisited('team');
  const t = useTranslations('settings');
  const { companyUuid, companyId, planCode } = useCompany();
  const [inviteOpen, setInviteOpen] = useState(false);
  const { user } = useAuth();

  const [currentRole, setCurrentRole] = useState<MemberRole | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [permissions, setPermissions] = useState<StaffPermissions | null>(null);
  const [maxUsers, setMaxUsers] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [error, setError] = useState(false);

  // ── Fetch members + current user role ──

  const fetchData = useCallback(async () => {
    if (!companyUuid || !user?.id) return;
    setLoading(true);
    setError(false);

    try {
      // 1. Fetch all members + auth info via admin API (bypasses RLS)
      const resp = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyUuid }),
      });
      const json = await resp.json();

      if (!json.ok) throw new Error(json.error ?? 'API error');

      const membersData: { id: string; user_id: string; role: MemberRole }[] = json.members ?? [];
      const userInfoMap: Record<string, { display_name: string; email: string }> = json.users ?? {};

      // 2. Determine current user role
      const me = membersData.find((m) => m.user_id === user.id);
      setCurrentRole((me?.role as MemberRole) ?? null);

      // 3. Build enriched member list
      const enriched: CompanyMember[] = membersData.map((m) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        display_name: userInfoMap[m.user_id]?.display_name ?? m.user_id,
        email: userInfoMap[m.user_id]?.email ?? '',
      }));

      // Sort: owner → admin → staff
      const roleOrder: Record<MemberRole, number> = { owner: 0, admin: 1, staff: 2 };
      enriched.sort((a, b) => (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3));

      setMembers(enriched);

      // 4. Fetch staff permissions
      const { data: permsData } = await supabaseReadOnly
        .from('staff_role_permissions')
        .select('*')
        .eq('company_id', companyUuid)
        .maybeSingle();

      setPermissions(permsData as StaffPermissions | null);

      // 5. Fetch max_users from company_user_limits
      const { data: limitsData } = await supabaseReadOnly
        .from('company_user_limits')
        .select('max_users')
        .eq('company_id', companyUuid)
        .maybeSingle();

      setMaxUsers(limitsData?.max_users ?? null);
    } catch (err) {
      console.error('[ClaniPage] fetchData error:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [companyUuid, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Toggle (local state only — save on button click) ──

  // Pairs that are mutually exclusive — enabling one disables the other
  const mutuallyExclusive: Partial<Record<keyof StaffPermissions, keyof StaffPermissions>> = {
    can_view_all_appointments: 'can_view_only_own_appointments',
    can_view_only_own_appointments: 'can_view_all_appointments',
    can_edit_all_appointments: 'can_edit_only_own_appointments',
    can_edit_only_own_appointments: 'can_edit_all_appointments',
  };

  const handleToggle = (key: keyof StaffPermissions, value: boolean) => {
    if (!permissions) return;
    const opposite = mutuallyExclusive[key];
    setPermissions((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      if (opposite) next[opposite] = !value as never;
      return next;
    });
    setSaveSuccess(false);
    setSaveError(false);
  };

  // ── Save all permissions via n8n ──

  const handleSave = async () => {
    if (!permissions || !companyUuid || !companyId || !user?.id) return;

    setSaving(true);
    setSaveSuccess(false);
    setSaveError(false);

    // Build the full permissions payload (exclude id & company_id from permission keys)
    const permissionData: Record<string, boolean> = {};
    for (const section of permissionSections) {
      for (const { key } of section.keys) {
        permissionData[key] = permissions[key] as boolean;
      }
    }

    const result = await callN8nAction({
      event: 'NASTAVITVE_STAFF',
      entity: 'staff_role_permissions',
      company_id: companyId,
      actor: user.id,
      timestamp: new Date().toISOString(),
      data: {
        company_id: companyUuid,
        user_id: user.id,
        ...permissionData,
      },
    });

    if (result.ok) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      setSaveError(true);
    }

    setSaving(false);
  };

  // ── Loading ──

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <GradientSpinner size={32} />
      </div>
    );
  }

  // ── Access denied (not owner) ──

  if (currentRole !== 'owner') {
    return (
      <div className="space-y-4">
        <Link
          href="/nastavitve"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          <CaretLeft className="w-3.5 h-3.5" weight="regular" />
          {t('back')}
        </Link>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-amber-50 p-8 text-center"
        >
          <Warning className="mx-auto mb-3 h-8 w-8 text-amber-500" weight="regular" />
          <h2 className="text-base font-semibold text-amber-900 mb-1">{t('members.noAccess.title')}</h2>
          <p className="text-sm text-amber-700">
            {t('members.noAccess.message')}
          </p>
        </motion.div>
      </div>
    );
  }

  // ── Error ──

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          href="/nastavitve"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          <CaretLeft className="w-3.5 h-3.5" weight="regular" />
          {t('back')}
        </Link>
        <div className="rounded-xl bg-red-50 p-6 text-center">
          <Warning className="mx-auto mb-2 h-7 w-7 text-red-500" weight="regular" />
          <p className="text-sm text-red-700">{t('members.loadError')}</p>
        </div>
      </div>
    );
  }

  // ── Main view ──

  return (
    <div className="space-y-6">
      <Link
        href="/nastavitve"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        <CaretLeft className="w-3.5 h-3.5" weight="regular" />
        {t('back')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{t('members.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('members.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
        >
          + {t('members.invite.button')}
        </button>
      </div>

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        usedSeats={members.length}
        maxSeats={maxUsers}
        isFree={planCode === 'FREE'}
      />

      {/* User limit banner */}
      {maxUsers !== null && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 divide-x divide-gray-100 overflow-hidden rounded-xl border border-gray-100 bg-white"
        >
          <div className="px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t('members.maxUsersLabel')}</p>
            <p className="tnum mt-0.5 text-2xl font-semibold tracking-tight text-gray-900">{maxUsers}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t('members.currentTeamLabel')}</p>
            <p className="tnum mt-0.5 text-2xl font-semibold tracking-tight text-gray-900">{members.length}</p>
          </div>
        </motion.div>
      )}

      {/* Members list */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        
      >
        <div className="mb-1.5 px-1">
          <h2 className="text-xs font-semibold uppercase tracking-[0.04em] text-gray-400">{t('members.list.title')}</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {t('members.list.subtitle')}
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
        {members.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            {t('members.list.empty')}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {members.map((member) => (
              <li key={member.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {member.display_name || member.user_id}
                  </p>
                  {member.email && (
                    <p className="text-xs text-gray-500 truncate">{member.email}</p>
                  )}
                </div>
                <RoleBadge role={member.role} />
              </li>
            ))}
          </ul>
        )}
        </div>
      </motion.div>

      {/* Staff permissions */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <div className="mb-1.5 px-1">
          <h2 className="text-xs font-semibold uppercase tracking-[0.04em] text-gray-400">
            {t('members.permissions.title')}
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {t('members.permissions.subtitle')}
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
        {!permissions ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">
            {t('members.permissions.notConfigured')}
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {permissionSections.map((section) => (
                <div key={section.sectionKey} className="px-4 py-4">
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    {t(`members.permissions.sections.${section.sectionKey}`)}
                  </h3>
                  <div className="space-y-3">
                    {section.keys.map(({ key }) => {
                      const value = permissions[key] as boolean;
                      return (
                        <div key={key} className="flex items-center justify-between gap-4">
                          <span className="text-sm text-gray-900">{t(`members.permissions.labels.${key}`)}</span>
                          <PermissionToggle
                            value={value ?? false}
                            onChange={(v) => handleToggle(key, v)}
                            disabled={saving}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Save footer */}
            <div className="flex items-center justify-between gap-4 border-t border-gray-100 px-4 py-3">
              <div className="text-sm">
                {saveSuccess && (
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" weight="regular" />
                    {t('members.permissions.saved')}
                  </span>
                )}
                {saveError && (
                  <span className="flex items-center gap-1.5 text-red-600">
                    <Warning className="h-3.5 w-3.5" weight="regular" />
                    {t('members.permissions.saveError')}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <CircleNotch className="w-4 h-4 animate-spin" />
                    {t('members.permissions.saving')}
                  </>
                ) : (
                  t('members.permissions.saveButton')
                )}
              </button>
            </div>
          </>
        )}
        </div>
      </motion.div>
    </div>
  );
}
