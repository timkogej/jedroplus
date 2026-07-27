// app/api/n8n/[...path]/route.ts
//
// Proxy for the n8n webhooks the app legitimately calls (billing/onboarding/
// SMS via billingClient, the chatbot-plus widget, and the assistant chat).
// Exists to avoid CORS and to attach the server-held N8N_API_KEY.
//
// Security:
// - Rate limiting (50 req / 10 sec)
// - Session validation via authenticateRequest (cookie session or a verified
//   Supabase bearer token) — a header merely being present is NOT enough
// - Path allowlist: only the webhook paths real callers use are proxied;
//   anything else is rejected so this can't be used as an open proxy into
//   the whole n8n webhook namespace
// - Only POST is exposed; no caller uses GET

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';
import { authenticateRequest } from '@/lib/auth/apiAuth';

const N8N_BASE_URL = process.env.N8N_WEBHOOK_URL || 'https://n8n.jedroplus.com/webhook';
const N8N_API_KEY = process.env.N8N_WEBHOOK_API_KEY;

// Webhook paths callers actually use (see lib/api/billingClient.ts,
// app/chatbot-plus/page.tsx, components/asistent/AssistantChat.tsx).
// Entries ending in "/" are namespace prefixes; the rest are exact endpoints.
const ALLOWED_PATH_PREFIXES = ['onboarding/', 'billing/', 'sms/'];
const ALLOWED_EXACT_PATHS = ['chatbot-plus-message', 'asistent'];

function isPathAllowed(path: string): boolean {
  return (
    ALLOWED_EXACT_PATHS.includes(path) ||
    ALLOWED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // ✅ KORAK 1: Rate limiting
    const { success, limit, remaining, reset } = await rateLimit(request, "webhook");

    if (!success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Preveč zahtev. Počakajte trenutek.",
          retryAfter: Math.ceil((reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": reset.toString(),
            "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // ✅ KORAK 2: Validate the session (cookie or verified bearer token)
    const auth = await authenticateRequest(request);
    if ('response' in auth) return auth.response;

    // ✅ KORAK 3: Sestavi target URL — only allowlisted webhook paths
    const { path } = await params;
    const joinedPath = path.join('/');
    if (!isPathAllowed(joinedPath)) {
      return NextResponse.json(
        { ok: false, error: 'Path not allowed' },
        { status: 403 }
      );
    }
    const query = request.nextUrl.search;
    const targetUrl = `${N8N_BASE_URL}/${joinedPath}${query}`;

    // ✅ KORAK 4: Preberi body
    const body = await request.json().catch(() => ({}));

    // ✅ KORAK 5: Pošlji na n8n z API key IN user auth
    const authHeader = request.headers.get('Authorization');
    const n8nResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {}),
        ...(N8N_API_KEY ? { 'X-API-Key': N8N_API_KEY } : {}),
      },
      body: JSON.stringify(body),
    });

    // Parsiraj response
    const responseText = await n8nResponse.text();
    let responseData: unknown;

    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch {
      responseData = { raw: responseText };
    }

    return NextResponse.json(responseData, {
      status: n8nResponse.status,
      headers: {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": reset.toString(),
      },
    });

  } catch (error) {
    console.error('[API /n8n] Proxy error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Proxy request failed',
      },
      { status: 500 }
    );
  }
}
