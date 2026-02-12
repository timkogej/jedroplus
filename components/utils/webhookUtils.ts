// Webhook utilities for n8n integration

export interface WebhookPayload {
  event: string;
  entity: string;
  company_id: string;
  actor: string;
  timestamp: string;
  data: Record<string, unknown>;
}

const WEBHOOK_URL = 'https://tikej.app.n8n.cloud/webhook/main_povezava';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export async function sendWebhook(payload: WebhookPayload): Promise<unknown> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }

      console.log('Webhook sent successfully:', payload.event);
      return await response.json();
    } catch (error) {
      console.error(`Webhook attempt ${attempt + 1} failed:`, error);

      if (attempt < MAX_RETRIES - 1) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * (attempt + 1)));
      } else {
        // Log final failure but don't throw - settings should save even if webhook fails
        console.error('Webhook failed after all retries:', payload);
      }
    }
  }
  return null;
}

// Setting-specific webhook events
export const WEBHOOK_EVENTS = {
  GENERAL_SETTINGS_UPDATED: 'GENERAL_SETTINGS_UPDATED',
  COMPANY_PROFILE_UPDATED: 'COMPANY_PROFILE_UPDATED',
  BOOKING_SETTINGS_UPDATED: 'BOOKING_SETTINGS_UPDATED',
  CHATBOT_SETTINGS_UPDATED: 'CHATBOT_SETTINGS_UPDATED',
  KPI_SETTINGS_UPDATED: 'KPI_SETTINGS_UPDATED',
  REMINDER_SETTINGS_UPDATED: 'REMINDER_SETTINGS_UPDATED',
  LOST_LEADS_SETTINGS_UPDATED: 'LOST_LEADS_SETTINGS_UPDATED',
} as const;
