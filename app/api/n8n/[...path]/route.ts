import { NextRequest, NextResponse } from 'next/server';

const N8N_BASE_URL = process.env.N8N_WEBHOOK_URL || 'https://tikej.app.n8n.cloud/webhook';

/**
 * Proxy API route for n8n webhook calls
 *
 * This route proxies requests to n8n webhooks server-side,
 * avoiding CORS issues that occur with direct browser requests.
 *
 * The client sends the Supabase access token in the Authorization header,
 * which is forwarded to n8n for authentication.
 *
 * Usage: /api/n8n/onboarding/create-company -> https://tikej.app.n8n.cloud/webhook/onboarding/create-company
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const endpoint = '/' + path.join('/');
    const targetUrl = `${N8N_BASE_URL}${endpoint}`;

    // Get the request body
    const body = await request.json().catch(() => ({}));

    // Get auth token from client request header (forwarded from billingClient)
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      return NextResponse.json(
        { ok: false, error: 'Authorization header required' },
        { status: 401 }
      );
    }

    // Forward the request to n8n with the auth token
    const n8nResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(body)
    });

    // Get response data
    const responseText = await n8nResponse.text();
    let responseData: unknown;

    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch {
      responseData = { raw: responseText };
    }

    // Return the response with same status code
    return NextResponse.json(responseData, {
      status: n8nResponse.status
    });

  } catch (error) {
    console.error('[API /n8n] Proxy error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Proxy request failed'
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
    const { path } = await params;
    const endpoint = '/' + path.join('/');
    const targetUrl = `${N8N_BASE_URL}${endpoint}`;

    // Get auth token from client request header
    const authHeader = request.headers.get('Authorization');

    // Forward the request to n8n
    const n8nResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {})
      }
    });

    // Get response data
    const responseText = await n8nResponse.text();
    let responseData: unknown;

    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch {
      responseData = { raw: responseText };
    }

    // Return the response with same status code
    return NextResponse.json(responseData, {
      status: n8nResponse.status
    });

  } catch (error) {
    console.error('[API /n8n] Proxy error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Proxy request failed'
      },
      { status: 500 }
    );
  }
}
