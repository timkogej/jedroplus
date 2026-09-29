'use client';

/**
 * ZAČASNA predogledna stran za redizajn Strank.
 *
 * Poganja pravo komponento ClientTable z izmišljenimi podatki, da je videz
 * mogoče preveriti brez prijave in baze. Ko je redizajn potrjen, se mapa
 * `design` zbriše.
 */

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Plus,
  DownloadSimple,
  UploadSimple,
  CaretDown,
  MagnifyingGlass,
  X,
  Users,
  CalendarBlank,
  UserPlus,
} from '@phosphor-icons/react';
import ClientTable from '@/components/clients/ClientTable';
import { MetricGroup } from '@/components/dashboard';
import type { Client, ClientType } from '@/types/clients';

const NAMES: [string, string, ClientType | null, number][] = [
  ['Ana', 'Kovač', 'vip', 24],
  ['Marko', 'Zupan', 'redna', 11],
  ['Luka', 'Horvat', 'nova', 1],
  ['Nina', 'Bizjak', 'redna', 8],
  ['Tomaž', 'Krajnc', null, 0],
  ['Jure', 'Potočnik', 'redna', 6],
  ['Eva', 'Zajc', 'vip', 31],
  ['Rok', 'Mlakar', 'nova', 2],
  ['Blaž', 'Kralj', 'redna', 14],
  ['Nejc', 'Vidic', null, 0],
  ['Urša', 'Jereb', 'redna', 9],
  ['Katja', 'Bevk', 'nova', 3],
];

// Ponovimo nabor, da je strank čez 20 in se vidi paginacija.
const ROWS = Array.from({ length: 4 }, (_, k) =>
  NAMES.map(([ime, priimek, tip, count]) => [ime, `${priimek}${k ? ' ' + 'IVX'[k - 1] : ''}`, tip, count] as typeof NAMES[number]),
).flat();

const CLIENTS: Client[] = ROWS.map(([ime, priimek, tip, count], i) => {
  const zadnja = new Date();
  zadnja.setDate(zadnja.getDate() - i * 5);
  const created = new Date();
  created.setMonth(created.getMonth() - i);
  return {
    id: String(i + 1),
    ime,
    priimek,
    tip_stranke: tip,
    email: `${ime.toLowerCase()}.${priimek.toLowerCase()}@example.com`,
    telefon: `041 ${200 + i} ${300 + i}`,
    created_at: created.toISOString(),
    zadnja_interakcija: count > 0 ? zadnja.toISOString() : null,
    appointment_count: count,
  };
});

export default function StrankeDesignPreview() {
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CLIENTS;
    return CLIENTS.filter((c) =>
      `${c.ime} ${c.priimek} ${c.email}`.toLowerCase().includes(q),
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
            <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Stranke</h1>
            <p className="mt-0.5 text-base text-gray-500">Pregled in urejanje vseh strank.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => { setImportOpen(!importOpen); setExportOpen(false); }}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100"
            >
              <DownloadSimple className="h-4 w-4 text-gray-500" weight="regular" />
              <span className="hidden md:inline">Uvozi iz CRM</span>
              <CaretDown className={`hidden md:block h-3 w-3 text-gray-400 transition-transform ${importOpen ? 'rotate-180' : ''}`} weight="regular" />
            </button>
            <button
              type="button"
              onClick={() => { setExportOpen(!exportOpen); setImportOpen(false); }}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100"
            >
              <UploadSimple className="h-4 w-4 text-gray-500" weight="regular" />
              <span className="hidden md:inline">Izvozi</span>
              <CaretDown className={`hidden md:block h-3 w-3 text-gray-400 transition-transform ${exportOpen ? 'rotate-180' : ''}`} weight="regular" />
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
            >
              <Plus size={17} weight="bold" />
              <span className="whitespace-nowrap">Nova stranka</span>
            </button>
          </div>
        </motion.div>

        <div className="mb-8">
          <MetricGroup
            metrics={[
              { label: 'Vse stranke', value: CLIENTS.length, icon: Users },
              { label: 'S termini', value: CLIENTS.filter((c) => (c.appointment_count ?? 0) > 0).length, icon: CalendarBlank },
              { label: 'Nove ta mesec', value: 3, icon: UserPlus },
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
              placeholder="Išči po imenu ali e-pošti…"
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

        <ClientTable
          clients={filtered}
          onEdit={() => {}}
          onDelete={() => {}}
          onView={() => {}}
        />
      </div>
    </main>
  );
}
