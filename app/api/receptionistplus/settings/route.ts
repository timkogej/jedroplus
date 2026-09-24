// app/api/receptionistplus/settings/route.ts
//
// Read/write receptionist_settings for the logged-in user's company.
// Resolves company_slug server-side (same pattern as the Phase 3 checkout route) —
// the client never needs to know the slug.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, resolveUserCompany } from '@/lib/auth/apiAuth';
import { GREETING_MAX_LENGTH, isReceptionistLanguage } from '@/lib/receptionist';

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
    // '*': detect_caller_language / announce_recording / recording_notice_text
    // exist only after migration 1790500000.
    .select('*')
    .eq('company_slug', companySlug)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: 'Napaka pri branju nastavitev' }, { status: 500 });
  }

  const row = (data ?? null) as Record<string, unknown> | null;
  return NextResponse.json({
    ok: true,
    provisioned: Boolean(row),
    settings: {
      company_slug: companySlug,
      enabled: Boolean(row?.enabled ?? false),
      low_balance_threshold: Number(row?.low_balance_threshold ?? 60),
      greeting_text: (row?.greeting_text as string | null) ?? null,
      language: isReceptionistLanguage(row?.language) ? row.language : 'sl',
      detect_caller_language: Boolean(row?.detect_caller_language ?? false),
      announce_recording: row?.announce_recording === undefined || row?.announce_recording === null
        ? true
        : Boolean(row.announce_recording),
      recording_notice_text: (row?.recording_notice_text as string | null) ?? null,
    },
  });
}

type SettingsBody = {
  enabled?: boolean;
  low_balance_threshold?: number;
  greeting_text?: string | null;
  language?: string;
  detect_caller_language?: boolean;
  announce_recording?: boolean;
  recording_notice_text?: string | null;
};

function optionalText(value: unknown): string | null | 'invalid' {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > GREETING_MAX_LENGTH) return 'invalid';
  return value.trim() || null;
}

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

  if (body.language !== undefined && !isReceptionistLanguage(body.language)) {
    return NextResponse.json({ ok: false, error: 'invalid_language' }, { status: 400 });
  }

  const update: Record<string, unknown> = { company_slug: companySlug, updated_at: new Date().toISOString() };
  if (body.enabled !== undefined) update.enabled = Boolean(body.enabled);
  if (body.low_balance_threshold !== undefined) update.low_balance_threshold = body.low_balance_threshold;
  if (body.language !== undefined) update.language = body.language;
  if (body.detect_caller_language !== undefined) update.detect_caller_language = Boolean(body.detect_caller_language);
  if (body.announce_recording !== undefined) update.announce_recording = Boolean(body.announce_recording);
  for (const key of ['greeting_text', 'recording_notice_text'] as const) {
    if (body[key] === undefined) continue;
    const text = optionalText(body[key]);
    if (text === 'invalid') {
      return NextResponse.json({ ok: false, error: `invalid_${key}` }, { status: 400 });
    }
    update[key] = text;
  }

  const { error } = await admin.from('receptionist_settings').upsert(update);

  if (error) {
    return NextResponse.json({ ok: false, error: 'Napaka pri shranjevanju nastavitev' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
