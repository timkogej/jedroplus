// app/api/unsubscribe/[token]/route.ts
//
// POST: the client leaves the company's marketing list. Called by the button
// on /unsubscribe/<token> and by mail apps' one-click unsubscribe
// (RFC 8058, List-Unsubscribe-Post). Deliberately not GET — link scanners
// and prefetchers must not unsubscribe anyone.

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';
import { verifyUnsubscribeToken } from '@/lib/unsubscribe';
import { recordOptOut } from '@/lib/marketingConsent.server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { success } = await rateLimit(request, 'auth');
  if (!success) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });

  const { token } = await params;
  const clientId = verifyUnsubscribeToken(token);
  if (!clientId) return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 404 });

  const ok = await recordOptOut(clientId);

  // The page's own form wants the page back; mail apps want a status.
  const fromForm = (request.headers.get('content-type') ?? '').includes('application/x-www-form-urlencoded')
    && request.nextUrl.searchParams.get('from') === 'page';
  if (fromForm) {
    const back = new URL(`/unsubscribe/${token}`, request.url);
    back.searchParams.set(ok ? 'done' : 'error', '1');
    return NextResponse.redirect(back, 303);
  }

  return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
}
