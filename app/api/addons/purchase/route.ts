import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireCompanyAccess } from '@/lib/auth/apiAuth';
import { MAX_EXTRA_LOCATIONS } from '@/lib/billing/locationAddon';
import { isCompanyOwner, loadLocationBilling } from '@/lib/billing/locationBilling.server';
import { stripe } from '@/lib/receptionistPlusStripe';
import { apiMessages } from '@/lib/api/apiMessages';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// Pointed at a retired n8n Cloud tenant until 2026-09-27, which answered 404 —
// every addon purchase and cancellation failed with it.
const N8N_BASE = (process.env.N8N_WEBHOOK_URL ?? 'https://n8n.jedroplus.com/webhook')
  .replace(/\/webhook\/?$/, '');
const N8N_API_KEY = process.env.N8N_WEBHOOK_API_KEY;

const SMS_PACKAGES = {
  'sms-50':   { quantity: 50,   priceId: process.env.STRIPE_SMS_50_PRICE_ID!,   priceMonthly: 4  },
  'sms-100':  { quantity: 100,  priceId: process.env.STRIPE_SMS_100_PRICE_ID!,  priceMonthly: 8  },
  'sms-200':  { quantity: 200,  priceId: process.env.STRIPE_SMS_200_PRICE_ID!,  priceMonthly: 16 },
  'sms-500':  { quantity: 500,  priceId: process.env.STRIPE_SMS_500_PRICE_ID!,  priceMonthly: 35 },
  'sms-1000': { quantity: 1000, priceId: process.env.STRIPE_SMS_1000_PRICE_ID!, priceMonthly: 65 },
} as const;

const EMAIL_PACKAGES = {
  'email-500':  { quantity: 500,  priceId: process.env.STRIPE_EMAIL_500_PRICE_ID!,  priceMonthly: 4  },
  'email-1000': { quantity: 1000, priceId: process.env.STRIPE_EMAIL_1000_PRICE_ID!, priceMonthly: 7  },
  'email-2500': { quantity: 2500, priceId: process.env.STRIPE_EMAIL_2500_PRICE_ID!, priceMonthly: 15 },
  'email-5000': { quantity: 5000, priceId: process.env.STRIPE_EMAIL_5000_PRICE_ID!, priceMonthly: 25 },
} as const;

type PurchaseBody = {
  company_id: string;
  addon_type: 'sms' | 'email' | 'employees' | 'locations';
  package_key?: string;
  quantity?: number;
};

export async function POST(request: NextRequest) {
  const tApi = await apiMessages(request);
  if (!serviceRoleKey) {
    return NextResponse.json({ success: false, message: 'Service role key not configured' }, { status: 500 });
  }

  let body: PurchaseBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const { company_id, addon_type, package_key, quantity } = body;

  if (!company_id || !addon_type) {
    return NextResponse.json({ success: false, message: 'company_id and addon_type are required' }, { status: 400 });
  }

  if (!['sms', 'email', 'employees', 'locations'].includes(addon_type)) {
    return NextResponse.json({ success: false, message: 'Invalid addon_type' }, { status: 400 });
  }

  const authResult = await requireCompanyAccess(request, company_id);
  if ('response' in authResult) return authResult.response;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: sub } = await admin
    .from('company_subscriptions')
    .select('id, provider_subscription_id, sms_addon_stripe_item_id, email_addon_stripe_item_id')
    .eq('company_id', company_id)
    .eq('status', 'active')
    .maybeSingle();

  if (!sub) {
    return NextResponse.json({ success: false, message: tApi('noActiveSubscription') }, { status: 400 });
  }

  if (!sub.provider_subscription_id) {
    return NextResponse.json(
      { success: false, message: tApi('notStripeManaged') },
      { status: 400 }
    );
  }

  let n8nPayload: Record<string, unknown>;

  if (addon_type === 'sms') {
    if (!package_key || !(package_key in SMS_PACKAGES)) {
      return NextResponse.json({ success: false, message: tApi('invalidSmsPack') }, { status: 400 });
    }
    const pkg = SMS_PACKAGES[package_key as keyof typeof SMS_PACKAGES];
    if (!pkg.priceId) {
      return NextResponse.json(
        { success: false, message: tApi('pricesNotConfigured') },
        { status: 503 }
      );
    }
    n8nPayload = {
      company_id,
      addon_type: 'sms',
      stripe_subscription_id: sub.provider_subscription_id,
      subscription_db_id: sub.id,
      package_key,
      stripe_price_id: pkg.priceId,
      addon_quantity: pkg.quantity,
      existing_stripe_item_id: sub.sms_addon_stripe_item_id ?? null,
    };
  } else if (addon_type === 'email') {
    if (!package_key || !(package_key in EMAIL_PACKAGES)) {
      return NextResponse.json({ success: false, message: tApi('invalidEmailPack') }, { status: 400 });
    }
    const pkg = EMAIL_PACKAGES[package_key as keyof typeof EMAIL_PACKAGES];
    if (!pkg.priceId) {
      return NextResponse.json(
        { success: false, message: tApi('pricesNotConfigured') },
        { status: 503 }
      );
    }
    n8nPayload = {
      company_id,
      addon_type: 'email',
      stripe_subscription_id: sub.provider_subscription_id,
      subscription_db_id: sub.id,
      package_key,
      stripe_price_id: pkg.priceId,
      addon_quantity: pkg.quantity,
      existing_stripe_item_id: sub.email_addon_stripe_item_id ?? null,
    };
  } else if (addon_type === 'locations') {
    // Extra locations: quantity-based like extra team members, owner only.
    const fail = (code: string, message: string, status: number) =>
      NextResponse.json({ success: false, code, message }, { status });

    const billing = await loadLocationBilling(admin, company_id);
    if (!billing) return fail('not_found', tApi('companyNotFound'), 404);
    if (!(await isCompanyOwner(admin, billing.companyUuid, authResult.user.id))) {
      return fail('owner_only', tApi('locationsOwnerOnly'), 403);
    }
    if (!billing.eligible) {
      return fail('plan_not_eligible', tApi('locationsPlan'), 403);
    }
    const locationQty = Number(quantity);
    if (!Number.isInteger(locationQty) || locationQty < 1 || locationQty > MAX_EXTRA_LOCATIONS) {
      return fail('invalid_quantity', tApi('locationQuantityRange', { max: MAX_EXTRA_LOCATIONS }), 400);
    }
    if (billing.included + locationQty < billing.active) {
      return fail(
        'locations_in_use',
        tApi('locationsOverQuantity'),
        409
      );
    }
    // Stripe only allows one billing interval per subscription, so a company on a
    // yearly plan gets the yearly price of the add-on, a monthly one the monthly price.
    let yearly = false;
    try {
      const stripeSub = await stripe.subscriptions.retrieve(sub.provider_subscription_id);
      yearly = stripeSub.items.data.some((item) => item.price.recurring?.interval === 'year');
    } catch (err) {
      console.error('[addons/purchase] could not read Stripe subscription:', err);
      return fail('stripe_unavailable', tApi('pricesNotConfigured'), 502);
    }
    const locationPriceId = yearly
      ? process.env.STRIPE_LOCATION_PRICE_ID_YEARLY
      : process.env.STRIPE_LOCATION_PRICE_ID;
    if (!locationPriceId) {
      return fail('not_configured', tApi('pricesNotConfigured'), 503);
    }

    n8nPayload = {
      company_id,
      addon_type: 'locations',
      stripe_subscription_id: sub.provider_subscription_id,
      subscription_db_id: sub.id,
      stripe_price_id: locationPriceId,
      quantity: locationQty,
      existing_stripe_item_id: billing.stripeItemId,
    };
  } else {
    // employees
    const employeeQty = quantity ?? 0;
    if (employeeQty < 0 || employeeQty > 20) {
      return NextResponse.json({ success: false, message: tApi('quantityRange') }, { status: 400 });
    }
    const employeePriceId = process.env.STRIPE_EMPLOYEE_PRICE_ID;
    if (!employeePriceId) {
      return NextResponse.json(
        { success: false, message: tApi('pricesNotConfigured') },
        { status: 503 }
      );
    }
    const { data: limits } = await admin
      .from('company_user_limits')
      .select('stripe_subscription_item_id')
      .eq('company_id', company_id)
      .maybeSingle();

    n8nPayload = {
      company_id,
      addon_type: 'employees',
      stripe_subscription_id: sub.provider_subscription_id,
      subscription_db_id: sub.id,
      stripe_price_id: employeePriceId,
      quantity: employeeQty,
      existing_stripe_item_id: limits?.stripe_subscription_item_id ?? null,
    };
  }

  try {
    const n8nRes = await fetch(`${N8N_BASE}/webhook/addon-purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(N8N_API_KEY ? { 'X-API-Key': N8N_API_KEY } : {}),
      },
      body: JSON.stringify(n8nPayload),
    });
    const n8nData = await n8nRes.json().catch(() => ({}));

    if (!n8nRes.ok || n8nData.success === false) {
      const msg = n8nData.message ?? 'Napaka pri obdelavi addonov';
      return NextResponse.json({ success: false, message: msg }, { status: 502 });
    }

    if (addon_type === 'locations') {
      // n8n writes this too; doing it here as well keeps the limit right even if
      // that branch of the workflow does not (the write is the same either way).
      const billing = await loadLocationBilling(admin, company_id);
      if (billing) {
        await admin.from('company_location_limits').upsert({
          company_id: billing.companyUuid,
          extra_locations: Number(quantity),
          stripe_subscription_item_id: n8nData.stripe_item_id ?? billing.stripeItemId,
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({ success: true, ...n8nData });
  } catch {
    return NextResponse.json({ success: false, message: 'n8n webhook ni dosegljiv' }, { status: 502 });
  }
}
