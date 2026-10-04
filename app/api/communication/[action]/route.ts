// app/api/communication/[action]/route.ts
// ✅ SECURE: session + company access + API key + rate limiting
// Proxies to n8n communication webhooks (generate / send)

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { requireCompanyAccess } from "@/lib/auth/apiAuth";
import { createClient } from "@supabase/supabase-js";
import { canReceiveMarketing } from "@/lib/marketingConsent";
import { unsubscribeUrl } from "@/lib/unsubscribe";

export const maxDuration = 60;

const N8N_BASE = "https://n8n.jedroplus.com/webhook/communication";
const N8N_API_KEY = process.env.N8N_WEBHOOK_API_KEY;

const ALLOWED_ACTIONS = new Set(["generate", "send"]);

type Skipped = { client_id: number; reason: "unsubscribed" };

/**
 * Komunikacija is marketing: drop clients who declined or unsubscribed, and
 * give n8n an unsubscribe link for everyone else (data.unsubscribe_urls,
 * keyed by client id) to put in the message and the List-Unsubscribe header.
 * Before migration 1790300000 the columns are missing: nobody is dropped.
 */
async function applyMarketingConsent(
  clientIds: number[],
  origin: string
): Promise<{ allowed: number[]; skipped: Skipped[]; urls: Record<string, string> }> {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin
    .from("Stranke")
    .select("id, marketing_consent, marketing_opt_out_at")
    .in("id", clientIds);

  const blocked = new Set<number>();
  if (error) {
    console.warn("[api/communication/send] consent columns not readable:", error.message);
  } else {
    for (const row of data ?? []) {
      if (!canReceiveMarketing(row as Record<string, unknown>)) blocked.add(Number(row.id));
    }
  }

  const allowed = clientIds.filter((id) => !blocked.has(id));
  const urls: Record<string, string> = {};
  for (const id of allowed) {
    const url = unsubscribeUrl(origin, id);
    if (url) urls[String(id)] = url;
  }
  return {
    allowed,
    skipped: clientIds.filter((id) => blocked.has(id)).map((id) => ({ client_id: id, reason: "unsubscribed" })),
    urls,
  };
}

/** Adds the clients we held back to n8n's own totals/skipped list. */
function withConsentSkipped(json: unknown, skipped: Skipped[]): unknown {
  if (skipped.length === 0 || !json || typeof json !== "object" || Array.isArray(json)) return json;
  const body = json as Record<string, unknown>;
  const totals = (body.totals ?? null) as Record<string, number> | null;
  return {
    ...body,
    ...(totals
      ? {
          totals: {
            ...totals,
            requested: (totals.requested ?? 0) + skipped.length,
            skipped: (totals.skipped ?? 0) + skipped.length,
          },
        }
      : {}),
    skipped: [...(Array.isArray(body.skipped) ? body.skipped : []), ...skipped],
  };
}

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

    const companyId: string = payload.company_id || payload.data?.company_id || "";

    // ✅ Prijavljen uporabnik, ki pripada podjetju iz zahteve
    const access = await requireCompanyAccess(request, companyId);
    if ("response" in access) return access.response;

    const normalizedPayload = {
      ...payload,
      company_id: companyId,
      actor: access.user.email ?? access.user.id,
      timestamp: payload.timestamp || new Date().toISOString(),
    };

    let consentSkipped: Skipped[] = [];
    const rawIds: unknown = payload.data?.client_ids;
    if (action === "send" && Array.isArray(rawIds) && rawIds.length > 0) {
      const ids = rawIds.map(Number).filter((n) => Number.isInteger(n));
      const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      const consent = await applyMarketingConsent(ids, origin);
      consentSkipped = consent.skipped;
      normalizedPayload.data = {
        ...payload.data,
        client_ids: consent.allowed,
        unsubscribe_urls: consent.urls,
      };

      if (consent.allowed.length === 0) {
        return NextResponse.json({
          ok: true,
          totals: { requested: ids.length, sent: 0, skipped: ids.length },
          sent: [],
          skipped: consentSkipped,
        });
      }
    }

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
        consentSkipped.length > 0 ? { ok: true, skipped: consentSkipped } : { ok: true },
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
      const json = withConsentSkipped(JSON.parse(responseText), consentSkipped);
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
