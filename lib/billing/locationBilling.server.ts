// Server side: what a company's locations plan looks like right now.
// Used by the add-on routes (status, purchase, cancel).

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { canBuyExtraLocations } from '@/lib/billing/locationAddon';

export interface LocationBilling {
  companyUuid: string;
  textId: string;
  /** Locations the plan includes. */
  included: number;
  /** Bought extra locations. */
  extra: number;
  /** included + extra */
  allowed: number;
  /** Active locations right now. */
  active: number;
  /** May this company buy extra locations. */
  eligible: boolean;
  stripeItemId: string | null;
  cancelAtPeriodEnd: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `companyId` may be the uuid (companies.id) or the text id (companies.company_id). */
export async function loadLocationBilling(
  admin: SupabaseClient,
  companyId: string
): Promise<LocationBilling | null> {
  const { data: company } = await admin
    .from('companies')
    .select('id, company_id')
    .eq(UUID.test(companyId) ? 'id' : 'company_id', companyId)
    .maybeSingle();
  const companyUuid = company?.id as string | undefined;
  const textId = company?.company_id as string | undefined;
  if (!companyUuid || !textId) return null;

  const [{ data: sub }, { data: limits }, { count }] = await Promise.all([
    admin
      .from('company_subscriptions')
      .select('plan:plans(max_locations)')
      .eq('company_id', companyUuid)
      .eq('status', 'active')
      .maybeSingle(),
    admin
      .from('company_location_limits')
      .select('extra_locations, stripe_subscription_item_id, cancel_at_period_end')
      .eq('company_id', companyUuid)
      .maybeSingle(),
    admin
      .from('Lokacije')
      .select('id', { count: 'exact', head: true })
      .eq('ID podjetja', textId)
      .eq('status', 'active'),
  ]);

  const plan = (sub as { plan?: { max_locations?: number } | { max_locations?: number }[] | null } | null)?.plan;
  const planRow = Array.isArray(plan) ? plan[0] : plan;
  const included = Math.max(1, Number(planRow?.max_locations ?? 1));
  const extra = Number(limits?.extra_locations ?? 0);

  return {
    companyUuid,
    textId,
    included,
    extra,
    allowed: included + extra,
    active: count ?? 0,
    eligible: canBuyExtraLocations(included),
    stripeItemId: (limits?.stripe_subscription_item_id as string | null | undefined) ?? null,
    cancelAtPeriodEnd: Boolean(limits?.cancel_at_period_end),
  };
}

/** Whether the user is the company's owner (billing changes are the owner's). */
export async function isCompanyOwner(admin: SupabaseClient, companyUuid: string, userId: string): Promise<boolean> {
  const { data } = await admin
    .from('company_members')
    .select('role')
    .eq('company_id', companyUuid)
    .eq('user_id', userId)
    .maybeSingle();
  return data?.role === 'owner';
}
