'use client';

/**
 * ZAČASNA predogledna stran za redizajn Resursov.
 * Uporablja pravo ResursGrid z izmišljenimi podatki.
 * Ko je redizajn potrjen, se mapa `design` zbriše.
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, MagnifyingGlass, CaretDown, Cube, CheckCircle, Users } from '@phosphor-icons/react';
import ResursGrid from '@/components/resursi/ResursGrid';
import { MetricGroup } from '@/components/dashboard';
import { SERVICE_GRADIENTS } from '@/lib/constants/serviceGradients';
import { DEFAULT_URNIK, type Resurs } from '@/types/resursi';

const ROWS: [string, number, number, boolean, boolean, string[]][] = [
  ['Frizerski stol', 4, 1, true, true, ['Klasično striženje', 'Barvanje in fen', 'Pramenčki', 'Otroško striženje']],
  ['Masažna miza', 2, 1, false, true, ['Nega obraza']],
  ['Pralna postaja', 2, 1, true, true, ['Barvanje in fen', 'Pramenčki']],
  ['Brivski stol', 1, 1, true, true, ['Urejanje brade', 'Britje z britvijo']],
  ['Skupinska soba', 1, 8, true, false, []],
  ['Sušilnik', 3, 1, false, true, ['Barvanje in fen']],
];

const RESURSI: Resurs[] = ROWS.map(([naziv, kolicina, kapaciteta, urnik, aktiven, storitve], i) => ({
  id: String(i + 1),
  row_id: i + 1,
  naziv,
  booking_naziv: null,
  opis: null,
  kolicina,
  kapaciteta,
  prikazi_v_bookingu: true,
  urnik: urnik ? DEFAULT_URNIK : null,
  status: aktiven ? 'active' : 'inactive',
  barva: SERVICE_GRADIENTS[(i * 3) % SERVICE_GRADIENTS.length].gradient,
  podjetje_id: 'p1',
  created_at: new Date().toISOString(),
  storitve: storitve.map((n, j) => ({
    id_storitve: `${i}-${j}`,
    naziv_storitve: n,
    barva_storitve: SERVICE_GRADIENTS[j % SERVICE_GRADIENTS.length].gradient,
  })),
}));

export default function ResursiDesignPreview() {
  const [showInactive, setShowInactive] = useState(true);
  const shown = showInactive ? RESURSI : RESURSI.filter((r) => r.status === 'active');

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
            <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Resursi</h1>
            <p className="mt-0.5 text-base text-gray-500">Prostori in oprema, ki jih zasedejo termini.</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
          >
            <Plus size={17} weight="bold" />
            Nov resurs
          </button>
        </motion.div>

        <div className="mb-8">
          <MetricGroup
            metrics={[
              { label: 'Vsi resursi', value: RESURSI.length, icon: Cube },
              { label: 'Aktivni', value: RESURSI.filter((r) => r.status === 'active').length, icon: CheckCircle },
              { label: 'Skupna zmogljivost', value: 21, icon: Users },
            ]}
          />
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] max-w-md flex-1">
            <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
            <input
              type="text"
              placeholder="Išči resurse…"
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-[#7C78FA] focus:outline-none focus:ring-[3px] focus:ring-[#7C78FA]/25"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowInactive(!showInactive)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
              showInactive
                ? 'border border-gray-200 bg-white text-gray-900 hover:bg-gray-50'
                : 'border border-gray-900 bg-gray-900 text-white'
            }`}
          >
            {showInactive ? 'Prikaži vse' : 'Samo aktivni'}
            <CaretDown className={`h-3.5 w-3.5 transition-transform ${showInactive ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <ResursGrid resursi={shown} onEdit={() => {}} onDelete={() => {}} onToggleActive={() => {}} />
      </div>
    </main>
  );
}
