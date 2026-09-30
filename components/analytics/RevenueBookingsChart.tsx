'use client';

import { memo, useState, useEffect } from 'react';
import { useFormat } from '@/hooks/useFormat';
import { useTranslations } from 'next-intl';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { fetchRevenueChartData, type ChartDataPoint } from '@/lib/analytics/calculations';
import ChartCard from './ChartCard';
import { AXIS, GRID, TOOLTIP, NO_ANIM, BRAND } from './chartTheme';
import {
  type TimePeriod,
  type CustomRange,
  getDateRangeForPeriod,
} from '@/lib/analytics/dateUtils';

interface RevenueBookingsChartProps {
  companyId: string;
  timePeriod: TimePeriod;
  customRange?: CustomRange;
}

function RevenueBookingsChart({ companyId, timePeriod, customRange }: RevenueBookingsChartProps) {
  const { money } = useFormat();
  const t = useTranslations('analytics');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const dateRange = getDateRangeForPeriod(timePeriod, customRange);
        const data = await fetchRevenueChartData(companyId, dateRange);
        setChartData(data);
      } catch (error) {
        console.error('Error fetching chart data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (companyId) {
      fetchData();
    }
  }, [companyId, timePeriod, customRange]);

  const revenueLegend = t('revenueChart.revenueLegend');
  const appointmentsLegend = t('revenueChart.appointmentsLegend');

  return (
    <ChartCard
      title={t('revenueChart.title')}
      subtitle={t('revenueChart.subtitle')}
      isLoading={isLoading}
      isEmpty={chartData.length === 0}
      emptyLabel={t('revenueChart.noData')}
      height={320}
    >
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="date" {...AXIS} />
            <YAxis
              yAxisId="left"
              {...AXIS}
              tickFormatter={(value) => money(Number(value), { whole: true })}
            />
            <YAxis yAxisId="right" orientation="right" {...AXIS} />
            <Tooltip
              contentStyle={TOOLTIP.contentStyle}
              labelStyle={TOOLTIP.labelStyle}
              formatter={(value, name) => {
                const numValue = Number(value) || 0;
                if (name === revenueLegend) return [money(numValue), name];
                return [numValue, name];
              }}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="prihodki"
              stroke="url(#revenueGradient)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
              name={revenueLegend}
              {...NO_ANIM}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="termini"
              stroke={BRAND.emerald}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
              name={appointmentsLegend}
              {...NO_ANIM}
            />
          </LineChart>
        </ResponsiveContainer>
    </ChartCard>
  );
}

export default memo(RevenueBookingsChart);
