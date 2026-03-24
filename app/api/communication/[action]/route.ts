// app/api/communication/[action]/route.ts
// ✅ SECURE: API key + Rate limiting
// Proxies to n8n communication webhooks (generate / send)

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

export const maxDuration = 60;

const N8N_BASE = "https://tikej.app.n8n.cloud/webhook/communication";
const N8N_API_KEY = process.env.N8N_WEBHOOK_API_KEY;

const ALLOWED_ACTIONS = new Set(["generate", "send"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  try {
    const { action } = await params;

    if (!ALLOWED_ACTIONS.has(action)) {
      return NextResponse.json(
        { ok: false, error: "Invalid action" },
        { status: 400 }
      );
    }

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

    // ✅ KORAK 2: Preveri API key konfiguracijo
    if (!N8N_API_KEY) {
      console.error("[api/communication] N8N_WEBHOOK_API_KEY is not configured!");
      return NextResponse.json(
        { ok: false, error: "Webhook not configured" },
        { status: 500 }
      );
    }

    // ✅ KORAK 3: Preberi payload
    const payload = await request.json().catch(() => ({}));

    const normalizedPayload = {
      ...payload,
      company_id: payload.company_id || payload.data?.company_id || "",
      actor: payload.actor && payload.actor.trim() ? payload.actor : "unknown",
      timestamp: payload.timestamp || new Date().toISOString(),
    };

    // ✅ KORAK 4: Pošlji na n8n z API key
    const targetUrl = `${N8N_BASE}/${action}`;
    const n8nResponse = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": N8N_API_KEY,
      },
      body: JSON.stringify(normalizedPayload),
    });

    const responseText = await n8nResponse.text();

    if (!n8nResponse.ok) {
      console.error(`[api/communication/${action}] n8n returned ${n8nResponse.status}`);
      return NextResponse.json(
        { ok: false, error: `Webhook failed: ${n8nResponse.status}` },
        {
          status: n8nResponse.status,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
        }
      );
    }

    if (!responseText) {
      return NextResponse.json(
        { ok: true },
        {
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
        }
      );
    }

    try {
      const json = JSON.parse(responseText);
      return NextResponse.json(json, {
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      });
    } catch {
      return NextResponse.json(
        { ok: true, data: responseText },
        {
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
        }
      );
    }
  } catch (error) {
    console.error("[api/communication] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
