'use client';

/**
 * ZAČASNA predogledna stran za obrazec termina (nov / uredi).
 * Odpre pravi AppointmentModal z izmišljenimi storitvami in zaposlenimi.
 * Ko je redizajn potrjen, se mapa `design` zbriše.
 */

import { useState } from 'react';
import AppointmentModal from '@/components/appointments/AppointmentModal';
import type { AppointmentWithDetails, Storitev, Zaposleni } from '@/types/appointments';

const G = {
  violet: 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)',
  pink: 'linear-gradient(135deg, #EC4899 0%, #F97316 100%)',
  green: 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)',
};

const SERVICES: Storitev[] = [
  { id: 's1', naziv: 'Barvanje in fen', barva: G.violet, trajanje: 75, cena: 55 },
  { id: 's2', naziv: 'Pramenčki', barva: G.pink, trajanje: 45, cena: 40 },
  { id: 's3', naziv: 'Nega las s keratinom', barva: G.green, trajanje: 30, cena: 25 },
];

const EMPLOYEES: Zaposleni[] = [
  { id: 'e1', ime: 'Maja', priimek: 'Novak', email: 'maja@example.com', barva: G.violet },
  { id: 'e2', ime: 'Jaka', priimek: 'Kos', email: 'jaka@example.com', barva: G.pink },
];

const today = new Date().toISOString().split('T')[0];

const EDIT: AppointmentWithDetails = {
  id: '101', id_termina: 'T-48291037', datum: today, cas_zacetek: '10:00', cas_konec: '12:00',
  stranka_id: 'c1', stranka_ime: 'Ana Kovač', stranka_email: 'ana.kovac@example.com', stranka_telefon: '041 234 567',
  language: 'slo', storitev_id: 's1', storitev_id_2: 's2', zaposleni_id: 'e1', status: 'scheduled',
  opombe: 'Želi nekoliko toplejši odtenek kot zadnjič.', interne_opombe: 'Stalna stranka.',
  cena: 95, popust: 10, popust_tip: 'percent', koncna_cena: 85.5, valuta: 'EUR', belezi_termin: true,
  storitev: { id: 's1', naziv: 'Barvanje in fen', barva: G.violet, trajanje: 75, cena: 55 },
  storitev_2: { id: 's2', naziv: 'Pramenčki', barva: G.pink, trajanje: 45 },
  zaposleni: { id: 'e1', ime: 'Maja', priimek: 'Novak', email: 'maja@example.com', initials: 'MN', barva: G.violet },
};

export default function ObrazecDesignPreview() {
  const [mode, setMode] = useState<'create' | 'edit' | null>('edit');

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          predogled
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Okenca — obrazec termina</h1>
        <p className="mt-0.5 mb-6 text-base text-gray-500">Nov termin in urejanje obstoječega.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode('create')}
            className="rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-sm">
            Nov termin
          </button>
          <button type="button" onClick={() => setMode('edit')}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900">
            Uredi termin
          </button>
        </div>
      </div>

      {mode && (
        <AppointmentModal
          key={mode}
          isOpen
          onClose={() => setMode(null)}
          mode={mode}
          appointment={mode === 'edit' ? EDIT : null}
          services={SERVICES}
          employees={EMPLOYEES}
          onSave={async () => setMode(null)}
          initialDate={today}
          initialStartTime="10:00"
        />
      )}
    </main>
  );
}
