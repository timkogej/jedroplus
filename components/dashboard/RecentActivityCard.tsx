"use client";

import { motion } from "motion/react";
import {
  ClockCounterClockwise,
  CalendarPlus,
  UserPlus,
  XCircle,
  CheckCircle,
  Clock,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import type { RecentActivity } from "@/lib/dashboard/fetchDashboardData";

interface RecentActivityCardProps {
  activities: RecentActivity[];
}

export function RecentActivityCard({ activities }: RecentActivityCardProps) {
  const t = useTranslations('dashboard');
  const getActivityIcon = (type: RecentActivity["type"]) => {
    switch (type) {
      case "completed":
        return CheckCircle;
      case "booking":
        return CalendarPlus;
      case "client":
        return UserPlus;
      case "cancellation":
        return XCircle;
      default:
        return ClockCounterClockwise;
    }
  };

  const getActivityColor = (type: RecentActivity["type"]) => {
    switch (type) {
      case "completed":
        return "text-emerald-600";
      case "booking":
        return "text-emerald-600";
      case "client":
        return "text-violet-600";
      case "cancellation":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      className="overflow-hidden rounded-2xl border border-gray-100 bg-white"
    >
      {/* Activity List */}
      <div className="divide-y divide-gray-100">
        {activities.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <ClockCounterClockwise size={24} weight="regular" className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-400">{t('recentActivity.empty')}</p>
          </div>
        ) : (
          activities.map((activity) => {
            const Icon = getActivityIcon(activity.type);
            const colorClass = getActivityColor(activity.type);

            // For completed appointments, show extended info
            if (activity.type === "completed") {
              return (
                <motion.div
                  key={activity.id}
                  className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-gray-50"
                >
                  {/* Icon */}
                  <Icon
                    size={18}
                    weight="regular"
                    className={`mt-0.5 flex-shrink-0 ${colorClass}`}
                  />

                  {/* Client and Service Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {activity.clientName || t('recentActivity.unknownClient')}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {activity.serviceName || t('recentActivity.serviceLabel')}
                    </p>
                    {/* Time range */}
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                      <Clock size={12} weight="regular" />
                      <span>
                        {activity.startTime}
                        {activity.endTime ? ` - ${activity.endTime}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Time ago */}
                  <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                    {activity.timeAgo}
                  </span>
                </motion.div>
              );
            }

            // Default display for other activity types
            return (
              <motion.div
                key={activity.id}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50"
              >
                {/* Icon */}
                <Icon
                  size={18}
                  weight="regular"
                  className={`flex-shrink-0 ${colorClass}`}
                />

                {/* Description */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">
                    {activity.description}
                  </p>
                </div>

                {/* Time ago */}
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {activity.timeAgo}
                </span>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
