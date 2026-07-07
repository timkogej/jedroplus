// app/[locale]/clients/page.tsx
//
// Server Component entry for the Stranke (clients) page. Authenticates via the
// cookie session, reads the active company from the `company_id` cookie, fetches
// clients + bookings server-side once (deriving both the list and the stats from
// the shared rows), and hands the result to the client shell as `initialData`.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { fetchClientsDataServer } from "@/lib/clients/fetchClientsData.server";
import ClientsClient from "./ClientsClient";

export default async function ClientsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const companyId = cookieStore.get("company_id")?.value ?? null;

  // If the company cookie isn't set yet (e.g. first load right after login), fall
  // back to the client shell, which resolves the company from localStorage and
  // fetches on mount as before.
  const initialData = companyId ? await fetchClientsDataServer(companyId) : null;

  return <ClientsClient initialData={initialData} />;
}
