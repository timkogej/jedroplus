// lib/email/notifyOwner.ts
//
// Server-side notice to the company owner, sent through the n8n `email-event`
// workflow (which decides the template, drops duplicates and logs everything).
//
// Deliberately fire-and-forget: a mail that cannot be sent must never break or
// slow down the request that triggered it.


const N8N_EVENT_URL =
  process.env.N8N_EMAIL_EVENT_URL || 'https://n8n.jedroplus.com/webhook/email-event';
const N8N_API_KEY = process.env.N8N_WEBHOOK_API_KEY;

export type OwnerEvent =
  | 'company_created'
  | 'quota_reached'
  | 'payment_failed'
  | 'addon_purchased'
  | 'addon_cancelled'
  | 'plan_changed';

export interface NotifyOwnerInput {
  event: OwnerEvent;
  /** Text business id, e.g. 7LHB28. */
  companyId: string;
  data?: Record<string, unknown>;
  language?: 'sl' | 'en' | 'de' | 'hr' | 'it';
}

export async function notifyOwner({ event, companyId, data, language }: NotifyOwnerInput): Promise<void> {
  if (!companyId) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(N8N_EVENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(N8N_API_KEY ? { 'X-API-Key': N8N_API_KEY } : {}),
      },
      body: JSON.stringify({ event, company_id: companyId, data: data ?? {}, language }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[notifyOwner] ${event} for ${companyId}: n8n returned ${res.status}`);
    }
  } catch (error) {
    console.warn(`[notifyOwner] ${event} for ${companyId} failed:`, error);
  }
}

/** Runs the notice without making the caller wait for it. */
export function notifyOwnerInBackground(input: NotifyOwnerInput): void {
  void notifyOwner(input);
}
