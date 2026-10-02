'use client';

/**
 * ZAČASNA predogledna stran za redizajn Promocij.
 * Uporablja prave gradnike (SegmentedControl, DataTable, MiniSwitch) z
 * izmišljenimi podatki. Ko je redizajn potrjen, se mapa `design` zbriše.
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, PencilSimple, Trash, MagnifyingGlass, Tag } from '@phosphor-icons/react';
import { SegmentedControl } from '@/components/settings/SegmentedControl';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { MiniSwitch } from '@/components/ui/MiniSwitch';

interface Row {
  id: string;
  naziv: string;
  storitve: number;
  vrednost: string;
  od: string;
  do: string;
  status: { label: string; color: string };
  aktiven: boolean;
}

const ACTIVE = { label: 'Aktiven', color: 'bg-emerald-50 text-emerald-700' };
const PLANNED = { label: 'Načrtovan', color: 'bg-blue-50 text-blue-700' };
const EXPIRED = { label: 'Potekel', color: 'bg-gray-100 text-gray-600' };

const INITIAL: Row[] = [
  { id: '1', naziv: 'Jesenska akcija', storitve: 4, vrednost: '15%', od: '1. 10. 2026', do: '31. 10. 2026', status: ACTIVE, aktiven: true },
  { id: '2', naziv: 'Študentski popust', storitve: 2, vrednost: '10%', od: '1. 9. 2026', do: '30. 6. 2027', status: ACTIVE, aktiven: true },
  { id: '3', naziv: 'Božični paket', storitve: 6, vrednost: '20,00 €', od: '1. 12. 2026', do: '24. 12. 2026', status: PLANNED, aktiven: true },
  { id: '4', naziv: 'Poletna barva', storitve: 1, vrednost: '25%', od: '1. 7. 2026', do: '31. 8. 2026', status: EXPIRED, aktiven: false },
];

export default function PromocijeDesignPreview() {
  const [tab, setTab] = useState('discounts');
  const [rows, setRows] = useState(INITIAL);
  const [search, setSearch] = useState('');

  const toggle = (id: string) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, aktiven: !x.aktiven } : x)));

  function renderActions(r: Row) {
    return (
      <div className="flex items-center justify-end gap-1">
        <MiniSwitch checked={r.aktiven} onChange={() => toggle(r.id)} />
        <button type="button" className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900">
          <PencilSimple className="h-4 w-4" weight="regular" />
        </button>
        <button type="button" className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500">
          <Trash className="h-4 w-4" weight="regular" />
        </button>
      </div>
    );
  }

  const columns: DataTableColumn<Row>[] = [
    { id: 'naziv', header: 'Naziv', sortValue: (r) => r.naziv.toLowerCase(), cell: (r) => <span className="text-sm font-medium text-gray-900">{r.naziv}</span> },
    { id: 'services', header: 'Storitve', sortValue: (r) => r.storitve, cell: (r) => <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">{r.storitve} storitev</span> },
    { id: 'value', header: 'Popust', cell: (r) => <span className="tnum text-sm font-semibold text-gray-900">{r.vrednost}</span> },
    { id: 'from', header: 'Od', cell: (r) => <span className="tnum whitespace-nowrap text-sm text-gray-600">{r.od}</span> },
    { id: 'to', header: 'Do', cell: (r) => <span className="tnum whitespace-nowrap text-sm text-gray-600">{r.do}</span> },
    { id: 'status', header: 'Status', cell: (r) => <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${r.status.color}`}>{r.status.label}</span> },
    { id: 'actions', header: 'Akcije', align: 'right', cell: (r) => renderActions(r) },
  ];

  const filtered = rows.filter((r) => r.naziv.toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          className="mb-6"
        >
          <div className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            predogled
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Promocije</h1>
          <p className="mt-0.5 text-base text-gray-500">Popusti, happy hours in dodatki k storitvam.</p>
        </motion.div>

        <div className="mb-6 overflow-x-auto">
          <SegmentedControl
            options={[
              { value: 'discounts', label: 'Popusti' },
              { value: 'happy', label: 'Happy hours' },
              { value: 'addons', label: 'Dodatki' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Išči popuste…"
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-[#7C78FA] focus:outline-none focus:ring-[3px] focus:ring-[#7C78FA]/25"
            />
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
          >
            <Plus size={17} weight="bold" />
            Nov popust
          </button>
        </div>

        <DataTable<Row>
          rows={filtered}
          columns={columns}
          rowKey={(r) => r.id}
          pageSize={20}
          empty={
            <div className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white p-12 text-center">
              <Tag className="mb-3 h-7 w-7 text-gray-300" weight="regular" />
              <p className="text-sm text-gray-500">Ni popustov.</p>
            </div>
          }
          mobile={{
            title: (r) => r.naziv,
            subtitle: (r) => <span className="tnum">{r.od} – {r.do}</span>,
            meta: (r) => (
              <div className="flex flex-wrap items-center gap-2">
                <span className="tnum text-[13px] font-semibold text-gray-900">{r.vrednost}</span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.status.color}`}>{r.status.label}</span>
              </div>
            ),
            trailing: (r) => renderActions(r),
          }}
        />
      </div>
    </main>
  );
}
