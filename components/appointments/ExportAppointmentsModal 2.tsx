'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  CalendarBlank,
  DownloadSimple,
  SpinnerGap,
  Warning,
  FunnelSimple,
} from '@phosphor-icons/react';
import * as XLSX from 'xlsx';
import { normalizeStatus } from '@/components/appointments/StatusBadge';
import type { AppointmentWithDetails } from '@/types/appointments';

interface ExportAppointmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  appointments: AppointmentWithDetails[];
}

type Preset = 'this_week' | 'this_month' | 'last_month' | 'last_30' | 'this_year' | 'all' | 'custom';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'this_week',  label: 'Ta teden' },
  { key: 'this_month', label: 'Ta mesec' },
  { key: 'last_month', label: 'Prejšnji mesec' },
  { key: 'last_30',    label: 'Zadnjih 30 dni' },
  { key: 'this_year',  label: 'Letos' },
  { key: 'all',        label: 'Vse' },
];

const STATUS_SL: Record<string, string> = {
  scheduled:  'Načrtovan',
  confirmed:  'Potrjen',
  pending:    'V obdelavi',
  completed:  'Zaključen',
  cancelled:  'Odpovedan',
  no_show:    'Ni prišel',
};

function fmtDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function getPresetRange(p: Preset): { from: string; to: string } {
  const today = new Date();

  switch (p) {
    case 'this_week': {
      const day = today.getDay() || 7;
      const mon = new Date(today);
      mon.setDate(today.getDate() - (day - 1));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { from: fmtDate(mon), to: fmtDate(sun) };
    }
    case 'this_month': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last  = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: fmtDate(first), to: fmtDate(last) };
    }
    case 'last_month': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last  = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: fmtDate(first), to: fmtDate(last) };
    }
    case 'last_30': {
      const from = new Date(today);
      from.setDate(today.getDate() - 29);
      return { from: fmtDate(from), to: fmtDate(today) };
    }
    case 'this_year':
      return {
        from: `${today.getFullYear()}-01-01`,
        to:   `${today.getFullYear()}-12-31`,
      };
    case 'all':
      return { from: '2020-01-01', to: `${today.getFullYear() + 1}-12-31` };
    default:
      return { from: fmtDate(today), to: fmtDate(today) };
  }
}

const DAY_SL = ['ned', 'pon', 'tor', 'sre', 'čet', 'pet', 'sob'];

export default function ExportAppointmentsModal({
  isOpen,
  onClose,
  appointments,
}: ExportAppointmentsModalProps) {
  const defaultRange = getPresetRange('this_month');

  const [preset, setPreset]               = useState<Preset>('this_month');
  const [from, setFrom]                   = useState(defaultRange.from);
  const [to, setTo]                       = useState(defaultRange.to);
  const [onlyCompleted, setOnlyCompleted] = useState(false);
  const [excludeGhost, setExcludeGhost]   = useState(true);
  const [isExporting, setIsExporting]     = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      const range = getPresetRange('this_month');
      setPreset('this_month');
      setFrom(range.from);
      setTo(range.to);
      setOnlyCompleted(false);
      setExcludeGhost(true);
      setIsExporting(false);
    }
  }, [isOpen]);

  const handlePreset = useCallback((p: Preset) => {
    setPreset(p);
    const range = getPresetRange(p);
    setFrom(range.from);
    setTo(range.to);
  }, []);

  const handleDateChange = useCallback((field: 'from' | 'to', val: string) => {
    if (field === 'from') setFrom(val);
    else setTo(val);
    setPreset('custom');
  }, []);

  const rangeValid = !!from && !!to && new Date(from) <= new Date(to);

  // Live-computed filtered list — no async needed, data already in memory
  const filtered = useMemo(() => {
    if (!rangeValid) return [];

    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    return appointments.filter((a) => {
      const d = new Date(a.datum);
      if (d < fromDate || d > toDate) return false;
      if (onlyCompleted && normalizeStatus(a.status || '') !== 'completed') return false;
      if (excludeGhost && a.belezi_termin === false) return false;
      return true;
    });
  }, [appointments, from, to, onlyCompleted, excludeGhost, rangeValid]);

  const handleExport = useCallback(async () => {
    if (!rangeValid || filtered.length === 0 || isExporting) return;
    setIsExporting(true);

    try {
      const rows = filtered.map((a) => {
        const d = new Date(a.datum);
        const storitev = [
          a.storitev?.naziv,
          a.storitev_2?.naziv,
          a.storitev_3?.naziv,
          a.add_on_naziv ? `${a.add_on_naziv} (Dodatna storitev)` : null,
        ]
          .filter(Boolean)
          .join(' + ');

        const zaposleni = a.zaposleni
          ? `${a.zaposleni.ime} ${a.zaposleni.priimek}`.trim()
          : '';

        const stranka = [a.stranka_ime, a.stranka_priimek]
          .filter(Boolean)
          .join(' ');

        const statusNorm = normalizeStatus(a.status || '');

        return {
          'Datum':         d.toLocaleDateString('sl-SI'),
          'Dan':           DAY_SL[d.getDay()],
          'Čas začetka':  a.cas_zacetek?.substring(0, 5) ?? '',
          'Čas konca':    a.cas_konec?.substring(0, 5) ?? '',
          'Stranka':       stranka,
          'Email':         a.stranka_email ?? '',
          'Telefon':       a.stranka_telefon ?? '',
          'Storitev':      storitev,
          'Zaposleni':     zaposleni,
          'Status':        STATUS_SL[statusNorm] ?? a.status ?? '',
          'Cena (€)':      a.cena !== null && a.cena !== undefined ? a.cena : '',
          'Popust':        a.popust !== null && a.popust !== undefined ? a.popust : '',
          'Končna cena (€)': a.koncna_cena !== null && a.koncna_cena !== undefined ? a.koncna_cena : '',
          'Valuta':        a.valuta ?? 'EUR',
          'Opombe':        a.opombe ?? '',
          'ID termina':    a.id_termina ?? '',
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Termini');

      const colWidths = Object.keys(rows[0]).map((key) => ({
        wch: Math.max(key.length, ...rows.map((r) => String(r[key as keyof typeof r] ?? '').length)),
      }));
      ws['!cols'] = colWidths;

      const fromStr = from.replace(/-/g, '');
      const toStr   = to.replace(/-/g, '');
      XLSX.writeFile(wb, `termini_${fromStr}_${toStr}.xlsx`);

      onClose();
    } catch {
      // silently fall through; the button re-enables
    } finally {
      setIsExporting(false);
    }
  }, [filtered, from, to, rangeValid, isExporting, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{
              opacity: 1, scale: 1, y: 0,
              transition: { type: 'spring', stiffness: 400, damping: 36 },
            }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-gray-100 bg-[#F7F8FA] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b border-gray-100 bg-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2
                    className="text-xl font-semibold text-transparent bg-clip-text"
                    style={{ backgroundImage: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)' }}
                  >
                    Izvozi termine
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-500">
                    Izberite obdobje in možnosti izvoza
                  </p>
                </div>
                <motion.button
                  type="button"
                  onClick={onClose}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                >
                  <X className="h-5 w-5" weight="bold" />
                </motion.button>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">

              {/* Preset chips */}
              <div>
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Hitri izbor
                </p>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => handlePreset(p.key)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                        preset === p.key
                          ? 'text-white shadow-sm'
                          : 'bg-white border border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-700'
                      }`}
                      style={
                        preset === p.key
                          ? { background: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)' }
                          : undefined
                      }
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date range */}
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Obdobje
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Datum od</label>
                    <div className="relative">
                      <CalendarBlank className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                      <input
                        type="date"
                        value={from}
                        max={to || undefined}
                        onChange={(e) => handleDateChange('from', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400/30"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Datum do</label>
                    <div className="relative">
                      <CalendarBlank className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                      <input
                        type="date"
                        value={to}
                        min={from || undefined}
                        onChange={(e) => handleDateChange('to', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400/30"
                      />
                    </div>
                  </div>
                </div>
                {from && to && new Date(from) > new Date(to) && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-red-500">
                    <Warning className="h-3.5 w-3.5" weight="fill" />
                    Datum &quot;od&quot; ne sme biti poznejši od &quot;do&quot;.
                  </p>
                )}
              </div>

              {/* Filter checkboxes */}
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <FunnelSimple className="h-3.5 w-3.5" weight="bold" />
                  Filtri
                </p>
                <div className="space-y-3">
                  <label className="flex cursor-pointer items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={onlyCompleted}
                        onChange={(e) => setOnlyCompleted(e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        className={`h-4.5 w-4.5 flex h-[18px] w-[18px] items-center justify-center rounded transition-all ${
                          onlyCompleted ? 'border-0' : 'border border-gray-300 bg-white'
                        }`}
                        style={
                          onlyCompleted
                            ? { background: 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)' }
                            : undefined
                        }
                      >
                        {onlyCompleted && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-gray-700">Vključi samo zaključene termine</span>
                  </label>

                  <label className="flex cursor-pointer items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={excludeGhost}
                        onChange={(e) => setExcludeGhost(e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        className={`flex h-[18px] w-[18px] items-center justify-center rounded transition-all ${
                          excludeGhost ? 'border-0' : 'border border-gray-300 bg-white'
                        }`}
                        style={
                          excludeGhost
                            ? { background: 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)' }
                            : undefined
                        }
                      >
                        {excludeGhost && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-gray-700">Izključi ghost termine</span>
                  </label>
                </div>
              </div>

              {/* Live count chip */}
              <motion.div
                key={`${from}-${to}-${onlyCompleted}-${excludeGhost}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                  filtered.length > 0
                    ? 'border border-violet-100 bg-violet-50'
                    : 'border border-gray-100 bg-gray-50'
                }`}
              >
                <span className="text-sm text-gray-600">Najdenih terminov za izvoz</span>
                <span
                  className={`text-lg font-bold tabular-nums ${
                    filtered.length > 0 ? 'text-violet-600' : 'text-gray-400'
                  }`}
                >
                  {rangeValid ? filtered.length : '—'}
                </span>
              </motion.div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-gray-100 bg-white px-5 py-4">
              <motion.button
                type="button"
                onClick={onClose}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="rounded-lg px-5 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
              >
                Prekliči
              </motion.button>

              <motion.button
                type="button"
                onClick={handleExport}
                disabled={!rangeValid || filtered.length === 0 || isExporting}
                whileHover={{ scale: (!rangeValid || filtered.length === 0 || isExporting) ? 1 : 1.02 }}
                whileTap={{ scale: (!rangeValid || filtered.length === 0 || isExporting) ? 1 : 0.98 }}
                className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)' }}
              >
                {isExporting ? (
                  <>
                    <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                    Izvažam...
                  </>
                ) : (
                  <>
                    <DownloadSimple className="h-4 w-4" weight="bold" />
                    Izvozi Excel
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
