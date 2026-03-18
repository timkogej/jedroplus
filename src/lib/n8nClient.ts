// src/lib/n8nClient.ts
// ✅ SECURE: Calls internal API route, not n8n directly
// API key stays on server, never exposed to browser

const WEBHOOK_PROXY_URL = "/api/webhook";  // ✅ Internal API route

export type N8nPayload = {
  event: string;
  entity: string;
  data: Record<string, unknown>;
  company_id: string;
  actor: string;
  timestamp: string;
  meta?: { app: "Integrate"; version: "1.0" };
};

import { validateWebhookData } from "./webhookValidator";

export async function callN8nAction(
  payload: N8nPayload,
  retry?: () => Promise<N8nPayload>
): Promise<{
  ok: boolean;
  data?: unknown;
  error?: string;
}> {
  try {
    const normalizedPayload = {
      ...payload,
      company_id: payload.company_id || payload.data?.company_id || "",
      actor: payload.actor && payload.actor.trim() ? payload.actor : "unknown",
      timestamp: payload.timestamp || new Date().toISOString(),
      meta: payload.meta ?? { app: "Integrate", version: "1.0" },
    };
    const normalizedData = {
      ...payload.data,
      company_id: normalizedPayload.company_id,
      user_id: normalizedPayload.actor,
    };
    normalizedPayload.data = normalizedData;
    
    const missing = validateWebhookData(
      normalizedPayload.event,
      normalizedPayload.entity,
      normalizedData
    );
    if (missing.length > 0) {
      const shouldDebug =
        typeof window !== "undefined" &&
        window.localStorage?.getItem("debug_webhooks") === "1";
      if (shouldDebug) {
        console.warn("[webhook] missing keys", missing);
        console.warn("[webhook] payload", normalizedPayload);
      }
      if (process.env.NODE_ENV !== "production") {
        throw new Error(`Webhook payload missing keys: ${missing.join(", ")}`);
      }
      console.error("[webhook] missing keys", missing);
    }

    // ✅ Call internal API route instead of n8n directly
    const response = await fetch(WEBHOOK_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalizedPayload),
    });

    if (!response.ok) {
      if (retry && response.status === 409) {
        const nextPayload = await retry();
        return callN8nAction(nextPayload);
      }
      // Read the response body to get the actual error message
      try {
        const errText = await response.text();
        if (errText) {
          const errJson = JSON.parse(errText);
          const errMsg = errJson?.error || errJson?.message || `HTTP ${response.status}`;
          return { ok: false, error: errMsg };
        }
      } catch {
        // ignore parse errors
      }
      return { ok: false, error: `HTTP ${response.status}` };
    }
    
    const text = await response.text();
    if (!text) {
      return { ok: true };
    }
    try {
      const json = JSON.parse(text);
      if (typeof json === "object" && json && "ok" in json) {
        if (
          retry &&
          json.ok === false &&
          typeof json.error === "string" &&
          json.error.toLowerCase().includes("duplicate")
        ) {
          const nextPayload = await retry();
          return callN8nAction(nextPayload);
        }
        return json;
      }
      return { ok: true, data: json };
    } catch {
      return { ok: true, data: text };
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Webhook failed",
    };
  }
}