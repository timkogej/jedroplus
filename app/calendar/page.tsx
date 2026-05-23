// TODO(i18n-review): confirm if this dev page should be removed, kept English-only, or included in i18n.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { useCompany } from "@/app/company-context";

export default function CalendarPage() {
  const router = useRouter();
  const { companyId, loading } = useCompany();

  useEffect(() => {
    if (loading) return;
    if (!companyId) {
      router.replace("/onboarding");
    }
  }, [companyId, loading, router]);

  if (!companyId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-12">
        <h1 className="text-2xl font-semibold uppercase tracking-wide">
          Calendar
        </h1>
        <p className="text-xs uppercase tracking-widest">
          Placeholder route. Implement calendar view here.
        </p>
      </main>
    </div>
  );
}
