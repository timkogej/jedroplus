// app/api/webhooks/receptionistplus-stripe/route.ts
//
// Stripe webhook receiver for ReceptionistPlus one-time credit pack
// purchases. Separate endpoint from the subscription/plans Stripe flow
// (which lives in n8n) — this app owns signature verification and the
// resulting Supabase writes directly for this product line only.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe, creditsForPriceId } from '@/lib/receptionistPlusStripe';
import type Stripe from 'stripe';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.metadata?.product !== 'receptionistplus_credits') return;

  const companySlug = session.metadata?.company_slug;
  if (!companySlug) {
    console.error('[receptionistplus-webhook] checkout.session.completed missing company_slug metadata', session.id);
    return;
  }

  // Prefer the credits amount from metadata (set at Checkout creation time);
  // fall back to a price-id lookup in case metadata is ever missing.
  let credits = Number(session.metadata?.credits);
  if (!credits) {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    credits = creditsForPriceId(lineItems.data[0]?.price?.id) ?? 0;
  }
  if (!credits || credits <= 0) {
    console.error('[receptionistplus-webhook] could not resolve credits for session', session.id);
    return;
  }

  const admin = adminClient();

  // Idempotency guard against Stripe's at-least-once delivery.
  const { data: existing } = await admin
    .from('receptionist_credit_transactions')
    .select('id')
    .eq('stripe_checkout_session', session.id)
    .maybeSingle();

  if (existing) {
    return;
  }

  const { data: balanceRow } = await admin
    .from('receptionist_credits')
    .select('balance_credits')
    .eq('company_slug', companySlug)
    .maybeSingle();

  const currentBalance = Number(balanceRow?.balance_credits ?? 0);
  const newBalance = currentBalance + credits;

  const { error: txError } = await admin.from('receptionist_credit_transactions').insert({
    company_slug: companySlug,
    delta_credits: credits,
    balance_after: newBalance,
    type: 'purchase',
    stripe_checkout_session: session.id,
    note: `Stripe payment_intent: ${session.payment_intent ?? 'n/a'}`,
  });

  if (txError) {
    console.error('[receptionistplus-webhook] failed to insert transaction', txError);
    return;
  }

  const { error: balanceError } = await admin
    .from('receptionist_credits')
    .upsert({ company_slug: companySlug, balance_credits: newBalance, updated_at: new Date().toISOString() });

  if (balanceError) {
    console.error('[receptionistplus-webhook] failed to update balance', balanceError);
  }
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_RECEPTIONISTPLUS_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');

  if (!webhookSecret || !signature) {
    return NextResponse.json({ ok: false, error: 'Webhook not configured' }, { status: 500 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[receptionistplus-webhook] signature verification failed', err);
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
  }

  return NextResponse.json({ ok: true });
}
