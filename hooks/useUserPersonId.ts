import { useEffect, useState } from 'react';
import { getUserPersonId } from '@/lib/supabase/companyMembers';

/**
 * Returns the person_id linked to the current user in company_members.
 * - undefined: not yet loaded
 * - null: loaded, but user is not connected to any person
 * - string: the person_id (= "id" in Osebe table) the user is connected to
 */
export function useUserPersonId(userId: string | undefined): string | null | undefined {
  const [personId, setPersonId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!userId) {
      setPersonId(null);
      return;
    }
    getUserPersonId(userId).then((id) => setPersonId(id));
  }, [userId]);

  return personId;
}
