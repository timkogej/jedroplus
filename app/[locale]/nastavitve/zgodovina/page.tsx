'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
import { useTranslations } from 'next-intl';
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
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
                className={`rounded px-2 py-1 text-xs ${
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
                className={`rounded px-2 py-1 text-xs ${
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

  const formattedDate = new Date(row.created_at).toLocaleString('sl-SI', {
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
    <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white transition-colors hover:border-gray-200">
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          {/* Top row: action badge + entity type + ID */}
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <AkcijaBadge akcija={akcija} label={akcijLabel} />
            <span className="text-xs text-gray-500">{tipLabel}</span>
            {row['ID entitete'] && (
              <span className="text-xs text-gray-400 font-mono truncate max-w-[140px]">
                #{row['ID entitete']}
              </span>
            )}
          </div>

          {/* Second row: who + date */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            {row.izvedel && (
              <span className="font-medium text-gray-700 truncate max-w-[200px]">
                {row.izvedel}
              </span>
            )}
            {izvedalTipLabel && (
              <>
                {row.izvedel && <span>·</span>}
                <span>{izvedalTipLabel}</span>
              </>
            )}
            {(row.izvedel || izvedalTipLabel) && <span>·</span>}
            <span>{formattedDate}</span>
          </div>
        </div>

        {/* Expand button */}
        {hasExtra && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:border-gray-300 hover:text-gray-900 transition-colors"
          >
            {expanded ? (
              <>
                <CaretUp className="w-3.5 h-3.5" />
                {t('zgodovina.collapse')}
              </>
            ) : (
              <>
                <CaretDown className="w-3.5 h-3.5" />
                {t('zgodovina.expand')}
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
            <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-4">
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
                  <p className="text-xs font-semibold text-gray-500 tracking-wide mb-2">
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
          className="rounded-2xl bg-amber-50 border border-amber-100 p-8 text-center"
        >
          <Warning className="w-8 h-8 text-amber-500 mx-auto mb-3" weight="fill" />
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
        className="bg-white rounded-2xl border border-gray-100 px-5 py-4 space-y-3"
      >
        {/* Row 1: Tip tabs + Akcija dropdown */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Tip tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['vsi', 'termini', 'stranke'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setFilters((f) => ({ ...f, tip: v }))}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  filters.tip === v
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
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
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
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
            <label className="text-xs text-gray-500">{t('zgodovina.filters.datumOd')}</label>
            <input
              type="date"
              value={filters.datumOd}
              onChange={(e) => setFilters((f) => ({ ...f, datumOd: e.target.value }))}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">{t('zgodovina.filters.datumDo')}</label>
            <input
              type="date"
              value={filters.datumDo}
              onChange={(e) => setFilters((f) => ({ ...f, datumDo: e.target.value }))}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
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
              className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
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
            className="px-4 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            {t('zgodovina.filters.tip')}
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:text-gray-700 hover:border-gray-300 transition-colors"
            >
              {t('zgodovina.filters.resetFilters')}
            </button>
          )}
          {totalCount > 0 && !isLoading && (
            <span className="text-xs text-gray-400 ml-auto">
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
        <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center">
          <Warning className="w-7 h-7 text-red-500 mx-auto mb-2" weight="fill" />
          <p className="text-sm text-red-700">{t('zgodovina.loadError')}</p>
        </div>
      ) : records.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-100 px-6 py-14 text-center"
        >
          <p className="text-sm font-medium text-gray-500">{t('zgodovina.empty.title')}</p>
          <p className="text-xs text-gray-400 mt-1">{t('zgodovina.empty.description')}</p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
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
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:border-gray-300 hover:text-gray-900 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('zgodovina.pagination.previous')}
          </button>

          <span className="text-xs text-gray-500">
            {page + 1} {t('zgodovina.pagination.of')} {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:border-gray-300 hover:text-gray-900 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            {t('zgodovina.pagination.next')}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
