// app/api/company/main-design/route.ts
//
// Which design opens at the company's short booking link
// (booking.jedroplus.com/<slug>). Stored as `main_booking_link`, the full link
// of that design: the booking site reads the design from it, and the reminder
// emails and the QR code already use the same column.
// PATCH { design }, owners and admins only.

import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/auth/ownerAccess';
import { BOOKING_ORIGIN, DESIGN_KEYS } from '@/lib/reservations/mainLink';

export async function PATCH(request: NextRequest) {
  const access = await requireOwnerOrAdmin(request);
  if ('response' in access) return access.response;
  const { textId, admin } = access;

  const body = (await request.json().catch(() => null)) as { design?: unknown } | null;
  const index = (DESIGN_KEYS as readonly unknown[]).indexOf(body?.design);
  if (index < 0) {
    return NextResponse.json({ ok: false, error: 'invalid_value' }, { status: 400 });
  }
  const design = DESIGN_KEYS[index];

  const { data: row, error: readError } = await admin
    .from('Podatki podjetij')
    .select('*')
    .eq('ID Podjetja', textId)
    .maybeSingle();
  if (readError || !row) {
    console.error('[api/company/main-design] read failed:', readError?.message);
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 502 });
  }

  // The link n8n stored for this design; built from the slug when it is missing.
  const stored = String(row[`booking_link_${index + 1}`] ?? row[`Booking_link_${index + 1}`] ?? '').trim();
  const slug = String(row.slug ?? '').trim();
  const link = stored || (slug ? `${BOOKING_ORIGIN}/${encodeURIComponent(slug)}/${design}` : '');
  if (!link) {
    return NextResponse.json({ ok: false, error: 'no_link' }, { status: 409 });
  }

  const { error } = await admin.from('Podatki podjetij').update({ main_booking_link: link }).eq('ID Podjetja', textId);
  if (error) {
    console.error('[api/company/main-design] update failed:', error.message);
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, main_booking_link: link });
}
