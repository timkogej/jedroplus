import { format } from 'date-fns';
import type { AnalyticsMetrics, ServiceChartData, EmployeeChartData, TopPerformer } from './calculations';

/**
 * Export data to CSV format
 */
export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string
): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          // Escape commas and quotes
          const stringValue = String(value ?? '');
          if (stringValue.includes(',') || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(',')
    ),
  ];

  const csvContent = csvRows.join('\n');
  downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Labels for the analytics CSV export. Pass translated strings from the
 * `analytics.csvExport` namespace; the Slovenian defaults keep old callers working.
 */
export type AnalyticsCsvLabels = Record<
  | 'metric' | 'value' | 'totalRevenue' | 'averageBookingValue' | 'occupancyRate'
  | 'completionRate' | 'totalAppointments' | 'completedAppointments' | 'cancelledAppointments'
  | 'revenueGrowth' | 'bookingGrowth' | 'service' | 'staff' | 'appointmentCount' | 'revenue'
  | 'fileMetrics' | 'fileServices' | 'fileStaff',
  string
>;

const DEFAULT_CSV_LABELS: AnalyticsCsvLabels = {
  metric: 'Metrika',
  value: 'Vrednost',
  totalRevenue: 'Skupaj Prihodki',
  averageBookingValue: 'Povprečna Vrednost Termina',
  occupancyRate: 'Stopnja Zasedenosti',
  completionRate: 'Stopnja Zaključenih',
  totalAppointments: 'Skupaj Terminov',
  completedAppointments: 'Zaključenih Terminov',
  cancelledAppointments: 'Odpovedanih Terminov',
  revenueGrowth: 'Rast Prihodkov',
  bookingGrowth: 'Rast Terminov',
  service: 'Storitev',
  staff: 'Osebje',
  appointmentCount: 'Število Terminov',
  revenue: 'Prihodki',
  fileMetrics: 'analitika-metrike',
  fileServices: 'analitika-storitve',
  fileStaff: 'analitika-osebje',
};

/**
 * Export analytics report to CSV
 */
export function exportAnalyticsToCSV(
  metrics: AnalyticsMetrics,
  services: ServiceChartData[],
  employees: EmployeeChartData[],
  dateRange: { start: Date; end: Date },
  labels: AnalyticsCsvLabels = DEFAULT_CSV_LABELS
): void {
  const L = labels;
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const periodStr = `${format(dateRange.start, 'dd.MM.yyyy')}-${format(dateRange.end, 'dd.MM.yyyy')}`;
  const row = (metric: string, value: string) => ({ [L.metric]: metric, [L.value]: value });

  // Prepare metrics data
  const metricsData = [
    row(L.totalRevenue, `€${metrics.totalRevenue.toFixed(2)}`),
    row(L.averageBookingValue, `€${metrics.averageBookingValue.toFixed(2)}`),
    row(L.occupancyRate, `${metrics.occupancyRate.toFixed(1)}%`),
    row(L.completionRate, `${metrics.completionRate.toFixed(1)}%`),
    row(L.totalAppointments, metrics.totalAppointments.toString()),
    row(L.completedAppointments, metrics.completedAppointments.toString()),
    row(L.cancelledAppointments, metrics.cancelledAppointments.toString()),
    row(L.revenueGrowth, `${metrics.revenueGrowth.toFixed(1)}%`),
    row(L.bookingGrowth, `${metrics.bookingGrowth.toFixed(1)}%`),
  ];

  // Prepare services data
  const servicesData = services.map((s) => ({
    [L.service]: s.name,
    [L.appointmentCount]: s.value,
    [L.revenue]: `€${s.revenue.toFixed(2)}`,
  }));

  // Prepare employees data
  const employeesData = employees.map((e) => ({
    [L.staff]: e.fullName,
    [L.appointmentCount]: e.termini,
    [L.revenue]: `€${e.prihodki.toFixed(2)}`,
  }));

  // Export each section
  exportToCSV(metricsData, `${L.fileMetrics}-${periodStr}-${dateStr}`);
  exportToCSV(servicesData, `${L.fileServices}-${periodStr}-${dateStr}`);
  exportToCSV(employeesData, `${L.fileStaff}-${periodStr}-${dateStr}`);
}

/**
 * Download file helper
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('sl-SI', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format number with thousand separators
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('sl-SI').format(value);
}
