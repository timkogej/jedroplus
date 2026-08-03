// app/api/receptionistplus/checkout/route.ts
//
// Creates a Stripe Checkout Session (mode: 'payment', one-time) for a
// ReceptionistPlus credit pack. Separate from the subscription checkout flow
// in n8n (lib/api/billingClient.ts) — this app talks to Stripe directly here.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireCompanyAccess, resolveUserCompany } from '@/lib/auth/apiAuth';
import { stripe, RECEPTIONISTPLUS_PACKS, ReceptionistPlusPackKey } from '@/lib/receptionistPlusStripe';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type CheckoutBody = {
  company_id: string;
  pack: ReceptionistPlusPackKey;
};

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ ok: false, error: 'Stripe ni konfiguriran' }, { status: 500 });
  }

  let body: CheckoutBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { company_id, pack } = body;

  if (!company_id || !pack || !(pack in RECEPTIONISTPLUS_PACKS)) {
    return NextResponse.json({ ok: false, error: 'company_id and a valid pack are required' }, { status: 400 });
  }

  const authResult = await requireCompanyAccess(request, company_id);
  if ('response' in authResult) return authResult.response;

  const { user } = authResult;
  const { uuid: companyUuid } = await resolveUserCompany(user.id);
  if (!companyUuid) {
    return NextResponse.json({ ok: false, error: 'Company ni najdena' }, { status: 400 });
  }

  const packConfig = RECEPTIONISTPLUS_PACKS[pack];
  if (!packConfig.priceId) {
    return NextResponse.json(
      { ok: false, error: 'Cene niso konfigurirane. Kontaktirajte administratorja.' },
      { status: 503 }
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: company } = await admin
    .from('companies')
    .select('slug')
    .eq('id', companyUuid)
    .maybeSingle();

  const companySlug = company?.slug as string | undefined;
  if (!companySlug) {
    return NextResponse.json({ ok: false, error: 'Company slug ni najden' }, { status: 400 });
  }

  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? '';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: packConfig.priceId, quantity: 1 }],
    success_url: `${origin}/receptionist-plus?tab=krediti&checkout=success`,
    cancel_url: `${origin}/receptionist-plus?tab=krediti&checkout=canceled`,
    metadata: {
      product: 'receptionistplus_credits',
      company_slug: companySlug,
      pack,
      credits: String(packConfig.credits),
    },
  });

  return NextResponse.json({ ok: true, checkout_url: session.url });
}
