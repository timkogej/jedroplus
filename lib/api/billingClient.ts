/**
 * Billing & Onboarding API Client
 *
 * Handles all billing, subscription, onboarding, and SMS operations
 * via n8n webhooks. All sensitive operations go through n8n backend.
 *
 * SECURITY: Never uses service_role key or Stripe secret key on frontend.
 * All payments handled via Stripe Checkout redirect flow.
 *
 * NOTE: All n8n requests are proxied through /api/n8n/* to avoid CORS issues.
 * The client sends the Supabase access token which gets forwarded to n8n.
 */

import { supabase } from '@/lib/supabaseClient';

interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  [key: string]: unknown;
}

/**
 * Get current Supabase session access token
 */
async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/**
 * Make request to n8n endpoint via local API proxy
 * This avoids CORS issues by routing through Next.js API routes
 * The Supabase access token is included for n8n authentication
 */
async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    // Get the user's Supabase access token
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        ok: false,
        error: 'Niste prijavljeni. Prosimo, prijavite se ponovno.'
      };
    }

    // Route through local API proxy to avoid CORS
    // /onboarding/create-company -> /api/n8n/onboarding/create-company
    const proxyUrl = `/api/n8n${endpoint}`;

    const response = await fetch(proxyUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers
      }
    });

    const text = await response.text();
    let data: unknown;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      return {
        ok: false,
        error: (data as Record<string, unknown>)?.message as string ||
               (data as Record<string, unknown>)?.error as string ||
               `HTTP ${response.status}`,
        data: data as T
      };
    }

    if (typeof data === 'object' && data && !Array.isArray(data)) {
      // If response already has ok field, return as-is
      if ('ok' in data) {
        return data as ApiResponse<T>;
      }

      // Normalize object responses without ok by exposing fields and data
      return {
        ok: true,
        ...(data as Record<string, unknown>),
        data: data as T
      };
    }

    return { ok: true, data: data as T };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Request failed'
    };
  }
}

// ============================================
// ONBOARDING OPERATIONS
// ============================================

export interface CreateCompanyResult {
  ok: boolean;
  company_id?: string;
  company_slug?: string;
  join_code?: string;
  error?: string;
}

export interface JoinCompanyResult {
  ok: boolean;
  company_id?: string;
  company_slug?: string;
  company_name?: string;
  reason?: string;
  error?: string;
}

/**
 * Create a new company during onboarding
 */
export async function createCompany(companyName: string): Promise<CreateCompanyResult> {
  return apiRequest<CreateCompanyResult>('/onboarding/create-company', {
    method: 'POST',
    body: JSON.stringify({ company_name: companyName })
  });
}

/**
 * Join an existing company using a join code.
 * The backend determines admin vs staff by matching join_code against
 * companies.join_code_admin or companies.join_code_staff.
 */
export async function joinCompany(joinCode: string): Promise<JoinCompanyResult> {
  return apiRequest<JoinCompanyResult>('/onboarding/join-company', {
    method: 'POST',
    body: JSON.stringify({
      join_code: joinCode.toUpperCase().trim()
    })
  });
}

// ============================================
// BILLING & SUBSCRIPTION OPERATIONS
// ============================================

export interface SubscriptionInfo {
  status: 'pending' | 'active' | 'past_due' | 'canceled' | 'paused';
  plan_code: string;
  plan_name?: string;
  sms_blocked: boolean;
  current_period_end?: string;
}

export interface SMSQuotaInfo {
  enabled_effective: boolean;
  quota_effective: number;
  used_current_month: number;
  remaining: number;
}

export interface BootstrapResult {
  ok: boolean;
  subscription?: SubscriptionInfo;
  sms?: SMSQuotaInfo;
  error?: string;
}

/**
 * Bootstrap billing info for a company
 * Called when company context loads to get subscription and SMS quota status
 */
export async function bootstrapBilling(companyId: string): Promise<BootstrapResult> {
  return apiRequest<BootstrapResult>('/billing/bootstrap', {
    method: 'POST',
    body: JSON.stringify({ company_id: companyId })
  });
}

// ============================================
// BILLING STATUS (READ-ONLY)
// ============================================

export interface BillingStatusPlan {
  code: string;
  name?: string;
  flags?: Record<string, boolean>;
  quotas?: Record<string, number>;
}

export interface BillingStatusSubscription {
  status: 'pending' | 'active' | 'past_due' | 'canceled' | 'paused';
  plan_id?: string;
  current_period_start?: string;
  current_period_end?: string;
  sms_blocked?: boolean;
  email_blocked?: boolean;
}

export interface BillingStatusResult {
  ok: boolean;
  needs_onboarding?: boolean;
  company_uuid?: string;
  company?: {
    id: string;
    company_id: string;
    name: string;
    booking_url?: string;
    chatbot_url?: string;
    twilio_phone_number?: string;
  };
  subscription?: BillingStatusSubscription;
  plan?: BillingStatusPlan;
  usage?: Record<string, unknown>;
  error?: string;
}

/**
 * Get billing status (READ-ONLY endpoint)
 * Used for polling after Stripe checkout to check if subscription is active
 *
 * Endpoint: POST /billing/status
 * Body: { include_usage?: boolean, company_id?: string }
 * Response: { ok, subscription, plan, company, ... }
 *
 * @param companyUuid - Optional UUID from companies.id, passed to n8n so it
 *                      can identify the company without relying solely on JWT.
 */
export async function getBillingStatus(includeUsage = false, companyUuid?: string): Promise<BillingStatusResult> {
  return apiRequest<BillingStatusResult>('/billing/status', {
    method: 'POST',
    body: JSON.stringify({
      include_usage: includeUsage,
      ...(companyUuid ? { company_id: companyUuid } : {}),
    })
  });
}

export interface CheckoutResult {
  ok: boolean;
  checkout_url?: string;
  error?: string;
}

/**
 * Start Stripe checkout session for plan upgrade
 * Returns a Stripe Checkout URL to redirect user to
 *
 * Endpoint: POST /billing/checkout/start
 * Body: { company_id, plan_code, success_url, cancel_url }
 * Response: { ok: true, checkout_url: "https://checkout.stripe.com/..." }
 */
export async function startCheckout(
  companyUuid: string,
  planCode: string,
  email?: string
): Promise<CheckoutResult> {
  const appBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return apiRequest<CheckoutResult>('/billing/checkout/start', {
    method: 'POST',
    body: JSON.stringify({
      company_id: companyUuid,
      plan_code: planCode,
      success_url: `${appBaseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/billing/cancel`
    })
  });
}

export interface PortalResult {
  ok: boolean;
  portal_url?: string;
  error?: string;
}

/**
 * Get Stripe Customer Portal URL for managing subscription
 */
export async function getCustomerPortal(companyId: string): Promise<PortalResult> {
  return apiRequest<PortalResult>('/billing/portal', {
    method: 'POST',
    body: JSON.stringify({
      company_id: companyId,
      return_url: `${window.location.origin}/nastavitve/racun`
    })
  });
}

// ============================================
// SMS OPERATIONS
// ============================================

export interface SendSMSResult {
  ok: boolean;
  provider_message_id?: string;
  used?: number;
  remaining?: number;
  reason?: string;
  error?: string;
}

/**
 * Send SMS message with quota enforcement
 */
export async function sendSMS(
  companyId: string,
  to: string,
  message: string
): Promise<SendSMSResult> {
  return apiRequest<SendSMSResult>('/sms/send', {
    method: 'POST',
    body: JSON.stringify({
      company_id: companyId,
      to,
      message
    })
  });
}

export interface SMSUsageResult {
  ok: boolean;
  quota: number;
  used: number;
  remaining: number;
  error?: string;
}

/**
 * Get current SMS usage for the month
 */
export async function getSMSUsage(companyId: string): Promise<ApiResponse<SMSUsageResult>> {
  return apiRequest<SMSUsageResult>('/sms/usage', {
    method: 'POST',
    body: JSON.stringify({ company_id: companyId })
  });
}

// ============================================
// FEATURE GATING HELPERS
// ============================================

export interface PlanLimits {
  max_employees: number;
  max_services: number;
  max_appointments_monthly: number;
  sms_enabled: boolean;
  sms_quota: number;
}

/**
 * Check if a feature is available based on current plan
 */
export function canUseFeature(
  subscription: SubscriptionInfo | null | undefined,
  feature: keyof PlanLimits
): boolean {
  if (!subscription || subscription.status !== 'active') {
    // Free plan defaults
    const freeDefaults: PlanLimits = {
      max_employees: 3,
      max_services: 5,
      max_appointments_monthly: -1, // unlimited on free
      sms_enabled: false,
      sms_quota: 0
    };

    if (feature === 'sms_enabled') return freeDefaults.sms_enabled;
    return true;
  }

  // For active subscriptions, the feature is available
  // Actual limits are enforced by n8n backend
  return true;
}

/**
 * Check if SMS can be sent (quota not exceeded, not blocked)
 */
export function canSendSMS(
  subscription: SubscriptionInfo | null | undefined,
  smsQuota: SMSQuotaInfo | null | undefined
): { allowed: boolean; reason?: string } {
  if (!subscription) {
    return { allowed: false, reason: 'Naročnina ni aktivna' };
  }

  if (subscription.sms_blocked) {
    return { allowed: false, reason: 'SMS funkcionalnost je blokirana' };
  }

  if (!smsQuota) {
    return { allowed: false, reason: 'SMS kvota ni naložena' };
  }

  if (!smsQuota.enabled_effective) {
    return { allowed: false, reason: 'SMS ni vključen v vaš paket' };
  }

  if (smsQuota.remaining <= 0) {
    return { allowed: false, reason: 'Mesečna SMS kvota je porabljena' };
  }

  return { allowed: true };
}

// Export everything for easy imports
export const billingClient = {
  // Onboarding
  createCompany,
  joinCompany,

  // Billing
  bootstrapBilling,
  getBillingStatus,
  startCheckout,
  getCustomerPortal,

  // SMS
  sendSMS,
  getSMSUsage,

  // Helpers
  canUseFeature,
  canSendSMS
};

export default billingClient;
