'use client';

import { memo, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import ChartCard from './ChartCard';
import { AXIS, GRID, TOOLTIP, NO_ANIM } from './chartTheme';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchClientGrowthData, type ClientGrowthData } from '@/lib/analytics/calculations';
import {
  type TimePeriod,
  type CustomRange,
  getDateRangeForPeriod,
} from '@/lib/analytics/dateUtils';

interface ClientGrowthChartProps {
  companyId: string;
  timePeriod: TimePeriod;
  customRange?: CustomRange;
}

function ClientGrowthChart({ companyId, timePeriod, customRange }: ClientGrowthChartProps) {
  const t = useTranslations('analytics');
  const [chartData, setChartData] = useState<ClientGrowthData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const dateRange = getDateRangeForPeriod(timePeriod, customRange);
        const data = await fetchClientGrowthData(companyId, dateRange);
        setChartData(data);
      } catch (error) {
        console.error('Error fetching client growth data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (companyId) {
      fetchData();
    }
  }, [companyId, timePeriod, customRange]);

  const totalNewClients = chartData.reduce((sum, d) => sum + d.nove, 0);
  const totalLabel = t('clientGrowth.totalLabel');
  const newLabel = t('clientGrowth.newLabel');

  return (
    <ChartCard
      title={t('clientGrowth.title')}
      subtitle={t('clientGrowth.subtitle')}
      isLoading={isLoading}
      isEmpty={chartData.length === 0}
      emptyLabel={t('clientGrowth.noData')}
      height={250}
      aside={
        <>
          <div className="tnum text-2xl font-semibold text-gray-900">+{totalNewClients}</div>
          <div className="text-xs text-gray-500">{t('clientGrowth.newClientsCount')}</div>
        </>
      }
    >
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="clientGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.2} />
              </linearGradient>
            </defs>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="date" {...AXIS} />
            <YAxis {...AXIS} />
            <Tooltip
              contentStyle={TOOLTIP.contentStyle}
              labelStyle={TOOLTIP.labelStyle}
              formatter={(value, name) => {
                if (name === totalLabel) return [value, String(name)];
                return [value, newLabel];
              }}
            />
            <Area
              type="monotone"
              dataKey="skupaj"
              stroke="#8B5CF6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#clientGradient)"
              name={totalLabel}
              {...NO_ANIM}
            />
          </AreaChart>
        </ResponsiveContainer>
    </ChartCard>
  );
}

export default memo(ClientGrowthChart);
