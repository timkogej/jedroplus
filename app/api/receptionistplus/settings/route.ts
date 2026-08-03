// app/api/receptionistplus/settings/route.ts
//
// Read/write receptionist_settings for the logged-in user's company.
// Resolves company_slug server-side (same pattern as the Phase 3 checkout route) —
// the client never needs to know the slug.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, resolveUserCompany } from '@/lib/auth/apiAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolveCompanySlug(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if ('response' in authResult) return { error: authResult.response };

  const { user } = authResult;
  const { uuid: companyUuid } = await resolveUserCompany(user.id);
  if (!companyUuid) {
    return { error: NextResponse.json({ ok: false, error: 'Company ni najdena' }, { status: 400 }) };
  }

  const admin = adminClient();
  const { data: company } = await admin.from('companies').select('slug').eq('id', companyUuid).maybeSingle();
  const companySlug = company?.slug as string | undefined;
  if (!companySlug) {
    return { error: NextResponse.json({ ok: false, error: 'Company slug ni najden' }, { status: 400 }) };
  }

  return { companySlug, admin };
}

export async function GET(request: NextRequest) {
  const resolved = await resolveCompanySlug(request);
  if ('error' in resolved) return resolved.error;
  const { companySlug, admin } = resolved;

  const { data, error } = await admin
    .from('receptionist_settings')
    .select('company_slug, enabled, low_balance_threshold, greeting_text, language')
    .eq('company_slug', companySlug)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: 'Napaka pri branju nastavitev' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    provisioned: Boolean(data),
    settings: data ?? {
      company_slug: companySlug,
      enabled: false,
      low_balance_threshold: 60,
      greeting_text: null,
      language: 'sl',
    },
  });
}

type SettingsBody = {
  enabled?: boolean;
  low_balance_threshold?: number;
  greeting_text?: string | null;
  language?: string;
};

export async function PATCH(request: NextRequest) {
  const resolved = await resolveCompanySlug(request);
  if ('error' in resolved) return resolved.error;
  const { companySlug, admin } = resolved;

  let body: SettingsBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.low_balance_threshold !== undefined && (!Number.isFinite(body.low_balance_threshold) || body.low_balance_threshold < 0)) {
    return NextResponse.json({ ok: false, error: 'Neveljaven prag za nizko stanje' }, { status: 400 });
  }

  const update: Record<string, unknown> = { company_slug: companySlug, updated_at: new Date().toISOString() };
  if (body.enabled !== undefined) update.enabled = body.enabled;
  if (body.low_balance_threshold !== undefined) update.low_balance_threshold = body.low_balance_threshold;
  if (body.greeting_text !== undefined) update.greeting_text = body.greeting_text?.trim() || null;
  if (body.language !== undefined) update.language = body.language;

  const { error } = await admin.from('receptionist_settings').upsert(update);

  if (error) {
    return NextResponse.json({ ok: false, error: 'Napaka pri shranjevanju nastavitev' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
