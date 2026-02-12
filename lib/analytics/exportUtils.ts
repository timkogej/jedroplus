import { format } from 'date-fns';
import { sl } from 'date-fns/locale';
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
 * Export analytics report to CSV
 */
export function exportAnalyticsToCSV(
  metrics: AnalyticsMetrics,
  services: ServiceChartData[],
  employees: EmployeeChartData[],
  dateRange: { start: Date; end: Date }
): void {
  const dateStr = format(new Date(), 'yyyy-MM-dd', { locale: sl });
  const periodStr = `${format(dateRange.start, 'dd.MM.yyyy')}-${format(dateRange.end, 'dd.MM.yyyy')}`;

  // Prepare metrics data
  const metricsData = [
    { Metrika: 'Skupaj Prihodki', Vrednost: `€${metrics.totalRevenue.toFixed(2)}` },
    { Metrika: 'Povprečna Vrednost Termina', Vrednost: `€${metrics.averageBookingValue.toFixed(2)}` },
    { Metrika: 'Stopnja Zasedenosti', Vrednost: `${metrics.occupancyRate.toFixed(1)}%` },
    { Metrika: 'Stopnja Zaključenih', Vrednost: `${metrics.completionRate.toFixed(1)}%` },
    { Metrika: 'Skupaj Terminov', Vrednost: metrics.totalAppointments.toString() },
    { Metrika: 'Zaključenih Terminov', Vrednost: metrics.completedAppointments.toString() },
    { Metrika: 'Odpovedanih Terminov', Vrednost: metrics.cancelledAppointments.toString() },
    { Metrika: 'Rast Prihodkov', Vrednost: `${metrics.revenueGrowth.toFixed(1)}%` },
    { Metrika: 'Rast Terminov', Vrednost: `${metrics.bookingGrowth.toFixed(1)}%` },
  ];

  // Prepare services data
  const servicesData = services.map((s) => ({
    Storitev: s.name,
    'Število Terminov': s.value,
    Prihodki: `€${s.revenue.toFixed(2)}`,
  }));

  // Prepare employees data
  const employeesData = employees.map((e) => ({
    Osebje: e.fullName,
    'Število Terminov': e.termini,
    Prihodki: `€${e.prihodki.toFixed(2)}`,
  }));

  // Export each section
  exportToCSV(metricsData, `analitika-metrike-${periodStr}-${dateStr}`);
  exportToCSV(servicesData, `analitika-storitve-${periodStr}-${dateStr}`);
  exportToCSV(employeesData, `analitika-osebje-${periodStr}-${dateStr}`);
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
