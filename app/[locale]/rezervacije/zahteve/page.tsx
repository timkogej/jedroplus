// app/[locale]/rezervacije/zahteve/page.tsx
//
// Server Component entry for the Zahteve za termin (request-based booking
// requests) page. Same auth gate as the parent Rezervacije page: authenticate
// via the cookie session, redirect to /login if missing. The actual data
// (zahteve_termini rows) is fetched client-side by ZahteveClient, same as the
// rest of this app's company-scoped tables.

import { redirect } from "next/navigation";
import ZahteveClient from "./ZahteveClient";
import { getServerUser } from "@/lib/auth/serverUser";

export default async function ZahteveTerminaPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  return <ZahteveClient />;
}
