// lib/billing/usage.ts
//
// One place that turns the raw /api/addons/status payload into the numbers the
// UI shows: what the plan includes, what add-ons add, what is used and what is
// left. Paketi, Dodatki, the reminder editor and the quota banner all read
// from here so they can never disagree with each other again.

export interface AddonStatusPlan {
  code: string;
  name: string;
  price_monthly_cents: number;
  sms_quota_monthly: number | null;
  email_quota_monthly: number | null;
  sms_enabled: boolean | null;
  email_enabled: boolean | null;
  max_employees: number | null;
}

export interface AddonStatusSubscription {
  id: string;
  status: string;
  provider_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  sms_addon_monthly: number | null;
  email_addon_monthly: number | null;
  sms_addon_stripe_item_id: string | null;
  email_addon_stripe_item_id: string | null;
  sms_addon_cancel_at_period_end: boolean | null;
  email_addon_cancel_at_period_end: boolean | null;
  sms_quota_override: number | null;
  email_quota_override: number | null;
  plan: AddonStatusPlan | null;
}

export interface AddonStatusResponse {
  subscription: AddonStatusSubscription | null;
  smsUsage: { sent_count: number | null } | null;
  emailUsage: { sent_count: number | null } | null;
  employeeLimits: {
    included_users: number | null;
    extra_users: number | null;
    max_users: number | null;
  } | null;
  activeEmployeeCount?: number;
  memberCount?: number;
}

export interface ChannelUsage {
  /** Messages included in the plan each period. */
  included: number;
  /** Messages added by purchased add-ons each period. */
  addon: number;
  /** Everything available this period (override wins when set). */
  total: number;
  used: number;
  remaining: number;
  /** 0–100+, rounded. 0 when nothing is available. */
  percent: number;
  /** Nothing available at all — the channel cannot send. */
  unavailable: boolean;
  /** Quota exists and is used up: the backend skips further messages. */
  exhausted: boolean;
  /** 80 % or more used, not yet exhausted. */
  nearLimit: boolean;
}

export interface BillingUsage {
  planCode: string;
  planName: string | null;
  priceMonthlyEur: number | null;
  isFree: boolean;
  /** End of the current billing period; null on the free plan. */
  periodEnd: string | null;
  sms: ChannelUsage;
  email: ChannelUsage;
  seats: { included: number; extra: number; total: number; used: number };
}

export const NEAR_LIMIT_PERCENT = 80;

function channel(
  included: number,
  addon: number,
  override: number | null | undefined,
  used: number
): ChannelUsage {
  const total = override ?? included + addon;
  const remaining = Math.max(total - used, 0);
  const percent = total > 0 ? Math.round((used / total) * 100) : 0;
  const exhausted = total > 0 && used >= total;
  return {
    included,
    addon,
    total,
    used,
    remaining,
    percent,
    unavailable: total <= 0,
    exhausted,
    nearLimit: !exhausted && total > 0 && percent >= NEAR_LIMIT_PERCENT,
  };
}

export function computeBillingUsage(data: AddonStatusResponse | null): BillingUsage {
  const sub = data?.subscription ?? null;
  const plan = sub?.plan ?? null;
  const planCode = (plan?.code ?? 'FREE').toUpperCase();
  const isFree = !sub || planCode === 'FREE';

  const includedSeats = plan?.max_employees ?? data?.employeeLimits?.included_users ?? 1;
  const extraSeats = data?.employeeLimits?.extra_users ?? 0;

  return {
    planCode,
    planName: plan?.name ?? null,
    priceMonthlyEur: plan ? plan.price_monthly_cents / 100 : null,
    isFree,
    periodEnd: isFree ? null : sub?.current_period_end ?? null,
    sms: channel(
      plan?.sms_quota_monthly ?? 0,
      sub?.sms_addon_monthly ?? 0,
      sub?.sms_quota_override,
      data?.smsUsage?.sent_count ?? 0
    ),
    email: channel(
      plan?.email_quota_monthly ?? 0,
      sub?.email_addon_monthly ?? 0,
      sub?.email_quota_override,
      data?.emailUsage?.sent_count ?? 0
    ),
    seats: {
      included: includedSeats,
      extra: extraSeats,
      total: data?.employeeLimits?.max_users ?? includedSeats + extraSeats,
      used: data?.memberCount ?? 0,
    },
  };
}
