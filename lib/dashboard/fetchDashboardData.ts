import { format, startOfMonth, endOfMonth, addDays, subDays } from "date-fns";
import { fetchAllTableRows, fetchTableRows } from "@/lib/companyScope";
import { TABLES } from "@/lib/data";
import { detectBookingSchema, pickFirst } from "@/lib/dashboardHelpers";
import { normalizeCommunicationLanguage, type CommunicationLanguageCode } from "@/lib/communicationLanguage";

// Types for dashboard data
export interface DashboardStats {
  todayAppointments: number;
  activeAppointments: number;
  newClientsThisMonth: number;
  revenueThisMonth: number;
  isOwner: boolean;
}

export interface AppointmentItem {
  id: string;
  time: string;
  endTime?: string;
  datum?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientColor?: string;
  language?: CommunicationLanguageCode;
  clientId?: string;
  serviceName: string;
  serviceColor: string;
  serviceColor2?: string;
  serviceColor3?: string;
  serviceId?: string;
  serviceId2?: string;
  serviceId3?: string;
  addOnServiceId?: string;
  addOnName?: string;
  addOnDuration?: number;
  addOnServiceColor?: string;
  addOnFinalCena?: string;
  employeeName: string;
  employeeInitials: string;
  employeeColor?: string;
  employeeId?: string;
  status: string;
  opombe?: string;
  interneOpombe?: string;
  cena?: number;
}

export interface TopService {
  id: string;
  name: string;
  color: string;
  count: number;
  percentage: number;
}

export interface TopEmployee {
  id: string;
  name: string;
  initials: string;
  color?: string;
  appointmentCount: number;
  percentage: number;
}

export interface RecentActivity {
  id: string;
  type: "booking" | "client" | "cancellation" | "completed";
  description: string;
  timestamp: Date;
  timeAgo: string;
  // Extended fields for completed appointments display
  clientName?: string;
  serviceName?: string;
  startTime?: string;
  endTime?: string;
}

export interface WeeklyChartData {
  day: string;
  date: string;
  termini: number;
}

export interface DashboardData {
  stats: DashboardStats;
  todayAppointments: AppointmentItem[];
  tomorrowAppointments: AppointmentItem[];
  weeklyChart: WeeklyChartData[];
  topServices: TopService[];
  topEmployees: TopEmployee[];
  recentActivity: RecentActivity[];
  nextPersonAppointment?: AppointmentItem | null;
}

// Helper to format time ago
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Pravkar";
  if (diffMins < 60) return `Pred ${diffMins} min`;
  if (diffHours < 24) return `Pred ${diffHours} h`;
  return `Pred ${diffDays} d`;
}

// Helper to get employee initials
function getInitials(firstName: string, lastName: string): string {
  return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase();
}

type DashboardServiceInfo = { naziv: string; barva: string; trajanje: number };

const LANGUAGE_FIELDS = ['language', 'Language', 'Jezik komunikacije', 'jezik_komunikacije', 'Jezik', 'jezik', 'preferred_language'];

function pickLanguage(row: Record<string, unknown>, fallback?: unknown) {
  return normalizeCommunicationLanguage(pickFirst(row, LANGUAGE_FIELDS) ?? fallback);
}

function parseOptionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text && text !== 'null' ? text : undefined;
}

function parseOptionalNumber(value: unknown): number | undefined {
  const text = parseOptionalString(value);
  if (!text) return undefined;
  const numberValue = Number(text);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function extractAppointmentAddOn(
  row: Record<string, unknown>,
  servicesMap: Map<string, DashboardServiceInfo>
) {
  const addOnServiceId = parseOptionalString(pickFirst(row, ['add_on_storitev_id', 'add_on_service_id', 'addOnStoritevId']));
  const addOnName = parseOptionalString(pickFirst(row, ['add_on_naziv', 'add_on_name', 'addOnNaziv']));
  const addOnService = addOnServiceId ? servicesMap.get(addOnServiceId) : undefined;
  const addOnDuration =
    parseOptionalNumber(pickFirst(row, ['add_on_trajanje', 'add_on_duration', 'addOnTrajanje'])) ??
    addOnService?.trajanje;

  return {
    addOnServiceId,
    addOnName,
    addOnDuration,
    addOnServiceColor: addOnService?.barva,
    addOnFinalCena: parseOptionalString(pickFirst(row, ['add_on_final_cena', 'add_on_final_price'])),
  };
}

function getAppointmentTotalCena(row: Record<string, unknown>): number | undefined {
  const main = parseOptionalNumber(pickFirst(row, ['Final cena', 'final_cena', 'koncna_cena', 'cena', 'Cena']));
  const addOn = parseOptionalNumber(pickFirst(row, ['add_on_final_cena', 'add_on_final_price']));
  if (main === undefined && addOn === undefined) return undefined;
  return (main ?? 0) + (addOn ?? 0);
}

// Fetch today's appointments - all scheduled appointments for today, ordered by time
async function fetchTodayAppointments(companyId: string, personId?: string | null): Promise<AppointmentItem[]> {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  console.log('[Dashboard] Fetching today appointments for date:', todayStr);

  try {
    // Use fetchTableRows which properly handles company column detection
    const [bookingsRes, servicesRes, staffRes, clientsRes] = await Promise.all([
      fetchAllTableRows<Record<string, unknown>>(TABLES.bookings, companyId),
      fetchTableRows<Record<string, unknown>>(TABLES.services, companyId, 500),
      fetchTableRows<Record<string, unknown>>(TABLES.staff, companyId, 200),
      fetchTableRows<Record<string, unknown>>(TABLES.clients, companyId, 1000),
    ]);

    if (bookingsRes.error) {
      console.error('[Dashboard] Error fetching bookings:', bookingsRes.error);
      return [];
    }

    const bookings = bookingsRes.data ?? [];
    const services = servicesRes.data ?? [];
    const staff = staffRes.data ?? [];
    const clients = clientsRes.data ?? [];

    // Build lookup maps for services
    const servicesMap = new Map<string, DashboardServiceInfo>();
    for (const s of services) {
      const id = String(pickFirst(s, ['id', 'ID storitev', 'ID storitve', 'service_id']) ?? '');
      const naziv = String(pickFirst(s, ['naziv', 'Naziv', 'name', 'service_name']) ?? '');
      const barva = String(pickFirst(s, ['barva', 'Barva', 'color']) ?? '#8B5CF6');
      const trajanje = parseOptionalNumber(pickFirst(s, ['Trajanje', 'trajanje', 'duration', 'duration_min'])) ?? 0;
      if (id) servicesMap.set(id, { naziv, barva, trajanje });
    }

    // Build lookup maps for employees
    const employeesMap = new Map<string, { ime: string; priimek: string; barva: string }>();
    for (const e of staff) {
      const id = String(pickFirst(e, ['id', 'ID osebja', 'ID osebe', 'person_id', 'partner_id']) ?? '');
      const ime = String(pickFirst(e, ['ime', 'Ime', 'first_name']) ?? '');
      const priimek = String(pickFirst(e, ['priimek', 'Priimek', 'last_name']) ?? '');
      const barva = String(pickFirst(e, ['Barva', 'barva', 'color']) ?? '');
      if (id) employeesMap.set(id, { ime, priimek, barva });
    }

    // Build lookup maps for clients
    const clientsMap = new Map<string, { barva: string; language: CommunicationLanguageCode }>();
    for (const c of clients) {
      const id = String(pickFirst(c, ['id', 'ID stranke', 'client_id']) ?? '');
      const barva = String(pickFirst(c, ['barva', 'Barva', 'color']) ?? '');
      if (id) clientsMap.set(id, { barva, language: pickLanguage(c) });
    }

    // Filter bookings for today with status 'scheduled'
    const todayAppointments: AppointmentItem[] = [];

    for (const row of bookings) {
      const schema = detectBookingSchema(row);

      // Get date from booking
      const dateValue = schema.dateField ? row[schema.dateField] : null;
      if (!dateValue) continue;

      // Parse and compare date
      let bookingDateStr = '';
      if (typeof dateValue === 'string') {
        // Handle various date formats
        if (dateValue.includes('T')) {
          bookingDateStr = dateValue.split('T')[0];
        } else if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
          bookingDateStr = dateValue;
        } else if (dateValue.match(/^\d{1,2}\.\d{1,2}\.\d{4}$/)) {
          const parts = dateValue.split('.');
          bookingDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      if (bookingDateStr !== todayStr) continue;

      // Check status
      const status = String(pickFirst(row, ['status', 'Status', 'stanje']) ?? 'scheduled').toLowerCase();
      if (status !== 'scheduled') continue;

      // Get IDs
      const id = schema.idField ? String(row[schema.idField] ?? '') : '';
      const serviceId = String(pickFirst(row, ['ID storitev', 'ID storitve', 'storitev_id', 'service_id']) ?? '');
      const serviceId2 = String(pickFirst(row, ['ID storitve 2', 'service_id_2', 'storitev_id_2']) ?? '');
      const serviceId3 = String(pickFirst(row, ['ID storitve 3', 'service_id_3', 'storitev_id_3']) ?? '');
      const staffId = String(pickFirst(row, ['ID osebja', 'ID osebe', 'ID Osebe', 'oseba_id', 'person_id']) ?? '');
      const clientId = String(pickFirst(row, ['ID stranke', 'stranka_id', 'client_id']) ?? '');

      // Filter by personId if provided
      if (personId && staffId !== personId) continue;

      // Get time fields
      const startTime = String(pickFirst(row, ['cas_zacetek', 'Čas', 'Cas', 'start_time', 'ura_od']) ?? '00:00');
      const endTime = String(pickFirst(row, ['cas_konec', 'Konec', 'end_time', 'ura_do']) ?? '');

      // Get client name
      const clientName = String(pickFirst(row, ['stranka_ime', 'Stranka', 'client_name', 'Ime stranke']) ?? 'Neznana stranka');
      const clientEmail = String(pickFirst(row, ['Email', 'stranka_email', 'client_email', 'Email stranke', 'email']) ?? '');
      const clientPhone = String(pickFirst(row, ['Telefon', 'stranka_telefon', 'client_phone', 'Telefon stranke', 'Telefonska številka', 'telefon', 'phone']) ?? '');

      // Get related data
      const service = servicesMap.get(serviceId);
      const service2 = serviceId2 ? servicesMap.get(serviceId2) : undefined;
      const service3 = serviceId3 ? servicesMap.get(serviceId3) : undefined;
      const addOn = extractAppointmentAddOn(row, servicesMap);
      const employee = employeesMap.get(staffId);
      const client = clientsMap.get(clientId);

      // Get additional fields
      const opombe = String(pickFirst(row, ['opombe', 'Opombe', 'notes', 'Notes']) ?? '');
      const interneOpombe = String(pickFirst(row, ['interne_opombe', 'Interne opombe', 'internal_notes']) ?? '');
      const cena = getAppointmentTotalCena(row);
      const language = pickLanguage(row, client?.language);

      todayAppointments.push({
        id,
        time: startTime.substring(0, 5),
        endTime: endTime ? endTime.substring(0, 5) : undefined,
        datum: bookingDateStr,
        clientName,
        clientEmail: clientEmail || undefined,
        clientPhone: clientPhone || undefined,
        clientColor: client?.barva || undefined,
        language,
        clientId: clientId || undefined,
        serviceName: service?.naziv || 'Neznana storitev',
        serviceColor: service?.barva || '#8B5CF6',
        serviceColor2: service2?.barva || undefined,
        serviceColor3: service3?.barva || undefined,
        serviceId: serviceId || undefined,
        serviceId2: serviceId2 || undefined,
        serviceId3: serviceId3 || undefined,
        addOnServiceId: addOn.addOnServiceId,
        addOnName: addOn.addOnName,
        addOnDuration: addOn.addOnDuration,
        addOnServiceColor: addOn.addOnServiceColor,
        addOnFinalCena: addOn.addOnFinalCena,
        employeeName: employee ? `${employee.ime} ${employee.priimek}` : 'Nedoločeno',
        employeeInitials: employee ? getInitials(employee.ime, employee.priimek) : '?',
        employeeColor: employee?.barva || undefined,
        employeeId: staffId || undefined,
        status: 'scheduled',
        opombe: opombe || undefined,
        interneOpombe: interneOpombe || undefined,
        cena,
      });
    }

    // Sort by time
    todayAppointments.sort((a, b) => a.time.localeCompare(b.time));

    console.log(`[Dashboard] Found ${todayAppointments.length} appointments for today`);
    return todayAppointments;
  } catch (err) {
    console.error('[Dashboard] Error in fetchTodayAppointments:', err);
    return [];
  }
}

// Fetch tomorrow's appointments - all scheduled appointments for tomorrow, ordered by time
async function fetchTomorrowAppointments(companyId: string, personId?: string | null): Promise<AppointmentItem[]> {
  const tomorrow = addDays(new Date(), 1);
  const tomorrowStr = format(tomorrow, "yyyy-MM-dd");

  console.log('[Dashboard] Fetching tomorrow appointments for date:', tomorrowStr);

  try {
    // Use fetchTableRows which properly handles company column detection
    const [bookingsRes, servicesRes, staffRes, clientsRes] = await Promise.all([
      fetchAllTableRows<Record<string, unknown>>(TABLES.bookings, companyId),
      fetchTableRows<Record<string, unknown>>(TABLES.services, companyId, 500),
      fetchTableRows<Record<string, unknown>>(TABLES.staff, companyId, 200),
      fetchTableRows<Record<string, unknown>>(TABLES.clients, companyId, 1000),
    ]);

    if (bookingsRes.error) {
      console.error('[Dashboard] Error fetching bookings:', bookingsRes.error);
      return [];
    }

    const bookings = bookingsRes.data ?? [];
    const services = servicesRes.data ?? [];
    const staff = staffRes.data ?? [];
    const clients = clientsRes.data ?? [];

    // Build lookup maps for services
    const servicesMap = new Map<string, DashboardServiceInfo>();
    for (const s of services) {
      const id = String(pickFirst(s, ['id', 'ID storitev', 'ID storitve', 'service_id']) ?? '');
      const naziv = String(pickFirst(s, ['naziv', 'Naziv', 'name', 'service_name']) ?? '');
      const barva = String(pickFirst(s, ['barva', 'Barva', 'color']) ?? '#8B5CF6');
      const trajanje = parseOptionalNumber(pickFirst(s, ['Trajanje', 'trajanje', 'duration', 'duration_min'])) ?? 0;
      if (id) servicesMap.set(id, { naziv, barva, trajanje });
    }

    // Build lookup maps for employees
    const employeesMap = new Map<string, { ime: string; priimek: string; barva: string }>();
    for (const e of staff) {
      const id = String(pickFirst(e, ['id', 'ID osebja', 'ID osebe', 'person_id', 'partner_id']) ?? '');
      const ime = String(pickFirst(e, ['ime', 'Ime', 'first_name']) ?? '');
      const priimek = String(pickFirst(e, ['priimek', 'Priimek', 'last_name']) ?? '');
      const barva = String(pickFirst(e, ['Barva', 'barva', 'color']) ?? '');
      if (id) employeesMap.set(id, { ime, priimek, barva });
    }

    // Build lookup maps for clients
    const clientsMap = new Map<string, { barva: string; language: CommunicationLanguageCode }>();
    for (const c of clients) {
      const id = String(pickFirst(c, ['id', 'ID stranke', 'client_id']) ?? '');
      const barva = String(pickFirst(c, ['barva', 'Barva', 'color']) ?? '');
      if (id) clientsMap.set(id, { barva, language: pickLanguage(c) });
    }

    // Filter bookings for tomorrow with status 'scheduled'
    const tomorrowAppointments: AppointmentItem[] = [];

    for (const row of bookings) {
      const schema = detectBookingSchema(row);

      // Get date from booking
      const dateValue = schema.dateField ? row[schema.dateField] : null;
      if (!dateValue) continue;

      // Parse and compare date
      let bookingDateStr = '';
      if (typeof dateValue === 'string') {
        if (dateValue.includes('T')) {
          bookingDateStr = dateValue.split('T')[0];
        } else if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
          bookingDateStr = dateValue;
        } else if (dateValue.match(/^\d{1,2}\.\d{1,2}\.\d{4}$/)) {
          const parts = dateValue.split('.');
          bookingDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      if (bookingDateStr !== tomorrowStr) continue;

      // Check status
      const status = String(pickFirst(row, ['status', 'Status', 'stanje']) ?? 'scheduled').toLowerCase();
      if (status !== 'scheduled') continue;

      // Get IDs
      const id = schema.idField ? String(row[schema.idField] ?? '') : '';
      const serviceId = String(pickFirst(row, ['ID storitev', 'ID storitve', 'storitev_id', 'service_id']) ?? '');
      const serviceId2 = String(pickFirst(row, ['ID storitve 2', 'service_id_2', 'storitev_id_2']) ?? '');
      const serviceId3 = String(pickFirst(row, ['ID storitve 3', 'service_id_3', 'storitev_id_3']) ?? '');
      const staffId = String(pickFirst(row, ['ID osebja', 'ID osebe', 'ID Osebe', 'oseba_id', 'person_id']) ?? '');
      const clientId = String(pickFirst(row, ['ID stranke', 'stranka_id', 'client_id']) ?? '');

      // Filter by personId if provided
      if (personId && staffId !== personId) continue;

      // Get time fields
      const startTime = String(pickFirst(row, ['cas_zacetek', 'Čas', 'Cas', 'start_time', 'ura_od']) ?? '00:00');
      const endTime = String(pickFirst(row, ['cas_konec', 'Konec', 'end_time', 'ura_do']) ?? '');

      // Get client name
      const clientName = String(pickFirst(row, ['stranka_ime', 'Stranka', 'client_name', 'Ime stranke']) ?? 'Neznana stranka');
      const clientEmail = String(pickFirst(row, ['Email', 'stranka_email', 'client_email', 'Email stranke', 'email']) ?? '');
      const clientPhone = String(pickFirst(row, ['Telefon', 'stranka_telefon', 'client_phone', 'Telefon stranke', 'Telefonska številka', 'telefon', 'phone']) ?? '');

      // Get related data
      const service = servicesMap.get(serviceId);
      const service2 = serviceId2 ? servicesMap.get(serviceId2) : undefined;
      const service3 = serviceId3 ? servicesMap.get(serviceId3) : undefined;
      const addOn = extractAppointmentAddOn(row, servicesMap);
      const employee = employeesMap.get(staffId);
      const client = clientsMap.get(clientId);

      // Get additional fields
      const opombe = String(pickFirst(row, ['opombe', 'Opombe', 'notes', 'Notes']) ?? '');
      const interneOpombe = String(pickFirst(row, ['interne_opombe', 'Interne opombe', 'internal_notes']) ?? '');
      const cena = getAppointmentTotalCena(row);
      const language = pickLanguage(row, client?.language);

      tomorrowAppointments.push({
        id,
        time: startTime.substring(0, 5),
        endTime: endTime ? endTime.substring(0, 5) : undefined,
        datum: bookingDateStr,
        clientName,
        clientEmail: clientEmail || undefined,
        clientPhone: clientPhone || undefined,
        clientColor: client?.barva || undefined,
        language,
        clientId: clientId || undefined,
        serviceName: service?.naziv || 'Neznana storitev',
        serviceColor: service?.barva || '#8B5CF6',
        serviceColor2: service2?.barva || undefined,
        serviceColor3: service3?.barva || undefined,
        serviceId: serviceId || undefined,
        serviceId2: serviceId2 || undefined,
        serviceId3: serviceId3 || undefined,
        addOnServiceId: addOn.addOnServiceId,
        addOnName: addOn.addOnName,
        addOnDuration: addOn.addOnDuration,
        addOnServiceColor: addOn.addOnServiceColor,
        addOnFinalCena: addOn.addOnFinalCena,
        employeeName: employee ? `${employee.ime} ${employee.priimek}` : 'Nedoločeno',
        employeeInitials: employee ? getInitials(employee.ime, employee.priimek) : '?',
        employeeColor: employee?.barva || undefined,
        employeeId: staffId || undefined,
        status: 'scheduled',
        opombe: opombe || undefined,
        interneOpombe: interneOpombe || undefined,
        cena,
      });
    }

    // Sort by time
    tomorrowAppointments.sort((a, b) => a.time.localeCompare(b.time));

    console.log(`[Dashboard] Found ${tomorrowAppointments.length} appointments for tomorrow`);
    return tomorrowAppointments;
  } catch (err) {
    console.error('[Dashboard] Error in fetchTomorrowAppointments:', err);
    return [];
  }
}

// Fetch dashboard stats with new logic
async function fetchStats(companyId: string, personId?: string | null): Promise<DashboardStats> {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");

  console.log('[Dashboard] Fetching stats with dates:', {
    today: todayStr,
    monthStart,
    monthEnd,
  });

  try {
    // Fetch all data using fetchTableRows which handles company column detection
    const [bookingsRes, clientsRes] = await Promise.all([
      fetchAllTableRows<Record<string, unknown>>(TABLES.bookings, companyId),
      fetchTableRows<Record<string, unknown>>(TABLES.clients, companyId, 2000),
    ]);

    const bookings = bookingsRes.data ?? [];
    const clients = clientsRes.data ?? [];

    // 1. TERMINI DANES - Count today's appointments (all statuses)
    let todayCount = 0;
    // 2. AKTIVNI TERMINI - Count scheduled appointments
    let activeCount = 0;
    // 4. PRIHODKI TA MESEC
    let revenueThisMonth = 0;

    for (const row of bookings) {
      const schema = detectBookingSchema(row);

      // Filter by personId if provided
      if (personId) {
        const staffId = String(pickFirst(row, ['ID osebja', 'ID osebe', 'ID Osebe', 'oseba_id', 'person_id']) ?? '');
        if (staffId !== personId) continue;
      }

      // Get date from booking
      const dateValue = schema.dateField ? row[schema.dateField] : null;
      let bookingDateStr = '';
      if (typeof dateValue === 'string') {
        if (dateValue.includes('T')) {
          bookingDateStr = dateValue.split('T')[0];
        } else if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
          bookingDateStr = dateValue;
        } else if (dateValue.match(/^\d{1,2}\.\d{1,2}\.\d{4}$/)) {
          const parts = dateValue.split('.');
          bookingDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      // Count today's appointments
      if (bookingDateStr === todayStr) {
        todayCount++;
      }

      // Count active (scheduled) appointments
      const status = String(pickFirst(row, ['status', 'Status', 'stanje']) ?? '').toLowerCase();
      if (status === 'scheduled') {
        activeCount++;
      }

      // Calculate revenue for this month - completed appointments only
      const isCompletedStatus =
        status.includes('zaključen') ||
        status.includes('zakljucen') ||
        status.includes('completed') ||
        status.includes('done');
      if (isCompletedStatus && bookingDateStr >= monthStart && bookingDateStr <= monthEnd) {
        const price = pickFirst(row, ['cena', 'Cena', 'price']);
        if (price !== undefined) {
          revenueThisMonth += parseFloat(String(price)) || 0;
        }
      }
    }

    // 3. NOVE STRANKE TA MESEC - Count clients added this month
    let newClientsCount = 0;
    for (const client of clients) {
      const dateAdded = pickFirst(client, ['Datum vpisa', 'datum_vpisa', 'created_at', 'date_added']);
      if (dateAdded) {
        let clientDateStr = '';
        if (typeof dateAdded === 'string') {
          if (dateAdded.includes('T')) {
            clientDateStr = dateAdded.split('T')[0];
          } else if (dateAdded.match(/^\d{4}-\d{2}-\d{2}$/)) {
            clientDateStr = dateAdded;
          } else if (dateAdded.match(/^\d{1,2}\.\d{1,2}\.\d{4}$/)) {
            const parts = dateAdded.split('.');
            clientDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        if (clientDateStr >= monthStart && clientDateStr <= monthEnd) {
          newClientsCount++;
        }
      }
    }

    console.log('[Dashboard] Stats:', { todayCount, activeCount, newClientsCount, revenueThisMonth });

    return {
      todayAppointments: todayCount,
      activeAppointments: activeCount,
      newClientsThisMonth: newClientsCount,
      revenueThisMonth,
      isOwner: false,
    };
  } catch (err) {
    console.error('[Dashboard] Error fetching stats:', err);
    return {
      todayAppointments: 0,
      activeAppointments: 0,
      newClientsThisMonth: 0,
      revenueThisMonth: 0,
      isOwner: false,
    };
  }
}

// Fetch weekly chart data (last 7 days) - accurate appointment counts
async function fetchWeeklyChart(companyId: string, personId?: string | null): Promise<WeeklyChartData[]> {
  const today = new Date();
  const weekData: WeeklyChartData[] = [];
  const dayNames = ["Ned", "Pon", "Tor", "Sre", "Čet", "Pet", "Sob"];

  // Calculate date range
  const startDate = subDays(today, 6);
  const startDateStr = format(startDate, "yyyy-MM-dd");
  const endDateStr = format(today, "yyyy-MM-dd");

  console.log('[Dashboard] Fetching weekly chart data:', {
    startDate: startDateStr,
    endDate: endDateStr,
  });

  try {
    // Fetch all bookings using fetchTableRows
    const bookingsRes = await fetchAllTableRows<Record<string, unknown>>(TABLES.bookings, companyId);

    if (bookingsRes.error) {
      console.error('[Dashboard] Error fetching weekly chart data:', bookingsRes.error);
    }

    const bookings = bookingsRes.data ?? [];

    // Count appointments per day
    const countsByDate: Record<string, number> = {};

    for (const row of bookings) {
      const schema = detectBookingSchema(row);
      const dateValue = schema.dateField ? row[schema.dateField] : null;

      if (!dateValue) continue;

      // Filter by personId if provided
      if (personId) {
        const staffId = String(pickFirst(row, ['ID osebja', 'ID osebe', 'ID Osebe', 'oseba_id', 'person_id']) ?? '');
        if (staffId !== personId) continue;
      }

      let bookingDateStr = '';
      if (typeof dateValue === 'string') {
        if (dateValue.includes('T')) {
          bookingDateStr = dateValue.split('T')[0];
        } else if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
          bookingDateStr = dateValue;
        } else if (dateValue.match(/^\d{1,2}\.\d{1,2}\.\d{4}$/)) {
          const parts = dateValue.split('.');
          bookingDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      // Only count if within date range
      if (bookingDateStr >= startDateStr && bookingDateStr <= endDateStr) {
        countsByDate[bookingDateStr] = (countsByDate[bookingDateStr] || 0) + 1;
      }
    }

    console.log('[Dashboard] Counts by date:', countsByDate);

    // Build week data array (from 6 days ago to today)
    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      const dateStr = format(date, "yyyy-MM-dd");
      const count = countsByDate[dateStr] || 0;

      weekData.push({
        day: dayNames[date.getDay()],
        date: format(date, "dd.MM"),
        termini: count,
      });

      console.log(`[Dashboard] ${dateStr} (${dayNames[date.getDay()]}): ${count} appointments`);
    }

    return weekData;
  } catch (err) {
    console.error('[Dashboard] Error in fetchWeeklyChart:', err);
    // Return empty week data
    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      weekData.push({
        day: dayNames[date.getDay()],
        date: format(date, "dd.MM"),
        termini: 0,
      });
    }
    return weekData;
  }
}

// Fetch top services - count all 3 service columns (ID storitev, ID storitve 2, ID storitve 3)
async function fetchTopServices(companyId: string): Promise<TopService[]> {
  try {
    // Use fetchTableRows for proper company column handling
    const [bookingsRes, servicesRes] = await Promise.all([
      fetchAllTableRows<Record<string, unknown>>(TABLES.bookings, companyId),
      fetchTableRows<Record<string, unknown>>(TABLES.services, companyId, 500),
    ]);

    const bookings = bookingsRes.data ?? [];
    const services = servicesRes.data ?? [];

    if (bookings.length === 0) return [];

    // Current month range
    const today = new Date();
    const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");

    // Build services lookup map
    const servicesMap = new Map<string, { naziv: string; barva: string }>();
    for (const s of services) {
      const id = String(pickFirst(s, ['id', 'ID storitev', 'ID storitve', 'service_id']) ?? '');
      const naziv = String(pickFirst(s, ['naziv', 'Naziv', 'name', 'service_name']) ?? '');
      const barva = String(pickFirst(s, ['barva', 'Barva', 'color']) ?? '#8B5CF6');
      if (id) servicesMap.set(id, { naziv, barva });
    }

    // Count service occurrences across all 3 columns (current month only)
    const serviceCounts = new Map<string, number>();

    for (const apt of bookings) {
      // Filter by current month
      const schema = detectBookingSchema(apt);
      const dateValue = schema.dateField ? apt[schema.dateField] : null;
      let bookingDateStr = '';
      if (typeof dateValue === 'string') {
        if (dateValue.includes('T')) {
          bookingDateStr = dateValue.split('T')[0];
        } else if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
          bookingDateStr = dateValue;
        } else if (dateValue.match(/^\d{1,2}\.\d{1,2}\.\d{4}$/)) {
          const parts = dateValue.split('.');
          bookingDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
      if (!bookingDateStr || bookingDateStr < monthStart || bookingDateStr > monthEnd) continue;

      // Count primary service
      const serviceId1 = String(pickFirst(apt, ['ID storitev', 'ID storitve', 'storitev_id', 'service_id']) ?? '');
      if (serviceId1) {
        serviceCounts.set(serviceId1, (serviceCounts.get(serviceId1) || 0) + 1);
      }

      // Count second service
      const serviceId2 = String(pickFirst(apt, ['ID storitve 2', 'service_id_2']) ?? '');
      if (serviceId2) {
        serviceCounts.set(serviceId2, (serviceCounts.get(serviceId2) || 0) + 1);
      }

      // Count third service
      const serviceId3 = String(pickFirst(apt, ['ID storitve 3', 'service_id_3']) ?? '');
      if (serviceId3) {
        serviceCounts.set(serviceId3, (serviceCounts.get(serviceId3) || 0) + 1);
      }

      // Count add-on service
      const addOnServiceId = parseOptionalString(pickFirst(apt, ['add_on_storitev_id', 'add_on_service_id']));
      if (addOnServiceId) {
        serviceCounts.set(addOnServiceId, (serviceCounts.get(addOnServiceId) || 0) + 1);
      }
    }

    // Sort by count and get top 3
    const sortedServices = Array.from(serviceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Build top services array
    const topServices: TopService[] = [];
    const totalCount = Array.from(serviceCounts.values()).reduce((a, b) => a + b, 0);

    for (const [serviceId, count] of sortedServices) {
      const service = servicesMap.get(serviceId);
      if (service) {
        topServices.push({
          id: serviceId,
          name: service.naziv || "Neznana storitev",
          color: service.barva || "#8B5CF6",
          count,
          percentage: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
        });
      }
    }

    return topServices;
  } catch (err) {
    console.error('[Dashboard] Error fetching top services:', err);
    return [];
  }
}

// Fetch top employees - count by "ID osebja" column
async function fetchTopEmployees(companyId: string): Promise<TopEmployee[]> {
  try {
    // Use fetchTableRows for proper company column handling
    const [bookingsRes, staffRes] = await Promise.all([
      fetchAllTableRows<Record<string, unknown>>(TABLES.bookings, companyId),
      fetchTableRows<Record<string, unknown>>(TABLES.staff, companyId, 200),
    ]);

    const bookings = bookingsRes.data ?? [];
    const staff = staffRes.data ?? [];

    if (bookings.length === 0) return [];

    // Current month range
    const today = new Date();
    const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");

    // Build staff lookup map
    const staffMap = new Map<string, { ime: string; priimek: string; barva: string }>();
    for (const e of staff) {
      const id = String(pickFirst(e, ['id', 'ID osebja', 'ID osebe', 'person_id', 'partner_id']) ?? '');
      const ime = String(pickFirst(e, ['ime', 'Ime', 'first_name']) ?? '');
      const priimek = String(pickFirst(e, ['priimek', 'Priimek', 'last_name']) ?? '');
      const barva = String(pickFirst(e, ['Barva', 'barva', 'color']) ?? '');
      if (id) staffMap.set(id, { ime, priimek, barva });
    }

    // Count employee occurrences (current month only)
    const employeeCounts = new Map<string, number>();

    for (const apt of bookings) {
      // Filter by current month
      const schema = detectBookingSchema(apt);
      const dateValue = schema.dateField ? apt[schema.dateField] : null;
      let bookingDateStr = '';
      if (typeof dateValue === 'string') {
        if (dateValue.includes('T')) {
          bookingDateStr = dateValue.split('T')[0];
        } else if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
          bookingDateStr = dateValue;
        } else if (dateValue.match(/^\d{1,2}\.\d{1,2}\.\d{4}$/)) {
          const parts = dateValue.split('.');
          bookingDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
      if (!bookingDateStr || bookingDateStr < monthStart || bookingDateStr > monthEnd) continue;

      const employeeId = String(pickFirst(apt, ['ID osebja', 'ID osebe', 'ID Osebe', 'oseba_id', 'person_id']) ?? '');
      if (employeeId) {
        employeeCounts.set(employeeId, (employeeCounts.get(employeeId) || 0) + 1);
      }
    }

    // Sort by count and get top 3
    const sortedEmployees = Array.from(employeeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Build top employees array
    const topEmployees: TopEmployee[] = [];
    const totalCount = Array.from(employeeCounts.values()).reduce((a, b) => a + b, 0);

    for (const [employeeId, count] of sortedEmployees) {
      const employee = staffMap.get(employeeId);
      if (employee) {
        topEmployees.push({
          id: employeeId,
          name: `${employee.ime || ''} ${employee.priimek || ''}`.trim() || "Neznani zaposleni",
          initials: getInitials(employee.ime || '', employee.priimek || ''),
          color: employee.barva || undefined,
          appointmentCount: count,
          percentage: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
        });
      }
    }

    return topEmployees;
  } catch (err) {
    console.error('[Dashboard] Error fetching top employees:', err);
    return [];
  }
}

// Fetch recent activity - last 3 completed appointments
// Displays: client name (Stranka), service (Storitev), time range (Čas - Konec)
async function fetchRecentActivity(companyId: string): Promise<RecentActivity[]> {
  try {
    // Use fetchTableRows for proper company column handling
    const bookingsRes = await fetchAllTableRows<Record<string, unknown>>(TABLES.bookings, companyId);

    const bookings = bookingsRes.data ?? [];

    // Filter completed appointments and sort by date
    const completedAppointments: {
      id: string;
      datum: string;
      cas: string;
      casKonec: string;
      stranka: string;
      storitev: string;
    }[] = [];

    for (const row of bookings) {
      const schema = detectBookingSchema(row);
      const status = String(pickFirst(row, ['status', 'Status', 'stanje']) ?? '').toLowerCase();

      // Only include completed appointments
      if (status !== 'completed' && status !== 'zaključen' && status !== 'zakljucen') continue;

      const id = schema.idField ? String(row[schema.idField] ?? '') : '';
      const dateValue = schema.dateField ? row[schema.dateField] : null;

      // Read directly from Termini table columns as specified:
      // - Stranka column for client name
      // - Storitev column for service name
      // - Čas column for start time
      // - Konec column for end time
      const clientName = String(pickFirst(row, ['Stranka', 'stranka_ime', 'client_name']) ?? 'Neznana stranka');
      const serviceName = String(pickFirst(row, ['Storitev', 'storitev_ime', 'service_name']) ?? 'Storitev');
      const startTime = String(pickFirst(row, ['Čas', 'cas_zacetek', 'Cas', 'start_time']) ?? '00:00');
      const endTime = String(pickFirst(row, ['Konec', 'cas_konec', 'end_time']) ?? '');

      let bookingDateStr = '';
      if (typeof dateValue === 'string') {
        if (dateValue.includes('T')) {
          bookingDateStr = dateValue.split('T')[0];
        } else if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
          bookingDateStr = dateValue;
        } else if (dateValue.match(/^\d{1,2}\.\d{1,2}\.\d{4}$/)) {
          const parts = dateValue.split('.');
          bookingDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      if (bookingDateStr) {
        completedAppointments.push({
          id,
          datum: bookingDateStr,
          cas: startTime,
          casKonec: endTime,
          stranka: clientName,
          storitev: serviceName,
        });
      }
    }

    // Sort by date and end time (most recent first) - using Datum and Konec columns
    completedAppointments.sort((a, b) => {
      const dateCompare = b.datum.localeCompare(a.datum);
      if (dateCompare !== 0) return dateCompare;
      return b.casKonec.localeCompare(a.casKonec);
    });

    const activities: RecentActivity[] = [];
    for (const apt of completedAppointments.slice(0, 3)) {
      const timestamp = new Date(`${apt.datum}T${apt.casKonec || apt.cas || "00:00"}`);

      // Format time range
      const startTimeFormatted = apt.cas.substring(0, 5);
      const endTimeFormatted = apt.casKonec ? apt.casKonec.substring(0, 5) : '';
      const timeRange = endTimeFormatted ? `${startTimeFormatted} - ${endTimeFormatted}` : startTimeFormatted;

      activities.push({
        id: `completed-${apt.id}`,
        type: "completed",
        description: `${apt.stranka} - ${apt.storitev}`,
        timestamp,
        timeAgo: getTimeAgo(timestamp),
        // Extended fields
        clientName: apt.stranka,
        serviceName: apt.storitev,
        startTime: startTimeFormatted,
        endTime: endTimeFormatted,
      });
    }

    return activities;
  } catch (err) {
    console.error('[Dashboard] Error fetching recent activity:', err);
    return [];
  }
}

// Fetch the next upcoming appointment for a specific person (across all future dates)
async function fetchNextPersonAppointment(companyId: string, personId: string): Promise<AppointmentItem | null> {
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  try {
    const [bookingsRes, servicesRes, staffRes] = await Promise.all([
      fetchAllTableRows<Record<string, unknown>>(TABLES.bookings, companyId),
      fetchTableRows<Record<string, unknown>>(TABLES.services, companyId, 500),
      fetchTableRows<Record<string, unknown>>(TABLES.staff, companyId, 200),
    ]);

    if (bookingsRes.error) return null;

    const bookings = bookingsRes.data ?? [];
    const services = servicesRes.data ?? [];
    const staff = staffRes.data ?? [];

    const servicesMap = new Map<string, DashboardServiceInfo>();
    for (const s of services) {
      const id = String(pickFirst(s, ['id', 'ID storitev', 'ID storitve', 'service_id']) ?? '');
      const naziv = String(pickFirst(s, ['naziv', 'Naziv', 'name', 'service_name']) ?? '');
      const barva = String(pickFirst(s, ['barva', 'Barva', 'color']) ?? '#8B5CF6');
      const trajanje = parseOptionalNumber(pickFirst(s, ['Trajanje', 'trajanje', 'duration', 'duration_min'])) ?? 0;
      if (id) servicesMap.set(id, { naziv, barva, trajanje });
    }

    const employeesMap = new Map<string, { ime: string; priimek: string; barva: string }>();
    for (const e of staff) {
      const id = String(pickFirst(e, ['id', 'ID osebja', 'ID osebe', 'ID Osebe', 'person_id', 'partner_id']) ?? '');
      const ime = String(pickFirst(e, ['ime', 'Ime', 'first_name']) ?? '');
      const priimek = String(pickFirst(e, ['priimek', 'Priimek', 'last_name']) ?? '');
      const barva = String(pickFirst(e, ['Barva', 'barva', 'color']) ?? '');
      if (id) employeesMap.set(id, { ime, priimek, barva });
    }

    const candidates: Array<{ item: AppointmentItem; dateStr: string; timeStr: string }> = [];

    for (const row of bookings) {
      const schema = detectBookingSchema(row);

      // Get staff ID and check it matches our person
      const staffId = String(pickFirst(row, ['ID Osebe', 'ID osebe', 'ID osebja', 'oseba_id', 'person_id']) ?? '');
      if (staffId !== personId) continue;

      // Only scheduled appointments
      const status = String(pickFirst(row, ['status', 'Status', 'stanje']) ?? 'scheduled').toLowerCase();
      if (status !== 'scheduled' && !status.includes('načrtovan') && !status.includes('nacrtovan') && !status.includes('potrj') && !status.includes('confirm')) continue;

      // Get date
      const dateValue = schema.dateField ? row[schema.dateField] : null;
      if (!dateValue) continue;

      let bookingDateStr = '';
      if (typeof dateValue === 'string') {
        if (dateValue.includes('T')) {
          bookingDateStr = dateValue.split('T')[0];
        } else if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
          bookingDateStr = dateValue;
        } else if (dateValue.match(/^\d{1,2}\.\d{1,2}\.\d{4}$/)) {
          const parts = dateValue.split('.');
          bookingDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      if (!bookingDateStr) continue;

      // Must be today or in the future
      if (bookingDateStr < todayStr) continue;

      const startTime = String(pickFirst(row, ['cas_zacetek', 'Čas', 'Cas', 'start_time', 'ura_od']) ?? '00:00');
      const timeStr = startTime.substring(0, 5);

      // If today, must be upcoming (time >= now)
      if (bookingDateStr === todayStr && timeStr < currentTimeStr) continue;

      const endTime = String(pickFirst(row, ['cas_konec', 'Konec', 'end_time', 'ura_do']) ?? '');
      const id = schema.idField ? String(row[schema.idField] ?? '') : '';
      const serviceId = String(pickFirst(row, ['ID storitev', 'ID storitve', 'storitev_id', 'service_id']) ?? '');
      const serviceId2 = String(pickFirst(row, ['ID storitve 2', 'service_id_2', 'storitev_id_2']) ?? '');
      const serviceId3 = String(pickFirst(row, ['ID storitve 3', 'service_id_3', 'storitev_id_3']) ?? '');
      const clientName = String(pickFirst(row, ['stranka_ime', 'Stranka', 'client_name', 'Ime stranke']) ?? 'Neznana stranka');
      const clientEmail = String(pickFirst(row, ['Email', 'stranka_email', 'client_email', 'Email stranke', 'email']) ?? '');
      const clientPhone = String(pickFirst(row, ['Telefon', 'stranka_telefon', 'client_phone', 'Telefon stranke', 'Telefonska številka', 'telefon', 'phone']) ?? '');
      const clientId = String(pickFirst(row, ['ID stranke', 'stranka_id', 'client_id']) ?? '');
      const opombe = String(pickFirst(row, ['opombe', 'Opombe', 'notes']) ?? '');
      const cena = getAppointmentTotalCena(row);
      const language = pickLanguage(row);

      const service = servicesMap.get(serviceId);
      const service2 = serviceId2 ? servicesMap.get(serviceId2) : undefined;
      const service3 = serviceId3 ? servicesMap.get(serviceId3) : undefined;
      const addOn = extractAppointmentAddOn(row, servicesMap);
      const employee = employeesMap.get(staffId);

      candidates.push({
        dateStr: bookingDateStr,
        timeStr,
        item: {
          id,
          time: timeStr,
          endTime: endTime ? endTime.substring(0, 5) : undefined,
          datum: bookingDateStr,
          clientName,
          clientEmail: clientEmail || undefined,
          clientPhone: clientPhone || undefined,
          language,
          clientId: clientId || undefined,
          serviceName: service?.naziv || 'Neznana storitev',
          serviceColor: service?.barva || '#8B5CF6',
          serviceColor2: service2?.barva || undefined,
          serviceColor3: service3?.barva || undefined,
          serviceId: serviceId || undefined,
          serviceId2: serviceId2 || undefined,
          serviceId3: serviceId3 || undefined,
          addOnServiceId: addOn.addOnServiceId,
          addOnName: addOn.addOnName,
          addOnDuration: addOn.addOnDuration,
          addOnServiceColor: addOn.addOnServiceColor,
          addOnFinalCena: addOn.addOnFinalCena,
          employeeName: employee ? `${employee.ime} ${employee.priimek}` : 'Nedoločeno',
          employeeInitials: employee ? getInitials(employee.ime, employee.priimek) : '?',
          employeeColor: employee?.barva || undefined,
          employeeId: staffId || undefined,
          status: 'scheduled',
          opombe: opombe || undefined,
          cena,
        },
      });
    }

    if (candidates.length === 0) return null;

    // Sort by date then time, pick first
    candidates.sort((a, b) => {
      const dc = a.dateStr.localeCompare(b.dateStr);
      if (dc !== 0) return dc;
      return a.timeStr.localeCompare(b.timeStr);
    });

    return candidates[0].item;
  } catch (err) {
    console.error('[Dashboard] Error fetching next person appointment:', err);
    return null;
  }
}

// Main function to fetch all dashboard data
export async function fetchDashboardData(companyId: string, personId?: string | null): Promise<DashboardData> {
  const [
    stats,
    todayAppointments,
    tomorrowAppointments,
    weeklyChart,
    topServices,
    topEmployees,
    recentActivity,
    nextPersonAppointment,
  ] = await Promise.all([
    fetchStats(companyId, personId),
    fetchTodayAppointments(companyId, personId),
    fetchTomorrowAppointments(companyId, personId),
    fetchWeeklyChart(companyId, personId),
    fetchTopServices(companyId),
    fetchTopEmployees(companyId),
    fetchRecentActivity(companyId),
    personId ? fetchNextPersonAppointment(companyId, personId) : Promise.resolve(null),
  ]);

  return {
    stats,
    todayAppointments,
    tomorrowAppointments,
    weeklyChart,
    topServices,
    topEmployees,
    recentActivity,
    nextPersonAppointment,
  };
}
