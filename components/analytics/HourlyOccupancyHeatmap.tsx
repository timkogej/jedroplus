'use client';

import { memo, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import ChartCard from './ChartCard';
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

function getIntensityColor(pct: number, maxPct: number): string {
  if (pct === 0 || maxPct === 0) return 'bg-gray-100';
  const rel = pct / maxPct;
  if (rel >= 0.7) return 'bg-violet-800';
  if (rel >= 0.4) return 'bg-violet-600';
  if (rel >= 0.2) return 'bg-violet-400';
  return 'bg-violet-200';
}

function getTextColor(pct: number, maxPct: number): string {
  if (maxPct === 0) return 'text-violet-900';
  const rel = pct / maxPct;
  if (rel >= 0.4) return 'text-white';
  return 'text-violet-900';
}

function HourlyOccupancyHeatmap({
  companyId,
  timePeriod,
  customRange,
}: HourlyOccupancyHeatmapProps) {
  const t = useTranslations('analytics');
  const tCommon = useTranslations('common');
  const [heatmapData, setHeatmapData] = useState<HeatmapData>({});
  const [isLoading, setIsLoading] = useState(true);
  const maxPct = Math.max(...Object.values(heatmapData).filter(v => v > 0), 1);

  // Translated short day names matching DAYS_OF_WEEK order (Mon–Sun)
  const translatedDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(
    k => tCommon(`daysShort.${k}`)
  );

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

  return (
    <ChartCard
      title={t('heatmap.title')}
      subtitle={t('heatmap.subtitle')}
      isLoading={isLoading}
      height={280}
    >

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="w-full min-w-[420px]">
          {/* Hour headers */}
          <div className="mb-2 flex">
            <div className="w-12" /> {/* Empty corner */}
            {WORKING_HOURS.map((hour) => (
              <div key={hour} className="min-w-[24px] flex-1 text-center text-xs font-medium text-gray-500">
                {hour}
              </div>
            ))}
          </div>

          {/* Day rows */}
          {DAYS_OF_WEEK.map((day, dayIndex) => (
            <div key={day} className="mb-1 flex">
              <div className="flex w-12 items-center text-sm font-medium text-gray-700">
                {translatedDays[dayIndex]}
              </div>
              {WORKING_HOURS.map((hour) => {
                const key = `${dayIndex}-${hour}`;
                const pct = heatmapData[key] || 0;
                return (
                  <div
                    key={key}
                    className={`mx-0.5 h-8 min-w-[24px] flex-1 rounded-md transition-colors ${getIntensityColor(pct, maxPct)}`}
                    title={t('heatmap.cellTooltip', {
                      day: translatedDays[dayIndex],
                      hour,
                      hourEnd: hour + 1,
                      pct: pct.toFixed(1),
                    })}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center gap-4">
        <span className="text-[13px] text-gray-500">{t('heatmap.lessOccupied')}</span>
        <div className="flex gap-1">
          <div className="h-5 w-5 rounded bg-gray-100" />
          <div className="h-5 w-5 rounded bg-violet-200" />
          <div className="h-5 w-5 rounded bg-violet-400" />
          <div className="h-5 w-5 rounded bg-violet-600" />
          <div className="h-5 w-5 rounded bg-violet-800" />
        </div>
        <span className="text-[13px] text-gray-500">{t('heatmap.moreOccupied')}</span>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        {t('heatmap.note')}
      </p>
    </ChartCard>
  );
}

export default memo(HourlyOccupancyHeatmap);
