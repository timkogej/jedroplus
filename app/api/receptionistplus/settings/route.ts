// app/api/receptionistplus/settings/route.ts
//
// Read/write receptionist_settings for the logged-in user's company.
// Resolves company_slug server-side (same pattern as the Phase 3 checkout route) —
// the client never needs to know the slug.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, resolveUserCompany } from '@/lib/auth/apiAuth';
import {
  GREETING_MAX_LENGTH,
  INSTRUCTIONS_MAX_LENGTH,
  isReceptionistLanguage,
  isTransferNumber,
} from '@/lib/receptionist';
import { normalizePhone } from '@/lib/phone';

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
    // exist only after migration 1790500000; instructions / transfer_* /
    // sms_confirmation only after the worker's phase7_features.sql. Missing
    // columns read as their defaults below.
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
      instructions: (row?.instructions as string | null) ?? null,
      transfer_enabled: Boolean(row?.transfer_enabled ?? false),
      transfer_number: (row?.transfer_number as string | null) ?? null,
      sms_confirmation: row?.sms_confirmation === undefined || row?.sms_confirmation === null
        ? true
        : Boolean(row.sms_confirmation),
      owner_alert_sms: row?.owner_alert_sms === undefined || row?.owner_alert_sms === null
        ? true
        : Boolean(row.owner_alert_sms),
      owner_alert_phone: (row?.owner_alert_phone as string | null) ?? null,
    },
    // false until phase7_features.sql has run: the page then hides the
    // instructions / transfer / SMS settings instead of failing to save them.
    phase7: Boolean(row && 'sms_confirmation' in row),
    // false until the worker's phase10_owner_alerts.sql has run.
    phase10: Boolean(row && 'owner_alert_sms' in row),
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
  instructions?: string | null;
  transfer_enabled?: boolean;
  transfer_number?: string | null;
  sms_confirmation?: boolean;
  owner_alert_sms?: boolean;
  owner_alert_phone?: string | null;
};

function optionalText(value: unknown, maxLength = GREETING_MAX_LENGTH): string | null | 'invalid' {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > maxLength) return 'invalid';
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
  if (body.instructions !== undefined) {
    const text = optionalText(body.instructions, INSTRUCTIONS_MAX_LENGTH);
    if (text === 'invalid') {
      return NextResponse.json({ ok: false, error: 'invalid_instructions' }, { status: 400 });
    }
    update.instructions = text;
  }
  if (body.transfer_enabled !== undefined) update.transfer_enabled = Boolean(body.transfer_enabled);
  if (body.transfer_number !== undefined) {
    if (body.transfer_number === null || (typeof body.transfer_number === 'string' && !body.transfer_number.trim())) {
      update.transfer_number = null;
    } else {
      const number = typeof body.transfer_number === 'string' ? normalizePhone(body.transfer_number) : '';
      if (!isTransferNumber(number)) {
        return NextResponse.json({ ok: false, error: 'invalid_transfer_number' }, { status: 400 });
      }
      update.transfer_number = number;
    }
  }
  if (body.sms_confirmation !== undefined) update.sms_confirmation = Boolean(body.sms_confirmation);
  if (body.owner_alert_sms !== undefined) update.owner_alert_sms = Boolean(body.owner_alert_sms);
  if (body.owner_alert_phone !== undefined) {
    if (body.owner_alert_phone === null || (typeof body.owner_alert_phone === 'string' && !body.owner_alert_phone.trim())) {
      update.owner_alert_phone = null;
    } else {
      const number = typeof body.owner_alert_phone === 'string' ? normalizePhone(body.owner_alert_phone) : '';
      if (!isTransferNumber(number)) {
        return NextResponse.json({ ok: false, error: 'invalid_owner_alert_phone' }, { status: 400 });
      }
      update.owner_alert_phone = number;
    }
  }

  const { error } = await admin.from('receptionist_settings').upsert(update);

  if (error) {
    return NextResponse.json({ ok: false, error: 'Napaka pri shranjevanju nastavitev' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
