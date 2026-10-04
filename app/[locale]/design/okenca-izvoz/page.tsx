'use client';

/**
 * ZAČASNA predogledna stran za okenci izvoza terminov in obvestila o
 * prestavitvi. Ko je redizajn potrjen, se mapa `design` zbriše.
 */

import { useState } from 'react';
import ExportAppointmentsModal from '@/components/appointments/ExportAppointmentsModal';
import { RescheduleNotificationModal } from '@/components/appointments/RescheduleNotificationModal';
import type { AppointmentWithDetails } from '@/types/appointments';

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// Trideset terminov v zadnjem mesecu, različnih stanj, nekaj »ghost«.
const APPOINTMENTS = Array.from({ length: 30 }, (_, i) => ({
  id: `a${i}`,
  datum: daysAgo(i),
  cas_zacetek: `${String(9 + (i % 8)).padStart(2, '0')}:00:00`,
  status: i % 5 === 0 ? 'cancelled' : i % 3 === 0 ? 'scheduled' : 'completed',
  belezi_termin: i % 7 !== 0,
  stranka_ime: ['Ana', 'Luka', 'Eva', 'Tina', 'Marko'][i % 5],
  stranka_priimek: ['Kovač', 'Zupan', 'Kranjc', 'Golob', 'Horvat'][i % 5],
})) as unknown as AppointmentWithDetails[];

export default function OkencaIzvozPreview() {
  const [open, setOpen] = useState<'export' | 'reschedule' | null>('export');
  const btn = 'rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900';

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          predogled
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Okenca — izvoz in prestavitev</h1>
        <p className="mt-0.5 mb-6 text-base text-gray-500">30 terminov v zadnjem mesecu.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setOpen('export')} className={btn}>Izvozi termine</button>
          <button type="button" onClick={() => setOpen('reschedule')} className={btn}>Obvestilo o prestavitvi</button>
        </div>
      </div>

      <ExportAppointmentsModal
        isOpen={open === 'export'}
        onClose={() => setOpen(null)}
        companyId="preview"
        appointments={APPOINTMENTS}
      />
      <RescheduleNotificationModal
        isOpen={open === 'reschedule'}
        onClose={() => setOpen(null)}
        onConfirm={() => setOpen(null)}
        appointment={APPOINTMENTS[1]}
        newDate="2026-10-09"
        newTime="15:30"
        channel="both"
      />
    </main>
  );
}
