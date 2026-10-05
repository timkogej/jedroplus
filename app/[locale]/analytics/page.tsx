'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
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
  PromotionsAnalytics,
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
import { exportAnalyticsToCSV, type AnalyticsCsvLabels } from '@/lib/analytics/exportUtils';
import { GradientSpinner } from '@/components/ui/GradientSpinner';

const CSV_LABEL_KEYS: (keyof AnalyticsCsvLabels)[] = [
  'metric', 'value', 'totalRevenue', 'averageBookingValue', 'occupancyRate',
  'completionRate', 'totalAppointments', 'completedAppointments', 'cancelledAppointments',
  'revenueGrowth', 'bookingGrowth', 'service', 'staff', 'appointmentCount', 'revenue',
  'fileMetrics', 'fileServices', 'fileStaff',
];

export default function AnalyticsPage() {
  const { companyId } = useCompany();
  const tCsv = useTranslations('analytics.csvExport');
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
      }, CSV_LABEL_KEYS.reduce((acc, key) => {
        acc[key] = tCsv(key);
        return acc;
      }, {} as AnalyticsCsvLabels));
    } catch (error) {
      console.error('Error exporting CSV:', error);
    }
  }, [companyId, timePeriod, customRange, tCsv]);

  if (!companyId) {
    return (
      <ProtectedLayout>
        <main className="flex min-h-screen items-center justify-center bg-white">
          <GradientSpinner />
        </main>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <main className="min-h-screen bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
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
        <div className="mb-6">
          <RevenueBookingsChart
            companyId={companyId}
            timePeriod={timePeriod}
            customRange={customRange}
          />
        </div>

        {/* Services & Employees Charts */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
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
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
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
        <div className="mb-6">
          <TopPerformersTable
            companyId={companyId}
            timePeriod={timePeriod}
            customRange={customRange}
          />
        </div>

        {/* Retention & Cancellation */}
        <div className="mb-6">
          <RetentionCancellationAnalysis
            companyId={companyId}
            timePeriod={timePeriod}
            customRange={customRange}
          />
        </div>

        {/* Promotions Analytics */}
          <PromotionsAnalytics companyId={companyId} />
        </div>
      </main>
    </ProtectedLayout>
  );
}
