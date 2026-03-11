// app/api/n8n/[...path]/route.ts
// ✅ SECURE: Rate limiting + API Key + Auth validation

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';

const N8N_BASE_URL = process.env.N8N_WEBHOOK_URL || 'https://tikej.app.n8n.cloud/webhook';
const N8N_API_KEY = process.env.N8N_WEBHOOK_API_KEY;

/**
 * Proxy API route for n8n webhook calls
 * 
 * Security features:
 * - Rate limiting (50 req / 10 sec)
 * - API Key authentication to n8n
 * - Authorization header validation
 */

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

    // ✅ KORAK 2: Preveri Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json(
        { ok: false, error: 'Authorization header required' },
        { status: 401 }
      );
    }

    // ✅ KORAK 3: Sestavi target URL
    const { path } = await params;
    const endpoint = '/' + path.join('/');
    const query = request.nextUrl.search;
    const targetUrl = `${N8N_BASE_URL}${endpoint}${query}`;

    // ✅ KORAK 4: Preberi body
    const body = await request.json().catch(() => ({}));

    // ✅ KORAK 5: Pošlji na n8n z API key IN user auth
    const n8nResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // ✅ KORAK 1: Rate limiting
    const { success, limit, remaining, reset } = await rateLimit(request, "api");
    
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

    // ✅ KORAK 2: Auth header (opcijsko za GET, ampak priporočeno)
    const authHeader = request.headers.get('Authorization');

    // ✅ KORAK 3: Sestavi target URL
    const { path } = await params;
    const endpoint = '/' + path.join('/');
    const query = request.nextUrl.search;
    const targetUrl = `${N8N_BASE_URL}${endpoint}${query}`;

    // ✅ KORAK 4: Pošlji na n8n z API key
    const n8nResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {}),
        ...(N8N_API_KEY ? { 'X-API-Key': N8N_API_KEY } : {}),
      },
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
