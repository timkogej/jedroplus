// lib/webhook.ts
// ✅ SECURE: Calls internal API route, not n8n directly
// API key stays on server, never exposed to browser

const WEBHOOK_PROXY_URL = "/api/webhook";  // ✅ Internal API route
export const WEBHOOK_URL = WEBHOOK_PROXY_URL; // backwards compat

export type SendWebhookOptions = { companyId: string; actor: string };

export function sendWebhook(
  event: string,
  entity: string,
  data: Record<string, unknown>,
  opts: SendWebhookOptions
) {
  const payload = {
    event,
    entity,
    data,
    company_id: opts.companyId,
    actor: opts.actor && opts.actor.trim() ? opts.actor : "unknown",
    timestamp: new Date().toISOString(),
    meta: { app: "Integrate", version: "1.0" },
  };

  if (process.env.NODE_ENV !== "production") {
    const shouldDebug =
      typeof window !== "undefined" &&
      window.localStorage?.getItem("debug_webhooks") === "1";
    if (shouldDebug) {
      console.log("[webhook] payload", payload);
    }
    console.log("[webhook] sent", event, entity);
  }

  // ✅ Call internal API route instead of n8n directly
  fetch(WEBHOOK_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((error) => {
    console.error("[webhook] failed", event, entity, error);
  });
}