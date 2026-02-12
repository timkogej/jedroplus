'use client';

import { memo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { fetchHeatmapData, type HeatmapData } from '@/lib/analytics/calculations';
import {
  type TimePeriod,
  type CustomRange,
  getDateRangeForPeriod,
  DAYS_OF_WEEK,
  WORKING_HOURS,
} from '@/lib/analytics/dateUtils';

interface HourlyOccupancyHeatmapProps {
  companyId: string;
  timePeriod: TimePeriod;
  customRange?: CustomRange;
}

function getIntensityColor(count: number): string {
  if (count === 0) return 'bg-gray-100';
  if (count <= 2) return 'bg-violet-200';
  if (count <= 4) return 'bg-violet-400';
  if (count <= 6) return 'bg-violet-600';
  return 'bg-violet-800';
}

function getTextColor(count: number): string {
  if (count <= 4) return 'text-violet-900';
  return 'text-white';
}

function HourlyOccupancyHeatmap({
  companyId,
  timePeriod,
  customRange,
}: HourlyOccupancyHeatmapProps) {
  const [heatmapData, setHeatmapData] = useState<HeatmapData>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const dateRange = getDateRangeForPeriod(timePeriod, customRange);
        const data = await fetchHeatmapData(companyId, dateRange);
        setHeatmapData(data);
      } catch (error) {
        console.error('Error fetching heatmap data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (companyId) {
      fetchData();
    }
  }, [companyId, timePeriod, customRange]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
          <div className="mt-2 h-4 w-48 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="h-[300px] animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Zasedenost po Urah</h3>
        <p className="mt-1 text-sm text-gray-500">Termini po dnevih in urah</p>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Hour headers */}
          <div className="mb-2 flex">
            <div className="w-12" /> {/* Empty corner */}
            {WORKING_HOURS.map((hour) => (
              <div key={hour} className="w-10 text-center text-xs font-medium text-gray-600">
                {hour}
              </div>
            ))}
          </div>

          {/* Day rows */}
          {DAYS_OF_WEEK.map((day, dayIndex) => (
            <div key={day} className="mb-1 flex">
              <div className="flex w-12 items-center text-sm font-medium text-gray-700">{day}</div>
              {WORKING_HOURS.map((hour) => {
                const key = `${dayIndex}-${hour}`;
                const count = heatmapData[key] || 0;
                return (
                  <motion.div
                    key={key}
                    whileHover={{ scale: 1.1 }}
                    className={`mx-0.5 flex h-8 w-10 cursor-pointer items-center justify-center rounded transition-all ${getIntensityColor(count)}`}
                    title={`${day} ${hour}:00 - ${count} terminov`}
                  >
                    {count > 0 && (
                      <span className={`text-xs font-semibold ${getTextColor(count)}`}>
                        {count}
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center gap-4">
        <span className="text-sm text-gray-600">Manj</span>
        <div className="flex gap-1">
          <div className="h-6 w-6 rounded bg-gray-100" />
          <div className="h-6 w-6 rounded bg-violet-200" />
          <div className="h-6 w-6 rounded bg-violet-400" />
          <div className="h-6 w-6 rounded bg-violet-600" />
          <div className="h-6 w-6 rounded bg-violet-800" />
        </div>
        <span className="text-sm text-gray-600">Več</span>
      </div>
    </motion.div>
  );
}

export default memo(HourlyOccupancyHeatmap);
