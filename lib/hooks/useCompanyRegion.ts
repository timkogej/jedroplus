'use client';

import { useMemo } from 'react';
import { useCompany } from '@/app/company-context';
import { resolveCompanyRegion, type CompanyRegion } from '@/lib/region';

/** The current company's country, time zone and currency (see lib/region.ts). */
export function useCompanyRegion(): CompanyRegion {
  const { companySettings } = useCompany();
  return useMemo(() => resolveCompanyRegion(companySettings), [companySettings]);
}

export type RegionPatch = { country_code?: string; timezone?: string; currency?: string };

/** Saves through /api/company/region; resolves to the API's error code or null. */
export async function saveCompanyRegion(patch: RegionPatch): Promise<string | null> {
  try {
    const res = await fetch('/api/company/region', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) return null;
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    return body?.error ?? `http_${res.status}`;
  } catch {
    return 'network';
  }
}
