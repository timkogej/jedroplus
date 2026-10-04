"use client";

import { motion } from "motion/react";
import { useTranslations, useLocale } from "next-intl";
import { intlLocale } from "@/lib/format";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { WeeklyChartData } from "@/lib/dashboard/fetchDashboardData";

// Podatki pridejo s slovenskimi kraticami dni (Ned … Sob); za prikaz jih
// prevedemo v jezik aplikacije.
const SL_DAYS = ["Ned", "Pon", "Tor", "Sre", "Čet", "Pet", "Sob"];

function localizedDay(day: string, locale: string): string {
  const index = SL_DAYS.indexOf(day);
  if (index < 0) return day;
  // 7. 1. 2024 je bila nedelja.
  const date = new Date(2024, 0, 7 + index);
  const label = date.toLocaleDateString(intlLocale(locale), { weekday: "short" }).replace(/\.$/, "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

interface WeeklyChartProps {
  data: WeeklyChartData[];
}

export function WeeklyChart({ data }: WeeklyChartProps) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const chartData = data.map((d) => ({ ...d, day: localizedDay(d.day, locale) }));
  const maxValue = Math.max(...data.map((d) => d.termini), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      className="overflow-hidden rounded-2xl border border-gray-100 bg-white"
    >
      {/* Chart */}
      <div className="p-5">
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#06B6D4" />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#9CA3AF", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#9CA3AF", fontSize: 12 }}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(139, 92, 246, 0.1)" }}
                contentStyle={{
                  background: "white",
                  border: "1px solid #E5E7EB",
                  borderRadius: "12px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
                formatter={(value) => [
                  t('weeklyChart.tooltipValue', { value: Number(value) }),
                  t('weeklyChart.tooltipLabel'),
                ]}
                labelStyle={{ color: "#111827", fontWeight: 600 }}
              />
              {/* Brez animacije: če se stran naloži v zavihku v ozadju, brskalnik
                      zadrži rAF in stolpci obtičijo na ničli. */}
              <Bar dataKey="termini" radius={[6, 6, 0, 0]} maxBarSize={40} isAnimationActive={false}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill="url(#barGradient)"
                    opacity={0.6 + (entry.termini / maxValue) * 0.4}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}
