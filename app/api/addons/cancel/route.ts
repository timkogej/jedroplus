import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const N8N_BASE = 'https://tikej.app.n8n.cloud';

type CancelBody = {
  company_id: string;
  addon_type: 'sms' | 'email' | 'employees';
};

export async function POST(request: NextRequest) {
  if (!serviceRoleKey) {
    return NextResponse.json({ success: false, message: 'Service role key not configured' }, { status: 500 });
  }

  let body: CancelBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const { company_id, addon_type } = body;

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

  let stripeItemId: string | null = null;

  if (addon_type === 'sms') {
    stripeItemId = sub.sms_addon_stripe_item_id;
  } else if (addon_type === 'email') {
    stripeItemId = sub.email_addon_stripe_item_id;
  } else {
    const { data: limits } = await admin
      .from('company_user_limits')
      .select('stripe_subscription_item_id')
      .eq('company_id', company_id)
      .maybeSingle();
    stripeItemId = limits?.stripe_subscription_item_id ?? null;
  }

  if (!stripeItemId) {
    return NextResponse.json({ success: false, message: 'Ta addon ni aktiven' }, { status: 400 });
  }

  try {
    const n8nRes = await fetch(`${N8N_BASE}/webhook/addon-cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id,
        addon_type,
        stripe_subscription_item_id: stripeItemId,
        subscription_db_id: sub.id,
      }),
    });
    const n8nData = await n8nRes.json().catch(() => ({}));
    if (!n8nRes.ok || n8nData.success === false) {
      const msg = n8nData.message ?? 'Napaka pri preklicu addonov';
      return NextResponse.json({ success: false, message: msg }, { status: 502 });
    }
  } catch {
    // n8n call failed — still do optimistic DB update so UI reflects intent
    console.error('[api/addons/cancel] n8n call failed, continuing with optimistic update');
  }

  // Optimistic DB update
  if (addon_type === 'sms') {
    await admin
      .from('company_subscriptions')
      .update({ sms_addon_cancel_at_period_end: true })
      .eq('id', sub.id);
  } else if (addon_type === 'email') {
    await admin
      .from('company_subscriptions')
      .update({ email_addon_cancel_at_period_end: true })
      .eq('id', sub.id);
  } else {
    await admin
      .from('company_user_limits')
      .update({ cancel_at_period_end: true })
      .eq('company_id', company_id);
  }

  return NextResponse.json({ success: true });
}
