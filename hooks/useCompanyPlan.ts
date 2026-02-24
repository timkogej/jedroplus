'use client';

import { useCompany } from '@/app/company-context';

/**
 * Returns the current plan code and loading state.
 *
 * Delegates to the company context which already performs the full query chain:
 *   companies (company_id) → id (UUID)
 *   → company_subscriptions (company_id = UUID) → plan_id
 *   → plans (id = plan_id) → code
 *
 * The query chain is awaited before company loading completes, so planCode
 * is guaranteed to be set correctly by the time loading = false.
 *
 * Plan hierarchy:
 *   FREE → JEDRO_PLUS → JEDRO_PRO → JEDRO_PREMIUM
 */
export function useCompanyPlan() {
  const { planCode, loading } = useCompany();
  return { planCode, loading };
}
