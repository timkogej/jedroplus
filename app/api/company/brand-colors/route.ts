// app/api/company/brand-colors/route.ts
//
// One pair of company colours for everything: the booking pages and every
// email. The app used to keep them twice (Booking_primary / brand_primary), so
// the same salon could get two different colours. PATCH writes all four
// columns together. Owners and admins only.

import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/auth/ownerAccess';
import { normalizeHex } from '@/lib/brandColors';

export async function PATCH(request: NextRequest) {
  const access = await requireOwnerOrAdmin(request);
  if ('response' in access) return access.response;
  const { textId, admin } = access;

  const body = (await request.json().catch(() => null)) as { primary?: unknown; secondary?: unknown } | null;
  const primary = normalizeHex(body?.primary);
  const secondary = normalizeHex(body?.secondary);
  if (!primary || !secondary) {
    return NextResponse.json({ ok: false, error: 'invalid_value' }, { status: 400 });
  }

  const { error } = await admin
    .from('Podatki podjetij')
    .update({
      brand_primary: primary,
      brand_second: secondary,
      Booking_primary: primary,
      Booking_secondary: secondary,
    })
    .eq('ID Podjetja', textId);
  if (error) {
    console.error('[api/company/brand-colors] update failed:', error.message);
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, primary, secondary });
}
