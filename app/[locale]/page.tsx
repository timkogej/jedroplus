import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth/serverUser";

export default async function LocaleHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const user = await getServerUser();

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
