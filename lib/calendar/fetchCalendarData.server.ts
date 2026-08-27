// lib/calendar/fetchCalendarData.server.ts
//
// Server-side loader for the Koledar (calendar) page's initial paint only.
// Mirrors the Termini conversion (lib/appointments/fetchAppointmentsData.server.ts):
// session-aware (cookie) fetch, with the RBAC "view own appointments only"
// restriction applied server-side instead of shipping every appointment to the
// browser and filtering client-side.
//
// Scope, deliberately narrow:
//  - Appointments are scoped to the CURRENT MONTH only (matching what
//    fetchAppointmentsForMonth already returns for the default day-view month —
//    no new DB-level date-window scoping is introduced here).
//  - Events are scoped to TODAY only (the default day-view range).
//  - Services/employees/absences/resursi data is company-wide, same as the
//    existing client fetchers (fetchServices, fetchEmployees, fetchAbsences,
//    fetchActiveResursi, fetchTerminIdsWithResursi, fetchTerminResursiMap).
//
// This module has NO callers yet. It is a pure addition — safe to land and
// revert independently of the page/component wiring that will consume it.

import "server-only";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { detectBookingSchema, pickFirst } from "@/lib/dashboardHelpers";
import { normalizeCommunicationLanguage } from "@/lib/communicationLanguage";
import { TABLES } from "@/lib/data";
import {
  parseService,
  parseStaff,
  parseBookingDate,
  extractAdditionalServiceIds,
  extractPricingFields,
  extractPromotionFields,
  extractAddOnFields,
} from "@/lib/supabase/appointments";
import type { AppointmentWithDetails, Storitev, Zaposleni } from "@/types/appointments";
import type { Absence } from "@/lib/supabase/appointments";
import type { CalendarEvent } from "@/types/events";
import type { Resurs } from "@/types/resursi";

type Row = Record<string, unknown>;
type ServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

const CLIENT_ID_FIELDS = ["ID stranke", "id", "ID_stranke", "client_id"];
const CLIENT_LAST_NAME_FIELDS = ["Priimek", "priimek", "last_name", "lastName", "surname"];
const LANGUAGE_FIELDS = ["language", "Language", "Jezik komunikacije", "jezik_komunikacije", "Jezik", "jezik", "preferred_language"];

function pickLanguage(row: Row, fallback?: unknown) {
  return normalizeCommunicationLanguage(pickFirst(row, LANGUAGE_FIELDS) ?? fallback);
}

const COMPANY_COLUMN_CANDIDATES = [
  "ID podjetja",
  "ID Podjetja",
  "ID_podjetja",
  "company_id",
  "companyId",
];

const DATE_COLUMN = "Datum";

const isMissingColumnError = (error: { message?: string; code?: string }) => {
  if (error.code === "42703") return true;
  if (!error.message) return false;
  return error.message.includes("does not exist") && error.message.includes("column");
};

async function fetchTableOnce(
  supabase: ServerClient,
  tableName: string,
  companyId: string,
  orderColumn?: string
): Promise<Row[]> {
  for (const col of COMPANY_COLUMN_CANDIDATES) {
    const rows: Row[] = [];
    let columnExists = false;

    for (let from = 0; ; from += 1000) {
      let query = supabase
        .from(tableName)
        .select("*")
        .eq(col, companyId);

      if (orderColumn) {
        query = query.order(orderColumn, { ascending: false });
      }

      const { data, error } = await query.range(from, from + 999);

      if (error) {
        if (isMissingColumnError(error)) break;
        console.warn(`[Calendar.server] ${tableName} fetch error:`, error.message);
        return [];
      }

      columnExists = true;
      const page = (data as Row[] | null) ?? [];
      rows.push(...page);

      if (page.length < 1000) return rows;
    }

    if (columnExists) return rows;
  }
  return [];
}

async function fetchBookingsForMonth(
  supabase: ServerClient,
  companyId: string,
  fromInclusive: string,
  toExclusive: string
): Promise<Row[]> {
  for (const col of COMPANY_COLUMN_CANDIDATES) {
    const rows: Row[] = [];
    let columnExists = false;

    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from(TABLES.bookings)
        .select("*")
        .eq(col, companyId)
        .gte(DATE_COLUMN, fromInclusive)
        .lt(DATE_COLUMN, toExclusive)
        .order(DATE_COLUMN, { ascending: false })
        .range(from, from + 999);

      if (error) {
        if (isMissingColumnError(error)) break;
        console.warn(`[Calendar.server] Termini fetch error:`, error.message);
        return [];
      }

      columnExists = true;
      const page = (data as Row[] | null) ?? [];
      rows.push(...page);

      if (page.length < 1000) return rows;
    }

    if (columnExists) return rows;
  }
  return [];
}

// Resolve the caller's role/person, and whether they are restricted to their own
// appointments. Duplicated (not imported) from fetchAppointmentsData.server.ts so
// this file has zero dependency on/impact on the Termini conversion — each stays
// independently revertible. Mirrors useRolePermissions + Calendar.tsx's
// staffViewOwnOnly:
//   staffViewOwnOnly = role==='staff' &&
//     (can_view_only_own_appointments === true || can_view_all_appointments === false)
async function resolveViewScope(
  supabase: ServerClient,
  userId: string
): Promise<{ ownOnly: boolean; personId: string | null }> {
  const { data: member } = await supabase
    .from("company_members")
    .select("role, person_id, company_id")
    .eq("user_id", userId)
    .maybeSingle();

  const role = (member?.role as string | undefined) ?? null;
  const personId = member?.person_id ? String(member.person_id) : null;

  if (role !== "staff" || !member?.company_id) {
    return { ownOnly: false, personId };
  }

  const { data: perms } = await supabase
    .from("staff_role_permissions")
    .select("can_view_only_own_appointments, can_view_all_appointments")
    .eq("company_id", member.company_id)
    .maybeSingle();

  const ownOnly =
    perms?.can_view_only_own_appointments === true ||
    perms?.can_view_all_appointments === false;

  return { ownOnly, personId };
}

function isDateInMonth(date: Date, year: number, month: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month;
}

// Assembly ported from fetchAppointmentsForMonth (lib/supabase/appointments.ts) —
// same field lists, same normalization, same output shape, reusing the same
// exported parse helpers, so the produced objects are identical to what the
// client fetcher returns today. `ownOnlyPersonId`, when set, restricts to that
// person's appointments (server-side; other staff's rows never leave the server).
function buildAppointments(
  bookings: Row[],
  services: Row[],
  staff: Row[],
  clients: Row[],
  year: number,
  month: number,
  ownOnlyPersonId: string | null
): AppointmentWithDetails[] {
  const serviceMap = new Map<string, Storitev>();
  for (const row of services) {
    const service = parseService(row);
    if (service) serviceMap.set(service.id, service);
  }

  const staffMap = new Map<string, Zaposleni & { initials: string }>();
  for (const row of staff) {
    const person = parseStaff(row);
    if (person) staffMap.set(person.id, person);
  }

  const clientPriimekMap = new Map<string, string>();
  const clientLanguageMap = new Map<string, ReturnType<typeof normalizeCommunicationLanguage>>();
  for (const row of clients) {
    const rowKeys = Object.keys(row);
    const idField = rowKeys.find((k) => CLIENT_ID_FIELDS.includes(k));
    const priimekField = rowKeys.find((k) => CLIENT_LAST_NAME_FIELDS.includes(k));
    if (idField) {
      const cid = String(row[idField] ?? "");
      if (cid) {
        if (priimekField) {
          const priimek = String(row[priimekField] ?? "");
          if (priimek) clientPriimekMap.set(cid, priimek);
        }
        clientLanguageMap.set(cid, pickLanguage(row));
      }
    }
  }

  const appointments: AppointmentWithDetails[] = [];

  for (const row of bookings) {
    const schema = detectBookingSchema(row);
    const bookingDate = parseBookingDate(row, schema);
    if (!bookingDate || !isDateInMonth(bookingDate, year, month)) continue;

    const id = schema.idField ? String(row[schema.idField] ?? "") : "";
    const serviceId = schema.serviceIdField ? String(row[schema.serviceIdField] ?? "") : "";
    const staffId = String(
      pickFirst(row, ["ID osebja", "ID Osebe", "ID osebe", "assigned_person_id", "oseba_id", "person_id"]) ?? ""
    );

    // Server-side own-only restriction for view-own-only staff.
    if (ownOnlyPersonId && staffId !== ownOnlyPersonId) continue;

    const startTime = schema.startTimeField ? String(row[schema.startTimeField] ?? "") : "";
    const endTime = schema.endTimeField ? String(row[schema.endTimeField] ?? "") : "";

    const clientId = schema.clientIdField
      ? String(row[schema.clientIdField] ?? "")
      : String(pickFirst(row, ["ID stranke", "stranka_id", "client_id"]) ?? "");
    const clientName = schema.clientNameField
      ? String(row[schema.clientNameField] ?? "")
      : String(pickFirst(row, ["client_name", "stranka_ime", "Ime stranke"]) ?? "Neznana stranka");

    const status = schema.statusField
      ? String(row[schema.statusField] ?? "scheduled").toLowerCase()
      : "scheduled";

    let normalizedStatus: AppointmentWithDetails["status"] = "scheduled";
    if (status.includes("confirm") || status.includes("potrj")) {
      normalizedStatus = "confirmed";
    } else if (status.includes("complet") || status.includes("zakljuc") || status.includes("done")) {
      normalizedStatus = "completed";
    } else if (status.includes("cancel") || status.includes("odpoved") || status.includes("preklic")) {
      normalizedStatus = "cancelled";
    } else if (status.includes("no_show") || status.includes("ni_prisel") || status.includes("no show")) {
      normalizedStatus = "no_show";
    }

    const clientEmail = String(
      pickFirst(row, ["Email", "client_email", "stranka_email", "Email stranke", "email"]) ?? ""
    );
    const clientPhone = String(
      pickFirst(row, ["Telefon", "Telefonska številka", "client_phone", "stranka_telefon", "Telefon stranke", "telefon", "phone"]) ?? ""
    );
    const language = pickLanguage(row, clientId ? clientLanguageMap.get(clientId) : undefined);
    const notes = String(pickFirst(row, ["opombe", "notes", "Opombe", "description", "opis"]) ?? "");
    const interneOpombe = String(pickFirst(row, ["Interne opombe", "interne_opombe", "internal_notes"]) ?? "");

    let serviceData = serviceMap.get(serviceId) || null;
    if (!serviceData && schema.serviceNameField) {
      const directServiceName = String(row[schema.serviceNameField] ?? "");
      if (directServiceName) {
        for (const [, svc] of serviceMap) {
          if (svc.naziv.toLowerCase() === directServiceName.toLowerCase()) {
            serviceData = svc;
            break;
          }
        }
        if (!serviceData) {
          serviceData = { id: "", naziv: directServiceName, barva: "#6366F1", trajanje: 0 };
        }
      }
    }

    const { serviceId2, serviceId3 } = extractAdditionalServiceIds(row);
    const storitev2 = serviceId2 ? serviceMap.get(serviceId2) || null : null;
    const storitev3 = serviceId3 ? serviceMap.get(serviceId3) || null : null;

    const pricing = extractPricingFields(row);
    const promo = extractPromotionFields(row);
    const addOn = extractAddOnFields(row);
    const addOnService = addOn.add_on_storitev_id ? serviceMap.get(addOn.add_on_storitev_id) || null : null;

    const beleziTermin = row["belezi_termin"];
    const belezi_termin = beleziTermin === false || beleziTermin === 0 ? false : true;
    const deletedAt = row["deleted_at"];
    const deleted_at = deletedAt && String(deletedAt) !== "null" ? String(deletedAt) : null;
    const id_termina = row["ID termina"] ? String(row["ID termina"]) : undefined;

    // Ghost termini with deleted_at set are soft-deleted — exclude from all views.
    if (deleted_at !== null) continue;

    appointments.push({
      id,
      id_termina,
      datum: bookingDate.toISOString(),
      cas_zacetek: startTime,
      cas_konec: endTime,
      stranka_id: clientId || undefined,
      stranka_ime: clientName,
      stranka_priimek: (clientId && clientPriimekMap.get(clientId)) || undefined,
      stranka_email: clientEmail || undefined,
      stranka_telefon: clientPhone || undefined,
      language,
      storitev_id: serviceId || undefined,
      storitev_id_2: serviceId2 || undefined,
      storitev_id_3: serviceId3 || undefined,
      add_on_storitev_id: addOn.add_on_storitev_id,
      add_on_naziv: addOn.add_on_naziv,
      add_on_trajanje: addOn.add_on_trajanje,
      zaposleni_id: staffId || undefined,
      status: normalizedStatus,
      opombe: notes || undefined,
      interne_opombe: interneOpombe || undefined,
      cena: pricing.cena,
      popust: pricing.popust,
      popust_tip: pricing.popust_tip as "eur" | "percent" | null,
      koncna_cena: pricing.koncna_cena,
      promocija_tip: promo.promocija_tip,
      promocija_naziv: promo.promocija_naziv,
      popust_id: promo.popust_id,
      happy_hour_id: promo.happy_hour_id,
      add_on_popust: addOn.add_on_popust,
      add_on_popust_tip: addOn.add_on_popust_tip,
      add_on_final_cena: addOn.add_on_final_cena,
      valuta: addOn.valuta,
      belezi_termin,
      deleted_at,
      storitev: serviceData,
      storitev_2: storitev2,
      storitev_3: storitev3,
      add_on_storitev: addOnService,
      zaposleni: staffMap.get(staffId) || null,
    });
  }

  appointments.sort((a, b) => {
    const dateCompare = new Date(a.datum).getTime() - new Date(b.datum).getTime();
    if (dateCompare !== 0) return dateCompare;
    return a.cas_zacetek.localeCompare(b.cas_zacetek);
  });

  return appointments;
}

function buildServices(services: Row[]): Storitev[] {
  const out: Storitev[] = [];
  for (const row of services) {
    const service = parseService(row);
    if (service) out.push(service);
  }
  out.sort((a, b) => a.naziv.localeCompare(b.naziv));
  return out;
}

function buildEmployees(staff: Row[]): (Zaposleni & { initials: string })[] {
  const out: (Zaposleni & { initials: string })[] = [];
  for (const row of staff) {
    const person = parseStaff(row);
    if (person) out.push(person);
  }
  out.sort((a, b) => a.priimek.localeCompare(b.priimek));
  return out;
}

// Absences: same shape/logic as fetchAbsences (lib/supabase/appointments.ts) —
// company-wide, CONFIRMED only, joined against Osebe for name/initials/color.
// No date scoping (the existing client fetcher doesn't scope by date either).
async function buildAbsences(supabase: ServerClient, companyId: string): Promise<Absence[]> {
  const { data: absencesData, error } = await supabase
    .from("absences")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "CONFIRMED");

  if (error) {
    if (error.code === "42P01" || error.message?.includes('relation "absences" does not exist')) {
      return [];
    }
    console.warn("[Calendar.server] absences fetch error:", error.message);
    return [];
  }

  const rows = (absencesData as Row[] | null) ?? [];

  const staffMap = new Map<string, { name: string; initials: string; color?: string }>();
  const employeeIds = [
    ...new Set(
      rows
        .map((r) => r.employee_id)
        .filter((id) => id !== null && id !== undefined)
        .map((id) => Number(id))
        .filter((id) => !isNaN(id))
    ),
  ];

  if (employeeIds.length > 0) {
    const { data: osebe } = await supabase
      .from("Osebe")
      .select("id, Ime, Priimek, Barva")
      .in("id", employeeIds);

    for (const row of (osebe as Row[] | null) ?? []) {
      const id = String(row.id ?? "");
      if (!id) continue;
      const ime = String(row.Ime ?? "");
      const priimek = String(row.Priimek ?? "");
      const name = `${ime} ${priimek}`.trim();
      const initials = `${ime.charAt(0)}${priimek.charAt(0)}`.toUpperCase();
      const color = row.Barva ? String(row.Barva) : undefined;
      staffMap.set(id, { name, initials, color });
    }
  }

  const normTs = (raw: string) => raw.replace(" ", "T").replace(/([+-]\d{2}:\d{2}|[+-]\d{2}|Z)$/, "");

  return rows.map((row) => {
    const employeeId = row.employee_id ? String(row.employee_id) : undefined;
    const employeeData = employeeId ? staffMap.get(employeeId) : undefined;
    const rawStartAt = row.start_at ? String(row.start_at) : "";
    const rawEndAt = row.end_at ? String(row.end_at) : "";

    return {
      id: String(row.id ?? ""),
      company_id: String(row.company_id ?? ""),
      employee_id: employeeId,
      start_at: normTs(rawStartAt),
      end_at: normTs(rawEndAt),
      reason: String(row.reason ?? ""),
      status: String(row.status ?? ""),
      employee_name: employeeData?.name,
      employee_initials: employeeData?.initials,
      employee_color: employeeData?.color,
    };
  });
}

// Events for a single day (the default day-view range), mirroring fetchEvents'
// overlap logic (lib/supabase/events.ts) for a dateFrom === dateTo window.
async function buildEvents(supabase: ServerClient, companyId: string, dateFrom: string, dateTo: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("company_id", companyId)
    .lte("event_date", dateTo);

  if (error) {
    if (error.code === "42P01" || error.message?.includes('relation "events" does not exist')) {
      return [];
    }
    console.warn("[Calendar.server] events fetch error:", error.message);
    return [];
  }

  const rows = (data as Row[] | null) ?? [];

  return rows.filter((row) => {
    const endDate = (row.end_date as string | null) ?? (row.event_date as string);
    if (endDate < dateFrom) return false;

    const vis = row.is_visible;
    if (vis === false || vis === 0 || vis === "false") return false;

    const status = String(row.status ?? "").toLowerCase();
    if (status === "cancelled" || status === "deleted" || status === "inactive") return false;

    return true;
  }) as unknown as CalendarEvent[];
}

function parseResurs(row: Row): Resurs | null {
  const id = String(row["ID resursa"] ?? "");
  if (!id) return null;

  let urnik = null;
  const urnikRaw = row["Urnik"];
  if (urnikRaw && typeof urnikRaw === "string") {
    try {
      urnik = JSON.parse(urnikRaw);
    } catch {
      urnik = null;
    }
  } else if (urnikRaw && typeof urnikRaw === "object") {
    urnik = urnikRaw;
  }

  const kolicina = Number(row["Kolicina"] ?? 1) || 1;
  const kapaciteta = Number(row["Kapaciteta"] ?? 1) || 1;
  const prikaziRaw = row["Prikazi v bookingu"];
  const prikazi = prikaziRaw === "true" || prikaziRaw === true;
  const statusRaw = String(row["Status"] ?? "active").toLowerCase();
  const status: "active" | "inactive" = statusRaw === "inactive" ? "inactive" : "active";
  const rowId = Number(row["id"]) || 0;

  return {
    id,
    row_id: rowId,
    naziv: String(row["Naziv"] ?? ""),
    booking_naziv: row["Booking naziv"] ? String(row["Booking naziv"]) : null,
    opis: row["Opis"] ? String(row["Opis"]) : null,
    kolicina,
    kapaciteta,
    prikazi_v_bookingu: prikazi,
    urnik,
    status,
    barva: String(row["Barva"] ?? "linear-gradient(135deg, #06B6D4 0%, #3B82F6 50%, #8B5CF6 100%)"),
    podjetje_id: String(row["ID podjetja"] ?? ""),
    created_at: String(row["created_at"] ?? new Date().toISOString()),
    skupna_kapaciteta: kolicina * kapaciteta,
  } as Resurs;
}

async function buildActiveResursi(supabase: ServerClient, companyId: string): Promise<Resurs[]> {
  const { data, error } = await supabase
    .from("Resursi")
    .select("*")
    .eq("ID podjetja", companyId)
    .eq("Status", "active")
    .order("Naziv");

  if (error) {
    console.warn("[Calendar.server] active resursi fetch error:", error.message);
    return [];
  }

  const out: Resurs[] = [];
  for (const row of (data as Row[] | null) ?? []) {
    const r = parseResurs(row);
    if (r) out.push(r);
  }
  return out;
}

async function buildTerminResursiLinks(
  supabase: ServerClient,
  companyId: string
): Promise<{ terminIds: number[]; mapEntries: [number, number[]][] }> {
  const { data, error } = await supabase
    .from("Termini_Resursi")
    .select("termin_id, resurs_id")
    .eq("ID podjetja", companyId);

  if (error) {
    console.warn("[Calendar.server] Termini_Resursi fetch error:", error.message);
    return { terminIds: [], mapEntries: [] };
  }

  const rows = (data as Row[] | null) ?? [];

  const terminIdSet = new Set<number>();
  const map = new Map<number, Set<number>>();
  for (const row of rows) {
    const terminId = Number(row["termin_id"]);
    const resursId = Number(row["resurs_id"]);
    if (!isNaN(terminId) && terminId > 0) terminIdSet.add(terminId);
    if (!resursId || !terminId) continue;
    if (!map.has(resursId)) map.set(resursId, new Set());
    map.get(resursId)!.add(terminId);
  }

  return {
    terminIds: [...terminIdSet],
    mapEntries: [...map.entries()].map(([resursId, ids]) => [resursId, [...ids]]),
  };
}

export interface CalendarInitialData {
  /** Company this payload was fetched for (from the company_id cookie). The
   *  client must discard the seed if its own resolved companyId differs. */
  companyId: string;
  /** yyyy-MM-dd date this payload was seeded for — the client only uses it when
   *  its own "today" (and default day view) still matches. */
  seededForDate: string;
  appointments: AppointmentWithDetails[];
  services: Storitev[];
  employees: (Zaposleni & { initials: string })[];
  absences: Absence[];
  events: CalendarEvent[];
  /** Serialized as arrays (not Set/Map) to avoid relying on RSC serialization of
   *  non-plain types; the client reconstructs Set/Map on the way in. */
  terminIdsWithResursi: number[];
  terminResursiMapEntries: [number, number[]][];
  activeResursi: Resurs[];
  /** True when the caller is staff restricted to their own appointments (already
   *  applied server-side to `appointments`). */
  ownOnly: boolean;
}

/**
 * Loads the Koledar page's initial data server-side, scoped to the current
 * month (appointments) and today (events) — the default day-view landing
 * state. Returns null when there is no authenticated session (page should
 * fall back to the existing fully-client fetch path).
 *
 * NOT called anywhere yet — added in isolation ahead of the page/component
 * wiring so it can be reviewed and reverted independently.
 */
export async function fetchCalendarDataServer(companyId: string): Promise<CalendarInitialData | null> {
  if (!companyId || companyId.trim() === "") return null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { ownOnly, personId } = await resolveViewScope(supabase, user.id);
  const ownOnlyPersonId = ownOnly && personId ? personId : null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayStr = now.toISOString().split("T")[0];
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const nextMonthDate = new Date(year, month + 1, 1);
  const nextMonthStart = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}-01`;

  const [bookings, services, staff, clients, absences, events, activeResursi, terminResursiLinks] =
    await Promise.all([
      fetchBookingsForMonth(supabase, companyId, monthStart, nextMonthStart),
      fetchTableOnce(supabase, TABLES.services, companyId),
      fetchTableOnce(supabase, TABLES.staff, companyId),
      fetchTableOnce(supabase, TABLES.clients, companyId),
      buildAbsences(supabase, companyId),
      buildEvents(supabase, companyId, todayStr, todayStr),
      buildActiveResursi(supabase, companyId),
      buildTerminResursiLinks(supabase, companyId),
    ]);

  return {
    companyId,
    seededForDate: todayStr,
    appointments: buildAppointments(bookings, services, staff, clients, year, month, ownOnlyPersonId),
    services: buildServices(services),
    employees: buildEmployees(staff),
    absences,
    events,
    terminIdsWithResursi: terminResursiLinks.terminIds,
    terminResursiMapEntries: terminResursiLinks.mapEntries,
    activeResursi,
    ownOnly: !!ownOnlyPersonId,
  };
}
