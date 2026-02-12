'use client';

import { memo, useState, useEffect } from 'react';
import { TrendUp, CurrencyEur, Clock, CheckCircle } from '@phosphor-icons/react';
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
        title="Skupaj Prihodki"
        value={`€${(metrics?.totalRevenue ?? 0).toFixed(2)}`}
        icon={<TrendUp className="h-6 w-6" weight="bold" />}
        iconColor="black"
        change={metrics?.revenueGrowth}
        changeLabel="vs. prejšnje obdobje"
        isLoading={isLoading}
      />

      {/* Average Booking Value */}
      <MetricCard
        title="Povprečna Vrednost"
        value={`€${(metrics?.averageBookingValue ?? 0).toFixed(2)}`}
        subtitle="Na termin"
        icon={<CurrencyEur className="h-6 w-6" weight="bold" />}
        iconColor="darkGray"
        change={metrics?.bookingGrowth}
        changeLabel="vs. prejšnje obdobje"
        isLoading={isLoading}
      />

      {/* Occupancy Rate */}
      <MetricCard
        title="Stopnja Zasedenosti"
        value={`${(metrics?.occupancyRate ?? 0).toFixed(1)}%`}
        subtitle="Delovnega časa"
        icon={<Clock className="h-6 w-6" weight="bold" />}
        iconColor="mediumGray"
        progressBar={metrics?.occupancyRate ?? 0}
        isLoading={isLoading}
      />

      {/* Completion Rate */}
      <MetricCard
        title="Stopnja Zaključenih"
        value={`${(metrics?.completionRate ?? 0).toFixed(1)}%`}
        subtitle="Terminov"
        icon={<CheckCircle className="h-6 w-6" weight="bold" />}
        iconColor="slate"
        progressBar={metrics?.completionRate ?? 0}
        isLoading={isLoading}
      />
    </div>
  );
}

export default memo(KeyMetricsCards);
