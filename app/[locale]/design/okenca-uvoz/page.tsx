'use client';

/**
 * ZAČASNA predogledna stran za uvoz strank iz CRM. Gumb »Naloži primer«
 * okencu poda testno CSV datoteko, da se vidi tudi korak s stolpci. Uvoz
 * tu ne pošlje ničesar (onSendToN8n je lažen). Ko je redizajn potrjen, se
 * mapa `design` zbriše.
 */

import { useState } from 'react';
import CrmImportModal from '@/components/clients/CrmImportModal';

const SAMPLE_CSV = [
  'Ime,Priimek,E-pošta,Telefon,Spol,Opombe,Datum vpisa',
  'Ana,Kovač,ana.kovac@example.com,041 234 567,Ž,Stalna stranka,2024-03-14',
  'Luka,Zupan,luka.zupan@example.com,031 555 123,M,,2024-06-02',
  'Eva,Kranjc,eva.kranjc@example.com,040 987 654,Ž,Alergija na amonijak,2025-01-20',
  'Tina,Golob,tina.golob@example.com,051 111 222,Ž,,2025-04-11',
  'Marko,Horvat,marko.horvat@example.com,070 333 444,M,Raje popoldne,2025-09-30',
  'Nina,Potočnik,nina.p@example.com,041 777 888,Ž,,2026-02-05',
].join('\n');

export default function OkencaUvozPreview() {
  const [open, setOpen] = useState(true);

  const loadSample = () => {
    const input = document.querySelector<HTMLInputElement>('input[type=file][accept=".csv,.xlsx,.xls"]');
    if (!input) return;
    const dt = new DataTransfer();
    dt.items.add(new File([SAMPLE_CSV], 'stranke-iz-crm.csv', { type: 'text/csv' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          predogled
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Okence — uvoz strank</h1>
        <p className="mt-0.5 mb-6 text-base text-gray-500">Uvoz iz CRM (CSV/Excel) v štirih korakih.</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900"
        >
          Odpri uvoz
        </button>
      </div>

      {open && (
        <button
          type="button"
          onClick={loadSample}
          className="fixed bottom-4 left-1/2 z-[200] -translate-x-1/2 rounded-full bg-amber-800 px-4 py-2 text-xs font-semibold text-white shadow-lg"
        >
          Naloži primer CSV
        </button>
      )}

      <CrmImportModal
        isOpen={open}
        onClose={() => setOpen(false)}
        companyId="preview"
        actor="preview@example.com"
        existingClients={[]}
        onImportComplete={() => {}}
        onSendToN8n={async () => ({ ok: true })}
      />
    </main>
  );
}
