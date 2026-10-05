// app/api/company/vat-check/route.ts
//
// POST { vat } — checks the company's VAT number in VIES and remembers the
// result on "Podatki podjetij" (vat_verified, vat_verified_at,
// vat_verified_name), so billing (n8n / Stripe) can reverse-charge.
// Owners and admins only. The number itself is still saved with the company
// profile ("Davčna številka").

import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/auth/ownerAccess';
import { rateLimit } from '@/lib/rateLimit';
import { resolveCompanyRegion } from '@/lib/region';
import { checkVatWithVies, parseVat } from '@/lib/vat';

export async function POST(request: NextRequest) {
  const { success } = await rateLimit(request, 'auth');
  if (!success) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });

  const access = await requireOwnerOrAdmin(request);
  if ('response' in access) return access.response;
  const { textId, admin } = access;

  const body = (await request.json().catch(() => null)) as { vat?: unknown } | null;

  const { data: companyRow } = await admin
    .from('Podatki podjetij')
    .select('*')
    .eq('ID Podjetja', textId)
    .maybeSingle();
  const region = resolveCompanyRegion(companyRow as Record<string, unknown> | null);

  const vat = parseVat(body?.vat, region.countryCode);
  if (!vat) {
    return NextResponse.json({ ok: true, status: 'bad_format' });
  }

  const result = await checkVatWithVies(vat);

  if (result.status !== 'unavailable') {
    const { error } = await admin
      .from('Podatki podjetij')
      .update({
        vat_verified: result.status === 'valid',
        vat_verified_at: new Date().toISOString(),
        vat_verified_name: result.status === 'valid' ? result.name : null,
      })
      .eq('ID Podjetja', textId);
    // Before migration 1790600000 the columns are missing; the answer still counts.
    if (error) console.warn('[api/company/vat-check] saving result failed:', error.message);
  }

  return NextResponse.json({
    ok: true,
    status: result.status,
    vat: vat.full,
    name: result.status === 'valid' ? result.name : null,
    address: result.status === 'valid' ? result.address : null,
  });
}
