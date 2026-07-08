// lib/dashboard/fetchDashboardData.server.ts
//
// Server-side dashboard data loader (RSC). This is the session-aware, de-duplicated
// counterpart to the browser fetchDashboardData in ./fetchDashboardData.ts.
//
// Two differences from the browser version, both deliberate:
//  1. It runs on the server with the user's COOKIE session (createServerSupabaseClient),
//     so RLS (which requires auth.uid()) is satisfied.
//  2. It fetches each table ONCE and shares the rows + lookup maps across all
//     aggregators, instead of re-fetching Termini/Stranke/Storitve/Osebe ~8×.
//
// The pure transform logic mirrors ./fetchDashboardData.ts exactly so the rendered
// output is identical; only the fetching/plumbing differs. The browser version and
// its exported types are intentionally left untouched.

import "server-only";
import { format, startOfMonth, endOfMonth, addDays, subDays } from "date-fns";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { pickFirst, detectBookingSchema } from "@/lib/dashboardHelpers";
import { TABLES } from "@/lib/data";
import { normalizeCommunicationLanguage, type CommunicationLanguageCode } from "@/lib/communicationLanguage";
import type {
  DashboardData,
  DashboardStats,
  AppointmentItem,
  WeeklyChartData,
  TopService,
  TopEmployee,
  RecentActivity,
} from "./fetchDashboardData";

type Row = Record<string, unknown>;
type ServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

const COMPANY_COLUMN_CANDIDATES = [
  "ID podjetja",
  "ID Podjetja",
  "ID_podjetja",
  "company_id",
  "companyId",
];

const isMissingColumnError = (error: { message?: string; code?: string }) => {
  if (error.code === "42703") return true;
  if (!error.message) return false;
  return error.message.includes("does not exist") && error.message.includes("column");
};

// ── Shared low-level helpers (ported from ./fetchDashboardData.ts) ───────────

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

function getInitials(firstName: string, lastName: string): string {
  return `${(firstName || "").charAt(0)}${(lastName || "").charAt(0)}`.toUpperCase();
}

// Normalize a booking date cell to 'yyyy-MM-dd'. Mirrors the inline parsing used
// throughout the browser aggregators (ISO, yyyy-MM-dd, and d.m.yyyy).
function toDateStr(dateValue: unknown): string {
  if (typeof dateValue !== "string") return "";
  if (dateValue.includes("T")) return dateValue.split("T")[0];
  if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) return dateValue;
  if (dateValue.match(/^\d{1,2}\.\d{1,2}\.\d{4}$/)) {
    const parts = dateValue.split(".");
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return "";
}

const bookingStaffId = (row: Row) =>
  String(pickFirst(row, ["ID osebja", "ID osebe", "ID Osebe", "oseba_id", "person_id"]) ?? "");

type DashboardServiceInfo = { naziv: string; barva: string; trajanje: number };

const LANGUAGE_FIELDS = ["language", "Language", "Jezik komunikacije", "jezik_komunikacije", "Jezik", "jezik", "preferred_language"];

function pickLanguage(row: Row, fallback?: unknown) {
  return normalizeCommunicationLanguage(pickFirst(row, LANGUAGE_FIELDS) ?? fallback);
}

function parseOptionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text && text !== "null" ? text : undefined;
}

function parseOptionalNumber(value: unknown): number | undefined {
  const text = parseOptionalString(value);
  if (!text) return undefined;
  const numberValue = Number(text);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function extractAppointmentAddOn(row: Row, servicesMap: Map<string, DashboardServiceInfo>) {
  const addOnServiceId = parseOptionalString(pickFirst(row, ["add_on_storitev_id", "add_on_service_id", "addOnStoritevId"]));
  const addOnName = parseOptionalString(pickFirst(row, ["add_on_naziv", "add_on_name", "addOnNaziv"]));
  const addOnService = addOnServiceId ? servicesMap.get(addOnServiceId) : undefined;
  const addOnDuration =
    parseOptionalNumber(pickFirst(row, ["add_on_trajanje", "add_on_duration", "addOnTrajanje"])) ??
    addOnService?.trajanje;

  return {
    addOnServiceId,
    addOnName,
    addOnDuration,
    addOnServiceColor: addOnService?.barva,
    addOnFinalCena: parseOptionalString(pickFirst(row, ["add_on_final_cena", "add_on_final_price"])),
  };
}

function getAppointmentTotalCena(row: Row): number | undefined {
  const main = parseOptionalNumber(pickFirst(row, ["Final cena", "final_cena", "koncna_cena", "cena", "Cena"]));
  const addOn = parseOptionalNumber(pickFirst(row, ["add_on_final_cena", "add_on_final_price"]));
  if (main === undefined && addOn === undefined) return undefined;
  return (main ?? 0) + (addOn ?? 0);
}

// ── One-time table fetch (session client, company-scoped) ────────────────────
// Tries the company-column candidates; the first that isn't a missing-column
// error is used as the actual data query, so the happy path is a single round trip.
async function fetchTableOnce(
  supabase: ServerClient,
  tableName: string,
  companyId: string,
  limit: number
): Promise<Row[]> {
  for (const col of COMPANY_COLUMN_CANDIDATES) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .eq(col, companyId)
      .limit(limit);
    if (!error) return (data as Row[] | null) ?? [];
    if (!isMissingColumnError(error)) {
      console.warn(`[Dashboard.server] ${tableName} fetch error:`, error.message);
      return [];
    }
  }
  return [];
}

// ── Lookup maps (built once, shared by all aggregators) ──────────────────────

function buildServicesMap(services: Row[]) {
  const map = new Map<string, DashboardServiceInfo>();
  for (const s of services) {
    const id = String(pickFirst(s, ["id", "ID storitev", "ID storitve", "service_id"]) ?? "");
    const naziv = String(pickFirst(s, ["naziv", "Naziv", "name", "service_name"]) ?? "");
    const barva = String(pickFirst(s, ["barva", "Barva", "color"]) ?? "#8B5CF6");
    const trajanje = parseOptionalNumber(pickFirst(s, ["Trajanje", "trajanje", "duration", "duration_min"])) ?? 0;
    if (id) map.set(id, { naziv, barva, trajanje });
  }
  return map;
}

function buildEmployeesMap(staff: Row[]) {
  const map = new Map<string, { ime: string; priimek: string; barva: string }>();
  for (const e of staff) {
    const id = String(
      pickFirst(e, ["id", "ID osebja", "ID osebe", "ID Osebe", "person_id", "partner_id"]) ?? ""
    );
    const ime = String(pickFirst(e, ["ime", "Ime", "first_name"]) ?? "");
    const priimek = String(pickFirst(e, ["priimek", "Priimek", "last_name"]) ?? "");
    const barva = String(pickFirst(e, ["Barva", "barva", "color"]) ?? "");
    if (id) map.set(id, { ime, priimek, barva });
  }
  return map;
}

function buildClientsMap(clients: Row[]) {
  const map = new Map<string, { barva: string; language: CommunicationLanguageCode }>();
  for (const c of clients) {
    const id = String(pickFirst(c, ["id", "ID stranke", "client_id"]) ?? "");
    const barva = String(pickFirst(c, ["barva", "Barva", "color"]) ?? "");
    if (id) map.set(id, { barva, language: pickLanguage(c) });
  }
  return map;
}

type Maps = {
  servicesMap: ReturnType<typeof buildServicesMap>;
  employeesMap: ReturnType<typeof buildEmployeesMap>;
  clientsMap: ReturnType<typeof buildClientsMap>;
};

// ── Aggregators (pure; operate on pre-fetched rows + maps) ───────────────────

function buildStats(
  bookings: Row[],
  clients: Row[],
  personId: string | null,
  todayStr: string,
  monthStart: string,
  monthEnd: string
): DashboardStats {
  let todayCount = 0;
  let activeCount = 0;
  let revenueThisMonth = 0;

  for (const row of bookings) {
    const schema = detectBookingSchema(row);
    if (personId && bookingStaffId(row) !== personId) continue;

    const bookingDateStr = toDateStr(schema.dateField ? row[schema.dateField] : null);

    if (bookingDateStr === todayStr) todayCount++;

    const status = String(pickFirst(row, ["status", "Status", "stanje"]) ?? "").toLowerCase();
    if (status === "scheduled") activeCount++;

    const isCompletedStatus =
      status.includes("zaključen") ||
      status.includes("zakljucen") ||
      status.includes("completed") ||
      status.includes("done");
    if (isCompletedStatus && bookingDateStr >= monthStart && bookingDateStr <= monthEnd) {
      const price = pickFirst(row, ["cena", "Cena", "price"]);
      if (price !== undefined) revenueThisMonth += parseFloat(String(price)) || 0;
    }
  }

  let newClientsCount = 0;
  for (const client of clients) {
    const dateAdded = pickFirst(client, ["Datum vpisa", "datum_vpisa", "created_at", "date_added"]);
    if (!dateAdded) continue;
    const clientDateStr = toDateStr(dateAdded);
    if (clientDateStr >= monthStart && clientDateStr <= monthEnd) newClientsCount++;
  }

  return {
    todayAppointments: todayCount,
    activeAppointments: activeCount,
    newClientsThisMonth: newClientsCount,
    revenueThisMonth,
    isOwner: false,
  };
}

// Shared by today & tomorrow (identical logic, different target date).
function buildAppointmentsForDate(
  bookings: Row[],
  maps: Maps,
  targetStr: string,
  personId: string | null
): AppointmentItem[] {
  const { servicesMap, employeesMap, clientsMap } = maps;
  const out: AppointmentItem[] = [];

  for (const row of bookings) {
    const schema = detectBookingSchema(row);
    const dateValue = schema.dateField ? row[schema.dateField] : null;
    if (!dateValue) continue;

    const bookingDateStr = toDateStr(dateValue);
    if (bookingDateStr !== targetStr) continue;

    const status = String(pickFirst(row, ["status", "Status", "stanje"]) ?? "scheduled").toLowerCase();
    if (status !== "scheduled") continue;

    const id = schema.idField ? String(row[schema.idField] ?? "") : "";
    const serviceId = String(pickFirst(row, ["ID storitev", "ID storitve", "storitev_id", "service_id"]) ?? "");
    const serviceId2 = String(pickFirst(row, ["ID storitve 2", "service_id_2", "storitev_id_2"]) ?? "");
    const serviceId3 = String(pickFirst(row, ["ID storitve 3", "service_id_3", "storitev_id_3"]) ?? "");
    const staffId = bookingStaffId(row);
    const clientId = String(pickFirst(row, ["ID stranke", "stranka_id", "client_id"]) ?? "");

    if (personId && staffId !== personId) continue;

    const startTime = String(pickFirst(row, ["cas_zacetek", "Čas", "Cas", "start_time", "ura_od"]) ?? "00:00");
    const endTime = String(pickFirst(row, ["cas_konec", "Konec", "end_time", "ura_do"]) ?? "");

    const clientName = String(pickFirst(row, ["stranka_ime", "Stranka", "client_name", "Ime stranke"]) ?? "Neznana stranka");
    const clientEmail = String(pickFirst(row, ["Email", "stranka_email", "client_email", "Email stranke", "email"]) ?? "");
    const clientPhone = String(pickFirst(row, ["Telefon", "stranka_telefon", "client_phone", "Telefon stranke", "Telefonska številka", "telefon", "phone"]) ?? "");

    const service = servicesMap.get(serviceId);
    const service2 = serviceId2 ? servicesMap.get(serviceId2) : undefined;
    const service3 = serviceId3 ? servicesMap.get(serviceId3) : undefined;
    const addOn = extractAppointmentAddOn(row, servicesMap);
    const employee = employeesMap.get(staffId);
    const client = clientsMap.get(clientId);

    const opombe = String(pickFirst(row, ["opombe", "Opombe", "notes", "Notes"]) ?? "");
    const interneOpombe = String(pickFirst(row, ["interne_opombe", "Interne opombe", "internal_notes"]) ?? "");
    const cena = getAppointmentTotalCena(row);
    const language = pickLanguage(row, client?.language);

    out.push({
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
      serviceName: service?.naziv || "Neznana storitev",
      serviceColor: service?.barva || "#8B5CF6",
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
      employeeName: employee ? `${employee.ime} ${employee.priimek}` : "Nedoločeno",
      employeeInitials: employee ? getInitials(employee.ime, employee.priimek) : "?",
      employeeColor: employee?.barva || undefined,
      employeeId: staffId || undefined,
      status: "scheduled",
      opombe: opombe || undefined,
      interneOpombe: interneOpombe || undefined,
      cena,
    });
  }

  out.sort((a, b) => a.time.localeCompare(b.time));
  return out;
}

function buildWeeklyChart(bookings: Row[], personId: string | null, today: Date): WeeklyChartData[] {
  const dayNames = ["Ned", "Pon", "Tor", "Sre", "Čet", "Pet", "Sob"];
  const startDateStr = format(subDays(today, 6), "yyyy-MM-dd");
  const endDateStr = format(today, "yyyy-MM-dd");

  const countsByDate: Record<string, number> = {};
  for (const row of bookings) {
    const schema = detectBookingSchema(row);
    const dateValue = schema.dateField ? row[schema.dateField] : null;
    if (!dateValue) continue;
    if (personId && bookingStaffId(row) !== personId) continue;

    const bookingDateStr = toDateStr(dateValue);
    if (bookingDateStr >= startDateStr && bookingDateStr <= endDateStr) {
      countsByDate[bookingDateStr] = (countsByDate[bookingDateStr] || 0) + 1;
    }
  }

  const weekData: WeeklyChartData[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = subDays(today, i);
    const dateStr = format(date, "yyyy-MM-dd");
    weekData.push({
      day: dayNames[date.getDay()],
      date: format(date, "dd.MM"),
      termini: countsByDate[dateStr] || 0,
    });
  }
  return weekData;
}

function buildTopServices(
  bookings: Row[],
  servicesMap: Maps["servicesMap"],
  monthStart: string,
  monthEnd: string
): TopService[] {
  if (bookings.length === 0) return [];
  const serviceCounts = new Map<string, number>();

  for (const apt of bookings) {
    const schema = detectBookingSchema(apt);
    const bookingDateStr = toDateStr(schema.dateField ? apt[schema.dateField] : null);
    if (!bookingDateStr || bookingDateStr < monthStart || bookingDateStr > monthEnd) continue;

    const serviceId1 = String(pickFirst(apt, ["ID storitev", "ID storitve", "storitev_id", "service_id"]) ?? "");
    if (serviceId1) serviceCounts.set(serviceId1, (serviceCounts.get(serviceId1) || 0) + 1);
    const serviceId2 = String(pickFirst(apt, ["ID storitve 2", "service_id_2"]) ?? "");
    if (serviceId2) serviceCounts.set(serviceId2, (serviceCounts.get(serviceId2) || 0) + 1);
    const serviceId3 = String(pickFirst(apt, ["ID storitve 3", "service_id_3"]) ?? "");
    if (serviceId3) serviceCounts.set(serviceId3, (serviceCounts.get(serviceId3) || 0) + 1);
    const addOnServiceId = parseOptionalString(pickFirst(apt, ["add_on_storitev_id", "add_on_service_id"]));
    if (addOnServiceId) serviceCounts.set(addOnServiceId, (serviceCounts.get(addOnServiceId) || 0) + 1);
  }

  const sorted = Array.from(serviceCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const totalCount = Array.from(serviceCounts.values()).reduce((a, b) => a + b, 0);

  const top: TopService[] = [];
  for (const [serviceId, count] of sorted) {
    const service = servicesMap.get(serviceId);
    if (service) {
      top.push({
        id: serviceId,
        name: service.naziv || "Neznana storitev",
        color: service.barva || "#8B5CF6",
        count,
        percentage: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
      });
    }
  }
  return top;
}

function buildTopEmployees(
  bookings: Row[],
  employeesMap: Maps["employeesMap"],
  monthStart: string,
  monthEnd: string
): TopEmployee[] {
  if (bookings.length === 0) return [];
  const employeeCounts = new Map<string, number>();

  for (const apt of bookings) {
    const schema = detectBookingSchema(apt);
    const bookingDateStr = toDateStr(schema.dateField ? apt[schema.dateField] : null);
    if (!bookingDateStr || bookingDateStr < monthStart || bookingDateStr > monthEnd) continue;

    const employeeId = bookingStaffId(apt);
    if (employeeId) employeeCounts.set(employeeId, (employeeCounts.get(employeeId) || 0) + 1);
  }

  const sorted = Array.from(employeeCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const totalCount = Array.from(employeeCounts.values()).reduce((a, b) => a + b, 0);

  const top: TopEmployee[] = [];
  for (const [employeeId, count] of sorted) {
    const employee = employeesMap.get(employeeId);
    if (employee) {
      top.push({
        id: employeeId,
        name: `${employee.ime || ""} ${employee.priimek || ""}`.trim() || "Neznani zaposleni",
        initials: getInitials(employee.ime || "", employee.priimek || ""),
        color: employee.barva || undefined,
        appointmentCount: count,
        percentage: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
      });
    }
  }
  return top;
}

function buildRecentActivity(bookings: Row[]): RecentActivity[] {
  const completed: { id: string; datum: string; cas: string; casKonec: string; stranka: string; storitev: string }[] = [];

  for (const row of bookings) {
    const schema = detectBookingSchema(row);
    const status = String(pickFirst(row, ["status", "Status", "stanje"]) ?? "").toLowerCase();
    if (status !== "completed" && status !== "zaključen" && status !== "zakljucen") continue;

    const id = schema.idField ? String(row[schema.idField] ?? "") : "";
    const clientName = String(pickFirst(row, ["Stranka", "stranka_ime", "client_name"]) ?? "Neznana stranka");
    const serviceName = String(pickFirst(row, ["Storitev", "storitev_ime", "service_name"]) ?? "Storitev");
    const startTime = String(pickFirst(row, ["Čas", "cas_zacetek", "Cas", "start_time"]) ?? "00:00");
    const endTime = String(pickFirst(row, ["Konec", "cas_konec", "end_time"]) ?? "");
    const bookingDateStr = toDateStr(schema.dateField ? row[schema.dateField] : null);

    if (bookingDateStr) {
      completed.push({ id, datum: bookingDateStr, cas: startTime, casKonec: endTime, stranka: clientName, storitev: serviceName });
    }
  }

  completed.sort((a, b) => {
    const dateCompare = b.datum.localeCompare(a.datum);
    if (dateCompare !== 0) return dateCompare;
    return b.casKonec.localeCompare(a.casKonec);
  });

  const activities: RecentActivity[] = [];
  for (const apt of completed.slice(0, 3)) {
    const timestamp = new Date(`${apt.datum}T${apt.casKonec || apt.cas || "00:00"}`);
    const startTimeFormatted = apt.cas.substring(0, 5);
    const endTimeFormatted = apt.casKonec ? apt.casKonec.substring(0, 5) : "";
    activities.push({
      id: `completed-${apt.id}`,
      type: "completed",
      description: `${apt.stranka} - ${apt.storitev}`,
      timestamp,
      timeAgo: getTimeAgo(timestamp),
      clientName: apt.stranka,
      serviceName: apt.storitev,
      startTime: startTimeFormatted,
      endTime: endTimeFormatted,
    });
  }
  return activities;
}

function buildNextPersonAppointment(
  bookings: Row[],
  maps: Maps,
  personId: string,
  now: Date
): AppointmentItem | null {
  const { servicesMap, employeesMap } = maps;
  const todayStr = format(now, "yyyy-MM-dd");
  const currentTimeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  const candidates: Array<{ item: AppointmentItem; dateStr: string; timeStr: string }> = [];

  for (const row of bookings) {
    const schema = detectBookingSchema(row);
    const staffId = bookingStaffId(row);
    if (staffId !== personId) continue;

    const status = String(pickFirst(row, ["status", "Status", "stanje"]) ?? "scheduled").toLowerCase();
    if (status !== "scheduled" && !status.includes("načrtovan") && !status.includes("nacrtovan") && !status.includes("potrj") && !status.includes("confirm")) continue;

    const dateValue = schema.dateField ? row[schema.dateField] : null;
    if (!dateValue) continue;
    const bookingDateStr = toDateStr(dateValue);
    if (!bookingDateStr) continue;
    if (bookingDateStr < todayStr) continue;

    const startTime = String(pickFirst(row, ["cas_zacetek", "Čas", "Cas", "start_time", "ura_od"]) ?? "00:00");
    const timeStr = startTime.substring(0, 5);
    if (bookingDateStr === todayStr && timeStr < currentTimeStr) continue;

    const endTime = String(pickFirst(row, ["cas_konec", "Konec", "end_time", "ura_do"]) ?? "");
    const id = schema.idField ? String(row[schema.idField] ?? "") : "";
    const serviceId = String(pickFirst(row, ["ID storitev", "ID storitve", "storitev_id", "service_id"]) ?? "");
    const serviceId2 = String(pickFirst(row, ["ID storitve 2", "service_id_2", "storitev_id_2"]) ?? "");
    const serviceId3 = String(pickFirst(row, ["ID storitve 3", "service_id_3", "storitev_id_3"]) ?? "");
    const clientName = String(pickFirst(row, ["stranka_ime", "Stranka", "client_name", "Ime stranke"]) ?? "Neznana stranka");
    const clientEmail = String(pickFirst(row, ["Email", "stranka_email", "client_email", "Email stranke", "email"]) ?? "");
    const clientPhone = String(pickFirst(row, ["Telefon", "stranka_telefon", "client_phone", "Telefon stranke", "Telefonska številka", "telefon", "phone"]) ?? "");
    const clientId = String(pickFirst(row, ["ID stranke", "stranka_id", "client_id"]) ?? "");
    const opombe = String(pickFirst(row, ["opombe", "Opombe", "notes"]) ?? "");

    const service = servicesMap.get(serviceId);
    const service2 = serviceId2 ? servicesMap.get(serviceId2) : undefined;
    const service3 = serviceId3 ? servicesMap.get(serviceId3) : undefined;
    const addOn = extractAppointmentAddOn(row, servicesMap);
    const employee = employeesMap.get(staffId);
    const cena = getAppointmentTotalCena(row);
    const language = pickLanguage(row);

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
        serviceName: service?.naziv || "Neznana storitev",
        serviceColor: service?.barva || "#8B5CF6",
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
        employeeName: employee ? `${employee.ime} ${employee.priimek}` : "Nedoločeno",
        employeeInitials: employee ? getInitials(employee.ime, employee.priimek) : "?",
        employeeColor: employee?.barva || undefined,
        employeeId: staffId || undefined,
        status: "scheduled",
        opombe: opombe || undefined,
        cena,
      },
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const dc = a.dateStr.localeCompare(b.dateStr);
    if (dc !== 0) return dc;
    return a.timeStr.localeCompare(b.timeStr);
  });
  return candidates[0].item;
}

// ── Person resolution ────────────────────────────────────────────────────────
// effectivePersonId in the browser version reduces to company_members.person_id:
// userPersonId (useUserPersonId) and rolePersonId (useRolePermissions) are read
// from the SAME company_members row, so every branch of the client's ternary
// yields that person_id. Empty string is treated as "not linked" (null), matching
// getUserPersonId.
async function resolvePersonId(supabase: ServerClient, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("company_members")
    .select("person_id")
    .eq("user_id", userId)
    .maybeSingle();
  const personId = data?.person_id;
  if (!personId || personId === "") return null;
  return String(personId);
}

// ── Public entry ─────────────────────────────────────────────────────────────

/**
 * Loads all dashboard data server-side for the given company. Fetches each table
 * once and shares the rows across every aggregator. Returns null if there is no
 * authenticated session (the page should redirect / fall back in that case).
 */
export async function fetchDashboardDataServer(companyId: string): Promise<DashboardData | null> {
  if (!companyId || companyId.trim() === "") return null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const personId = await resolvePersonId(supabase, user.id);

  // Single fetch per table, shared across all aggregators (was ~8× before).
  const [bookings, services, staff, clients] = await Promise.all([
    fetchTableOnce(supabase, TABLES.bookings, companyId, 5000),
    fetchTableOnce(supabase, TABLES.services, companyId, 500),
    fetchTableOnce(supabase, TABLES.staff, companyId, 200),
    fetchTableOnce(supabase, TABLES.clients, companyId, 2000),
  ]);

  const maps: Maps = {
    servicesMap: buildServicesMap(services),
    employeesMap: buildEmployeesMap(staff),
    clientsMap: buildClientsMap(clients),
  };

  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const tomorrowStr = format(addDays(now, 1), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  return {
    stats: buildStats(bookings, clients, personId, todayStr, monthStart, monthEnd),
    todayAppointments: buildAppointmentsForDate(bookings, maps, todayStr, personId),
    tomorrowAppointments: buildAppointmentsForDate(bookings, maps, tomorrowStr, personId),
    weeklyChart: buildWeeklyChart(bookings, personId, now),
    topServices: buildTopServices(bookings, maps.servicesMap, monthStart, monthEnd),
    topEmployees: buildTopEmployees(bookings, maps.employeesMap, monthStart, monthEnd),
    recentActivity: buildRecentActivity(bookings),
    nextPersonAppointment: personId ? buildNextPersonAppointment(bookings, maps, personId, now) : null,
  };
}
