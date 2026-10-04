'use client';

/**
 * ZAČASNA predogledna stran za okenca koledarja (odsotnost, dogodek).
 * Ko je redizajn potrjen, se mapa `design` zbriše.
 */

import { useState } from 'react';
import AbsenceModal from '@/components/calendar/AbsenceModal';
import AbsenceDetailModal from '@/components/calendar/AbsenceDetailModal';
import EventModal from '@/components/calendar/EventModal';
import EventViewModal from '@/components/calendar/EventViewModal';
import type { Zaposleni } from '@/types/appointments';
import type { CalendarEvent } from '@/types/events';
import type { Absence } from '@/lib/supabase/appointments';
import { EMPLOYEE_GRADIENTS } from '@/lib/constants/gradients';
import { EVENT_COLOR_PRESETS } from '@/lib/utils/eventColors';

const EMPLOYEES: (Zaposleni & { initials: string })[] = [
  { id: 'e1', ime: 'Maja', priimek: 'Novak', email: 'maja@example.com', barva: EMPLOYEE_GRADIENTS[2].value, initials: 'MN' },
  { id: 'e2', ime: 'Luka', priimek: 'Zupan', email: 'luka@example.com', barva: EMPLOYEE_GRADIENTS[0].value, initials: 'LZ' },
  { id: 'e3', ime: 'Eva', priimek: 'Kranjc', email: 'eva@example.com', barva: EMPLOYEE_GRADIENTS[5].value, initials: 'EK' },
  { id: 'e4', ime: 'Tina', priimek: 'Golob', email: 'tina@example.com', barva: EMPLOYEE_GRADIENTS[8].value, initials: 'TG' },
];

const ABSENCE: Absence = {
  id: 'a1',
  company_id: 'preview',
  employee_id: 'e1',
  start_at: '2026-10-08T09:00:00',
  end_at: '2026-10-08T13:00:00',
  reason: 'Zdravniški pregled',
  status: 'active',
  employee_name: 'Maja Novak',
  employee_initials: 'MN',
  employee_color: EMPLOYEE_GRADIENTS[2].value,
};

const EVENT: CalendarEvent = {
  id: 'ev1',
  company_id: 'preview',
  title: 'Jesenska delavnica nege las',
  description: 'Predstavitev nove linije izdelkov in nasveti za nego v hladnejših mesecih.',
  notes: 'Pripravi vzorce in 15 stolov.',
  event_date: '2026-10-17',
  end_date: '2026-10-17',
  start_time: '17:00',
  end_time: '19:30',
  all_day: false,
  color: EVENT_COLOR_PRESETS[0].value,
  location: 'Salon Maja, Slovenska cesta 12, Ljubljana',
  status: 'active',
  is_visible: true,
  enable_booking: true,
};

type Open = 'absence' | 'absence-detail' | 'event-new' | 'event-edit' | 'event-view' | null;

export default function OkencaKoledarPreview() {
  const [open, setOpen] = useState<Open>('event-view');
  const close = () => setOpen(null);
  const done = async () => close();
  const btn = 'rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900';

  const buttons: [Open, string][] = [
    ['event-view', 'Dogodek'], ['event-edit', 'Uredi dogodek'], ['event-new', 'Nov dogodek'],
    ['absence-detail', 'Odsotnost'], ['absence', 'Nova odsotnost'],
  ];

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          predogled
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Okenca — koledar</h1>
        <p className="mt-0.5 mb-6 text-base text-gray-500">Odsotnosti in dogodki s polnimi podatki.</p>
        <div className="flex flex-wrap gap-2">
          {buttons.map(([key, label]) => (
            <button key={key} type="button" onClick={() => setOpen(key)} className={btn}>{label}</button>
          ))}
        </div>
      </div>

      <AbsenceModal isOpen={open === 'absence'} onClose={close} employees={EMPLOYEES} onSave={done} />
      <AbsenceDetailModal
        isOpen={open === 'absence-detail'}
        absence={ABSENCE}
        employees={EMPLOYEES}
        onClose={close}
        onDelete={done}
        onEdit={done}
      />
      <EventModal
        isOpen={open === 'event-new' || open === 'event-edit'}
        mode={open === 'event-edit' ? 'edit' : 'create'}
        event={open === 'event-edit' ? EVENT : null}
        onClose={close}
        onSave={done}
        onDelete={done}
      />
      <EventViewModal
        isOpen={open === 'event-view'}
        event={EVENT}
        onClose={close}
        onEdit={() => setOpen('event-edit')}
        onDelete={done}
      />
    </main>
  );
}
