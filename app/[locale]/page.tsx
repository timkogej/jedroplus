import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";

export default async function LocaleHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const cookieStore = await cookies();
  const companyId = cookieStore.get('company_id')?.value;

  if (!companyId) {
    redirect(`/${locale}/onboarding`);
  }

  redirect(`/${locale}/dashboard`);
}
