// lib/supabase/serije.ts
//
// Ponavljajoči termini v koledarju: branje povezav (termini_serije_clani, RLS) in
// prihodnjih terminov serije za »Odpovej vse prihodnje«. Pisanje gre prek strežnika
// (/api/termini/serija). Pred migracijo 1793700003 tabele ni: vrne prazno.

import { supabase } from '@/lib/supabaseClient';
import { normalizeCommunicationLanguage } from '@/lib/communicationLanguage';
import { normalizeAppointmentStatus } from '@/lib/appointments/status';
import type { AppointmentWithDetails } from '@/types/appointments';

export interface ClanSerije {
  serija: string;
  zap: number;
  /** "ID termina" vseh terminov serije po vrsti. */
  termini: string[];
}

/** "ID termina" → mesto v seriji. */
export async function fetchSerijeTerminov(companyId: string): Promise<Map<string, ClanSerije>> {
  const { data, error } = await supabase
    .from('termini_serije_clani')
    .select('serija_id,id_termina,zap')
    .eq('company_id', companyId)
    .limit(5000);
  const out = new Map<string, ClanSerije>();
  if (error || !data) return out;
  const poSerijah = new Map<string, { zap: number; id: string }[]>();
  for (const r of data as { serija_id: string; id_termina: string; zap: number }[]) {
    const s = poSerijah.get(r.serija_id) ?? [];
    s.push({ zap: r.zap, id: r.id_termina });
    poSerijah.set(r.serija_id, s);
  }
  for (const [serija, clani] of poSerijah) {
    clani.sort((a, b) => a.zap - b.zap);
    const termini = clani.map((c) => c.id);
    for (const c of clani) out.set(c.id, { serija, zap: c.zap, termini });
  }
  return out;
}

/**
 * Termini serije od tega naprej, ki so še odprti (ne odpovedani, ne zaključeni) in ne v
 * preteklosti — z vsemi polji, ki jih potrebuje odpoved enega termina.
 */
export async function fetchPrihodnjiTerminiSerije(
  companyId: string,
  idTerminov: string[],
  danes: string
): Promise<AppointmentWithDetails[]> {
  if (!idTerminov.length) return [];
  const { data, error } = await supabase
    .from('Termini')
    .select('*')
    .eq('ID podjetja', companyId)
    .in('ID termina', idTerminov)
    .is('deleted_at', null);
  if (error || !data) return [];
  const vrstni = new Map(idTerminov.map((id, i) => [id, i]));
  return (data as Record<string, unknown>[])
    .map((r) => {
      const status = normalizeAppointmentStatus(r['Status']);
      return {
        id: String(r['id'] ?? ''),
        id_termina: String(r['ID termina'] ?? ''),
        datum: String(r['Datum'] ?? '').slice(0, 10),
        cas_zacetek: String(r['Čas'] ?? '').slice(0, 5),
        cas_konec: String(r['Konec'] ?? '').slice(0, 5),
        stranka_id: r['ID stranke'] ? String(r['ID stranke']) : undefined,
        stranka_ime: String(r['Stranka'] ?? ''),
        language: normalizeCommunicationLanguage(r['language'] ?? r['Jezik']),
        status,
      } as AppointmentWithDetails;
    })
    .filter((a) => a.id && a.datum >= danes && (a.status === 'scheduled' || a.status === 'confirmed'))
    .sort((a, b) => (vrstni.get(a.id_termina ?? '') ?? 0) - (vrstni.get(b.id_termina ?? '') ?? 0));
}
