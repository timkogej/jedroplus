'use client';

import { memo, useState, useEffect } from 'react';
import { Trophy, Medal, Star } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import ChartCard from './ChartCard';
import { fetchTopPerformers, type TopPerformer } from '@/lib/analytics/calculations';
import {
  type TimePeriod,
  type CustomRange,
  getDateRangeForPeriod,
} from '@/lib/analytics/dateUtils';

interface TopPerformersTableProps {
  companyId: string;
  timePeriod: TimePeriod;
  customRange?: CustomRange;
}

function getRankBadge(index: number): React.ReactNode {
  switch (index) {
    case 0:
      return <Trophy className="h-4 w-4 text-yellow-500" weight="fill" />;
    case 1:
      return <Medal className="h-4 w-4 text-gray-400" weight="fill" />;
    case 2:
      return <Star className="h-4 w-4 text-orange-400" weight="fill" />;
    default:
      return null;
  }
}

function TopPerformersTable({ companyId, timePeriod, customRange }: TopPerformersTableProps) {
  const t = useTranslations('analytics');
  const [topServices, setTopServices] = useState<TopPerformer[]>([]);
  const [topEmployees, setTopEmployees] = useState<TopPerformer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const dateRange = getDateRangeForPeriod(timePeriod, customRange);
        const data = await fetchTopPerformers(companyId, dateRange);
        console.log('[TopPerformers] Data received:', data);
        setTopServices(data.services);
        setTopEmployees(data.employees);
      } catch (error) {
        console.error('Error fetching top performers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (companyId) {
      fetchData();
    }
  }, [companyId, timePeriod, customRange]);

  return (
    <ChartCard title={t('topPerformers.title')} isLoading={isLoading} height={220}>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Top Services - with service colors */}
        <div>
          <h4 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-gray-500">{t('topPerformers.services')}</h4>
          {topServices.length === 0 ? (
            <div className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-400">
              {t('topPerformers.noData')}
            </div>
          ) : (
            <div className="space-y-3">
              {topServices.slice(0, 3).map((service, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="tnum w-5 flex-shrink-0 text-lg font-semibold text-gray-300">
                    {index + 1}
                  </div>
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: service.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">{service.name}</div>
                    <div className="text-xs text-gray-500">
                      {t('topPerformers.appointmentCount', { count: service.count })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {getRankBadge(index)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Employees - with employee colors and initials */}
        <div>
          <h4 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-gray-500">{t('topPerformers.staff')}</h4>
          {topEmployees.length === 0 ? (
            <div className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-400">
              {t('topPerformers.noData')}
            </div>
          ) : (
            <div className="space-y-3">
              {topEmployees.slice(0, 3).map((employee, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="tnum w-5 flex-shrink-0 text-lg font-semibold text-gray-300">
                    {index + 1}
                  </div>
                  {/* Gradientne začetnice — brez kroga okoli, kot drugod v aplikaciji. */}
                  <span
                    className="w-8 flex-shrink-0 text-sm font-bold"
                    style={{
                      backgroundImage: employee.color?.includes('gradient')
                        ? employee.color
                        : `linear-gradient(135deg, ${employee.color} 0%, ${employee.color} 100%)`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {employee.initials || employee.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">{employee.name}</div>
                    <div className="text-xs text-gray-500">
                      {t('topPerformers.appointmentCount', { count: employee.count })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {getRankBadge(index)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ChartCard>
  );
}

export default memo(TopPerformersTable);
