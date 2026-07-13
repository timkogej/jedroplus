// app/[locale]/koledar/page.tsx
//
// Server Component entry for the Koledar (calendar) page. Mirrors the Termini
// conversion: authenticates via the cookie session, reads the active company
// from the `company_id` cookie, fetches the default view's data server-side
// (current month's appointments, today's events, company-wide services/staff/
// absences/resursi), and hands the result to the client shell as `initialData`.
//
// Calendar seeds its initial state from initialData only when the payload
// matches the default landing state (same company as the client resolved, seeded
// for the client's "today"); any mismatch — or an absent company_id cookie (e.g.
// first load right after login) — falls back to the original client fetches.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { fetchCalendarDataServer } from "@/lib/calendar/fetchCalendarData.server";
import KoledarClient from "./KoledarClient";

export default async function KoledarPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("company_id")?.value ?? null;

  const initialData = companyId ? await fetchCalendarDataServer(companyId) : null;

  return <KoledarClient initialData={initialData} />;
}
