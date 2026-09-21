'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCompany } from '@/app/company-context';
import {
  computeBillingUsage,
  type AddonStatusResponse,
  type BillingUsage,
} from '@/lib/billing/usage';

// Several components on one screen (quota banner + page) need the same data;
// share one in-flight request and keep the result briefly.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; promise: Promise<AddonStatusResponse | null> }>();

/**
 * Raw /api/addons/status payload through the shared cache. Pass force=true
 * after a purchase or cancellation so every screen sees the new numbers.
 */
export function fetchBillingStatus(companyUuid: string, force = false): Promise<AddonStatusResponse | null> {
  return load(companyUuid, force);
}

function load(companyUuid: string, force: boolean): Promise<AddonStatusResponse | null> {
  const hit = cache.get(companyUuid);
  if (!force && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise;

  const promise = fetch(`/api/addons/status?company_id=${encodeURIComponent(companyUuid)}`)
    .then((res) => (res.ok ? (res.json() as Promise<AddonStatusResponse>) : null))
    .catch(() => null);
  cache.set(companyUuid, { at: Date.now(), promise });
  return promise;
}

/**
 * Plan, quotas and seats for the current company, computed in one place.
 * `raw` exposes the untouched payload for screens that need Stripe ids etc.
 */
export function useBillingUsage() {
  const { companyUuid } = useCompany();
  const [raw, setRaw] = useState<AddonStatusResponse | null>(null);
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsage = useCallback(
    async (force = false) => {
      if (!companyUuid) return;
      setLoading(true);
      const data = await load(companyUuid, force);
      setRaw(data);
      setUsage(data ? computeBillingUsage(data) : null);
      setLoading(false);
    },
    [companyUuid]
  );

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const refresh = useCallback(() => fetchUsage(true), [fetchUsage]);

  return { usage, raw, loading, refresh };
}
