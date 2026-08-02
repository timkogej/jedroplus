'use client';

// Internal test page for the ReceptionistPlus credit-pack Stripe flow.
// Not linked from navigation — for manual end-to-end testing only while in
// Stripe test mode. Phase 4 will replace this with a polished dashboard.

import { useState } from 'react';
import { useCompany } from '@/app/company-context';

const PACKS: { key: 'zagon' | 'standard' | 'profi'; label: string; credits: number; price: string }[] = [
  { key: 'zagon', label: 'Zagon', credits: 100, price: '15 €' },
  { key: 'standard', label: 'Standard', credits: 300, price: '39 €' },
  { key: 'profi', label: 'Profi', credits: 750, price: '89 €' },
];

export default function ReceptionistPlusTestPage() {
  const { companyUuid } = useCompany();
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(pack: string) {
    if (!companyUuid) return;
    setLoadingPack(pack);
    setError(null);
    try {
      const res = await fetch('/api/receptionistplus/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyUuid, pack }),
      });
      const data = await res.json();
      if (!data.ok || !data.checkout_url) {
        setError(data.error ?? 'Napaka pri ustvarjanju Checkout seje');
        return;
      }
      window.location.href = data.checkout_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Napaka');
    } finally {
      setLoadingPack(null);
    }
  }

  return (
    <div className="mx-auto max-w-xl p-8">
      <h1 className="mb-2 text-xl font-semibold">ReceptionistPlus credit packs — test</h1>
      <p className="mb-6 text-sm text-gray-500">Stripe TEST MODE. Internal QA page, not linked from nav.</p>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <div className="space-y-3">
        {PACKS.map((pack) => (
          <button
            key={pack.key}
            onClick={() => buy(pack.key)}
            disabled={!companyUuid || loadingPack !== null}
            className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left hover:bg-gray-50 disabled:opacity-50"
          >
            <span>
              <span className="font-medium">{pack.label}</span>{' '}
              <span className="text-gray-500">— {pack.credits} kreditov</span>
            </span>
            <span className="flex items-center gap-2">
              <span>{pack.price}</span>
              {loadingPack === pack.key ? <span className="text-xs text-gray-400">…</span> : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
