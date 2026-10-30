// app/api/company/booking-mode/route.ts
//
// How clients book online (Nastavitve rezervacij → Način rezervacije):
//   'instant' — they pick a free time (default);
//   'request' — they send a request and the salon picks the time
//               (Rezervacije → Zahteve za termin).
// Read by n8n booking-v2 init (company.booking_mode) and the booking page.
// PATCH, owners and admins only.

import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/auth/ownerAccess';

export async function PATCH(request: NextRequest) {
  const access = await requireOwnerOrAdmin(request);
  if ('response' in access) return access.response;
  const { textId, admin } = access;

  const body = (await request.json().catch(() => null)) as { booking_mode?: unknown } | null;
  const mode = body?.booking_mode;
  if (mode !== 'instant' && mode !== 'request') {
    return NextResponse.json({ ok: false, error: 'invalid_value' }, { status: 400 });
  }

  const { error } = await admin.from('Podatki podjetij').update({ booking_mode: mode }).eq('ID Podjetja', textId);
  if (error) {
    console.error('[api/company/booking-mode] update failed:', error.message);
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
