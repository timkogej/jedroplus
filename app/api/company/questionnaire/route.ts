// app/api/company/questionnaire/route.ts
//
// The questions clients answer when they book online
// (Nastavitve rezervacij → Vprašalnik pred terminom). Stored in
// "Podatki podjetij".vprasalnik and passed to the booking page by n8n
// booking-v2 init. PATCH, owners and admins only.

import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/auth/ownerAccess';
import { sanitizeQuestions } from '@/lib/questionnaire';

export async function PATCH(request: NextRequest) {
  const access = await requireOwnerOrAdmin(request);
  if ('response' in access) return access.response;
  const { textId, admin } = access;

  const body = (await request.json().catch(() => null)) as { questions?: unknown } | null;
  const questions = sanitizeQuestions(body?.questions);
  if (!questions) {
    return NextResponse.json({ ok: false, error: 'invalid_value' }, { status: 400 });
  }

  const { error } = await admin.from('Podatki podjetij').update({ vprasalnik: questions }).eq('ID Podjetja', textId);
  if (error) {
    console.error('[api/company/questionnaire] update failed:', error.message);
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, questions });
}
