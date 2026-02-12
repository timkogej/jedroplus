import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";

export default async function Home() {
  // Check authentication first
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Then check company selection
  const cookieStore = await cookies();
  const companyId = cookieStore.get("company_id")?.value;

  if (!companyId) {
    // Redirect to onboarding for company setup
    redirect("/onboarding");
  }

  redirect("/dashboard");
}
