'use client';

/**
 * ZAČASNA predogledna stran za redizajn Terminov.
 *
 * Poganja prave komponente (AppointmentFilters, AppointmentTable) z izmišljenimi
 * podatki, da je videz mogoče preveriti brez prijave in baze.
 * Ko je redizajn potrjen, se mapa `design` zbriše.
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, DownloadSimple, CalendarBlank, Clock, ArrowRight } from '@phosphor-icons/react';
import AppointmentFilters, { type FilterState } from '@/components/appointments/AppointmentFilters';
import AppointmentTable from '@/components/appointments/AppointmentTable';
import { MetricGroup } from '@/components/dashboard';
import type { AppointmentWithDetails, Storitev, Zaposleni } from '@/types/appointments';

const SERVICES: Storitev[] = [
  { id: 's1', naziv: 'Klasično striženje', barva: '#7C78FA', trajanje: 45, cena: 25 },
  { id: 's2', naziv: 'Barvanje in fen', barva: '#35E3DB', trajanje: 75, cena: 55 },
  { id: 's3', naziv: 'Urejanje brade', barva: '#59AEEA', trajanje: 30, cena: 18 },
  { id: 's4', naziv: 'Pramenčki', barva: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)', trajanje: 90, cena: 75 },
];

const EMPLOYEES: Zaposleni[] = [
  { id: 'e1', ime: 'Maja', priimek: 'Novak', email: 'maja@example.com', barva: '#7C78FA' },
  { id: 'e2', ime: 'Jaka', priimek: 'Kos', email: 'jaka@example.com', barva: '#35E3DB' },
  { id: 'e3', ime: 'Tina', priimek: 'Svet', email: 'tina@example.com', barva: '#59AEEA' },
];

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
  status: AppointmentWithDetails['status'] = 'scheduled',
): AppointmentWithDetails {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  const s = svc(serviceId);
  const e = emp(employeeId);
  seq += 1;
  return {
    id: String(seq),
    datum: d.toISOString(),
    cas_zacetek: start,
    cas_konec: end,
    stranka_ime: client,
    stranka_email: `${client.split(' ')[0].toLowerCase()}@example.com`,
    stranka_telefon: '041 234 567',
    storitev_id: s.id,
    zaposleni_id: e.id,
    status,
    cena: s.cena ?? 0,
    storitev: { id: s.id, naziv: s.naziv, barva: s.barva, trajanje: s.trajanje, cena: s.cena },
    zaposleni: {
      id: e.id,
      ime: e.ime,
      priimek: e.priimek,
      email: e.email,
      initials: `${e.ime[0]}${e.priimek[0]}`,
      barva: e.barva,
    },
  } as AppointmentWithDetails;
}

const APPOINTMENTS: AppointmentWithDetails[] = [
  makeAppt(0, '08:00', '08:45', 'Ana Kovač', 's1', 'e1', 'confirmed'),
  makeAppt(0, '09:00', '10:15', 'Marko Zupan', 's2', 'e2'),
  makeAppt(0, '11:00', '12:30', 'Luka Horvat', 's4', 'e1'),
  makeAppt(0, '13:00', '13:45', 'Nina Bizjak', 's1', 'e2', 'Zaključen'),
  makeAppt(0, '14:00', '14:30', 'Tomaž Krajnc', 's3', 'e3', 'Odpovedan'),
  makeAppt(1, '08:30', '09:15', 'Jure Potočnik', 's1', 'e2'),
  makeAppt(1, '10:00', '11:30', 'Eva Zajc', 's4', 'e1'),
  makeAppt(1, '12:00', '12:30', 'Rok Mlakar', 's3', 'e3'),
  makeAppt(2, '09:00', '09:45', 'Blaž Kralj', 's1', 'e1'),
  makeAppt(2, '13:30', '15:00', 'Nejc Vidic', 's4', 'e2', 'Ni prišel'),
  makeAppt(3, '10:00', '11:15', 'Urša Jereb', 's2', 'e1'),
  makeAppt(4, '08:00', '08:30', 'Katja Bevk', 's3', 'e2'),
];

const EMPTY_FILTERS: FilterState = {
  search: '',
  status: 'all',
  employeeId: null,
  serviceId: null,
  dateFrom: '',
  dateTo: '',
};

export default function TerminiDesignPreview() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          className="mb-7 flex flex-wrap items-start justify-between gap-4"
        >
          <div>
            <div className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              predogled
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Termini</h1>
            <p className="mt-0.5 text-base text-gray-500">Pregled in urejanje vseh terminov.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
            >
              <Plus size={17} weight="bold" />
              <span>Nov termin</span>
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100"
            >
              <DownloadSimple size={17} weight="regular" className="text-gray-500" />
              <span>Izvozi</span>
            </button>
          </div>
        </motion.div>

        <div className="mb-8">
          <MetricGroup
            metrics={[
              { label: 'Ta mesec', value: 48, icon: CalendarBlank },
              { label: 'Danes', value: 5, icon: Clock },
              { label: 'Prihajajoči', value: 12, icon: ArrowRight },
            ]}
          />
        </div>

        <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4">
          <AppointmentFilters
            filters={filters}
            onFiltersChange={setFilters}
            employees={EMPLOYEES}
            services={SERVICES}
          />
        </div>

        <AppointmentTable
          appointments={APPOINTMENTS}
          onView={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
          onComplete={() => {}}
          onNoShow={() => {}}
          onCancel={() => {}}
          canDeleteAppointment
        />
      </div>
    </main>
  );
}
