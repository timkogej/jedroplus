// app/api/company/message-templates/route.ts
//
// English variants of the custom reminder templates. PATCH, owners and admins
// only. The Slovenian (main) templates still save through the n8n settings
// workflow; these columns are new, so the app writes them itself.
// n8n sends the variant to clients whose language differs from the
// company's (docs/multi-country-todo.md).

import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/auth/ownerAccess';

const ENGLISH_TEMPLATE_COLUMNS = [
  'lastna_predloga_pred_en',
  'lastna_predloga_po_en',
  'obvestilo_prestavitev_template_sms_en',
  'obvestilo_prestavitev_template_email_en',
] as const;

const MAX_LENGTH = 2000;

export async function PATCH(request: NextRequest) {
  const access = await requireOwnerOrAdmin(request);
  if ('response' in access) return access.response;
  const { textId, admin } = access;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const update: Record<string, string | null> = {};
  for (const column of ENGLISH_TEMPLATE_COLUMNS) {
    if (!(column in body)) continue;
    const value = body[column];
    if (value !== null && typeof value !== 'string') {
      return NextResponse.json({ ok: false, error: 'invalid_value', column }, { status: 400 });
    }
    const text = (value ?? '').trim();
    if (text.length > MAX_LENGTH) {
      return NextResponse.json({ ok: false, error: 'too_long', column }, { status: 400 });
    }
    update[column] = text || null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: 'nothing_to_update' }, { status: 400 });
  }

  const { error } = await admin.from('Podatki podjetij').update(update).eq('ID Podjetja', textId);

  if (error) {
    console.error('[api/company/message-templates] update failed:', error.message);
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
