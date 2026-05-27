'use client';

import { memo, useState, useEffect } from 'react';
import { TrendUp, CurrencyEur, Clock, CheckCircle } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import MetricCard from './MetricCard';
import {
  fetchAnalyticsMetrics,
  type AnalyticsMetrics,
} from '@/lib/analytics/calculations';
import {
  type TimePeriod,
  type CustomRange,
  getDateRangeForPeriod,
  getPreviousPeriodRange,
} from '@/lib/analytics/dateUtils';

interface KeyMetricsCardsProps {
  companyId: string;
  timePeriod: TimePeriod;
  customRange?: CustomRange;
}

function KeyMetricsCards({ companyId, timePeriod, customRange }: KeyMetricsCardsProps) {
  const t = useTranslations('analytics');
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const dateRange = getDateRangeForPeriod(timePeriod, customRange);
        const previousRange = getPreviousPeriodRange(timePeriod, dateRange);
        const data = await fetchAnalyticsMetrics(companyId, dateRange, previousRange);
        setMetrics(data);
      } catch (error) {
        console.error('Error fetching metrics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (companyId) {
      fetchData();
    }
  }, [companyId, timePeriod, customRange]);

  return (
    <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {/* Revenue */}
      <MetricCard
        title={t('metrics.totalRevenue')}
        value={`€${(metrics?.totalRevenue ?? 0).toFixed(2)}`}
        icon={<TrendUp className="h-6 w-6" weight="bold" />}
        iconColor="black"
        change={metrics?.revenueGrowth}
        changeLabel={t('metrics.vsPrevious')}
        isLoading={isLoading}
      />

      {/* Average Booking Value */}
      <MetricCard
        title={t('metrics.averageValue')}
        value={`€${(metrics?.averageBookingValue ?? 0).toFixed(2)}`}
        subtitle={t('metrics.perAppointment')}
        icon={<CurrencyEur className="h-6 w-6" weight="bold" />}
        iconColor="darkGray"
        change={metrics?.bookingGrowth}
        changeLabel={t('metrics.vsPrevious')}
        isLoading={isLoading}
      />

      {/* Occupancy Rate */}
      <MetricCard
        title={t('metrics.occupancyRate')}
        value={`${(metrics?.occupancyRate ?? 0).toFixed(1)}%`}
        subtitle={t('metrics.workingTime')}
        icon={<Clock className="h-6 w-6" weight="bold" />}
        iconColor="mediumGray"
        progressBar={metrics?.occupancyRate ?? 0}
        isLoading={isLoading}
      />

      {/* Completion Rate */}
      <MetricCard
        title={t('metrics.completionRate')}
        value={`${(metrics?.completionRate ?? 0).toFixed(1)}%`}
        subtitle={t('metrics.appointments')}
        icon={<CheckCircle className="h-6 w-6" weight="bold" />}
        iconColor="slate"
        progressBar={metrics?.completionRate ?? 0}
        isLoading={isLoading}
      />
    </div>
  );
}

export default memo(KeyMetricsCards);
