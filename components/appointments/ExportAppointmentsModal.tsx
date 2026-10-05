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
import { useLocale, useTranslations } from 'next-intl';
import { intlLocale } from '@/lib/format';
import { normalizeStatus } from '@/components/appointments/StatusBadge';
import type { AppointmentWithDetails } from '@/types/appointments';
import { sheet } from '@/components/ui/sheetClasses';

interface ExportAppointmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  appointments: AppointmentWithDetails[];
}

type Preset = 'this_week' | 'this_month' | 'last_month' | 'last_30' | 'this_year' | 'all' | 'custom';

const PRESETS: Preset[] = ['this_week', 'this_month', 'last_month', 'last_30', 'this_year', 'all'];

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


export default function ExportAppointmentsModal({
  isOpen,
  onClose,
  appointments,
}: ExportAppointmentsModalProps) {
  const t = useTranslations('appointments');
  const ts = useTranslations('appointments.status');
  const locale = useLocale();
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
        const storitev = [a.storitev?.naziv, a.storitev_2?.naziv, a.storitev_3?.naziv]
          .filter(Boolean)
          .join(' + ');

        const zaposleni = a.zaposleni
          ? `${a.zaposleni.ime} ${a.zaposleni.priimek}`.trim()
          : '';

        const stranka = [a.stranka_ime, a.stranka_priimek]
          .filter(Boolean)
          .join(' ');

        const statusNorm = normalizeStatus(a.status || '');

        const statusLabel = statusNorm === 'no_show' ? ts('noShow') : ts(statusNorm);
        const c = (key: string) => t(`export.columns.${key}`);
        return {
          [c('date')]:       d.toLocaleDateString(intlLocale(locale)),
          [c('day')]:        d.toLocaleDateString(intlLocale(locale), { weekday: 'short' }),
          [c('start')]:      a.cas_zacetek?.substring(0, 5) ?? '',
          [c('end')]:        a.cas_konec?.substring(0, 5) ?? '',
          [c('client')]:     stranka,
          [c('email')]:      a.stranka_email ?? '',
          [c('phone')]:      a.stranka_telefon ?? '',
          [c('service')]:    storitev,
          [c('staff')]:      zaposleni,
          [c('status')]:     statusLabel || a.status || '',
          [c('price')]:      a.cena !== null && a.cena !== undefined ? a.cena : '',
          [c('discount')]:   a.popust !== null && a.popust !== undefined ? a.popust : '',
          [c('finalPrice')]: a.koncna_cena !== null && a.koncna_cena !== undefined ? a.koncna_cena : '',
          [c('currency')]:   a.valuta ?? 'EUR',
          [c('notes')]:      a.opombe ?? '',
          [c('id')]:         a.id_termina ?? '',
        } as Record<string, string | number>;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, t('export.sheetName'));

      const colWidths = Object.keys(rows[0]).map((key) => ({
        wch: Math.max(key.length, ...rows.map((r) => String(r[key] ?? '').length)),
      }));
      ws['!cols'] = colWidths;

      const fromStr = from.replace(/-/g, '');
      const toStr   = to.replace(/-/g, '');
      XLSX.writeFile(wb, `${t('export.fileName')}_${fromStr}_${toStr}.xlsx`);

      onClose();
    } catch {
      // silently fall through; the button re-enables
    } finally {
      setIsExporting(false);
    }
  }, [filtered, from, to, rangeValid, isExporting, onClose, t, ts, locale]);

  const labelClass = 'mb-2 block text-[11px] font-semibold uppercase tracking-wider text-gray-500';
  const dateClass =
    'w-full rounded-[10px] border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:border-[#7C78FA] focus:outline-none focus:ring-[3px] focus:ring-[#7C78FA]/25';

  /** Vrstica s stikalom; pravo potrditveno polje ostane (skrito) za dostopnost. */
  const switchRow = (checked: boolean, onChange: (v: boolean) => void, label: string) => (
    <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm text-gray-900">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors peer-focus-visible:ring-[3px] peer-focus-visible:ring-[#7C78FA]/40 ${
          checked ? 'bg-gray-900' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-all ${
            checked ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </span>
    </label>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={sheet.backdrop.replace('z-50', 'z-[100]')}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{
              opacity: 1, scale: 1, y: 0,
              transition: { type: 'spring', stiffness: 400, damping: 36 },
            }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={sheet.panel}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={sheet.header}>
              <div className={sheet.grabber} aria-hidden="true" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className={sheet.title}>
                    {t('export.title')}
                  </h2>
                  <p className={sheet.subtitle}>
                    {t('export.subtitle')}
                  </p>
                </div>
                <motion.button
                  type="button"
                  onClick={onClose}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className={sheet.close}
                >
                  <X className="h-5 w-5" weight="regular" />
                </motion.button>
              </div>
            </div>

            {/* Body */}
            <div className={sheet.body}>

              {/* Preset chips */}
              <div className={sheet.group}>
                <p className={labelClass}>
                  {t('export.quickPick')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePreset(p)}
                      className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                        preset === p
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {t(`export.presets.${p}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date range */}
              <div className={sheet.group}>
                <p className={labelClass}>
                  {t('export.period')}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[13px] text-gray-500">{t('export.dateFrom')}</label>
                    <div className="relative">
                      <CalendarBlank className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                      <input
                        type="date"
                        value={from}
                        max={to || undefined}
                        onChange={(e) => handleDateChange('from', e.target.value)}
                        className={dateClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[13px] text-gray-500">{t('export.dateTo')}</label>
                    <div className="relative">
                      <CalendarBlank className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                      <input
                        type="date"
                        value={to}
                        min={from || undefined}
                        onChange={(e) => handleDateChange('to', e.target.value)}
                        className={dateClass}
                      />
                    </div>
                  </div>
                </div>
                {from && to && new Date(from) > new Date(to) && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-red-500">
                    <Warning className="h-3.5 w-3.5" weight="regular" />
                    {t('export.rangeInvalid')}
                  </p>
                )}
              </div>

              {/* Filters */}
              <div className="overflow-hidden rounded-xl bg-white">
                <p className={`${labelClass} flex items-center gap-1.5 px-4 pt-4 !mb-1`}>
                  <FunnelSimple className="h-3.5 w-3.5" weight="regular" />
                  {t('export.filters')}
                </p>
                <div className="divide-y divide-gray-100">
                  {switchRow(onlyCompleted, setOnlyCompleted, t('export.onlyCompleted'))}
                  {switchRow(excludeGhost, setExcludeGhost, t('export.excludeGhost'))}
                </div>
              </div>

              {/* Live count */}
              <motion.div
                key={`${from}-${to}-${onlyCompleted}-${excludeGhost}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                  filtered.length > 0 ? 'bg-violet-50' : 'bg-white'
                }`}
              >
                <span className="text-sm text-gray-600">{t('export.found')}</span>
                <span
                  className={`text-lg font-semibold tabular-nums ${
                    filtered.length > 0 ? 'text-violet-600' : 'text-gray-400'
                  }`}
                >
                  {rangeValid ? filtered.length : '—'}
                </span>
              </motion.div>
            </div>

            {/* Footer */}
            <div className={sheet.footer}>
              <motion.button
                type="button"
                onClick={onClose}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={sheet.cancel}
              >
                {t('export.cancel')}
              </motion.button>

              <motion.button
                type="button"
                onClick={handleExport}
                disabled={!rangeValid || filtered.length === 0 || isExporting}
                whileHover={{ scale: (!rangeValid || filtered.length === 0 || isExporting) ? 1 : 1.02 }}
                whileTap={{ scale: (!rangeValid || filtered.length === 0 || isExporting) ? 1 : 0.98 }}
                className={`${sheet.action} bg-gradient-to-r from-violet-500 to-cyan-500 disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {isExporting ? (
                  <>
                    <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                    {t('export.exporting')}
                  </>
                ) : (
                  <>
                    <DownloadSimple className="h-4 w-4" weight="bold" />
                    {t('export.submit')}
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
