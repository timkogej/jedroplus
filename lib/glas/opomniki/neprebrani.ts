// lib/glas/opomniki/neprebrani.ts
//
// Neprebrani opomniki ob odprtju asistenta (§5): opomnik, ki je prišel v zadnjih 12 urah
// in ga uporabnik še ni prebral v zvončku. Bere z uporabnikovo sejo (RLS na notifications:
// samo prejemnik). Asistent jih pove, nato jih brskalnik označi kot prebrane.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Jezik } from '../jeziki/jezik';
import { kt, prevedi } from '../jeziki/t';

export const OKNO_UR = 12;
export const NAJVEC_POVE = 3;

export interface NeprebranOpomnik {
  id: string;
  besedilo: string;
}

export async function neprebraniOpomniki(seja: SupabaseClient, userId: string, companyUuid: string, zdaj = new Date()): Promise<NeprebranOpomnik[]> {
  const od = new Date(zdaj.getTime() - OKNO_UR * 3600_000).toISOString();
  const { data, error } = await seja
    .from('notifications')
    .select('id,body')
    .eq('company_id', companyUuid)
    .eq('recipient_user_id', userId)
    .eq('entity_type', 'glas_opomnik')
    .eq('is_read', false)
    .gte('created_at', od)
    .order('created_at', { ascending: true })
    .limit(10);
  if (error || !data) return [];
  return (data as { id: string; body: string | null }[])
    .filter((r) => r.body)
    .map((r) => ({ id: String(r.id), besedilo: String(r.body).slice(0, 300) }));
}

/** »Imate en opomnik: pokliči dobavitelja.« (največ trije na glas, ostali na zaslonu). */
export function govorOpomnikov(o: NeprebranOpomnik[], jezik: Jezik): string | null {
  if (!o.length) return null;
  const prvi = o.slice(0, NAJVEC_POVE).map((x) => x.besedilo.replace(/[.!?\s]+$/, ''));
  const uvod = prevedi(jezik, kt('Imate {n} {n|opomnik|opomnika|opomnike|opomnikov}'), { n: o.length });
  const ostali = o.length > NAJVEC_POVE ? ` ${prevedi(jezik, kt('Ostali so v obvestilih.'))}` : '';
  return `${uvod}: ${prvi.join('; ')}.${ostali}`;
}
