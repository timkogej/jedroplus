'use client';

/**
 * ZAČASNA predogledna stran za okenci potrditve in zavrnitve zahteve.
 *
 * Potrditev naloži storitve in osebe iz baze, zato brez prijave pokaže le
 * povzetek zahteve in nalaganje. Ko je redizajn potrjen, se mapa `design`
 * zbriše.
 */

import { useState } from 'react';
import { ConfirmRequestModal } from '@/components/zahteve/ConfirmRequestModal';
import { RejectRequestModal } from '@/components/zahteve/RejectRequestModal';
import type { ZahtevaTermina } from '@/lib/supabase/zahteveTermini';

const ZAHTEVA: ZahtevaTermina = {
  id: 'z1',
  ime: 'Ana',
  priimek: 'Kovač',
  email: 'ana.kovac@example.com',
  telefon: '041 234 567',
  opis_zelje: 'Rada bi pobarvala lase v toplejši odtenek in jih malo skrajšala. Imam dolge, goste lase.',
  spol: 'ženska',
  zeljeni_datum_od: '2026-10-06',
  zeljeni_datum_do: '2026-10-10',
  zeljeni_del_dneva: 'popoldan',
  status: 'v_pregledu',
  language: 'sl',
  created_at: '2026-10-02T09:12:00Z',
  updated_at: '2026-10-02T09:12:00Z',
};

export default function OkencaZahtevePreview() {
  const [open, setOpen] = useState<'confirm' | 'reject' | null>('reject');
  const btn = 'rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900';

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          predogled
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Okenca — zahteve za termin</h1>
        <p className="mt-0.5 mb-6 text-base text-gray-500">
          Potrditev potrebuje prijavo za nalaganje storitev in oseb.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setOpen('confirm')} className={btn}>Potrdi zahtevo</button>
          <button type="button" onClick={() => setOpen('reject')} className={btn}>Zavrni zahtevo</button>
        </div>
      </div>

      {open === 'confirm' && (
        <ConfirmRequestModal zahteva={ZAHTEVA} onClose={() => setOpen(null)} onConfirmed={() => setOpen(null)} />
      )}
      {open === 'reject' && (
        <RejectRequestModal zahteva={ZAHTEVA} onClose={() => setOpen(null)} onRejected={() => setOpen(null)} />
      )}
    </main>
  );
}
