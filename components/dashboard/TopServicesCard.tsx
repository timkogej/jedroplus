"use client";

import { motion } from "motion/react";
import { Scissors, TrendUp } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import type { TopService } from "@/lib/dashboard/fetchDashboardData";

interface TopServicesCardProps {
  services: TopService[];
}

export function TopServicesCard({ services }: TopServicesCardProps) {
  const t = useTranslations('dashboard');
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {/* Icon only - no circle background */}
          <Scissors size={24} weight="regular" className="text-gray-900" />
          <div>
            <h3 className="font-normal text-gray-900">{t('topServices.title')}</h3>
            <p className="text-sm text-gray-500">{t('topServices.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Services List */}
      <div className="p-4 flex-1 flex flex-col">
        {services.length === 0 ? (
          <div className="py-8 text-center text-gray-400">
            <TrendUp size={32} className="mx-auto mb-2 opacity-50" />
            <p>{t('topServices.empty')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 flex-1">
            {services.slice(0, 3).map((service, index) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex flex-col justify-center p-3 rounded-xl bg-gray-50 min-h-[72px]"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: service.color }}
                    />
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {service.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm text-gray-500">{service.count}x</span>
                    <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                      {service.percentage}%
                    </span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-2 rounded-full overflow-hidden bg-gray-200">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${service.percentage}%` }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="h-full rounded-full"
                    style={{ background: service.color }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
