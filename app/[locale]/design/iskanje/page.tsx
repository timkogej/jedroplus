'use client';

/**
 * ZAČASNA predogledna stran za iskanje (⌘K). Ko je redizajn potrjen, se
 * mapa `design` zbriše.
 */

import { useEffect } from 'react';
import { SearchModal, SidebarProvider, useSidebar } from '@/components/layout';

function OpenOnLoad() {
  const { openSearch } = useSidebar();
  useEffect(() => {
    openSearch();
  }, [openSearch]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
        predogled
      </div>
      <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Iskanje (⌘K)</h1>
      <p className="mt-0.5 mb-6 text-base text-gray-500">Odpre se samo; znova z gumbom ali s ⌘K.</p>
      <button
        type="button"
        onClick={openSearch}
        className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900"
      >
        Odpri iskanje
      </button>
    </div>
  );
}

export default function IskanjePreview() {
  return (
    <SidebarProvider>
      <main className="min-h-screen bg-white">
        <OpenOnLoad />
        <SearchModal />
      </main>
    </SidebarProvider>
  );
}
