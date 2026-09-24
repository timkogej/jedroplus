// app/api/company/region/route.ts
//
// Company region (country, time zone, currency — see lib/region.ts).
// PATCH, owners and admins only. Written to "Podatki podjetij" with the
// service-role client, same as the logo route.

import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/auth/ownerAccess';
import { findCountry, isValidCurrency, isValidTimeZone } from '@/lib/region';

type RegionBody = {
  country_code?: unknown;
  timezone?: unknown;
  currency?: unknown;
};

export async function PATCH(request: NextRequest) {
  const access = await requireOwnerOrAdmin(request);
  if ('response' in access) return access.response;
  const { textId, admin } = access;

  const body = (await request.json().catch(() => null)) as RegionBody | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const update: Record<string, string> = {};

  if (body.country_code !== undefined) {
    const country = findCountry(body.country_code);
    if (!country) return NextResponse.json({ ok: false, error: 'invalid_country' }, { status: 400 });
    update.country_code = country.code;
  }
  if (body.timezone !== undefined) {
    if (!isValidTimeZone(body.timezone)) {
      return NextResponse.json({ ok: false, error: 'invalid_timezone' }, { status: 400 });
    }
    update.timezone = body.timezone;
  }
  if (body.currency !== undefined) {
    if (!isValidCurrency(body.currency)) {
      return NextResponse.json({ ok: false, error: 'invalid_currency' }, { status: 400 });
    }
    update.valuta = body.currency.trim().toUpperCase();
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'nothing_to_update' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('Podatki podjetij')
    .update(update)
    .eq('ID Podjetja', textId)
    .select('ID Podjetja');

  if (error) {
    console.error('[api/company/region] update failed:', error.message);
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 502 });
  }

  // Right after onboarding n8n may not have created the row yet; the caller retries.
  if (!data || data.length === 0) {
    return NextResponse.json({ ok: false, error: 'not_ready' }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
