'use client';

import { useState, useEffect } from 'react';
import { useFormat } from '@/hooks/useFormat';
import { motion } from 'motion/react';
import { Tag, Clock, Plus } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
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

const TYPES = ['popust', 'happy_hour', 'add_on'] as const;

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
  const { money } = useFormat();
  const t = useTranslations('analytics');
  const [rows, setRows] = useState<PromoRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const TYPE_CONFIG = {
    popust: {
      label: t('promotions.types.popust'),
      Icon: Tag,
      color: '#6D5EF7',
      bgClass: 'bg-purple-100',
      iconClass: 'text-purple-600',
      barBg: 'linear-gradient(90deg, #6D5EF7, #2F80ED)',
    },
    happy_hour: {
      label: t('promotions.types.happy_hour'),
      Icon: Clock,
      color: '#F59E0B',
      bgClass: 'bg-amber-100',
      iconClass: 'text-amber-600',
      barBg: '#F59E0B',
    },
    add_on: {
      label: t('promotions.types.add_on'),
      Icon: Plus,
      color: '#3B82F6',
      bgClass: 'bg-blue-100',
      iconClass: 'text-blue-600',
      barBg: '#3B82F6',
    },
  } as const;

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
  if (!rows || rows.length === 0) return <EmptyState t={t} />;

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
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-gray-500">
          {t('promotions.title')}
        </h2>
        <p className="mt-1 text-[13px] text-gray-500">{t('promotions.subtitle')}</p>
      </div>

      {/* A) Summary cards */}
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-gray-100 bg-gray-100 sm:grid-cols-3">
        {summary.map(({ type, count, savings }) => {
          const cfg = TYPE_CONFIG[type];
          const { Icon } = cfg;
          return (
            <div key={type} className="bg-white p-5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[13px] text-gray-500">{cfg.label}</span>
                <Icon size={18} className={`flex-shrink-0 ${cfg.iconClass}`} weight="regular" />
              </div>
              <p className="tnum mt-2 text-3xl font-semibold text-gray-900">{count}</p>
              <p className="mt-0.5 text-[13px] text-gray-400">{t('promotions.appointmentCount')}</p>
              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-400">{t('promotions.totalSavings')}</p>
                <p className="tnum mt-0.5 text-base font-semibold text-emerald-600">{money(savings)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* B) Horizontal bar chart — most used promotions */}
      <div className="rounded-xl border border-gray-100 bg-white p-5">
        <h3 className="mb-5 text-[15px] font-semibold text-gray-900">
          {t('promotions.topPromos')}
        </h3>
        <div className="space-y-3">
          {topPromos.map(({ naziv, count, type }, idx) => {
            const widthPct = (count / maxCount) * 100;
            const cfg = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG];
            return (
              <div key={naziv} className="flex items-center gap-3">
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
                      transition={{ duration: 0.45, delay: 0.03 * idx, ease: [0.32, 0.72, 0, 1] }}
                      className="h-full rounded-full"
                      style={{ background: cfg?.barBg ?? '#6D5EF7' }}
                    />
                  </div>
                  <span className="tnum w-6 text-right text-sm font-semibold text-gray-900">
                    {count}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* C) Monthly trend — last 6 months, stacked bars */}
      <div className="rounded-xl border border-gray-100 bg-white p-5">
        <h3 className="mb-5 text-[15px] font-semibold text-gray-900">
          {t('promotions.monthlyTrend')}
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
            <span className="text-xs text-gray-600">{t('promotions.legend.discount')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-amber-400" />
            <span className="text-xs text-gray-600">{t('promotions.legend.happyHour')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-blue-400" />
            <span className="text-xs text-gray-600">{t('promotions.legend.addOn')}</span>
          </div>
        </div>
      </div>

      {/* D) Total savings gradient summary card */}
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-gray-100 bg-gray-100 sm:grid-cols-3">
        <div className="bg-white p-5">
          <p className="text-[13px] text-gray-500">{t('promotions.totalSavingsLabel')}</p>
          <p className="tnum mt-2 text-2xl font-semibold text-gray-900">{money(totalSavings)}</p>
        </div>
        <div className="bg-white p-5">
          <p className="text-[13px] text-gray-500">{t('promotions.totalCountLabel')}</p>
          <p className="tnum mt-2 text-2xl font-semibold text-gray-900">{totalCount}</p>
        </div>
        <div className="bg-white p-5">
          <p className="text-[13px] text-gray-500">{t('promotions.avgSavingLabel')}</p>
          <p className="tnum mt-2 text-2xl font-semibold text-gray-900">{money(avgSaving)}</p>
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
            className="rounded-xl border border-gray-100 bg-white p-5"
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
      <div className="rounded-xl border border-gray-100 bg-white p-5">
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

function EmptyState({ t }: { t: ReturnType<typeof useTranslations<'analytics'>> }) {
  return (
    <div className="mb-8 rounded-xl border border-gray-100 bg-white p-12 text-center">
      <Tag className="mx-auto mb-3 h-7 w-7 text-gray-300" weight="regular" />
      <h3 className="mb-1 text-base font-semibold text-gray-900">
        {t('promotions.empty.title')}
      </h3>
      <p className="text-sm text-gray-500 leading-relaxed">
        {t('promotions.empty.description')}
      </p>
    </div>
  );
}
