"use client";

import { motion } from "motion/react";
import { TrendUp } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import type { TopService } from "@/lib/dashboard/fetchDashboardData";

interface TopServicesCardProps {
  services: TopService[];
}

export function TopServicesCard({ services }: TopServicesCardProps) {
  const t = useTranslations('dashboard');
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      className="overflow-hidden rounded-2xl border border-gray-100 bg-white"
    >
      {/* Services List */}
      <div className="p-5">
        {services.length === 0 ? (
          <div className="py-8 text-center">
            <TrendUp size={24} weight="regular" className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-400">{t('topServices.empty')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {services.slice(0, 3).map((service) => (
              <motion.div
                key={service.id}
              >
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium text-gray-900">
                    {service.name}
                  </span>
                  <span className="tnum flex-shrink-0 text-sm text-gray-500">
                    {service.count}&times;
                    <span className="ml-1.5 text-gray-400">{service.percentage}%</span>
                  </span>
                </div>
                {/* Tanka črta nosi delež — brez ploščice, pike in pilule */}
                <div className="h-1 overflow-hidden rounded-full bg-gray-100">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${service.percentage}%` }}
                    transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
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
