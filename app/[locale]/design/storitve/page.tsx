'use client';

/**
 * ZAČASNA predogledna stran za redizajn Storitev.
 * Ko je redizajn potrjen, se mapa `design` zbriše.
 */

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Plus,
  MagnifyingGlass,
  X,
  CaretDown,
  Briefcase,
  ChartLineUp,
  Clock,
  CurrencyEur,
} from '@phosphor-icons/react';
import ServiceGrid from '@/components/services/ServiceGrid';
import { MetricGroup } from '@/components/dashboard';
import { SERVICE_GRADIENTS } from '@/lib/constants/serviceGradients';
import type { Service } from '@/types/services';

const ROWS: [string, string | null, number, number | null, boolean][] = [
  ['Klasično striženje', 'Lasje', 45, 25, true],
  ['Barvanje in fen', 'Lasje', 75, 55, true],
  ['Urejanje brade', 'Brada', 30, 18, true],
  ['Pramenčki', 'Lasje', 90, 75, true],
  ['Otroško striženje', 'Lasje', 25, 14, true],
  ['Britje z britvijo', 'Brada', 35, 22, false],
  ['Nega obraza', null, 60, 45, true],
  ['Barvanje brade', 'Brada', 30, 20, false],
];

const SERVICES: Service[] = ROWS.map(([naziv, kategorija, trajanje, cena, aktivna], i) => ({
  id: String(i + 1),
  naziv,
  kategorija,
  barva: SERVICE_GRADIENTS[i % SERVICE_GRADIENTS.length].gradient,
  trajanje,
  buffer_pred: 0,
  buffer_po: 0,
  skupni_cas: trajanje,
  tip_cene: 'fiksna',
  cena,
  currency: 'EUR',
  opis: i % 3 === 0 ? 'Vključuje umivanje, striženje in oblikovanje pričeske po želji stranke.' : null,
  aktivna,
  spletne_rezervacije: true,
  zahteva_placilo: false,
  podjetje_id: 'p1',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  appointment_count: (i * 7) % 40,
}));

export default function StoritveDesignPreview() {
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SERVICES.filter(
      (s) =>
        (showInactive || s.aktivna) &&
        (!q || `${s.naziv} ${s.kategorija ?? ''}`.toLowerCase().includes(q)),
    );
  }, [search, showInactive]);

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
            <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Storitve</h1>
            <p className="mt-0.5 text-base text-gray-500">Pregled in urejanje vseh storitev.</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
          >
            <Plus size={17} weight="bold" />
            Nova storitev
          </button>
        </motion.div>

        <div className="mb-8">
          <MetricGroup
            metrics={[
              { label: 'Vse storitve', value: SERVICES.length, icon: Briefcase },
              { label: 'Aktivne', value: SERVICES.filter((s) => s.aktivna).length, icon: ChartLineUp },
              { label: 'Povprečno trajanje', value: '49 min', icon: Clock },
              { label: 'Najvišja cena', value: '75 €', icon: CurrencyEur },
            ]}
          />
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] max-w-md flex-1">
            <MagnifyingGlass
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              weight="regular"
            />
            <input
              type="text"
              placeholder="Išči po nazivu ali kategoriji…"
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
          <button
            type="button"
            onClick={() => setShowInactive(!showInactive)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
              showInactive
                ? 'border border-gray-200 bg-white text-gray-900 hover:bg-gray-50'
                : 'border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100'
            }`}
          >
            {showInactive ? 'Prikaži vse' : 'Samo aktivne'}
            <CaretDown className={`h-3.5 w-3.5 transition-transform ${showInactive ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <ServiceGrid
          services={filtered}
          onEdit={() => {}}
          onDelete={() => {}}
          onToggleActive={() => {}}
        />
      </div>
    </main>
  );
}
