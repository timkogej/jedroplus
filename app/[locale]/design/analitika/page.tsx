'use client';

/**
 * ZAČASNA predogledna stran za redizajn Analitike.
 *
 * Uporablja pravo ogrodje grafov (ChartCard, chartTheme, MetricGroup) z
 * izmišljenimi podatki. Ko je redizajn potrjen, se mapa `design` zbriše.
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import {
  DownloadSimple,
  TrendUp,
  CurrencyEur,
  Clock,
  CheckCircle,
} from '@phosphor-icons/react';
import {
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { MetricGroup } from '@/components/dashboard';
import ChartCard from '@/components/analytics/ChartCard';
import { AXIS, GRID, TOOLTIP, NO_ANIM, BRAND } from '@/components/analytics/chartTheme';

const PERIODS = ['Danes', 'Ta teden', 'Ta mesec', 'Zadnjih 30 dni', 'Letos', 'Po meri'];

const REVENUE = Array.from({ length: 12 }, (_, i) => ({
  date: `${i + 1}. 9.`,
  prihodki: 380 + Math.round(Math.sin(i / 1.7) * 210 + i * 26),
  termini: 6 + Math.round(Math.abs(Math.cos(i / 2)) * 7),
}));

const GROWTH = Array.from({ length: 12 }, (_, i) => ({
  date: `${i + 1}. 9.`,
  skupaj: 120 + i * 7,
  nove: 3 + (i % 4),
}));

const SERVICES = [
  { name: 'Klasično striženje', value: 42, color: '#7C78FA' },
  { name: 'Barvanje in fen', value: 28, color: '#35E3DB' },
  { name: 'Urejanje brade', value: 19, color: '#59AEEA' },
  { name: 'Pramenčki', value: 12, color: '#F59E0B' },
  { name: 'Nega obraza', value: 8, color: '#EF4444' },
];

const DAYS = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob'];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

function cellColor(pct: number) {
  if (pct === 0) return 'bg-gray-100';
  if (pct < 25) return 'bg-violet-200';
  if (pct < 50) return 'bg-violet-400';
  if (pct < 75) return 'bg-violet-600';
  return 'bg-violet-800';
}

export default function AnalitikaDesignPreview() {
  const [period, setPeriod] = useState('Ta mesec');

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-7">
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="mb-5 flex flex-wrap items-start justify-between gap-4"
          >
            <div>
              <div className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                predogled
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Analitika</h1>
              <p className="mt-0.5 text-base text-gray-500">Pregled poslovanja po obdobjih.</p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100"
            >
              <DownloadSimple size={17} weight="regular" className="text-gray-500" />
              Izvozi
            </button>
          </motion.div>

          <div className="flex flex-wrap gap-1.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  period === p ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <MetricGroup
            metrics={[
              { label: 'Skupni prihodki', value: '6.420 €', icon: TrendUp, trend: { value: 12, isPositive: true }, caption: 'proti prejšnjemu obdobju' },
              { label: 'Povprečna vrednost', value: '46 €', icon: CurrencyEur, trend: { value: 4, isPositive: false }, caption: 'na termin' },
              { label: 'Zasedenost', value: '68,4 %', icon: Clock, caption: 'delovnega časa' },
              { label: 'Zaključeni', value: '92,1 %', icon: CheckCircle, caption: 'terminov' },
            ]}
          />
        </div>

        <div className="mb-6">
          <ChartCard title="Prihodki in termini" subtitle="Gibanje čez izbrano obdobje" height={320}>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={REVENUE}>
                <defs>
                  <linearGradient id="prev" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#06B6D4" />
                  </linearGradient>
                </defs>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="date" {...AXIS} />
                <YAxis yAxisId="left" {...AXIS} />
                <YAxis yAxisId="right" orientation="right" {...AXIS} />
                <Tooltip contentStyle={TOOLTIP.contentStyle} labelStyle={TOOLTIP.labelStyle} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Line yAxisId="left" type="monotone" dataKey="prihodki" stroke="url(#prev)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} name="Prihodki" {...NO_ANIM} />
                <Line yAxisId="right" type="monotone" dataKey="termini" stroke={BRAND.emerald} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} name="Termini" {...NO_ANIM} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartCard title="Termini po storitvah" subtitle="Delež v izbranem obdobju" height={250} skeletonShape="circle">
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={SERVICES} cx="50%" cy="50%" labelLine={false} innerRadius={52} outerRadius={82} paddingAngle={2} dataKey="value" {...NO_ANIM}>
                    {SERVICES.map((e) => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP.contentStyle} labelStyle={TOOLTIP.labelStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {SERVICES.map((s) => (
                  <div key={s.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
                      <span className="text-sm text-gray-700">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tnum text-sm font-semibold text-gray-900">{s.value}</span>
                      <span className="tnum text-xs text-gray-500">
                        {Math.round((s.value / 109) * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          </ChartCard>

          <ChartCard
            title="Rast strank"
            subtitle="Nove in skupaj"
            height={250}
            aside={
              <>
                <div className="tnum text-2xl font-semibold text-gray-900">+38</div>
                <div className="text-xs text-gray-500">novih strank</div>
              </>
            }
          >
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={GROWTH}>
                <defs>
                  <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="date" {...AXIS} />
                <YAxis {...AXIS} />
                <Tooltip contentStyle={TOOLTIP.contentStyle} labelStyle={TOOLTIP.labelStyle} />
                <Area type="monotone" dataKey="skupaj" stroke="#8B5CF6" strokeWidth={2} fill="url(#cg)" name="Skupaj" {...NO_ANIM} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <ChartCard title="Zasedenost po urah" subtitle="Kdaj ste najbolj polni" height={280}>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="mb-2 flex">
                <div className="w-12" />
                {HOURS.map((h) => (
                  <div key={h} className="w-10 text-center text-xs font-medium text-gray-500">{h}</div>
                ))}
              </div>
              {DAYS.map((d, di) => (
                <div key={d} className="mb-1 flex">
                  <div className="flex w-12 items-center text-sm font-medium text-gray-700">{d}</div>
                  {HOURS.map((h) => {
                    const pct = Math.max(0, Math.round(Math.sin((di + 1) * (h / 4)) * 50 + 45));
                    return <div key={h} className={`mx-0.5 h-8 w-10 rounded-md ${cellColor(pct)}`} title={`${d} ${h}:00 — ${pct} %`} />;
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 flex items-center gap-4">
            <span className="text-[13px] text-gray-500">Manj zasedeno</span>
            <div className="flex gap-1">
              {['bg-gray-100','bg-violet-200','bg-violet-400','bg-violet-600','bg-violet-800'].map((c) => (
                <div key={c} className={`h-5 w-5 rounded ${c}`} />
              ))}
            </div>
            <span className="text-[13px] text-gray-500">Bolj zasedeno</span>
          </div>
        </ChartCard>
      </div>
    </main>
  );
}
