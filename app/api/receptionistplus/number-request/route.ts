// app/api/receptionistplus/number-request/route.ts
//
// A salon asks for the phone number its Receptionist+ answers on.
//
// GET  → { ok, has_number, request } — the company's latest request (or null)
//        and whether a number is already assigned (receptionist_phone_numbers).
// POST { country, area?, mode, current_phone?, private_phone?, company_name,
//        company_address, vat_number?, note? } → { ok, request }
//
// Owners and admins only. The Jedro+ team is told by email (n8n
// enterprise-inquiry webhook, the same mailbox) and by an in-app notification
// to the owners of RECEPTIONIST_TEAM_COMPANY_SLUG (push via the PWA trigger),
// orders the number at the provider and moves the request on in Supabase.

import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireOwnerOrAdmin } from '@/lib/auth/ownerAccess';
import { normalizePhone } from '@/lib/phone';

const N8N_INQUIRY_WEBHOOK = 'https://n8n.jedroplus.com/webhook/enterprise-inquiry';
const N8N_API_KEY = process.env.N8N_WEBHOOK_API_KEY;
const TEAM_EMAIL = process.env.RECEPTIONIST_NUMBER_REQUEST_EMAIL ?? 'info@jedroplus.com';
const TEAM_COMPANY_SLUG = process.env.RECEPTIONIST_TEAM_COMPANY_SLUG ?? 'jedroplus-d-o-o';

const COUNTRY_NAMES: Record<string, string> = {
  SI: 'Slovenija', HR: 'Hrvaška', AT: 'Avstrija', DE: 'Nemčija', IT: 'Italija',
};

const bodySchema = z.object({
  country: z.enum(['SI', 'HR', 'AT', 'DE', 'IT']),
  area: z.string().trim().max(80).optional().default(''),
  mode: z.enum(['forward', 'new']),
  current_phone: z.string().trim().max(30).optional().default(''),
  private_phone: z.boolean().optional().default(false),
  company_name: z.string().trim().min(2).max(200),
  company_address: z.string().trim().min(5).max(300),
  vat_number: z.string().trim().max(40).optional().default(''),
  note: z.string().trim().max(1000).optional().default(''),
});

const REQUEST_COLUMNS =
  'id, country, area, mode, current_phone, private_phone, status, status_note, phone_number, created_at, updated_at';

async function companyOf(admin: SupabaseClient, textId: string) {
  const { data } = await admin
    .from('companies')
    .select('id, slug, name')
    .eq('company_id', textId)
    .maybeSingle();
  return (data as { id: string; slug: string; name: string | null } | null) ?? null;
}

export async function GET(request: NextRequest) {
  const access = await requireOwnerOrAdmin(request);
  if ('response' in access) return access.response;
  const company = await companyOf(access.admin, access.textId);
  if (!company) return NextResponse.json({ ok: false, error: 'no_company' }, { status: 400 });

  const [{ data: requests }, { data: numbers }, { data: profile }] = await Promise.all([
    access.admin
      .from('receptionist_number_requests')
      .select(REQUEST_COLUMNS)
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
      .limit(1),
    access.admin.from('receptionist_phone_numbers').select('phone_number').eq('company_slug', company.slug).limit(1),
    access.admin
      .from('Podatki podjetij')
      .select('"Naziv Podjetja","Naslov podjetja","Davčna številka","Kontaktni telefon",country_code')
      .eq('ID Podjetja', access.textId)
      .maybeSingle(),
  ]);
  const p = (profile ?? {}) as Record<string, string | null>;

  return NextResponse.json({
    ok: true,
    has_number: Boolean(numbers && numbers.length),
    request: requests?.[0] ?? null,
    // For the form: what Jedro+ already knows about the company.
    prefill: {
      company_name: p['Naziv Podjetja'] ?? company.name ?? '',
      company_address: p['Naslov podjetja'] ?? '',
      vat_number: p['Davčna številka'] ?? '',
      current_phone: p['Kontaktni telefon'] ?? '',
      country: String(p.country_code ?? 'SI').toUpperCase(),
    },
  });
}

export async function POST(request: NextRequest) {
  const access = await requireOwnerOrAdmin(request);
  if ('response' in access) return access.response;
  const company = await companyOf(access.admin, access.textId);
  if (!company) return NextResponse.json({ ok: false, error: 'no_company' }, { status: 400 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 400 });
  }
  const body = parsed.data;
  const currentPhone = body.current_phone ? normalizePhone(body.current_phone, body.country) : '';
  if (body.mode === 'forward' && !/^\+[1-9][0-9]{6,14}$/.test(currentPhone)) {
    return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 });
  }

  // One open request at a time.
  const { data: open } = await access.admin
    .from('receptionist_number_requests')
    .select('id')
    .eq('company_id', company.id)
    .in('status', ['submitted', 'ordered'])
    .limit(1);
  if (open && open.length) {
    return NextResponse.json({ ok: false, error: 'already_requested' }, { status: 409 });
  }

  const { data: row, error } = await access.admin
    .from('receptionist_number_requests')
    .insert({
      company_id: company.id,
      company_slug: company.slug,
      country: body.country,
      area: body.area || null,
      mode: body.mode,
      current_phone: currentPhone || null,
      private_phone: body.private_phone,
      company_name: body.company_name,
      company_address: body.company_address,
      vat_number: body.vat_number || null,
      note: body.note || null,
    })
    .select(REQUEST_COLUMNS)
    .single();
  if (error || !row) {
    console.error('[number-request] insert failed:', error);
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 500 });
  }

  const summary = [
    'ZAHTEVA ZA TELEFONSKO ŠTEVILKO (Receptionist+)',
    `Podjetje: ${body.company_name} (${access.textId}, ${company.slug})`,
    `Država: ${COUNTRY_NAMES[body.country]}${body.area ? `, območje: ${body.area}` : ''}`,
    body.mode === 'forward'
      ? `Način: preusmeritev z obstoječe številke ${currentPhone}${body.private_phone ? ' (tudi zasebni telefon)' : ''}`
      : 'Način: nova številka salona',
    `Naslov: ${body.company_address}`,
    body.vat_number ? `Davčna številka: ${body.vat_number}` : '',
    body.note ? `Opomba: ${body.note}` : '',
    `ID zahteve: ${row.id}`,
  ].filter(Boolean).join('\n');

  await Promise.allSettled([
    notifyTeamByEmail(body.company_name, access.textId, summary),
    notifyTeamInApp(access.admin, body.company_name, row.id),
  ]);

  return NextResponse.json({ ok: true, request: row });
}

async function notifyTeamByEmail(companyName: string, textId: string, summary: string) {
  try {
    const res = await fetch(N8N_INQUIRY_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(N8N_API_KEY ? { 'X-API-Key': N8N_API_KEY } : {}) },
      body: JSON.stringify({
        to: TEAM_EMAIL,
        name: `Receptionist+ številka: ${companyName}`.slice(0, 100),
        email: TEAM_EMAIL,
        phone: null,
        message: summary.slice(0, 2000),
        company_id: textId,
        receivedAt: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) console.warn('[number-request] team email failed:', res.status);
  } catch (e) {
    console.warn('[number-request] team email failed:', e);
  }
}

async function notifyTeamInApp(
  admin: SupabaseClient,
  companyName: string,
  requestId: string,
) {
  const { data: team } = await admin.from('companies').select('id').eq('slug', TEAM_COMPANY_SLUG).maybeSingle();
  if (!team) return;
  const { data: owners } = await admin
    .from('company_members')
    .select('user_id, role')
    .eq('company_id', team.id);
  const rows = (owners ?? [])
    .filter((m) => ['owner', 'admin'].includes(String(m.role).toLowerCase()))
    .map((m) => ({
      company_id: team.id,
      recipient_user_id: m.user_id,
      type: 'system',
      severity: 'info',
      title: 'Nova zahteva za telefonsko številko',
      body: `${companyName} želi številko za Receptionist+.`,
      entity_type: 'receptionist_number_request',
      entity_id: requestId,
      dedupe_key: `recept_stevilka_${requestId}_${m.user_id}`,
    }));
  if (rows.length) {
    const { error } = await admin.from('notifications').insert(rows);
    if (error) console.warn('[number-request] team notification failed:', error.message);
  }
}
