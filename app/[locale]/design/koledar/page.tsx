'use client';

/**
 * ZAČASNA predogledna stran za redizajn koledarja.
 *
 * Poganja prave poglede (WeekView, DayView, MonthView) z izmišljenimi termini,
 * da je videz mogoče preveriti brez prijave in baze. Lupina posnema orodno
 * vrstico iz Calendar.tsx. Ko je redizajn potrjen, se mapa `design` zbriše.
 */

import { useEffect, useState } from 'react';
import { CaretLeft, CaretRight, Plus, Faders } from '@phosphor-icons/react';
import WeekView from '@/components/calendar/WeekView';
import DayView from '@/components/calendar/DayView';
import MonthView from '@/components/calendar/MonthView';
import ViewToggle from '@/components/calendar/ViewToggle';
import { AppointmentDetailModal } from '@/components/calendar/AppointmentDetailSheet';
import { AnimatePresence } from 'motion/react';
import type { Resurs } from '@/types/resursi';
import type { AppointmentWithDetails, Storitev, Zaposleni } from '@/types/appointments';
import type { ViewMode } from '@/lib/utils/calendar';

// ── Izmišljeni podatki ───────────────────────────────────────────────────────
// Barve storitev so namenoma take, kot jih uporablja aplikacija: nekatere so
// en hex, nekatere že pripravljen preliv — oboje mora delovati.

const SERVICES: Storitev[] = [
  { id: 's1', naziv: 'Klasično striženje', barva: '#7C78FA', trajanje: 45 },
  { id: 's2', naziv: 'Barvanje in fen', barva: '#35E3DB', trajanje: 75 },
  { id: 's3', naziv: 'Urejanje brade', barva: '#59AEEA', trajanje: 30 },
  { id: 's4', naziv: 'Pramenčki', barva: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)', trajanje: 90 },
  { id: 's5', naziv: 'Nega las', barva: '#10B981', trajanje: 30 },
];

const EMPLOYEES: (Zaposleni & { initials: string })[] = [
  { id: 'e1', ime: 'Maja', priimek: 'Novak', email: 'maja@example.com', barva: '#7C78FA', initials: 'MN' },
  { id: 'e2', ime: 'Jaka', priimek: 'Kos', email: 'jaka@example.com', barva: '#35E3DB', initials: 'JK' },
  { id: 'e3', ime: 'Tina', priimek: 'Svet', email: 'tina@example.com', barva: '#59AEEA', initials: 'TS' },
];

// Dva resursa, pripeta prvemu terminu — da je vidno, kako izgleda skupina
const RESURSI: Resurs[] = [
  { id: 'r1', row_id: 1, naziv: 'Stol 1', barva: '#7C78FA' } as Resurs,
  { id: 'r2', row_id: 2, naziv: 'Sušilec', barva: '#35E3DB' } as Resurs,
];
const TERMIN_RESURSI = new Map<number, Set<number>>([
  [1, new Set([1])],
  [2, new Set([1])],
]);

const svc = (id: string) => SERVICES.find((s) => s.id === id)!;
const emp = (id: string) => EMPLOYEES.find((e) => e.id === id)!;

let seq = 0;
function makeAppt(
  dayOffset: number,
  start: string,
  end: string,
  client: string,
  serviceId: string,
  employeeId: string,
  extra: Partial<AppointmentWithDetails> = {},
): AppointmentWithDetails {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  const s = svc(serviceId);
  const e = emp(employeeId);
  seq += 1;
  return {
    id: String(seq), // Number(id) mora dati število — resursi se vežejo prek njega
    datum: d.toISOString(),
    cas_zacetek: start,
    cas_konec: end,
    stranka_ime: client,
    storitev_id: s.id,
    zaposleni_id: e.id,
    status: 'scheduled',
    storitev: { id: s.id, naziv: s.naziv, barva: s.barva, trajanje: s.trajanje },
    zaposleni: {
      id: e.id,
      ime: e.ime,
      priimek: e.priimek,
      email: e.email,
      initials: e.initials,
      barva: e.barva,
    },
    ...extra,
  } as AppointmentWithDetails;
}

const APPOINTMENTS: AppointmentWithDetails[] = [
  makeAppt(0, '08:00', '08:45', 'Ana Kovač', 's1', 'e1', {
    stranka_id: 'c1',
    stranka_email: 'ana.kovac@example.com',
    stranka_telefon: '041 234 567',
    cena: 32,
    popust: 5,
    popust_tip: 'eur',
    koncna_cena: 27,
    promocija_naziv: 'Jesenski popust',
    opombe: 'Stranka želi krajše na straneh.',
    interne_opombe: 'Zadnjič zamudila 10 minut.',
  }),
  makeAppt(0, '09:00', '10:15', 'Marko Zupan', 's2', 'e2'),
  makeAppt(0, '09:30', '10:00', 'Petra Novak', 's3', 'e3'),
  makeAppt(0, '11:00', '12:30', 'Luka Horvat', 's4', 'e1', {
    storitev_id_2: 's5',
    storitev_2: { id: 's5', naziv: 'Nega las', barva: '#10B981', trajanje: 30 },
  }),
  makeAppt(0, '13:00', '13:45', 'Nina Bizjak', 's1', 'e2'),
  makeAppt(0, '14:00', '14:30', 'Tomaž Krajnc', 's3', 'e3', { status: 'Zaključen' }),
  makeAppt(0, '15:00', '16:15', 'Sara Vidmar', 's2', 'e1'),

  makeAppt(1, '08:30', '09:15', 'Jure Potočnik', 's1', 'e2'),
  makeAppt(1, '10:00', '11:30', 'Eva Zajc', 's4', 'e1'),
  makeAppt(1, '12:00', '12:30', 'Rok Mlakar', 's3', 'e3'),
  makeAppt(1, '14:00', '15:15', 'Maja Petek', 's2', 'e2'),

  makeAppt(2, '09:00', '09:45', 'Blaž Kralj', 's1', 'e1'),
  makeAppt(2, '11:00', '11:30', 'Lea Oblak', 's5', 'e3'),
  makeAppt(2, '13:30', '15:00', 'Nejc Vidic', 's4', 'e2'),

  makeAppt(3, '10:00', '11:15', 'Urša Jereb', 's2', 'e1'),
  makeAppt(3, '12:00', '12:45', 'Domen Rus', 's1', 'e3'),

  makeAppt(4, '08:00', '08:30', 'Katja Bevk', 's3', 'e2'),
  makeAppt(4, '09:00', '10:30', 'Matej Kline', 's4', 'e1'),
  makeAppt(4, '11:00', '11:45', 'Špela Kos', 's1', 'e3'),
  makeAppt(4, '16:00', '17:15', 'Gaber Zore', 's2', 'e2'),

  makeAppt(-1, '10:00', '10:45', 'Iza Mohar', 's1', 'e1', { status: 'Zaključen' }),
  makeAppt(5, '09:00', '09:30', 'Vid Anžur', 's3', 'e2'),
];

export default function CalendarDesignPreview() {
  const [view, setView] = useState<ViewMode>('week');
  // Pravi koledar poda ViewToggle-u isMobile; predogled mora ravnati enako,
  // sicer na telefonu preverjamo napačno različico.
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selected, setSelected] = useState<AppointmentWithDetails | null>(null);

  const monthTitle = currentDate.toLocaleDateString('sl-SI', { month: 'long', year: 'numeric' });
  const monthTitleShort = currentDate.toLocaleDateString('sl-SI', { month: 'short', year: 'numeric' });

  const shift = (days: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + days);
    setCurrentDate(d);
  };

  const step = view === 'month' ? 30 : view === 'week' ? 7 : 1;

  return (
    <div className="flex h-[100dvh] flex-col bg-white">
      {/* Orodna vrstica — posnema Calendar.tsx */}
      <header className="glass-bar hairline-b sticky top-0 z-30 flex flex-shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2.5 md:flex-nowrap md:px-5 md:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
          {/* Ta vrstica je samo oder za predogled — prava orodna vrstica
              koledarja je nespremenjena in živi v Calendar.tsx. */}
          <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            predogled
          </span>
          <h1 className="flex-shrink-0 text-lg font-semibold capitalize text-gray-900 md:text-xl">
            <span className="md:hidden">{monthTitleShort}</span>
            <span className="hidden md:inline">{monthTitle}</span>
          </h1>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => shift(-step)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200"
              aria-label="Prejšnji"
            >
              <CaretLeft className="h-3.5 w-3.5" weight="bold" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentDate(new Date())}
              className="rounded-md px-2 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200"
            >
              Danes
            </button>
            <button
              type="button"
              onClick={() => shift(step)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200"
              aria-label="Naslednji"
            >
              <CaretRight className="h-3.5 w-3.5" weight="bold" />
            </button>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2 md:gap-3">
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" weight="bold" />
            <span className="hidden md:inline">Nov termin</span>
          </button>
          <ViewToggle currentView={view} onViewChange={setView} isMobile={isNarrow} />
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            aria-label="Filtri"
          >
            <Faders className="h-[18px] w-[18px]" weight="regular" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        {view === 'week' && (
          <WeekView
            currentDate={currentDate}
            appointments={APPOINTMENTS}
            services={SERVICES}
            onAppointmentClick={setSelected}
            onDateClick={(d) => {
              setCurrentDate(d);
              setView('day');
            }}
          />
        )}
        {view === 'day' && (
          <DayView
            currentDate={currentDate}
            appointments={APPOINTMENTS}
            services={SERVICES}
            employees={EMPLOYEES}
            onAppointmentClick={setSelected}
          />
        )}
        {view === '2day' && (
          <DayView
            currentDate={currentDate}
            appointments={APPOINTMENTS}
            services={SERVICES}
            employees={EMPLOYEES}
            onAppointmentClick={setSelected}
          />
        )}
        {view === 'month' && (
          <MonthView
            currentDate={currentDate}
            appointments={APPOINTMENTS}
            services={SERVICES}
            onAppointmentClick={setSelected}
            onDateClick={(d) => {
              setCurrentDate(d);
              setView('day');
            }}
          />
        )}
      </div>

      {/* Pravi modal iz koledarja */}
      <AnimatePresence>
        {selected && (
          <AppointmentDetailModal
            appointment={selected}
            services={SERVICES}
            terminResursiMap={TERMIN_RESURSI}
            activeResursi={RESURSI}
            onClose={() => setSelected(null)}
            onEdit={() => {}}
            onComplete={() => {}}
            onNoShow={() => {}}
            onCancel={() => {}}
            onDelete={() => {}}
            onOpenClientDetails={() => {}}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
