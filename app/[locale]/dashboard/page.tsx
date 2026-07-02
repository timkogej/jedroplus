// app/[locale]/dashboard/page.tsx
//
// Server Component entry for the dashboard. It authenticates via the cookie
// session, reads the active company from the `company_id` cookie, fetches the
// dashboard data server-side (one round of parallel, de-duplicated queries), and
// hands it to the client shell as `initialData` — eliminating the on-mount
// client fetch waterfall for the common navigation case.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { fetchDashboardDataServer } from "@/lib/dashboard/fetchDashboardData.server";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("company_id")?.value ?? null;

  // If the company cookie isn't set yet (e.g. the very first load right after
  // login, before the client has persisted it), fall back to the client shell,
  // which resolves the company from localStorage and fetches on mount as before.
  const initialData = companyId ? await fetchDashboardDataServer(companyId) : null;

  return <DashboardClient initialData={initialData} />;
}
