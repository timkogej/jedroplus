'use client';

/**
 * ZAČASNA predogledna stran za redizajn Zaposlenih.
 * Ko je redizajn potrjen, se mapa `design` zbriše.
 */

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Plus,
  MagnifyingGlass,
  X,
  Users,
  UserCirclePlus,
  Briefcase,
  CalendarCheck,
} from '@phosphor-icons/react';
import EmployeeGrid from '@/components/employees/EmployeeGrid';
import { MetricGroup } from '@/components/dashboard';
import type { Employee } from '@/types/employees';

const GRADIENTS = [
  'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)',
  'linear-gradient(135deg, #EC4899 0%, #F97316 100%)',
  'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)',
  'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
  'linear-gradient(135deg, #7C75FC 0%, #44D0C6 100%)',
  'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
];

const ROWS: [string, string, string | null, boolean][] = [
  ['Maja', 'Novak', 'Frizerka', true],
  ['Jaka', 'Kos', 'Barber', true],
  ['Tina', 'Svet', 'Kozmetičarka', true],
  ['Rok', 'Pirc', null, true],
  ['Ana', 'Zorko', 'Vajenka', false],
  ['Matej', 'Hribar', 'Frizer', true],
];

const EMPLOYEES: Employee[] = ROWS.map(([ime, priimek, pozicija, aktivna], i) => ({
  id: String(i + 1),
  ime,
  priimek,
  email: `${ime.toLowerCase()}.${priimek.toLowerCase()}@example.com`,
  telefon: i === 3 ? null : `041 ${200 + i} ${300 + i}`,
  pozicija,
  barva: GRADIENTS[i % GRADIENTS.length],
  aktivna,
  podjetje_id: 'p1',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  appointments_today: (i * 3) % 7,
  appointments_week: (i * 7) % 24,
  appointments_month: (i * 13) % 80,
} as Employee));

export default function ZaposleniDesignPreview() {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return EMPLOYEES;
    return EMPLOYEES.filter((e) =>
      `${e.ime} ${e.priimek} ${e.pozicija ?? ''}`.toLowerCase().includes(q),
    );
  }, [search]);

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
            <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Zaposleni</h1>
            <p className="mt-0.5 text-base text-gray-500">Pregled in urejanje ekipe.</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
          >
            <Plus size={17} weight="bold" />
            Nov zaposleni
          </button>
        </motion.div>

        <div className="mb-8">
          <MetricGroup
            metrics={[
              { label: 'Vsi', value: EMPLOYEES.length, icon: Users },
              { label: 'Aktivni', value: EMPLOYEES.filter((e) => e.aktivna).length, icon: UserCirclePlus },
              { label: 'Neaktivni', value: EMPLOYEES.filter((e) => !e.aktivna).length, icon: Briefcase },
              { label: 'Termini danes', value: 12, icon: CalendarCheck, trend: { value: 8, isPositive: true } },
            ]}
          />
        </div>

        <div className="mb-6">
          <div className="relative max-w-md">
            <MagnifyingGlass
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              weight="regular"
            />
            <input
              type="text"
              placeholder="Išči po imenu ali poziciji…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-[#7C78FA] focus:outline-none focus:ring-[3px] focus:ring-[#7C78FA]/25"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <X className="h-4 w-4" weight="regular" />
              </button>
            )}
          </div>
        </div>

        <EmployeeGrid
          employees={filtered}
          isLoading={false}
          onEdit={() => {}}
          onDelete={() => {}}
          onToggleActive={() => {}}
          onSettings={() => {}}
          onConnect={() => {}}
          showConnectButton
          connectedPersonId="1"
        />
      </div>
    </main>
  );
}
