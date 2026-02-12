"use client";

import { motion } from "motion/react";
import { ChartBar } from "@phosphor-icons/react";
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

interface WeeklyChartProps {
  data: WeeklyChartData[];
}

export function WeeklyChart({ data }: WeeklyChartProps) {
  const maxValue = Math.max(...data.map((d) => d.termini), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {/* Icon only - no circle background */}
          <ChartBar size={24} weight="bold" className="text-gray-900" />
          <div>
            <h3 className="font-semibold text-gray-900">Termini - 7 Dni</h3>
            <p className="text-sm text-gray-500">Pregled zadnjih 7 dni</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-6">
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  `${value} terminov`,
                  "Št. terminov",
                ]}
                labelStyle={{ color: "#111827", fontWeight: 600 }}
              />
              <Bar dataKey="termini" radius={[6, 6, 0, 0]} maxBarSize={40}>
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
