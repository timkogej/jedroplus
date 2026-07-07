import { fetchTableRows } from '@/lib/companyScope';
import { TABLES } from '@/lib/data';
import {
  DateRange,
  getDaysArray,
  formatDate,
  getDayOfWeekIndex,
  DAYS_OF_WEEK,
  WORKING_HOURS,
} from './dateUtils';

// Types for analytics data
export interface AnalyticsMetrics {
  totalRevenue: number;
  averageBookingValue: number;
  occupancyRate: number;
  completionRate: number;
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  revenueGrowth: number;
  bookingGrowth: number;
}

export interface ChartDataPoint {
  date: string;
  fullDate: string;
  prihodki: number;
  termini: number;
}

export interface ServiceChartData {
  name: string;
  value: number;
  color: string;
  revenue: number;
  percentage: number;
}

export interface EmployeeChartData {
  name: string;
  fullName: string;
  termini: number;
  prihodki: number;
  color: string;
  percentage: number;
}

export interface HeatmapData {
  [key: string]: number;
}

export interface HourlyOccupancyData {
  hour: string;
  count: number;
  color: string;
}

export interface ClientGrowthData {
  date: string;
  nove: number;
  skupaj: number;
}

export interface TopPerformer {
  name: string;
  count: number;
  revenue: number;
  color: string;
  initials?: string;
}

export interface RetentionData {
  newClients: number;
  returningClients: number;
  existingClients: number;
  retainedClients: number;
  retentionRate: number;
}

export interface ClientAppointmentDistribution {
  totalClients: number;
  clientsWithOneAppointment: number;
  clientsWithThreeAppointments: number;
  clientsWithFivePlusAppointments: number;
}

export interface StatusData {
  name: string;
  value: number;
  color: string;
}

// Detect appointment schema
function detectAppointmentSchema(row: Record<string, unknown>) {
  const keys = Object.keys(row);
  const pickField = (candidates: string[]) =>
    candidates.find((candidate) => keys.includes(candidate));

  return {
    idField: pickField(['id', 'ID', 'ID termina']),
    dateField: pickField(['datum', 'Datum', 'date']),
    timeStartField: pickField(['Čas', 'cas_zacetek', 'Čas začetka', 'time_start', 'Ura']),
    timeEndField: pickField(['Konec', 'cas_konec', 'Čas konca', 'time_end']),
    statusField: pickField(['status', 'Status']),
    serviceIdField: pickField(['ID storitve', 'ID storitev', 'storitev_id', 'service_id', 'ID_storitve', 'Storitev']),
    employeeIdField: pickField(['ID osebe', 'ID osebja', 'zaposleni_id', 'employee_id', 'ID_osebja', 'Osebje']),
    clientIdField: pickField(['ID stranke', 'stranka_id', 'client_id', 'ID_stranke']),
    priceField: pickField(['cena', 'Cena', 'price']),
  };
}

// Parse appointment from raw row
interface ParsedAppointment {
  id: string;
  datum: string;
  cas_zacetek: string;
  cas_konec: string;
  status: string;
  storitev_id: string;
  zaposleni_id: string;
  stranka_id: string;
  cena: number;
}

function parseAppointment(row: Record<string, unknown>): ParsedAppointment | null {
  const schema = detectAppointmentSchema(row);
  const id = schema.idField ? String(row[schema.idField] ?? '') : '';
  if (!id) return null;

  let cena = 0;
  if (schema.priceField) {
    const priceValue = row[schema.priceField];
    if (typeof priceValue === 'number') {
      cena = priceValue;
    } else if (typeof priceValue === 'string') {
      cena = parseFloat(priceValue) || 0;
    }
  }

  return {
    id,
    datum: schema.dateField ? String(row[schema.dateField] ?? '') : '',
    cas_zacetek: schema.timeStartField ? String(row[schema.timeStartField] ?? '') : '',
    cas_konec: schema.timeEndField ? String(row[schema.timeEndField] ?? '') : '',
    status: schema.statusField ? String(row[schema.statusField] ?? '') : '',
    storitev_id: schema.serviceIdField ? String(row[schema.serviceIdField] ?? '') : '',
    zaposleni_id: schema.employeeIdField ? String(row[schema.employeeIdField] ?? '') : '',
    stranka_id: schema.clientIdField ? String(row[schema.clientIdField] ?? '') : '',
    cena,
  };
}

// Check if appointment is completed
function isCompleted(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes('zaključen') || s.includes('zakljucen') || s.includes('completed') || s.includes('done');
}

// Check if appointment is cancelled
function isCancelled(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes('odpovedan') || s.includes('cancelled') || s.includes('cancel');
}

// Check if appointment is no-show
function isNoShow(status: string): boolean {
  const s = status.toLowerCase();
  return s === 'no_show' || s.includes('ni_prisel') || s.includes('ni prisel');
}

// Check if appointment is pending/scheduled
function isPending(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes('načrtovan') || s.includes('potrjen') || s.includes('scheduled') || s.includes('confirmed') || s.includes('pending');
}

/**
 * Fetch and calculate analytics metrics
 */
export async function fetchAnalyticsMetrics(
  companyId: string,
  dateRange: DateRange,
  previousRange?: DateRange
): Promise<AnalyticsMetrics> {
  // Fetch appointments
  const appointmentsResult = await fetchTableRows<Record<string, unknown>>(
    TABLES.bookings,
    companyId,
    5000
  );

  // Fetch services for pricing
  const servicesResult = await fetchTableRows<Record<string, unknown>>(
    TABLES.services,
    companyId,
    1000
  );

  // Build service price map
  const servicePrices = new Map<string, number>();
  for (const row of servicesResult.data ?? []) {
    const id = String(row['ID storitve'] || row['id'] || row['ID_storitve'] || '');
    const price = Number(row['cena'] || row['Cena'] || row['price'] || 0);
    if (id) {
      servicePrices.set(id, price);
    }
  }

  // Exclude ghost termini (belezi_termin === false) from all analytics
  const validAppointmentRows = (appointmentsResult.data ?? []).filter(
    (a) => a['belezi_termin'] !== false
  );

  // Parse and filter appointments by date range
  const appointments: ParsedAppointment[] = [];
  const previousAppointments: ParsedAppointment[] = [];

  for (const row of validAppointmentRows) {
    const apt = parseAppointment(row);
    if (!apt || !apt.datum) continue;

    const aptDate = new Date(apt.datum);

    // Add service price if not in appointment
    if (apt.cena === 0 && apt.storitev_id) {
      apt.cena = servicePrices.get(apt.storitev_id) || 0;
    }

    // Check current period
    if (aptDate >= dateRange.startDate && aptDate <= dateRange.endDate) {
      appointments.push(apt);
    }

    // Check previous period for comparison
    if (previousRange && aptDate >= previousRange.startDate && aptDate <= previousRange.endDate) {
      previousAppointments.push(apt);
    }
  }

  // Calculate current period metrics
  const completed = appointments.filter((a) => isCompleted(a.status));
  const cancelled = appointments.filter((a) => isCancelled(a.status));

  const totalRevenue = completed.reduce((sum, apt) => sum + apt.cena, 0);
  const averageBookingValue = completed.length > 0 ? totalRevenue / completed.length : 0;
  const completionRate = appointments.length > 0 ? (completed.length / appointments.length) * 100 : 0;

  // Calculate occupancy (simplified - based on completed appointments per working hour)
  const totalWorkingMinutes = getDaysArray(dateRange.startDate, dateRange.endDate).length * 8 * 60; // 8 hours/day
  const bookedMinutes = completed.length * 45; // Assume 45 min average
  const occupancyRate = totalWorkingMinutes > 0 ? (bookedMinutes / totalWorkingMinutes) * 100 : 0;

  // Calculate growth vs previous period
  let revenueGrowth = 0;
  let bookingGrowth = 0;

  if (previousRange) {
    const prevCompleted = previousAppointments.filter((a) => isCompleted(a.status));
    const prevRevenue = prevCompleted.reduce((sum, apt) => sum + apt.cena, 0);

    if (prevRevenue > 0) {
      revenueGrowth = ((totalRevenue - prevRevenue) / prevRevenue) * 100;
    }
    if (prevCompleted.length > 0) {
      bookingGrowth = ((completed.length - prevCompleted.length) / prevCompleted.length) * 100;
    }
  }

  return {
    totalRevenue,
    averageBookingValue,
    occupancyRate: Math.min(occupancyRate, 100),
    completionRate,
    totalAppointments: appointments.length,
    completedAppointments: completed.length,
    cancelledAppointments: cancelled.length,
    revenueGrowth,
    bookingGrowth,
  };
}

/**
 * Fetch revenue and bookings chart data
 */
export async function fetchRevenueChartData(
  companyId: string,
  dateRange: DateRange
): Promise<ChartDataPoint[]> {
  const appointmentsResult = await fetchTableRows<Record<string, unknown>>(
    TABLES.bookings,
    companyId,
    5000
  );

  const servicesResult = await fetchTableRows<Record<string, unknown>>(
    TABLES.services,
    companyId,
    1000
  );

  // Build service price map
  const servicePrices = new Map<string, number>();
  for (const row of servicesResult.data ?? []) {
    const id = String(row['ID storitve'] || row['id'] || row['ID_storitve'] || '');
    const price = Number(row['cena'] || row['Cena'] || row['price'] || 0);
    if (id) {
      servicePrices.set(id, price);
    }
  }

  const days = getDaysArray(dateRange.startDate, dateRange.endDate);

  return days.map((day) => {
    const dayStr = day.toISOString().split('T')[0];

    const dayAppointments = (appointmentsResult.data ?? [])
      .map(parseAppointment)
      .filter((apt): apt is ParsedAppointment => {
        if (!apt || !apt.datum) return false;
        return apt.datum.startsWith(dayStr) && isCompleted(apt.status);
      });

    const revenue = dayAppointments.reduce((sum, apt) => {
      const price = apt.cena || servicePrices.get(apt.storitev_id) || 0;
      return sum + price;
    }, 0);

    return {
      date: formatDate(day),
      fullDate: formatDate(day, 'dd.MM.yyyy'),
      prihodki: revenue,
      termini: dayAppointments.length,
    };
  });
}

/**
 * Fetch appointments by service chart data
 * Only counts COMPLETED appointments (Status = "completed")
 * Links via "ID storitve" column in Termini to "id" column in Storitve
 */
export async function fetchServiceChartData(
  companyId: string,
  dateRange: DateRange
): Promise<ServiceChartData[]> {
  console.log('[Analytics] Fetching service chart data for period:', {
    start: dateRange.startDate.toISOString(),
    end: dateRange.endDate.toISOString(),
  });

  const appointmentsResult = await fetchTableRows<Record<string, unknown>>(
    TABLES.bookings,
    companyId,
    5000
  );

  const servicesResult = await fetchTableRows<Record<string, unknown>>(
    TABLES.services,
    companyId,
    1000
  );

  // Build service info map using "id" column from Storitve table
  const serviceInfo = new Map<string, { name: string; color: string; price: number }>();
  for (const row of servicesResult.data ?? []) {
    // Primary key is "id" in Storitve table
    const id = String(row['id'] || '');
    const name = String(row['naziv'] || row['Naziv'] || row['name'] || 'Neznana storitev');
    const color = String(row['Barva'] || row['barva'] || row['color'] || '#8B5CF6');
    const price = Number(row['cena'] || row['Cena'] || row['price'] || 0);
    if (id) {
      serviceInfo.set(id, { name, color, price });
    }
  }

  console.log('[Analytics] Service info map:', Array.from(serviceInfo.entries()).slice(0, 5));

  // Count appointments by service - ONLY COMPLETED appointments
  const serviceCounts = new Map<string, { count: number; revenue: number }>();
  let totalServiceOccurrences = 0;

  for (const row of appointmentsResult.data ?? []) {
    const apt = parseAppointment(row);
    if (!apt || !apt.datum) continue;

    const aptDate = new Date(apt.datum);
    if (aptDate < dateRange.startDate || aptDate > dateRange.endDate) continue;

    // CRITICAL: Only count COMPLETED appointments
    if (!isCompleted(apt.status)) continue;

    // Get price from Final cena if available
    const finalPrice = Number(row['Final cena'] || 0);
    const basePrice = apt.cena || 0;

    // Count primary service using "ID storitve" column from Termini
    const service1 = String(row['ID storitve'] || row['ID storitev'] || '');
    if (service1) {
      const existing = serviceCounts.get(service1) || { count: 0, revenue: 0 };
      const price = finalPrice || basePrice || serviceInfo.get(service1)?.price || 0;
      serviceCounts.set(service1, {
        count: existing.count + 1,
        revenue: existing.revenue + price,
      });
      totalServiceOccurrences++;
    }

    // Count second service (ID storitve 2) if exists
    const service2 = String(row['ID storitve 2'] || '');
    if (service2) {
      const existing = serviceCounts.get(service2) || { count: 0, revenue: 0 };
      const price = serviceInfo.get(service2)?.price || 0;
      serviceCounts.set(service2, {
        count: existing.count + 1,
        revenue: existing.revenue + price,
      });
      totalServiceOccurrences++;
    }

    // Count third service (ID storitve 3) if exists
    const service3 = String(row['ID storitve 3'] || '');
    if (service3) {
      const existing = serviceCounts.get(service3) || { count: 0, revenue: 0 };
      const price = serviceInfo.get(service3)?.price || 0;
      serviceCounts.set(service3, {
        count: existing.count + 1,
        revenue: existing.revenue + price,
      });
      totalServiceOccurrences++;
    }

    // Count add-on service if exists
    const addOnService = String(row['add_on_storitev_id'] || row['add_on_service_id'] || '').trim();
    if (addOnService && addOnService !== 'null') {
      const existing = serviceCounts.get(addOnService) || { count: 0, revenue: 0 };
      const price = serviceInfo.get(addOnService)?.price || 0;
      serviceCounts.set(addOnService, {
        count: existing.count + 1,
        revenue: existing.revenue + price,
      });
      totalServiceOccurrences++;
    }
  }

  console.log('[Analytics] Total completed service occurrences:', totalServiceOccurrences);
  console.log('[Analytics] Unique services found:', serviceCounts.size);

  // Convert to chart data with percentages
  const data: ServiceChartData[] = [];
  serviceCounts.forEach((counts, serviceId) => {
    const info = serviceInfo.get(serviceId);
    const percentage = totalServiceOccurrences > 0
      ? Number(((counts.count / totalServiceOccurrences) * 100).toFixed(1))
      : 0;

    data.push({
      name: info?.name || 'Neznana storitev',
      value: counts.count,
      color: info?.color || '#8B5CF6',
      revenue: counts.revenue,
      percentage,
    });
  });

  const sortedData = data.sort((a, b) => b.value - a.value);
  console.log('[Analytics] Service chart data:', sortedData.slice(0, 5));

  return sortedData;
}

/**
 * Fetch appointments by employee chart data
 * Only counts COMPLETED appointments (Status = "completed")
 * Links via "ID osebe" column in Termini to "id" column in Osebe
 */
export async function fetchEmployeeChartData(
  companyId: string,
  dateRange: DateRange
): Promise<EmployeeChartData[]> {
  console.log('[Analytics] Fetching employee chart data for period:', {
    start: dateRange.startDate.toISOString(),
    end: dateRange.endDate.toISOString(),
  });

  const appointmentsResult = await fetchTableRows<Record<string, unknown>>(
    TABLES.bookings,
    companyId,
    5000
  );

  const employeesResult = await fetchTableRows<Record<string, unknown>>(
    TABLES.staff,
    companyId,
    1000
  );

  const servicesResult = await fetchTableRows<Record<string, unknown>>(
    TABLES.services,
    companyId,
    1000
  );

  // Build employee info map using "id" column from Osebe table
  const employeeInfo = new Map<string, { name: string; color: string }>();
  for (const row of employeesResult.data ?? []) {
    // Primary key is "id" in Osebe table
    const id = String(row['id'] || '');
    const ime = String(row['ime'] || row['Ime'] || '');
    const priimek = String(row['priimek'] || row['Priimek'] || '');
    const color = String(row['Barva'] || row['barva'] || row['color'] || '#8B5CF6');
    if (id) {
      employeeInfo.set(id, {
        name: `${ime} ${priimek}`.trim() || 'Neznan zaposleni',
        color,
      });
    }
  }

  console.log('[Analytics] Employee info map:', Array.from(employeeInfo.entries()).slice(0, 5));

  // Build service price map using "id" column from Storitve
  const servicePrices = new Map<string, number>();
  for (const row of servicesResult.data ?? []) {
    const id = String(row['id'] || '');
    const price = Number(row['cena'] || row['Cena'] || row['price'] || 0);
    if (id) {
      servicePrices.set(id, price);
    }
  }

  // Count appointments by employee - ONLY COMPLETED
  // Uses "ID osebe" column from Termini table
  const employeeCounts = new Map<string, { count: number; revenue: number }>();
  let totalCompletedAppointments = 0;

  for (const row of appointmentsResult.data ?? []) {
    const apt = parseAppointment(row);
    if (!apt || !apt.datum) continue;

    const aptDate = new Date(apt.datum);
    if (aptDate < dateRange.startDate || aptDate > dateRange.endDate) continue;

    // CRITICAL: Only count COMPLETED appointments for employee stats
    if (!isCompleted(apt.status)) continue;

    // Get employee ID from "ID osebe" column in Termini (try multiple variations)
    const employeeId = String(row['ID osebe'] || row['ID Osebe'] || row['ID osebja'] || row['assigned_person_id'] || row['oseba_id'] || row['person_id'] || apt.zaposleni_id || '');
    if (!employeeId) continue;

    // Get price from Final cena if available
    const finalPrice = Number(row['Final cena'] || 0);
    const serviceId = String(row['ID storitve'] || row['ID storitev'] || apt.storitev_id || '');
    const basePrice = apt.cena || servicePrices.get(serviceId) || 0;

    const existing = employeeCounts.get(employeeId) || { count: 0, revenue: 0 };
    employeeCounts.set(employeeId, {
      count: existing.count + 1,
      revenue: existing.revenue + (finalPrice || basePrice),
    });
    totalCompletedAppointments++;
  }

  console.log('[Analytics] Total completed appointments:', totalCompletedAppointments);
  console.log('[Analytics] Unique employees found:', employeeCounts.size);

  // Convert to chart data with colors and percentages
  const data: EmployeeChartData[] = [];
  employeeCounts.forEach((counts, employeeId) => {
    const info = employeeInfo.get(employeeId);
    const fullName = info?.name || 'Neznan zaposleni';
    const percentage = totalCompletedAppointments > 0
      ? Number(((counts.count / totalCompletedAppointments) * 100).toFixed(1))
      : 0;

    data.push({
      name: fullName.length > 15 ? fullName.substring(0, 15) + '...' : fullName,
      fullName,
      termini: counts.count,
      prihodki: counts.revenue,
      color: info?.color || '#8B5CF6',
      percentage,
    });
  });

  const sortedData = data.sort((a, b) => b.termini - a.termini);
  console.log('[Analytics] Employee chart data:', sortedData.slice(0, 5));

  return sortedData;
}

// Parse "HH:MM" or "HH:MM:SS" to total minutes from midnight. Returns -1 on failure.
function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return -1;
  // Handle ISO datetime strings
  const t = timeStr.includes('T') ? timeStr.split('T')[1] : timeStr;
  const parts = t.split(':');
  if (parts.length < 2) return -1;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return -1;
  return hours * 60 + minutes;
}

/**
 * Fetch hourly occupancy heatmap data.
 * For each appointment, spreads its full time range (Čas → Konec) across
 * all overlapping working-hour slots. Returns each slot's share (%) of the
 * total appointment minutes across the whole period.
 */
export async function fetchHeatmapData(
  companyId: string,
  dateRange: DateRange
): Promise<HeatmapData> {
  const appointmentsResult = await fetchTableRows<Record<string, unknown>>(
    TABLES.bookings,
    companyId,
    5000
  );

  // Accumulate minutes per (dayOfWeek, hour) slot
  const gridMinutes: { [key: string]: number } = {};
  DAYS_OF_WEEK.forEach((_, dayIndex) => {
    WORKING_HOURS.forEach((hour) => {
      gridMinutes[`${dayIndex}-${hour}`] = 0;
    });
  });

  let totalMinutes = 0;

  for (const row of appointmentsResult.data ?? []) {
    const apt = parseAppointment(row);
    if (!apt || !apt.datum) continue;

    // Filter by date range
    const aptDate = new Date(apt.datum);
    if (isNaN(aptDate.getTime())) continue;
    if (aptDate < dateRange.startDate || aptDate > dateRange.endDate) continue;

    const startMin = parseTimeToMinutes(apt.cas_zacetek);
    const endMin = parseTimeToMinutes(apt.cas_konec);

    // Need valid start and end; end must be after start
    if (startMin < 0 || endMin <= startMin) continue;

    const dayIndex = getDayOfWeekIndex(aptDate);

    // Distribute minutes across every overlapping working-hour slot
    for (const hour of WORKING_HOURS) {
      const slotStart = hour * 60;
      const slotEnd = (hour + 1) * 60;
      const overlapStart = Math.max(startMin, slotStart);
      const overlapEnd = Math.min(endMin, slotEnd);
      const overlap = Math.max(0, overlapEnd - overlapStart);
      if (overlap > 0) {
        const key = `${dayIndex}-${hour}`;
        gridMinutes[key] += overlap;
        totalMinutes += overlap;
      }
    }
  }

  // Convert accumulated minutes to percentage of total
  const grid: HeatmapData = {};
  for (const key of Object.keys(gridMinutes)) {
    grid[key] = totalMinutes > 0
      ? Number(((gridMinutes[key] / totalMinutes) * 100).toFixed(2))
      : 0;
  }

  return grid;
}

/**
 * Fetch hourly occupancy bar chart data with violet gradient colors
 * CRITICAL FIX: Shows busiest hours with violet color intensity
 */
export async function fetchHourlyOccupancyData(
  companyId: string,
  dateRange: DateRange
): Promise<HourlyOccupancyData[]> {
  console.log('[Analytics] Fetching hourly occupancy data for period:', {
    start: dateRange.startDate.toISOString(),
    end: dateRange.endDate.toISOString(),
  });

  const appointmentsResult = await fetchTableRows<Record<string, unknown>>(
    TABLES.bookings,
    companyId,
    5000
  );

  // Count appointments by hour
  const hourCounts = new Map<number, number>();

  for (const row of appointmentsResult.data ?? []) {
    const apt = parseAppointment(row);
    if (!apt || !apt.datum || !apt.cas_zacetek) continue;

    const aptDate = new Date(apt.datum);
    if (aptDate < dateRange.startDate || aptDate > dateRange.endDate) continue;

    const hourStr = apt.cas_zacetek.split(':')[0];
    const hour = parseInt(hourStr, 10);

    if (hour >= 6 && hour <= 22) {
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }
  }

  // Find max count for color scaling
  const maxCount = Math.max(...Array.from(hourCounts.values()), 1);

  // Create data for all hours (6-22) with violet gradient colors
  const hourlyData: HourlyOccupancyData[] = [];
  for (let hour = 6; hour <= 22; hour++) {
    const count = hourCounts.get(hour) || 0;
    const intensity = maxCount > 0 ? count / maxCount : 0;

    // Violet gradient based on intensity
    let color: string;
    if (intensity > 0.7) {
      color = '#8B5CF6'; // Violet for busiest
    } else if (intensity > 0.4) {
      color = '#A78BFA'; // Light violet
    } else if (intensity > 0.2) {
      color = '#C4B5FD'; // Very light violet
    } else if (intensity > 0) {
      color = '#E9D5FF'; // Pale violet for low activity
    } else {
      color = '#F3F4F6'; // Gray for no activity
    }

    hourlyData.push({
      hour: `${hour}:00`,
      count,
      color,
    });
  }

  console.log('[Analytics] Hourly occupancy data:', hourlyData);
  return hourlyData;
}

/**
 * Fetch client growth chart data
 */
export async function fetchClientGrowthData(
  companyId: string,
  dateRange: DateRange
): Promise<ClientGrowthData[]> {
  const clientsResult = await fetchTableRows<Record<string, unknown>>(
    TABLES.clients,
    companyId,
    5000
  );

  const days = getDaysArray(dateRange.startDate, dateRange.endDate);
  let cumulative = 0;

  // Count clients created before the start date
  // Support multiple column names including "Datum vpisa"
  for (const row of clientsResult.data ?? []) {
    const createdAt = String(
      row['Datum vpisa'] ||
      row['datum_vpisa'] ||
      row['created_at'] ||
      row['Created'] ||
      row['datum_vnosa'] ||
      ''
    );
    if (createdAt) {
      const createdDate = new Date(createdAt);
      if (createdDate < dateRange.startDate) {
        cumulative++;
      }
    }
  }

  return days.map((day) => {
    const dayStr = day.toISOString().split('T')[0];

    const newClients = (clientsResult.data ?? []).filter((row) => {
      const createdAt = String(
        row['Datum vpisa'] ||
        row['datum_vpisa'] ||
        row['created_at'] ||
        row['Created'] ||
        row['datum_vnosa'] ||
        ''
      );
      return createdAt && createdAt.startsWith(dayStr);
    }).length;

    cumulative += newClients;

    return {
      date: formatDate(day),
      nove: newClients,
      skupaj: cumulative,
    };
  });
}

/**
 * Fetch top performers data
 * CRITICAL FIX: Include colors and initials for employees
 */
export async function fetchTopPerformers(
  companyId: string,
  dateRange: DateRange
): Promise<{ services: TopPerformer[]; employees: TopPerformer[] }> {
  console.log('[Analytics] Fetching top performers for period:', {
    start: dateRange.startDate.toISOString(),
    end: dateRange.endDate.toISOString(),
  });

  const serviceData = await fetchServiceChartData(companyId, dateRange);
  const employeeData = await fetchEmployeeChartData(companyId, dateRange);

  const topServices: TopPerformer[] = serviceData.slice(0, 5).map((s) => ({
    name: s.name,
    count: s.value,
    revenue: s.revenue,
    color: s.color,
  }));

  const topEmployees: TopPerformer[] = employeeData.slice(0, 5).map((e) => {
    // Generate initials from full name
    const nameParts = e.fullName.split(' ').filter(Boolean);
    const initials = nameParts.length >= 2
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : e.fullName.substring(0, 2).toUpperCase();

    return {
      name: e.fullName,
      count: e.termini,
      revenue: e.prihodki,
      color: e.color,
      initials,
    };
  });

  console.log('[Analytics] Top services:', topServices);
  console.log('[Analytics] Top employees:', topEmployees);

  return { services: topServices, employees: topEmployees };
}

/**
 * Fetch retention and status data
 * CRITICAL FIX: Correct retention logic
 * - Existing clients = all clients EXCEPT those added in selected period
 * - Retained clients = existing clients who had appointments in period
 * - Retention rate = retained / existing
 */
export async function fetchRetentionData(
  companyId: string,
  dateRange: DateRange
): Promise<{ retention: RetentionData; statuses: StatusData[] }> {
  console.log('[Analytics] Fetching retention data for period:', {
    start: dateRange.startDate.toISOString(),
    end: dateRange.endDate.toISOString(),
  });

  const appointmentsResult = await fetchTableRows<Record<string, unknown>>(
    TABLES.bookings,
    companyId,
    5000
  );

  const clientsResult = await fetchTableRows<Record<string, unknown>>(
    TABLES.clients,
    companyId,
    5000
  );

  const allClients = clientsResult.data ?? [];
  const totalClients = allClients.length;

  // Separate clients into NEW (created in period) and EXISTING (created before period)
  const newClientIds = new Set<string>();
  const existingClientIds = new Set<string>();

  for (const row of allClients) {
    const clientId = String(row['id'] || row['ID stranke'] || row['ID_stranke'] || '');
    if (!clientId) continue;

    const createdAt = String(
      row['Datum vpisa'] ||
      row['datum_vpisa'] ||
      row['created_at'] ||
      row['Created'] ||
      row['datum_vnosa'] ||
      ''
    );

    if (createdAt) {
      const createdDate = new Date(createdAt);
      if (createdDate >= dateRange.startDate && createdDate <= dateRange.endDate) {
        newClientIds.add(clientId);
      } else {
        existingClientIds.add(clientId);
      }
    } else {
      // If no date, assume existing
      existingClientIds.add(clientId);
    }
  }

  const newClients = newClientIds.size;
  const existingClients = existingClientIds.size;

  // Parse appointments in date range and track which existing clients had appointments
  const periodAppointments: ParsedAppointment[] = [];
  const existingClientsWithAppointments = new Set<string>();

  for (const row of appointmentsResult.data ?? []) {
    const apt = parseAppointment(row);
    if (!apt || !apt.datum) continue;

    const aptDate = new Date(apt.datum);
    if (aptDate < dateRange.startDate || aptDate > dateRange.endDate) continue;

    periodAppointments.push(apt);

    // Track if this existing client had an appointment in the period
    if (apt.stranka_id && existingClientIds.has(apt.stranka_id)) {
      existingClientsWithAppointments.add(apt.stranka_id);
    }
  }

  // Retained clients = existing clients who had appointments in period
  const retainedClients = existingClientsWithAppointments.size;

  // Retention rate = retained / existing (not total)
  const retentionRate = existingClients > 0
    ? Number(((retainedClients / existingClients) * 100).toFixed(1))
    : 0;

  console.log('[Analytics] Retention data:', {
    totalClients,
    newClients,
    existingClients,
    retainedClients,
    retentionRate,
  });

  // Count statuses
  let completed = 0;
  let pending = 0;
  let cancelled = 0;
  let noShow = 0;

  periodAppointments.forEach((apt) => {
    if (isCompleted(apt.status)) completed++;
    else if (isNoShow(apt.status)) noShow++;
    else if (isCancelled(apt.status)) cancelled++;
    else pending++;
  });

  return {
    retention: {
      newClients,
      returningClients: retainedClients, // For backwards compatibility
      existingClients,
      retainedClients,
      retentionRate,
    },
    statuses: [
      { name: 'Zaključeni', value: completed, color: '#6B7280' },
      { name: 'Načrtovani', value: pending, color: '#10B981' },
      { name: 'Odpovedani', value: cancelled, color: '#EF4444' },
      { name: 'Ni prišel', value: noShow, color: '#F59E0B' },
    ],
  };
}

/**
 * Fetch client appointment distribution data
 * Shows how many clients have 1, 3, or 5+ appointments
 */
export async function fetchClientAppointmentDistribution(
  companyId: string
): Promise<ClientAppointmentDistribution> {
  console.log('[Analytics] Fetching client appointment distribution');

  const appointmentsResult = await fetchTableRows<Record<string, unknown>>(
    TABLES.bookings,
    companyId,
    10000
  );

  const clientsResult = await fetchTableRows<Record<string, unknown>>(
    TABLES.clients,
    companyId,
    5000
  );

  const totalClients = (clientsResult.data ?? []).length;

  // Count appointments per client
  const appointmentCountByClient = new Map<string, number>();

  for (const row of appointmentsResult.data ?? []) {
    const apt = parseAppointment(row);
    if (!apt || !apt.stranka_id) continue;

    const currentCount = appointmentCountByClient.get(apt.stranka_id) || 0;
    appointmentCountByClient.set(apt.stranka_id, currentCount + 1);
  }

  // Categorize clients by appointment count
  let clientsWithOneAppointment = 0;
  let clientsWithThreeAppointments = 0;
  let clientsWithFivePlusAppointments = 0;

  appointmentCountByClient.forEach((count) => {
    if (count === 1) {
      clientsWithOneAppointment++;
    }
    if (count === 3) {
      clientsWithThreeAppointments++;
    }
    if (count >= 5) {
      clientsWithFivePlusAppointments++;
    }
  });

  console.log('[Analytics] Client appointment distribution:', {
    totalClients,
    clientsWithOneAppointment,
    clientsWithThreeAppointments,
    clientsWithFivePlusAppointments,
  });

  return {
    totalClients,
    clientsWithOneAppointment,
    clientsWithThreeAppointments,
    clientsWithFivePlusAppointments,
  };
}
