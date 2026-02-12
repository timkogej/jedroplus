'use client';

import { useState, useCallback } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import {
  AnalyticsHeader,
  KeyMetricsCards,
  RevenueBookingsChart,
  AppointmentsByServiceChart,
  AppointmentsByEmployeeChart,
  HourlyOccupancyHeatmap,
  ClientGrowthChart,
  TopPerformersTable,
  RetentionCancellationAnalysis,
} from '@/components/analytics';
import {
  type TimePeriod,
  type CustomRange,
  getDateRangeForPeriod,
  getPreviousPeriodRange,
} from '@/lib/analytics/dateUtils';
import {
  fetchServiceChartData,
  fetchEmployeeChartData,
  fetchAnalyticsMetrics,
} from '@/lib/analytics/calculations';
import { exportAnalyticsToCSV } from '@/lib/analytics/exportUtils';

export default function AnalyticsPage() {
  const { companyId } = useCompany();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('ta_mesec');
  const [customRange, setCustomRange] = useState<CustomRange>({ start: null, end: null });

  const handleExportCSV = useCallback(async () => {
    if (!companyId) return;

    try {
      const dateRange = getDateRangeForPeriod(timePeriod, customRange);
      const previousRange = getPreviousPeriodRange(timePeriod, dateRange);

      const [metrics, services, employees] = await Promise.all([
        fetchAnalyticsMetrics(companyId, dateRange, previousRange),
        fetchServiceChartData(companyId, dateRange),
        fetchEmployeeChartData(companyId, dateRange),
      ]);

      exportAnalyticsToCSV(metrics, services, employees, {
        start: dateRange.startDate,
        end: dateRange.endDate,
      });
    } catch (error) {
      console.error('Error exporting CSV:', error);
    }
  }, [companyId, timePeriod, customRange]);

  if (!companyId) {
    return (
      <ProtectedLayout>
        <main className="flex min-h-screen items-center justify-center bg-white">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
        </main>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <main className="mx-auto w-full max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8 bg-white min-h-screen">
        {/* Header with Time Filters */}
        <AnalyticsHeader
          timePeriod={timePeriod}
          setTimePeriod={setTimePeriod}
          customRange={customRange}
          setCustomRange={setCustomRange}
          onExportCSV={handleExportCSV}
        />

        {/* Key Metrics */}
        <KeyMetricsCards
          companyId={companyId}
          timePeriod={timePeriod}
          customRange={customRange}
        />

        {/* Revenue & Bookings Chart */}
        <RevenueBookingsChart
          companyId={companyId}
          timePeriod={timePeriod}
          customRange={customRange}
        />

        {/* Services & Employees Charts */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <AppointmentsByServiceChart
            companyId={companyId}
            timePeriod={timePeriod}
            customRange={customRange}
          />
          <AppointmentsByEmployeeChart
            companyId={companyId}
            timePeriod={timePeriod}
            customRange={customRange}
          />
        </div>

        {/* Heatmap & Client Growth */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <HourlyOccupancyHeatmap
            companyId={companyId}
            timePeriod={timePeriod}
            customRange={customRange}
          />
          <ClientGrowthChart
            companyId={companyId}
            timePeriod={timePeriod}
            customRange={customRange}
          />
        </div>

        {/* Top Performers */}
        <TopPerformersTable
          companyId={companyId}
          timePeriod={timePeriod}
          customRange={customRange}
        />

        {/* Retention & Cancellation */}
        <RetentionCancellationAnalysis
          companyId={companyId}
          timePeriod={timePeriod}
          customRange={customRange}
        />
      </main>
    </ProtectedLayout>
  );
}
