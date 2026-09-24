// lib/region.server.ts
//
// Server-side read of a company's region (see lib/region.ts). `select('*')`
// on purpose: it keeps working before the region columns are migrated.

import type { createServerSupabaseClient } from '@/lib/supabaseServer';
import { resolveCompanyRegion, type CompanyRegion } from './region';

type ServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export async function fetchCompanyRegionServer(
  supabase: ServerClient,
  companyId: string
): Promise<CompanyRegion> {
  const { data } = await supabase
    .from('Podatki podjetij')
    .select('*')
    .eq('ID Podjetja', companyId)
    .maybeSingle();
  return resolveCompanyRegion((data as Record<string, unknown> | null) ?? null);
}
