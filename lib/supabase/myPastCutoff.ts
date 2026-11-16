// lib/supabase/myPastCutoff.ts
//
// Meja preteklih terminov za prijavljenega ZAPOSLENEGA (brskalnik). Za lastnika in admina je null.
// Rezultat se zapomni za nekaj minut, da ga ne beremo ob vsakem listanju koledarja.

import { supabase } from '@/lib/supabaseClient';
import { pastCutoffKey } from '@/lib/utils/pastCutoff';

let cached: { at: number; days: number | null | undefined; uid: string } | null = null;
const TTL_MS = 2 * 60 * 1000;

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getMyPastCutoff(): Promise<string | null> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return null;

    if (!cached || cached.uid !== uid || Date.now() - cached.at > TTL_MS) {
      const { data: member } = await supabase
        .from('company_members')
        .select('role, company_id')
        .eq('user_id', uid)
        .maybeSingle();

      let days: number | null | undefined = null;
      if (member?.role === 'staff' && member.company_id) {
        const { data: perms } = await supabase
          .from('staff_role_permissions')
          .select('past_appointments_days')
          .eq('company_id', member.company_id)
          .maybeSingle();
        days = (perms as { past_appointments_days?: number | null } | null)?.past_appointments_days ?? null;
      }
      cached = { at: Date.now(), days, uid };
    }
    return pastCutoffKey(cached.days, localToday());
  } catch {
    return null;
  }
}

export function resetMyPastCutoffCache() {
  cached = null;
}
