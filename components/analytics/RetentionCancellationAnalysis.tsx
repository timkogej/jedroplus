'use client';

import { memo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { CalendarCheck, Star, Trophy } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import ChartCard from './ChartCard';
import { NO_ANIM } from './chartTheme';
import {
  fetchRetentionData,
  fetchClientAppointmentDistribution,
  type StatusData,
  type ClientAppointmentDistribution,
} from '@/lib/analytics/calculations';
import {
  type TimePeriod,
  type CustomRange,
  getDateRangeForPeriod,
} from '@/lib/analytics/dateUtils';

interface RetentionCancellationAnalysisProps {
  companyId: string;
  timePeriod: TimePeriod;
  customRange?: CustomRange;
}

// Maps the SL status name strings returned by calculations.ts to translation keys
const STATUS_KEYS: Record<string, string> = {
  'Zaključeni': 'zakljuceni',
  'Načrtovani': 'nacrtovani',
  'Odpovedani': 'odpovedani',
  'Ni prišel': 'niPrisel',
};

function RetentionCancellationAnalysis({
  companyId,
  timePeriod,
  customRange,
}: RetentionCancellationAnalysisProps) {
  const t = useTranslations('analytics');
  const [distributionData, setDistributionData] = useState<ClientAppointmentDistribution>({
    totalClients: 0,
    clientsWithOneAppointment: 0,
    clientsWithThreeAppointments: 0,
    clientsWithFivePlusAppointments: 0,
  });
  const [statusData, setStatusData] = useState<StatusData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const dateRange = getDateRangeForPeriod(timePeriod, customRange);
        const [retentionResult, distributionResult] = await Promise.all([
          fetchRetentionData(companyId, dateRange),
          fetchClientAppointmentDistribution(companyId),
        ]);
        console.log('[RetentionAnalysis] Data received:', { retentionResult, distributionResult });
        setStatusData(retentionResult.statuses);
        setDistributionData(distributionResult);
      } catch (error) {
        console.error('Error fetching retention data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (companyId) {
      fetchData();
    }
  }, [companyId, timePeriod, customRange]);

  const totalStatuses = statusData.reduce((sum, d) => sum + d.value, 0);

  const getStatusDisplayName = (name: string) => {
    const key = STATUS_KEYS[name];
    if (key) return t(`retention.statusNames.${key}` as Parameters<typeof t>[0]);
    return name;
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Client Appointment Distribution */}
      <ChartCard title={t('retention.distributionTitle')} isLoading={isLoading} height={220}>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-gray-100 bg-gray-100 sm:grid-cols-3">
          <div className="bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] text-gray-500">{t('retention.oneAppointment')}</p>
              <CalendarCheck className="h-4 w-4 flex-shrink-0 text-amber-500" weight="regular" />
            </div>
            <p className="tnum mt-2 text-2xl font-semibold text-gray-900">
              {distributionData.clientsWithOneAppointment}
            </p>
          </div>

          <div className="bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] text-gray-500">{t('retention.threeAppointments')}</p>
              <Star className="h-4 w-4 flex-shrink-0 text-emerald-500" weight="regular" />
            </div>
            <p className="tnum mt-2 text-2xl font-semibold text-gray-900">
              {distributionData.clientsWithThreeAppointments}
            </p>
          </div>

          <div className="bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] text-gray-500">{t('retention.fivePlusAppointments')}</p>
              <Trophy className="h-4 w-4 flex-shrink-0 text-[#7C78FA]" weight="regular" />
            </div>
            <p className="tnum mt-2 text-2xl font-semibold text-gray-900">
              {distributionData.clientsWithFivePlusAppointments}
            </p>
          </div>
        </div>
      </ChartCard>

      {/* Appointment Status Analysis */}
      <ChartCard
        title={t('retention.statusTitle')}
        isLoading={isLoading}
        isEmpty={totalStatuses === 0}
        emptyLabel={t('retention.noData')}
        height={200}
        skeletonShape="circle"
      >
          <>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={statusData as any[]}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  {...NO_ANIM}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            <div className="mt-4 space-y-3">
              {statusData.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-gray-700">{getStatusDisplayName(item.name)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tnum text-sm font-semibold text-gray-900">{item.value}</span>
                    <span className="text-xs text-gray-500">
                      {totalStatuses > 0 ? ((item.value / totalStatuses) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
      </ChartCard>
    </div>
  );
}

export default memo(RetentionCancellationAnalysis);
