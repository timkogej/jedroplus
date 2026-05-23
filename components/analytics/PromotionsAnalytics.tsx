'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Tag, Clock, Plus } from '@phosphor-icons/react';
import { supabase } from '@/lib/supabaseClient';

interface PromoRow {
  promocija_tip: 'popust' | 'happy_hour' | 'add_on';
  promocija_naziv: string | null;
  'Final cena': string | null;
  Cena: string | null;
  Popust: string | null;
  datum: string | null;
}

interface PromotionsAnalyticsProps {
  companyId: string;
}

const TYPE_CONFIG = {
  popust: {
    label: 'Popusti',
    Icon: Tag,
    color: '#6D5EF7',
    bgClass: 'bg-purple-100',
    iconClass: 'text-purple-600',
    barBg: 'linear-gradient(90deg, #6D5EF7, #2F80ED)',
  },
  happy_hour: {
    label: 'Happy Hours',
    Icon: Clock,
    color: '#F59E0B',
    bgClass: 'bg-amber-100',
    iconClass: 'text-amber-600',
    barBg: '#F59E0B',
  },
  add_on: {
    label: 'Add-oni',
    Icon: Plus,
    color: '#3B82F6',
    bgClass: 'bg-blue-100',
    iconClass: 'text-blue-600',
    barBg: '#3B82F6',
  },
} as const;

const TYPES = ['popust', 'happy_hour', 'add_on'] as const;

const fmt = (val: number) =>
  new Intl.NumberFormat('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

function parseMoney(v: string | null | undefined): number {
  if (!v) return 0;
  return parseFloat(String(v)) || 0;
}

function computeSaving(row: PromoRow): number {
  const cena = parseMoney(row.Cena);
  const final = parseMoney(row['Final cena']);
  if (cena <= 0 || final <= 0) return 0;
  return Math.max(0, cena - final);
}

export default function PromotionsAnalytics({ companyId }: PromotionsAnalyticsProps) {
  const [rows, setRows] = useState<PromoRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;

    const fetchData = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('Termini')
        .select('"ID podjetja", promocija_tip, promocija_naziv, "Final cena", "Cena", "Popust", datum')
        .eq('"ID podjetja"', companyId)
        .not('promocija_tip', 'is', null);

      if (!error && data) {
        setRows(data as PromoRow[]);
      }
      setIsLoading(false);
    };

    fetchData();
  }, [companyId]);

  if (isLoading) return <SkeletonLoader />;
  if (!rows || rows.length === 0) return <EmptyState />;

  // Summary per type
  const summary = TYPES.map((type) => {
    const typed = rows.filter((r) => r.promocija_tip === type);
    const savings = typed.reduce((sum, r) => sum + computeSaving(r), 0);
    return { type, count: typed.length, savings };
  });

  // Top promotions by naziv (section B)
  const nazivMap = new Map<string, { count: number; type: string }>();
  for (const r of rows) {
    const key = r.promocija_naziv?.trim() || r.promocija_tip;
    const existing = nazivMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      nazivMap.set(key, { count: 1, type: r.promocija_tip });
    }
  }
  const topPromos = Array.from(nazivMap.entries())
    .map(([naziv, { count, type }]) => ({ naziv, count, type }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const maxCount = topPromos[0]?.count ?? 1;

  // Monthly trend — last 6 months (section C)
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleDateString('sl-SI', { month: 'short' }),
    };
  });

  const monthlyData = months.map(({ year, month, label }) => {
    const monthRows = rows.filter((r) => {
      if (!r.datum) return false;
      const d = new Date(r.datum);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    return {
      label,
      popust: monthRows.filter((r) => r.promocija_tip === 'popust').length,
      happy_hour: monthRows.filter((r) => r.promocija_tip === 'happy_hour').length,
      add_on: monthRows.filter((r) => r.promocija_tip === 'add_on').length,
    };
  });

  const maxMonthly = Math.max(
    1,
    ...monthlyData.map((m) => m.popust + m.happy_hour + m.add_on)
  );

  // Total savings (section D)
  const totalSavings = rows.reduce((sum, r) => sum + computeSaving(r), 0);
  const totalCount = rows.length;
  const avgSaving = totalCount > 0 ? totalSavings / totalCount : 0;

  return (
    <div className="mb-8 space-y-6">
      {/* Section header */}
      <div>
        <h2 className="text-xl font-bold text-[#1A1F36]">Promocije</h2>
        <p className="mt-1 text-sm text-gray-500">
          Analitika popustov, happy hourov in add-onov
        </p>
      </div>

      {/* A) Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summary.map(({ type, count, savings }, idx) => {
          const cfg = TYPE_CONFIG[type];
          const { Icon } = cfg;
          return (
            <motion.div
              key={type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${cfg.bgClass}`}
                >
                  <Icon size={18} className={cfg.iconClass} weight="fill" />
                </div>
                <span className="font-semibold text-gray-800">{cfg.label}</span>
              </div>
              <p className="text-3xl font-bold text-gray-900 mb-0.5">{count}</p>
              <p className="text-sm text-gray-500 mb-4">terminov</p>
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-0.5">Skupni prihranek</p>
                <p className="text-lg font-bold text-green-600">€{fmt(savings)}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* B) Horizontal bar chart — most used promotions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-base font-bold text-[#1A1F36] mb-5">
          Najpogosteje uporabljeni popusti
        </h3>
        <div className="space-y-3">
          {topPromos.map(({ naziv, count, type }, idx) => {
            const widthPct = (count / maxCount) * 100;
            const cfg = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG];
            return (
              <motion.div
                key={naziv}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 * idx }}
                className="flex items-center gap-3"
              >
                <div className="w-40 shrink-0 space-y-0.5">
                  <span className="text-sm font-medium text-gray-700 truncate block">
                    {naziv}
                  </span>
                  {cfg && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full text-white inline-block"
                      style={{ backgroundColor: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 items-center gap-2">
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ duration: 0.55, delay: 0.04 * idx, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ background: cfg?.barBg ?? '#6D5EF7' }}
                    />
                  </div>
                  <span className="w-6 text-right text-sm font-semibold text-gray-700">
                    {count}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* C) Monthly trend — last 6 months, stacked bars */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-base font-bold text-[#1A1F36] mb-5">
          Uporaba promocij po mesecih
        </h3>
        <div className="flex items-end gap-2" style={{ height: '160px' }}>
          {monthlyData.map(({ label, popust, happy_hour, add_on }) => {
            const total = popust + happy_hour + add_on;
            const barH = Math.round((total / maxMonthly) * 120);
            const pH = total > 0 ? Math.round((popust / total) * barH) : 0;
            const hhH = total > 0 ? Math.round((happy_hour / total) * barH) : 0;
            const aoH = barH - pH - hhH;

            return (
              <div
                key={label}
                className="flex flex-1 flex-col items-center"
                style={{ height: '160px' }}
              >
                <div className="flex-1 flex flex-col justify-end w-full">
                  {total > 0 && (
                    <span className="text-[10px] text-gray-500 text-center mb-1">{total}</span>
                  )}
                  <div
                    className="w-full flex flex-col-reverse gap-px overflow-hidden rounded-t-sm"
                    style={{ height: `${barH}px` }}
                  >
                    <div style={{ height: pH, background: 'linear-gradient(135deg, #6D5EF7, #2F80ED)' }} />
                    <div style={{ height: hhH, backgroundColor: '#F59E0B' }} />
                    <div style={{ height: aoH, backgroundColor: '#3B82F6' }} />
                  </div>
                </div>
                <span className="text-[11px] text-gray-500 mt-2 text-center">{label}</span>
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex items-center justify-center gap-5 mt-4">
          <div className="flex items-center gap-1.5">
            <div
              className="h-3 w-3 rounded-sm"
              style={{ background: 'linear-gradient(135deg, #6D5EF7, #2F80ED)' }}
            />
            <span className="text-xs text-gray-600">Popust</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-amber-400" />
            <span className="text-xs text-gray-600">Happy Hour</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-blue-400" />
            <span className="text-xs text-gray-600">Add-on</span>
          </div>
        </div>
      </div>

      {/* D) Total savings gradient summary card */}
      <div
        className="rounded-2xl p-6 text-white"
        style={{
          background: 'linear-gradient(135deg, #6D5EF7 0%, #2F80ED 50%, #2AD4C5 100%)',
        }}
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <p className="text-white/70 text-sm mb-1">
              Skupni prihranek strank s promocijami
            </p>
            <p className="text-2xl font-bold">€{fmt(totalSavings)}</p>
          </div>
          <div>
            <p className="text-white/70 text-sm mb-1">Število terminov s promocijo</p>
            <p className="text-2xl font-bold">{totalCount}</p>
          </div>
          <div>
            <p className="text-white/70 text-sm mb-1">Povprečni popust na termin</p>
            <p className="text-2xl font-bold">€{fmt(avgSaving)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="mb-8 space-y-6">
      <div>
        <div className="h-7 w-32 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-4 w-64 bg-gray-100 rounded-lg animate-pulse mt-2" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mb-1" />
            <div className="h-3 w-20 bg-gray-100 rounded animate-pulse mb-4" />
            <div className="pt-3 border-t border-gray-100">
              <div className="h-3 w-28 bg-gray-100 rounded animate-pulse mb-1" />
              <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="h-5 w-64 bg-gray-200 rounded animate-pulse mb-5" />
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-40 h-9 bg-gray-100 rounded animate-pulse" />
              <div className="flex-1 h-6 bg-gray-100 rounded-full animate-pulse" />
              <div className="w-6 h-4 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mb-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
      <div className="text-4xl mb-4">🏷️</div>
      <h3 className="text-base font-semibold text-[#1A1F36] mb-2">
        Še ni terminov s promocijami
      </h3>
      <p className="text-sm text-gray-500 leading-relaxed">
        Ustvarite popust ali happy hour in
        <br />
        začnite slediti prihrankom strank.
      </p>
    </div>
  );
}
