'use client';

import { useState, useEffect, useCallback } from 'react';
import { Link } from '@/i18n/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  CaretLeft,
  CaretDown,
  CaretUp,
  Warning,
  MagnifyingGlass,
  X,
  ArrowLeft,
  ArrowRight,
} from '@phosphor-icons/react';
import { useTranslations, useLocale } from 'next-intl';
import { intlLocale } from '@/lib/format';
import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';
import { useCompany } from '@/app/company-context';
import { useRolePermissions } from '@/app/role-permission-context';
import { GradientSpinner } from '@/components/ui/GradientSpinner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ZgodovinaRow {
  id: number;
  'ID podjetja': string;
  tip_entitete: 'termin' | 'stranka';
  'ID entitete': string;
  akcija: string;
  spremembe: { prej: Record<string, unknown>; potem: Record<string, unknown> } | null;
  izvedel: string | null;
  izvedel_tip: string | null;
  'ID termina': string | null;
  'ID stranke': string | null;
  created_at: string;
}

interface Filters {
  tip: 'vsi' | 'termini' | 'stranke';
  akcija: string;
  datumOd: string;
  datumDo: string;
  search: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

const ALL_AKCIJE = [
  'ustvarjen',
  'spremenjen',
  'prestavljen',
  'zakljucen',
  'izbrisan',
  'odpovedan',
  'online_rezervacija',
  'stranka_dodana',
  'stranka_posodobljena',
] as const;

const AKCIJA_COLORS: Record<string, string> = {
  ustvarjen:             'bg-emerald-50 text-emerald-700',
  spremenjen:            'bg-blue-50 text-blue-700',
  prestavljen:           'bg-orange-50 text-orange-700',
  zakljucen:             'bg-purple-50 text-purple-700',
  izbrisan:              'bg-red-50 text-red-700',
  odpovedan:             'bg-red-50 text-red-700',
  online_rezervacija:    'bg-cyan-50 text-cyan-700',
  stranka_dodana:        'bg-emerald-50 text-emerald-700',
  stranka_posodobljena:  'bg-blue-50 text-blue-700',
};

const DEFAULT_FILTERS: Filters = {
  tip: 'vsi',
  akcija: 'vseAkcije',
  datumOd: '',
  datumDo: '',
  search: '',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function AkcijaBadge({ akcija, label }: { akcija: string; label: string }) {
  const color = AKCIJA_COLORS[akcija] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${color}`}>
      {label}
    </span>
  );
}

function JsonDiff({
  prej,
  potem,
  labelPrej,
  labelPotem,
}: {
  prej: Record<string, unknown>;
  potem: Record<string, unknown>;
  labelPrej: string;
  labelPotem: string;
}) {
  const allKeys = Array.from(
    new Set([...Object.keys(prej), ...Object.keys(potem)])
  );

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
          {labelPrej}
        </p>
        <div className="space-y-1">
          {allKeys.map((k) => {
            const val = prej[k];
            const changed = JSON.stringify(prej[k]) !== JSON.stringify(potem[k]);
            return (
              <div
                key={k}
                className={`rounded-md px-2 py-1 text-xs ${
                  changed ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'
                }`}
              >
                <span className="font-medium">{k}:</span>{' '}
                <span className="break-all">
                  {val === null || val === undefined
                    ? '—'
                    : typeof val === 'object'
                    ? JSON.stringify(val)
                    : String(val)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
          {labelPotem}
        </p>
        <div className="space-y-1">
          {allKeys.map((k) => {
            const val = potem[k];
            const changed = JSON.stringify(prej[k]) !== JSON.stringify(potem[k]);
            return (
              <div
                key={k}
                className={`rounded-md px-2 py-1 text-xs ${
                  changed ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-600'
                }`}
              >
                <span className="font-medium">{k}:</span>{' '}
                <span className="break-all">
                  {val === null || val === undefined
                    ? '—'
                    : typeof val === 'object'
                    ? JSON.stringify(val)
                    : String(val)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ZgodovinaCard({ row }: { row: ZgodovinaRow }) {
  const t = useTranslations('settings');
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);

  const akcija = row.akcija;
  const akcijLabel =
    ALL_AKCIJE.includes(akcija as (typeof ALL_AKCIJE)[number])
      ? t(`zgodovina.akcije.${akcija}`)
      : akcija;

  const tipLabel = row.tip_entitete === 'termin'
    ? t('zgodovina.tipEntitete.termin')
    : t('zgodovina.tipEntitete.stranka');

  const izvedalTipLabel = row.izvedel_tip
    ? (t.raw('zgodovina.izvedel_tip') as Record<string, string>)[row.izvedel_tip] ?? row.izvedel_tip
    : null;

  const formattedDate = new Date(row.created_at).toLocaleString(intlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const hasSpremembe =
    row.spremembe &&
    (Object.keys(row.spremembe.prej ?? {}).length > 0 ||
      Object.keys(row.spremembe.potem ?? {}).length > 0);

  const hasExtra = hasSpremembe || row['ID termina'] || row['ID stranke'];

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          {/* Top row: action badge + entity type + ID */}
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <AkcijaBadge akcija={akcija} label={akcijLabel} />
            <span className="text-[13px] text-gray-900">{tipLabel}</span>
            {row['ID entitete'] && (
              <span className="max-w-[140px] truncate font-mono text-xs text-gray-400">
                #{row['ID entitete']}
              </span>
            )}
          </div>

          {/* Second row: who + date */}
          <div className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-gray-500">
            {row.izvedel && (
              <span className="max-w-[200px] truncate text-gray-700">
                {row.izvedel}
              </span>
            )}
            {izvedalTipLabel && (
              <>
                {row.izvedel && <span className="text-gray-300">·</span>}
                <span>{izvedalTipLabel}</span>
              </>
            )}
            {(row.izvedel || izvedalTipLabel) && <span className="text-gray-300">·</span>}
            <span className="tnum">{formattedDate}</span>
          </div>
        </div>

        {/* Expand button */}
        {hasExtra && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            {expanded ? (
              <>
                {t('zgodovina.collapse')}
                <CaretUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                {t('zgodovina.expand')}
                <CaretDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        )}
      </div>

      <AnimatePresence>
        {expanded && hasExtra && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 px-4 pb-4 pt-1">
              {/* IDs */}
              {(row['ID termina'] || row['ID stranke']) && (
                <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                  {row['ID termina'] && (
                    <span>
                      <span className="font-semibold text-gray-600">{t('zgodovina.idTermina')}:</span>{' '}
                      <span className="font-mono">{row['ID termina']}</span>
                    </span>
                  )}
                  {row['ID stranke'] && (
                    <span>
                      <span className="font-semibold text-gray-600">{t('zgodovina.idStranke')}:</span>{' '}
                      <span className="font-mono">{row['ID stranke']}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Diff */}
              {hasSpremembe ? (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    {t('zgodovina.spremembe.title')}
                  </p>
                  <JsonDiff
                    prej={row.spremembe!.prej ?? {}}
                    potem={row.spremembe!.potem ?? {}}
                    labelPrej={t('zgodovina.spremembe.prej')}
                    labelPotem={t('zgodovina.spremembe.potem')}
                  />
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">
                  {t('zgodovina.spremembe.noChanges')}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ZgodovinaPage() {
  const t = useTranslations('settings');
  const { companyId } = useCompany();
  const { role, permissions, loading: roleLoading } = useRolePermissions();

  const [records, setRecords] = useState<ZgodovinaRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_FILTERS);

  // ── Access check ──

  const hasAccess =
    role === 'owner' ||
    role === 'admin' ||
    (role === 'staff' && permissions?.can_view_zgodovina === true);

  // ── Fetch ──

  const loadData = useCallback(async () => {
    if (!companyId || !hasAccess) return;
    setIsLoading(true);
    setError(false);

    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabaseReadOnly
        .from('zgodovina')
        .select('*', { count: 'exact' })
        .eq('ID podjetja', companyId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (appliedFilters.tip === 'termini') {
        query = query.eq('tip_entitete', 'termin');
      } else if (appliedFilters.tip === 'stranke') {
        query = query.eq('tip_entitete', 'stranka');
      }

      if (appliedFilters.akcija !== 'vseAkcije') {
        query = query.eq('akcija', appliedFilters.akcija);
      }

      if (appliedFilters.datumOd) {
        query = query.gte('created_at', appliedFilters.datumOd + 'T00:00:00');
      }

      if (appliedFilters.datumDo) {
        query = query.lte('created_at', appliedFilters.datumDo + 'T23:59:59');
      }

      const { data, count, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      let rows = (data ?? []) as ZgodovinaRow[];

      // Client-side search by ID stranke / ID termina (PostgREST .or with quoted cols is finicky)
      if (appliedFilters.search.trim()) {
        const s = appliedFilters.search.trim().toLowerCase();
        rows = rows.filter(
          (r) =>
            r['ID stranke']?.toLowerCase().includes(s) ||
            r['ID termina']?.toLowerCase().includes(s) ||
            r['ID entitete']?.toLowerCase().includes(s)
        );
      }

      setRecords(rows);
      setTotalCount(count ?? 0);
    } catch (err) {
      console.error('[ZgodovinaPage] loadData error:', err);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, hasAccess, page, appliedFilters]);

  useEffect(() => {
    if (!roleLoading) {
      loadData();
    }
  }, [loadData, roleLoading]);

  // ── Reset page when filters applied ──

  const applyFilters = () => {
    setPage(0);
    setAppliedFilters(filters);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(0);
    setAppliedFilters(DEFAULT_FILTERS);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasActiveFilters =
    filters.tip !== 'vsi' ||
    filters.akcija !== 'vseAkcije' ||
    filters.datumOd !== '' ||
    filters.datumDo !== '' ||
    filters.search !== '';

  // ── Loading state ──

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <GradientSpinner size={32} />
      </div>
    );
  }

  // ── Access denied ──

  if (!hasAccess) {
    return (
      <div className="space-y-4">
        <Link
          href="/nastavitve"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          <CaretLeft className="w-3.5 h-3.5" weight="regular" />
          {t('back')}
        </Link>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-amber-50 p-8 text-center"
        >
          <Warning className="mx-auto mb-3 h-8 w-8 text-amber-500" weight="regular" />
          <h2 className="text-base font-semibold text-amber-900 mb-1">
            {t('zgodovina.noAccess.title')}
          </h2>
          <p className="text-sm text-amber-700">{t('zgodovina.noAccess.message')}</p>
        </motion.div>
      </div>
    );
  }

  // ── Main view ──

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/nastavitve"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        <CaretLeft className="w-3.5 h-3.5" weight="regular" />
        {t('back')}
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{t('zgodovina.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('zgodovina.subtitle')}</p>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3 rounded-xl border border-gray-100 bg-white p-4"
      >
        {/* Row 1: Tip tabs + Akcija dropdown */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Tip tabs */}
          <div className="flex items-center gap-0.5 rounded-[9px] bg-gray-100 p-0.5">
            {(['vsi', 'termini', 'stranke'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setFilters((f) => ({ ...f, tip: v }))}
                className={`rounded-[7px] px-3 py-1 text-[13px] font-medium transition-colors ${
                  filters.tip === v
                    ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.1)]'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {t(`zgodovina.filters.${v}`)}
              </button>
            ))}
          </div>

          {/* Akcija dropdown */}
          <select
            value={filters.akcija}
            onChange={(e) => setFilters((f) => ({ ...f, akcija: e.target.value }))}
            className="rounded-[10px] border border-gray-200 bg-white px-3 py-1.5 text-[13px] text-gray-900 focus:border-[#7C78FA] focus:outline-none focus:ring-[3px] focus:ring-[#7C78FA]/25"
          >
            <option value="vseAkcije">{t('zgodovina.filters.vseAkcije')}</option>
            {ALL_AKCIJE.map((a) => (
              <option key={a} value={a}>
                {t(`zgodovina.akcije.${a}`)}
              </option>
            ))}
          </select>
        </div>

        {/* Row 2: Date range + search */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-[13px] text-gray-500">{t('zgodovina.filters.datumOd')}</label>
            <input
              type="date"
              value={filters.datumOd}
              onChange={(e) => setFilters((f) => ({ ...f, datumOd: e.target.value }))}
              className="rounded-[10px] border border-gray-200 bg-white px-2 py-1.5 text-[13px] text-gray-900 focus:border-[#7C78FA] focus:outline-none focus:ring-[3px] focus:ring-[#7C78FA]/25"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[13px] text-gray-500">{t('zgodovina.filters.datumDo')}</label>
            <input
              type="date"
              value={filters.datumDo}
              onChange={(e) => setFilters((f) => ({ ...f, datumDo: e.target.value }))}
              className="rounded-[10px] border border-gray-200 bg-white px-2 py-1.5 text-[13px] text-gray-900 focus:border-[#7C78FA] focus:outline-none focus:ring-[3px] focus:ring-[#7C78FA]/25"
            />
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder={t('zgodovina.filters.search')}
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              className="w-full rounded-[10px] border border-gray-200 bg-white py-1.5 pl-8 pr-8 text-[13px] text-gray-900 focus:border-[#7C78FA] focus:outline-none focus:ring-[3px] focus:ring-[#7C78FA]/25"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, search: '' }))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Row 3: Apply + Reset */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-xl bg-gray-900 px-4 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-gray-800"
          >
            {t('zgodovina.filters.apply')}
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-xl px-3 py-1.5 text-[13px] font-medium text-gray-500 transition-colors hover:text-gray-900"
            >
              {t('zgodovina.filters.resetFilters')}
            </button>
          )}
          {totalCount > 0 && !isLoading && (
            <span className="tnum ml-auto text-[13px] text-gray-500">
              {totalCount} zapisov
            </span>
          )}
        </div>
      </motion.div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <GradientSpinner size={32} />
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 p-6 text-center">
          <Warning className="mx-auto mb-2 h-7 w-7 text-red-500" weight="regular" />
          <p className="text-sm text-red-700">{t('zgodovina.loadError')}</p>
        </div>
      ) : records.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-gray-100 bg-white px-6 py-14 text-center"
        >
          <p className="text-sm font-medium text-gray-900">{t('zgodovina.empty.title')}</p>
          <p className="mt-1 text-[13px] text-gray-500">{t('zgodovina.empty.description')}</p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100 bg-white"
        >
          {records.map((row) => (
            <ZgodovinaCard key={row.id} row={row} />
          ))}
        </motion.div>
      )}

      {/* Pagination */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 py-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:pointer-events-none disabled:opacity-40"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('zgodovina.pagination.previous')}
          </button>

          <span className="tnum text-[13px] text-gray-500">
            {page + 1} {t('zgodovina.pagination.of')} {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:pointer-events-none disabled:opacity-40"
          >
            {t('zgodovina.pagination.next')}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
