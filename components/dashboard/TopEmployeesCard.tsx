"use client";

import { motion } from "motion/react";
import { Users, Trophy } from "@phosphor-icons/react";
import type { TopEmployee } from "@/lib/dashboard/fetchDashboardData";

interface TopEmployeesCardProps {
  employees: TopEmployee[];
}

export function TopEmployeesCard({ employees }: TopEmployeesCardProps) {
  const gradients = [
    "from-violet-500 to-purple-600",
    "from-cyan-500 to-blue-600",
    "from-emerald-500 to-teal-600",
    "from-amber-500 to-orange-600",
    "from-rose-500 to-pink-600",
  ];

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
          <Trophy size={24} weight="regular" className="text-gray-900" />
          <div>
            <h3 className="font-normal text-gray-900">Top Zaposleni</h3>
            <p className="text-sm text-gray-500">Po opravljenih terminih</p>
          </div>
        </div>
      </div>

      {/* Employees List */}
      <div className="p-4 space-y-3">
        {employees.length === 0 ? (
          <div className="py-8 text-center text-gray-400">
            <Users size={32} className="mx-auto mb-2 opacity-50" />
            <p>Ni podatkov</p>
          </div>
        ) : (
          employees.slice(0, 3).map((employee, index) => (
            <motion.div
              key={employee.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors"
            >
              {/* Rank */}
              <span className="flex h-6 w-6 items-center justify-center text-sm font-normal text-gray-400">
                #{index + 1}
              </span>

              {/* Initials - gradient text, no circle */}
              <div
                className="flex h-10 w-10 items-center justify-center text-lg font-bold"
                style={{
                  background: employee.color || 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  color: 'transparent'
                }}
              >
                {employee.initials}
              </div>

              {/* Name and stats */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {employee.name}
                </p>
                <p className="text-sm text-gray-500">
                  {employee.appointmentCount} terminov
                </p>
              </div>

              {/* Percentage badge */}
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                {employee.percentage}%
              </span>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}
