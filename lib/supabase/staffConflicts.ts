// lib/supabase/staffConflicts.ts
//
// Ali ima zaposleni v izbranem času že drug termin. Preverjanje je samo opozorilo
// (shranjevanje ni blokirano): salon sme namerno imeti dva termina hkrati.

import { supabase } from '@/lib/supabaseClient';

export interface StaffConflict {
  /** Vrstični id obstoječega termina. */
  terminId: number;
  stranka: string;
  storitev: string;
  datum: string;
  casZacetek: string;
  casKonec: string;
}

function minutes(time: unknown): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(time ?? ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const CANCELLED = new Set(['cancelled', 'canceled', 'odpovedan', 'odpovedano']);

/**
 * @param personIds vse oblike id-ja zaposlenega (vrstični id in besedilni "ID osebe"),
 *                  ker "ID Osebe" v Termini lahko hrani katerokoli.
 */
export async function checkStaffConflicts(
  companyId: string,
  personIds: (string | undefined | null)[],
  datum: string,
  casZacetek: string,
  casKonec: string,
  excludeTerminId?: number,
): Promise<{ conflicts: StaffConflict[]; error: string | null }> {
  const ids = new Set(personIds.filter((x): x is string => !!x).map(String));
  const start = minutes(casZacetek);
  const end = minutes(casKonec);
  if (!companyId || ids.size === 0 || !datum || start === null || end === null || start >= end) {
    return { conflicts: [], error: null };
  }

  const { data, error } = await supabase
    .from('Termini')
    .select('id, "Stranka", "Storitev", "Čas", "Konec", "Status", "ID Osebe", deleted_at')
    .eq('ID podjetja', companyId)
    .eq('Datum', datum);
  if (error) return { conflicts: [], error: error.message };

  const conflicts: StaffConflict[] = [];
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    if (row['deleted_at']) continue;
    if (CANCELLED.has(String(row['Status'] ?? '').trim().toLowerCase())) continue;
    if (excludeTerminId && Number(row['id']) === excludeTerminId) continue;
    if (!ids.has(String(row['ID Osebe'] ?? ''))) continue;
    const s = minutes(row['Čas']);
    const e = minutes(row['Konec']);
    if (s === null || e === null) continue;
    if (s < end && e > start) {
      conflicts.push({
        terminId: Number(row['id']),
        stranka: String(row['Stranka'] ?? ''),
        storitev: String(row['Storitev'] ?? ''),
        datum,
        casZacetek: String(row['Čas']).slice(0, 5),
        casKonec: String(row['Konec']).slice(0, 5),
      });
    }
  }
  conflicts.sort((a, b) => a.casZacetek.localeCompare(b.casZacetek));
  return { conflicts, error: null };
}
