// Extra locations are a per-unit add-on, like extra team members. Included
// locations come from the plan (plans.max_locations: Pro 3, Plus and Free 1);
// only a plan that already includes several locations may buy more.

/** Price of one extra location per month (EUR). */
export const LOCATION_PRICE_EUR = 9.9;

/** Most extra locations that can be bought; beyond that the company talks to us (Enterprise). */
export const MAX_EXTRA_LOCATIONS = 7;

/** Whether a plan may buy extra locations: only plans that include more than one. */
export const canBuyExtraLocations = (includedInPlan: number) => includedInPlan > 1;
