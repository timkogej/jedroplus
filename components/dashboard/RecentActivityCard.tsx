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
        return "text-green-600 bg-green-50";
      case "booking":
        return "text-emerald-600 bg-emerald-50";
      case "client":
        return "text-violet-600 bg-violet-50";
      case "cancellation":
        return "text-red-500 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <ClockCounterClockwise
            size={24}
            weight="regular"
            className="text-gray-900"
          />
          <div>
            <h3 className="font-normal text-gray-900">{t('recentActivity.title')}</h3>
            <p className="text-sm text-gray-500">{t('recentActivity.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div className="divide-y divide-gray-50">
        {activities.length === 0 ? (
          <div className="p-6 text-center text-gray-400">
            <ClockCounterClockwise size={32} className="mx-auto mb-2 opacity-50" />
            <p>{t('recentActivity.empty')}</p>
          </div>
        ) : (
          activities.map((activity, index) => {
            const Icon = getActivityIcon(activity.type);
            const colorClass = getActivityColor(activity.type);

            // For completed appointments, show extended info
            if (activity.type === "completed") {
              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors"
                >
                  {/* Icon */}
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full flex-shrink-0 ${colorClass}`}
                  >
                    <Icon size={18} weight="regular" />
                  </div>

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
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
              >
                {/* Icon */}
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${colorClass}`}
                >
                  <Icon size={18} weight="regular" />
                </div>

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
