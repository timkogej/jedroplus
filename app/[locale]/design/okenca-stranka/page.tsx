'use client';

/**
 * ZAČASNA predogledna stran za okenca stranke (obrazec in panel s
 * podrobnostmi). Ko je redizajn potrjen, se mapa `design` zbriše.
 */

import { useState } from 'react';
import ClientModal from '@/components/clients/ClientModal';
import ClientDetailsPanel from '@/components/clients/ClientDetailsPanel';
import type { Client } from '@/types/clients';

const CLIENT: Client = {
  id: '1',
  ime: 'Ana',
  priimek: 'Kovač',
  spol: 'ženska',
  tip_stranke: 'vip',
  language: 'slo',
  email: 'ana.kovac@example.com',
  telefon: '041 234 567',
  opombe: 'Alergija na amonijak. Raje ima jutranje termine.',
  interne_opombe: 'Stalna stranka, rada se pogovarja o vrtnarjenju.',
  created_at: '2025-03-14T10:00:00Z',
  appointment_count: 24,
};

export default function OkencaStrankaPreview() {
  const [open, setOpen] = useState<'create' | 'edit' | 'panel' | null>('panel');

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          predogled
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Okenca — stranka</h1>
        <p className="mt-0.5 mb-6 text-base text-gray-500">Obrazec za novo / urejanje in panel s podrobnostmi.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setOpen('panel')} className="rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-sm">Podrobnosti</button>
          <button type="button" onClick={() => setOpen('create')} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900">Nova stranka</button>
          <button type="button" onClick={() => setOpen('edit')} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900">Uredi stranko</button>
        </div>
      </div>

      <ClientModal
        isOpen={open === 'create' || open === 'edit'}
        onClose={() => setOpen(null)}
        client={open === 'edit' ? CLIENT : null}
        mode={open === 'edit' ? 'edit' : 'create'}
        companyId="preview"
        onSave={async () => setOpen(null)}
      />
      <ClientDetailsPanel
        isOpen={open === 'panel'}
        onClose={() => setOpen(null)}
        client={CLIENT}
        companyId="preview"
        onEdit={() => setOpen('edit')}
        onDelete={() => {}}
        onNewAppointment={() => {}}
      />
    </main>
  );
}
