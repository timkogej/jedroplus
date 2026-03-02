// app/api/webhook/route.ts
// ✅ SECURE: API key + Rate limiting

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

const WEBHOOK_URL = "https://tikej.app.n8n.cloud/webhook/main_povezava";
const N8N_API_KEY = process.env.N8N_WEBHOOK_API_KEY;

export async function POST(request: NextRequest) {
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

    // ✅ KORAK 2: Preveri API key konfiguracijo
    if (!N8N_API_KEY) {
      console.error("[api/webhook] N8N_WEBHOOK_API_KEY is not configured!");
      return NextResponse.json(
        { ok: false, error: "Webhook not configured" },
        { status: 500 }
      );
    }

    // ✅ KORAK 3: Preberi payload
    const payload = await request.json();

    // Normaliziraj payload
    const normalizedPayload = {
      ...payload,
      company_id: payload.company_id || payload.data?.company_id || "",
      actor: payload.actor && payload.actor.trim() ? payload.actor : "unknown",
      timestamp: payload.timestamp || new Date().toISOString(),
      meta: payload.meta ?? { app: "Integrate", version: "1.0" },
    };

    // ✅ KORAK 4: Pošlji na n8n z API key
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": N8N_API_KEY,
      },
      body: JSON.stringify(normalizedPayload),
    });

    if (!response.ok) {
      console.error(`[api/webhook] n8n returned ${response.status}`);
      return NextResponse.json(
        { ok: false, error: `Webhook failed: ${response.status}` },
        { 
          status: response.status,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
        }
      );
    }

    // Parsiraj response
    const text = await response.text();
    if (!text) {
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
      const json = JSON.parse(text);
      return NextResponse.json(json, {
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      });
    } catch {
      return NextResponse.json(
        { ok: true, data: text },
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
    console.error("[api/webhook] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}