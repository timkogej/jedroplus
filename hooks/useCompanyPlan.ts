'use client';

import { useState, useEffect } from 'react';
import { useCompany } from '@/app/company-context';
import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';

/**
 * Fetches the company's plan code directly from Supabase:
 *   company_subscriptions.plan_id  →  plans.id  →  plans.code
 *
 * Falls back to the planCode already in company context, then to 'FREE'.
 */
export function useCompanyPlan() {
  const { companyUuid, planCode: contextPlanCode, loading: companyLoading } = useCompany();
  const [planCode, setPlanCode] = useState<string>(contextPlanCode || 'FREE');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (companyLoading) return;

    if (!companyUuid) {
      setPlanCode(contextPlanCode || 'FREE');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchPlan() {
      try {
        // 1. Get plan_id from company_subscriptions
        const { data: sub, error: subError } = await supabaseReadOnly
          .from('company_subscriptions')
          .select('plan_id')
          .eq('company_id', companyUuid!)
          .maybeSingle();

        if (subError || !sub?.plan_id) {
          // No subscription row → use context value or FREE
          if (!cancelled) {
            setPlanCode(contextPlanCode || 'FREE');
            setLoading(false);
          }
          return;
        }

        // 2. Look up plan code from plans table
        const { data: plan, error: planError } = await supabaseReadOnly
          .from('plans')
          .select('code')
          .eq('id', sub.plan_id)
          .maybeSingle();

        if (!cancelled) {
          if (planError || !plan?.code) {
            setPlanCode(contextPlanCode || 'FREE');
          } else {
            setPlanCode(plan.code);
          }
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setPlanCode(contextPlanCode || 'FREE');
          setLoading(false);
        }
      }
    }

    fetchPlan();
    return () => { cancelled = true; };
  }, [companyUuid, companyLoading, contextPlanCode]);

  return { planCode, loading: loading || companyLoading };
}
