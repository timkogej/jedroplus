import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const N8N_BASE = 'https://tikej.app.n8n.cloud';

export const SMS_PACKAGES = {
  'sms-50':   { quantity: 50,   priceId: process.env.STRIPE_SMS_50_PRICE_ID!,   priceMonthly: 6  },
  'sms-100':  { quantity: 100,  priceId: process.env.STRIPE_SMS_100_PRICE_ID!,  priceMonthly: 11 },
  'sms-200':  { quantity: 200,  priceId: process.env.STRIPE_SMS_200_PRICE_ID!,  priceMonthly: 20 },
  'sms-500':  { quantity: 500,  priceId: process.env.STRIPE_SMS_500_PRICE_ID!,  priceMonthly: 45 },
  'sms-1000': { quantity: 1000, priceId: process.env.STRIPE_SMS_1000_PRICE_ID!, priceMonthly: 80 },
} as const;

export const EMAIL_PACKAGES = {
  'email-500':  { quantity: 500,  priceId: process.env.STRIPE_EMAIL_500_PRICE_ID!,  priceMonthly: 4  },
  'email-1000': { quantity: 1000, priceId: process.env.STRIPE_EMAIL_1000_PRICE_ID!, priceMonthly: 7  },
  'email-2500': { quantity: 2500, priceId: process.env.STRIPE_EMAIL_2500_PRICE_ID!, priceMonthly: 15 },
  'email-5000': { quantity: 5000, priceId: process.env.STRIPE_EMAIL_5000_PRICE_ID!, priceMonthly: 25 },
} as const;

type PurchaseBody = {
  company_id: string;
  addon_type: 'sms' | 'email' | 'employees';
  package_key?: string;
  quantity?: number;
};

export async function POST(request: NextRequest) {
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

  if (!['sms', 'email', 'employees'].includes(addon_type)) {
    return NextResponse.json({ success: false, message: 'Invalid addon_type' }, { status: 400 });
  }

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
    return NextResponse.json({ success: false, message: 'Aktivna naročnina ni najdena' }, { status: 400 });
  }

  if (!sub.provider_subscription_id) {
    return NextResponse.json(
      { success: false, message: 'Naročnina ni upravljana prek Stripe — nakup ni možen' },
      { status: 400 }
    );
  }

  let n8nPayload: Record<string, unknown>;

  if (addon_type === 'sms') {
    if (!package_key || !(package_key in SMS_PACKAGES)) {
      return NextResponse.json({ success: false, message: 'Neveljaven paket SMS' }, { status: 400 });
    }
    const pkg = SMS_PACKAGES[package_key as keyof typeof SMS_PACKAGES];
    if (!pkg.priceId) {
      return NextResponse.json(
        { success: false, message: 'Cene niso konfigurirane. Kontaktirajte administratorja.' },
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
      return NextResponse.json({ success: false, message: 'Neveljaven paket email' }, { status: 400 });
    }
    const pkg = EMAIL_PACKAGES[package_key as keyof typeof EMAIL_PACKAGES];
    if (!pkg.priceId) {
      return NextResponse.json(
        { success: false, message: 'Cene niso konfigurirane. Kontaktirajte administratorja.' },
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
  } else {
    // employees
    const employeeQty = quantity ?? 0;
    if (employeeQty < 0 || employeeQty > 20) {
      return NextResponse.json({ success: false, message: 'Količina mora biti med 0 in 20' }, { status: 400 });
    }
    const employeePriceId = process.env.STRIPE_EMPLOYEE_PRICE_ID;
    if (!employeePriceId) {
      return NextResponse.json(
        { success: false, message: 'Cene niso konfigurirane. Kontaktirajte administratorja.' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n8nPayload),
    });
    const n8nData = await n8nRes.json().catch(() => ({}));

    if (!n8nRes.ok || n8nData.success === false) {
      const msg = n8nData.message ?? 'Napaka pri obdelavi addonov';
      return NextResponse.json({ success: false, message: msg }, { status: 502 });
    }

    return NextResponse.json({ success: true, ...n8nData });
  } catch {
    return NextResponse.json({ success: false, message: 'n8n webhook ni dosegljiv' }, { status: 502 });
  }
}
