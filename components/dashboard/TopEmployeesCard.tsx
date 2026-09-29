"use client";

import { motion } from "motion/react";
import { Users } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import type { TopEmployee } from "@/lib/dashboard/fetchDashboardData";
import { initialsStyle } from "./initialsStyle";

interface TopEmployeesCardProps {
  employees: TopEmployee[];
}

export function TopEmployeesCard({ employees }: TopEmployeesCardProps) {
  const t = useTranslations('dashboard');
  const gradients = [
    "from-violet-500 to-purple-600",
    "from-cyan-500 to-blue-600",
    "from-emerald-500 to-teal-600",
    "from-amber-500 to-orange-600",
    "from-rose-500 to-pink-600",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      className="overflow-hidden rounded-2xl border border-gray-100 bg-white"
    >
      {/* Employees List */}
      <div className="space-y-1 p-3">
        {employees.length === 0 ? (
          <div className="py-8 text-center text-gray-400">
            <Users size={32} className="mx-auto mb-2 opacity-50" />
            <p>{t('topEmployees.empty')}</p>
          </div>
        ) : (
          employees.slice(0, 3).map((employee, index) => (
            <motion.div
              key={employee.id}
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50"
            >
              {/* Rank */}
              <span className="tnum w-4 flex-shrink-0 text-sm text-gray-400">
                {index + 1}
              </span>

              {/* Inicialke v barvi zaposlenega — barva nosi identiteto */}
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center text-lg font-bold"
                style={initialsStyle(employee.color)}
              >
                {employee.initials}
              </div>

              {/* Name and stats */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {employee.name}
                </p>
                <p className="text-xs text-gray-500">
                  {t('topEmployees.appointmentCount', { count: employee.appointmentCount })}
                </p>
              </div>

              <span className="tnum flex-shrink-0 text-sm text-gray-400">
                {employee.percentage}%
              </span>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}
