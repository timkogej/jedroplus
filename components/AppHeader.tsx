"use client";

import { useCompany } from "@/app/company-context";

export default function AppHeader() {
  const { companyId, switchCompany } = useCompany();

  return (
    <header className="w-full border-b border-black">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4 text-sm uppercase">
        <div className="flex items-center gap-2">
          <span>Podjetje</span>
          <span className="font-semibold">{companyId ?? "—"}</span>
        </div>
        <button
          type="button"
          onClick={switchCompany}
          className="border border-black px-3 py-1 text-xs uppercase transition hover:bg-black hover:text-white"
        >
          Zamenjaj podjetje
        </button>
      </div>
    </header>
  );
}
