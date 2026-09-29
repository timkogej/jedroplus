"use client";

import { motion } from "motion/react";
import type { IconProps } from "@phosphor-icons/react";

export interface Metric {
  label: string;
  value: string | number;
  caption?: string;
  icon?: React.ComponentType<IconProps>;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  trendLabel?: string;
}

interface MetricGroupProps {
  metrics: Metric[];
}

/**
 * Povzetek v enem kosu — vzorec iz Applove aplikacije Fitness.
 *
 * Namesto štirih ločenih kartic s svojimi robovi in sencami je to ena kartica,
 * razdeljena z lasnimi črtami. Lasne črte so risane kot 1px reže v mreži
 * (`gap-px` na sivi podlagi, celice bele) — zato so povsod enako debele in se
 * nikjer ne podvojijo, kar se pri border-jih na sosednjih celicah vedno zgodi.
 */
export function MetricGroup({ metrics }: MetricGroupProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-100"
    >
      {/* Stolpcev je toliko, kolikor je metrik — sicer na koncu ostane prazna
          siva celica. Razredi so našteti dobesedno, ker jih Tailwind poišče
          v izvorni kodi in bi sestavljeno ime izpadlo iz izhoda. */}
      <div
        className={`grid grid-cols-2 gap-px ${
          metrics.length >= 4
            ? 'lg:grid-cols-4'
            : metrics.length === 3
              ? 'lg:grid-cols-3'
              : 'lg:grid-cols-2'
        }`}
      >
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          // Pri lihem številu metrik bi zadnja na dvostolpčni mreži pustila
          // prazno celico, zato tam zasede obe koloni.
          const spansRow = metrics.length % 2 === 1 && index === metrics.length - 1;
          return (
            <div
              key={metric.label}
              className={`flex flex-col justify-between bg-white p-5 ${
                spansRow ? 'col-span-2 lg:col-span-1' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-gray-500">{metric.label}</p>
                {Icon && (
                  <Icon
                    size={18}
                    weight="regular"
                    className="flex-shrink-0 text-gray-300"
                  />
                )}
              </div>

              <p className="tnum mt-3 text-3xl font-semibold text-gray-900">
                {metric.value}
              </p>

              <div className="mt-1 flex items-center gap-1.5">
                {metric.trend && (
                  <span
                    className={`tnum text-sm font-medium ${
                      metric.trend.isPositive ? "text-emerald-600" : "text-red-500"
                    }`}
                  >
                    {metric.trend.isPositive ? "↑" : "↓"}
                    {Math.abs(metric.trend.value)}%
                  </span>
                )}
                {metric.caption && (
                  <span className="truncate text-sm text-gray-400">
                    {metric.caption}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
