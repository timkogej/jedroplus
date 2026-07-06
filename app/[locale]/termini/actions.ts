"use server";

// Server Action for the Termini page's on-demand range expansion. When the user
// filters to a date earlier than the loaded window, the client calls this to load
// that older range server-side (session-aware, own-only-filtered for restricted
// staff — same as the initial page fetch).
//
// Security: the company is taken from the `company_id` cookie (the caller's own
// active company), NOT from a client argument, so it can't be pointed at another
// company. RLS is the additional backstop.

import { cookies } from "next/headers";
import {
  fetchAppointmentsDataServer,
  type AppointmentsInitialData,
} from "@/lib/appointments/fetchAppointmentsData.server";

export async function loadAppointmentsFrom(
  fromDate: string
): Promise<AppointmentsInitialData | null> {
  const cookieStore = await cookies();
  const companyId = cookieStore.get("company_id")?.value ?? null;
  if (!companyId) return null;

  // Guard the input: expect yyyy-MM-dd. Fall back to the default window otherwise.
  const safeFrom = /^\d{4}-\d{2}-\d{2}$/.test(fromDate) ? fromDate : undefined;

  return fetchAppointmentsDataServer(companyId, safeFrom);
}
