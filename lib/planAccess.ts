/**
 * Plan-based page access configuration.
 *
 * Hierarchy (each level includes all previous):
 *   FREE  →  JEDRO_PLUS  →  JEDRO_PRO  →  JEDRO_PREMIUM
 *
 * Routes NOT listed here are accessible to every plan (FREE pages).
 */

// Ordered from lowest to highest – index is the "rank".
export const PLAN_HIERARCHY = [
  'FREE',
  'JEDRO_PLUS',
  'JEDRO_PRO',
  'JEDRO_PREMIUM',
] as const;

export type PlanCode = (typeof PLAN_HIERARCHY)[number];

/**
 * For each restricted route-prefix, specify the **minimum** plan required.
 * Routes that are not listed here are available to ALL plans (including FREE).
 *
 * FREE pages (no check needed):
 *   /dashboard, /clients, /termini, /nastavitve, /billing, /services,
 *   /staff, /koledar
 */
export const ROUTE_MIN_PLAN: Record<string, PlanCode> = {
  // JEDRO_PLUS
  '/analytics': 'JEDRO_PLUS',
  '/komunikacija': 'JEDRO_PLUS',
  '/rezervacije': 'JEDRO_PLUS',
  '/asistent': 'JEDRO_PLUS',
  '/reminders': 'JEDRO_PLUS',
  // JEDRO_PRO
  '/lost-leads': 'JEDRO_PRO',
  '/chatbot-plus': 'JEDRO_PRO',

  // JEDRO_PREMIUM
  '/receptionist-plus': 'JEDRO_PREMIUM',
};

/** Human-readable plan names (for the upgrade page). */
export const PLAN_NAMES: Record<PlanCode, string> = {
  FREE: 'Free',
  JEDRO_PLUS: 'Jedro Plus',
  JEDRO_PRO: 'Jedro Pro',
  JEDRO_PREMIUM: 'Jedro Premium',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeCode(code: string): string {
  if (!code) return '';
  return code.toUpperCase().replace(/[\s-]+/g, '_');
}

function planRank(code: string): number {
  if (!code) return 0;
  const normalized = normalizeCode(code);
  const idx = PLAN_HIERARCHY.indexOf(normalized as PlanCode);
  return idx === -1 ? 0 : idx; // unknown codes fall back to FREE level
}

/**
 * Check whether `currentPlan` satisfies the minimum requirement for
 * the given pathname. Returns `true` when access is allowed.
 */
export function hasAccessToRoute(pathname: string, currentPlan: string): boolean {
  // Find the first matching route prefix
  for (const [prefix, minPlan] of Object.entries(ROUTE_MIN_PLAN)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return planRank(currentPlan) >= planRank(minPlan);
    }
  }
  // Not restricted → everyone has access
  return true;
}

/**
 * Return the minimum plan required for a given pathname (or null if free).
 */
export function getRequiredPlan(pathname: string): PlanCode | null {
  for (const [prefix, minPlan] of Object.entries(ROUTE_MIN_PLAN)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return minPlan;
    }
  }
  return null;
}
