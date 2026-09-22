// lib/billing/plans.ts
//
// Plan names and list prices shown in the app (Paketi page, upgrade gates).
// Keep in sync with the Stripe prices.

export interface PlanPrice {
  /** €/month when billed monthly. */
  monthly: number;
  /** €/month when billed yearly. */
  annual: number;
}

export interface PlanDef {
  id: 'JEDRO_PLUS' | 'JEDRO_PRO' | 'ENTERPRISE';
  name: string;
  price: PlanPrice | null;
  recommended?: boolean;
}

export const PLANS: PlanDef[] = [
  { id: 'JEDRO_PLUS', name: 'Jedro Plus', price: { monthly: 19, annual: 15 } },
  { id: 'JEDRO_PRO', name: 'Jedro Pro', price: { monthly: 39, annual: 31 }, recommended: true },
  { id: 'ENTERPRISE', name: 'Enterprise', price: null },
];

export function getPlan(id: string): PlanDef | undefined {
  return PLANS.find((p) => p.id === id);
}
