// app/api/email/welcome/route.ts
//
// Fired once, when a new owner finishes the first-run setup. The company is
// taken from the session, never from the request, and n8n makes sure the
// welcome mail goes out only once per company.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, resolveUserCompany } from '@/lib/auth/apiAuth';
import { notifyOwner } from '@/lib/email/notifyOwner';

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ('response' in auth) return auth.response;

  const { textId } = await resolveUserCompany(auth.user.id);
  if (!textId) {
    return NextResponse.json({ ok: false, error: 'no_company' }, { status: 403 });
  }

  await notifyOwner({ event: 'company_created', companyId: textId });
  return NextResponse.json({ ok: true });
}
