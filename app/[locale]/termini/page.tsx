// app/[locale]/termini/page.tsx
//
// Server Component entry for the Termini (appointments) page. Authenticates via
// the cookie session, reads the active company from the `company_id` cookie,
// fetches appointments/services/employees server-side (one round of parallel,
// de-duplicated queries, with own-only pre-filtering for restricted staff), and
// hands the result to the client shell as `initialData`.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchAppointmentsDataServer } from "@/lib/appointments/fetchAppointmentsData.server";
import AppointmentsClient from "./AppointmentsClient";
import { getServerUser } from "@/lib/auth/serverUser";

export default async function AppointmentsPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("company_id")?.value ?? null;

  // If the company cookie isn't set yet (e.g. first load right after login), fall
  // back to the client shell, which resolves the company from localStorage and
  // fetches on mount as before.
  const initialData = companyId ? await fetchAppointmentsDataServer(companyId) : null;

  return <AppointmentsClient initialData={initialData} />;
}
