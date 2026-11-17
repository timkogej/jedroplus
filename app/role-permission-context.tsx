'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './auth-context';
import { useCompany } from './company-context';
import { getUserRole, getStaffPermissions } from '@/lib/supabase/companyMembers';
import type { MemberRole, StaffPermissions } from '@/types/roles';

interface RolePermissionContextValue {
  /** The user's role in the current company. null = not loaded yet or no record. */
  role: MemberRole | null;
  /** The person_id from company_members (links auth user → Osebe record). */
  personId: string | null;
  /** Granular permissions — only populated when role === 'staff'. */
  permissions: StaffPermissions | null;
  /**
   * Ali sme uporabnik videti, kateri termini so ghost. Lastnik vedno; admin in
   * zaposleni samo z dovoljenjem "can_view_ghost_termini". Vsi ostali vidijo
   * ghost termin kot običajen termin.
   */
  canSeeGhost: boolean;
  loading: boolean;
}

const RolePermissionContext = createContext<RolePermissionContextValue | undefined>(
  undefined
);

export function RolePermissionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { companyUuid } = useCompany();

  const [role, setRole] = useState<MemberRole | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<StaffPermissions | null>(null);
  const [adminSeesGhost, setAdminSeesGhost] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setPersonId(null);
      setPermissions(null);
      setAdminSeesGhost(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    getUserRole(user.id).then(async ({ role: userRole, personId: userPersonId }) => {
      setRole(userRole);
      setPersonId(userPersonId);

      if (userRole === 'staff' && companyUuid) {
        const perms = await getStaffPermissions(companyUuid);
        setPermissions(perms);
        setAdminSeesGhost(false);
      } else {
        setPermissions(null);
        // Admin nima polnih "staff" dovoljenj v kontekstu, ghost pa sledi isti nastavitvi.
        if (userRole === 'admin' && companyUuid) {
          const perms = await getStaffPermissions(companyUuid);
          setAdminSeesGhost(perms?.can_view_ghost_termini === true);
        } else {
          setAdminSeesGhost(false);
        }
      }

      setLoading(false);
    });
  }, [user?.id, companyUuid]);

  const canSeeGhost =
    role === 'owner' ||
    (role === 'staff' && permissions?.can_view_ghost_termini === true) ||
    (role === 'admin' && adminSeesGhost);

  const value = useMemo<RolePermissionContextValue>(
    () => ({ role, personId, permissions, canSeeGhost, loading }),
    [role, personId, permissions, canSeeGhost, loading]
  );

  return (
    <RolePermissionContext.Provider value={value}>
      {children}
    </RolePermissionContext.Provider>
  );
}

export function useRolePermissions(): RolePermissionContextValue {
  const context = useContext(RolePermissionContext);
  if (!context) {
    throw new Error('useRolePermissions must be used within RolePermissionProvider');
  }
  return context;
}
