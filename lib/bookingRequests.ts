// lib/bookingRequests.ts
//
// Client wrapper for the n8n booking-v2 webhook's request-based booking
// actions (request-slots / request-confirm / request-reject). Goes through the
// internal /api/n8n/booking-v2 proxy — same shape as app/api/n8n/[...path]/route.ts
// uses for onboarding/billing/sms — so the N8N_WEBHOOK_API_KEY never reaches
// the browser.

const BOOKING_V2_PROXY_URL = '/api/n8n/booking-v2';

export type SlotAvailability = string[] | 'unavailable' | 'fully_booked';

export interface RequestSlotsResult {
  success: boolean;
  slots?: Record<string, SlotAvailability>;
  totalDurationMin?: number;
  employeeId?: string;
  error?: string;
}

export interface RequestConfirmResult {
  success: boolean;
  terminId?: string;
  terminRowId?: string;
  storitev?: string;
  oseba?: string;
  datum?: string;
  cas?: string;
  konec?: string;
  message?: string;
  error?: string;
}

export interface RequestRejectResult {
  success: boolean;
  requestId?: string;
  status?: string;
  message?: string;
  error?: string;
}

async function postBookingV2<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch(BOOKING_V2_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    return { success: false, error: json?.error ?? 'Prišlo je do napake' } as T;
  }
  return json as T;
}

export function requestSlots(params: {
  companySlug: string;
  employeeId: string;
  serviceIds: string[];
  dateFrom: string;
  dateTo: string;
  delDneva: string;
}): Promise<RequestSlotsResult> {
  return postBookingV2<RequestSlotsResult>({ action: 'request-slots', ...params });
}

export function confirmRequest(params: {
  requestId: string;
  employeeId: string;
  serviceIds: string[];
  date: string;
  time: string;
  resursiIds?: string[];
}): Promise<RequestConfirmResult> {
  return postBookingV2<RequestConfirmResult>({ action: 'request-confirm', ...params });
}

export function rejectRequest(params: {
  requestId: string;
  razlog: string;
}): Promise<RequestRejectResult> {
  return postBookingV2<RequestRejectResult>({ action: 'request-reject', ...params });
}
