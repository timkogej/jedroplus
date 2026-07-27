// app/api/webhook-crm-import/route.ts
// ✅ SECURE: Auth + company ownership check + rate limiting.
// Proxies CRM imports to the dedicated n8n workflow so the webhook URL
// stays out of the client bundle and company_id cannot be spoofed.

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { requireCompanyAccess } from "@/lib/auth/apiAuth";

const CRM_IMPORT_WEBHOOK_URL = "https://n8n.jedroplus.com/webhook/uvoz-crm";
const N8N_API_KEY = process.env.N8N_WEBHOOK_API_KEY;

export async function POST(request: NextRequest) {
  try {
    // ✅ KORAK 1: Rate limiting
    const { success, reset } = await rateLimit(request, "webhook");
    if (!success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Preveč zahtev. Počakajte trenutek.",
          retryAfter: Math.ceil((reset - Date.now()) / 1000),
        },
        { status: 429, headers: { "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString() } }
      );
    }

    // ✅ KORAK 2: Preberi payload
    let payload: { company_id?: unknown; data?: unknown };
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const companyId = typeof payload.company_id === "string" ? payload.company_id : "";
    if (!companyId) {
      return NextResponse.json({ ok: false, error: "company_id required" }, { status: 400 });
    }
    if (!payload.data || typeof payload.data !== "object") {
      return NextResponse.json({ ok: false, error: "data required" }, { status: 400 });
    }

    // ✅ KORAK 3: Avtentikacija + preveri, da company_id pripada prijavljenemu uporabniku
    const authResult = await requireCompanyAccess(request, companyId);
    if ("response" in authResult) return authResult.response;

    // ✅ KORAK 4: Pošlji na namenski n8n workflow za uvoz CRM
    if (!N8N_API_KEY) {
      console.warn("[api/webhook-crm-import] N8N_WEBHOOK_API_KEY is not configured!");
    }

    const response = await fetch(CRM_IMPORT_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(N8N_API_KEY ? { "X-API-Key": N8N_API_KEY } : {}),
      },
      body: JSON.stringify({ company_id: companyId, data: payload.data }),
    });

    if (!response.ok) {
      let n8nErrorMsg = `Webhook failed: ${response.status}`;
      try {
        const errText = await response.text();
        if (errText) {
          const errJson = JSON.parse(errText);
          n8nErrorMsg = errJson?.message || errJson?.error || n8nErrorMsg;
        }
      } catch { /* ignore */ }
      console.error(`[api/webhook-crm-import] n8n returned ${response.status}: ${n8nErrorMsg}`);
      return NextResponse.json({ ok: false, error: n8nErrorMsg }, { status: response.status });
    }

    const text = await response.text();
    if (!text) {
      return NextResponse.json({ ok: true });
    }
    try {
      const json = JSON.parse(text);
      if (typeof json === "object" && json && "ok" in json) {
        return NextResponse.json(json);
      }
      return NextResponse.json({ ok: true, ...json });
    } catch {
      return NextResponse.json({ ok: true, data: text });
    }
  } catch (error) {
    console.error("[api/webhook-crm-import] Error:", error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
