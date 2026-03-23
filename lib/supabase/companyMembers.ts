import { supabase } from '@/lib/supabaseClient';
import type { MemberRole, StaffPermissions } from '@/types/roles';

/**
 * Check if the given user already has a linked person (person_id) in company_members.
 * Returns the person_id if connected, or null if not yet connected.
 */
export async function getUserPersonId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('company_members')
    .select('person_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;

  const personId = data.person_id;
  if (!personId || personId === '') return null;

  return String(personId);
}

/**
 * Returns the user's role and person_id from company_members.
 */
export async function getUserRole(
  userId: string
): Promise<{ role: MemberRole | null; personId: string | null }> {
  const { data, error } = await supabase
    .from('company_members')
    .select('role, person_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return { role: null, personId: null };

  return {
    role: (data.role as MemberRole) || null,
    personId: data.person_id ? String(data.person_id) : null,
  };
}

/**
 * Returns staff permissions from staff_role_permissions for the given company.
 * Only relevant when the user's role is 'staff'.
 */
export async function getStaffPermissions(
  companyId: string
): Promise<StaffPermissions | null> {
  const { data, error } = await supabase
    .from('staff_role_permissions')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();

  if (error || !data) return null;

  return data as StaffPermissions;
}
