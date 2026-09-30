'use client';

import { memo, useState, useEffect } from 'react';
import { useFormat } from '@/hooks/useFormat';
import { TrendUp, CurrencyEur, Clock, CheckCircle } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { MetricGroup } from '@/components/dashboard';
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
  const { money } = useFormat();
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
    <div className="mb-6">
      <MetricGroup
        metrics={[
          {
            label: t('metrics.totalRevenue'),
            value: isLoading ? '—' : money(metrics?.totalRevenue ?? 0),
            icon: TrendUp,
            trend:
              metrics?.revenueGrowth !== undefined
                ? { value: metrics.revenueGrowth, isPositive: metrics.revenueGrowth >= 0 }
                : undefined,
            caption: t('metrics.vsPrevious'),
          },
          {
            label: t('metrics.averageValue'),
            value: isLoading ? '—' : money(metrics?.averageBookingValue ?? 0),
            icon: CurrencyEur,
            trend:
              metrics?.bookingGrowth !== undefined
                ? { value: metrics.bookingGrowth, isPositive: metrics.bookingGrowth >= 0 }
                : undefined,
            caption: t('metrics.perAppointment'),
          },
          {
            label: t('metrics.occupancyRate'),
            value: isLoading ? '—' : `${(metrics?.occupancyRate ?? 0).toFixed(1)}%`,
            icon: Clock,
            caption: t('metrics.workingTime'),
          },
          {
            label: t('metrics.completionRate'),
            value: isLoading ? '—' : `${(metrics?.completionRate ?? 0).toFixed(1)}%`,
            icon: CheckCircle,
            caption: t('metrics.appointments'),
          },
        ]}
      />
    </div>
  );
}

export default memo(KeyMetricsCards);
