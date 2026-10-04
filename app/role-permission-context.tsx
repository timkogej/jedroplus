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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setPersonId(null);
      setPermissions(null);
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
      } else {
        setPermissions(null);
      }

      setLoading(false);
    });
  }, [user?.id, companyUuid]);

  const value = useMemo<RolePermissionContextValue>(
    () => ({ role, personId, permissions, loading }),
    [role, personId, permissions, loading]
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
