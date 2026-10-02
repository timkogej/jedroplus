'use client';

import { memo, useState, useEffect, useId } from 'react';
import { useFormat } from '@/hooks/useFormat';
import { useTranslations } from 'next-intl';
import ChartCard from './ChartCard';
import { TOOLTIP, NO_ANIM } from './chartTheme';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchEmployeeChartData, type EmployeeChartData } from '@/lib/analytics/calculations';
import {
  type TimePeriod,
  type CustomRange,
  getDateRangeForPeriod,
} from '@/lib/analytics/dateUtils';
import { parseLinearGradient, getSvgGradientCoords } from '@/components/analytics/gradientUtils';

interface AppointmentsByEmployeeChartProps {
  companyId: string;
  timePeriod: TimePeriod;
  customRange?: CustomRange;
}

function AppointmentsByEmployeeChart({
  companyId,
  timePeriod,
  customRange,
}: AppointmentsByEmployeeChartProps) {
  const { money } = useFormat();
  const t = useTranslations('analytics');
  const [chartData, setChartData] = useState<EmployeeChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const gradientIdPrefix = useId().replace(/:/g, '');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const dateRange = getDateRangeForPeriod(timePeriod, customRange);
        const data = await fetchEmployeeChartData(companyId, dateRange);
        console.log('[EmployeeChart] Data received:', data);
        setChartData(data);
      } catch (error) {
        console.error('Error fetching employee chart data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (companyId) {
      fetchData();
    }
  }, [companyId, timePeriod, customRange]);

  // Transform data for pie chart
  const pieData = chartData.slice(0, 8).map((e) => ({
    name: e.fullName,
    value: e.termini,
    color: e.color,
    prihodki: e.prihodki,
    percentage: e.percentage,
  }));
  const slices = pieData.map((entry, index) => {
    const gradient = parseLinearGradient(entry.color);
    const gradientId = `${gradientIdPrefix}-employee-${index}`;
    return {
      ...entry,
      gradient,
      gradientId,
      fill: gradient ? `url(#${gradientId})` : entry.color,
    };
  });

  const tooltipLabel = t('employeeChart.tooltipAppointments');

  return (
    <ChartCard
      title={t('employeeChart.title')}
      subtitle={t('employeeChart.subtitle')}
      isLoading={isLoading}
      isEmpty={chartData.length === 0}
      emptyLabel={t('employeeChart.noData')}
      height={250}
      skeletonShape="circle"
    >
      <>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <defs>
                {slices.map((entry) => {
                  if (!entry.gradient) return null;
                  const coords = getSvgGradientCoords(entry.gradient.angle);
                  return (
                    <linearGradient
                      key={entry.gradientId}
                      id={entry.gradientId}
                      x1={coords.x1}
                      y1={coords.y1}
                      x2={coords.x2}
                      y2={coords.y2}
                    >
                      {entry.gradient.stops.map((stop, stopIndex) => (
                        <stop
                          key={`${entry.gradientId}-${stopIndex}`}
                          offset={`${stop.offset * 100}%`}
                          stopColor={stop.color}
                        />
                      ))}
                    </linearGradient>
                  );
                })}
              </defs>
              <Pie
                data={slices as any[]}
                cx="50%"
                cy="50%"
                labelLine={false}
                innerRadius={52}
                outerRadius={82}
                paddingAngle={2}
                fill="#8884d8"
                dataKey="value"
                {...NO_ANIM}
              >
                {slices.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={TOOLTIP.contentStyle}
                labelStyle={TOOLTIP.labelStyle}
                formatter={(value, name) => {
                  const entry = pieData.find((d) => d.name === name);
                  return [
                    <div key="tooltip" className="space-y-1">
                      <div className="font-semibold">{value} {tooltipLabel}</div>
                      <div className="text-gray-500">{money(entry?.prihodki ?? 0)}</div>
                      <div className="text-gray-500">{entry?.percentage}%</div>
                    </div>,
                    String(name),
                  ];
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend with counts and employee colors */}
          <div className="mt-4 space-y-2">
            {chartData.slice(0, 5).map((employee, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-bold"
                    style={{
                      background: employee.color,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    {employee.fullName.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </span>
                  <span className="text-sm text-gray-700">{employee.fullName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900">{employee.termini}</span>
                  <span className="text-xs text-gray-500">
                    {employee.percentage}%
                  </span>
                </div>
              </div>
            ))}
            {chartData.length > 5 && (
              <div className="text-center text-xs text-gray-500">
                {t('employeeChart.moreEmployees', { count: chartData.length - 5 })}
              </div>
            )}
          </div>
      </>
    </ChartCard>
  );
}

export default memo(AppointmentsByEmployeeChart);
