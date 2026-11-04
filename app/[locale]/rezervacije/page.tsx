// app/[locale]/rezervacije/page.tsx
//
// Server Component entry for the Rezervacije (booking pages / settings) page.
// Authenticates via the cookie session, reads the active company from the
// `company_id` cookie, fetches + parses the company settings row server-side,
// and hands the result to the client shell as `initialData` so the booking
// links and settings overview paint without a spinner flash.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchReservationSettingsServer } from "@/lib/reservations/fetchReservationSettings.server";
import RezervacijeClient from "./RezervacijeClient";
import { getServerUser } from "@/lib/auth/serverUser";

export default async function RezervacijePage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("company_id")?.value ?? null;

  // If the company cookie isn't set yet (e.g. first load right after login), fall
  // back to the client shell, which resolves the company from context and fetches
  // on mount as before.
  const initialData = companyId ? await fetchReservationSettingsServer(companyId) : null;

  return <RezervacijeClient initialData={initialData} />;
}
