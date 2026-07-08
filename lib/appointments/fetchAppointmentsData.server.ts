// lib/appointments/fetchAppointmentsData.server.ts
//
// Server-side loader for the Termini (appointments) page. Session-aware,
// de-duplicated counterpart to the browser fetchAllAppointments + fetchServices
// + fetchEmployees trio used by the page today.
//
// Differences from the browser path, both deliberate:
//  1. Runs on the server with the user's COOKIE session (createServerSupabaseClient),
//     so RLS (auth.uid()) is satisfied.
//  2. Fetches each table ONCE and derives appointments + services + employees from
//     the shared rows. (The page currently calls fetchAllAppointments AND
//     fetchServices AND fetchEmployees, so services/staff were each fetched twice.)
//  3. For staff restricted to their own appointments (view-own-only), the
//     appointments are pre-filtered SERVER-SIDE so other people's data never leaves
//     the server — instead of shipping everyone's rows and hiding them in the client.
//
// The appointment assembly mirrors fetchAllAppointments exactly, reusing the same
// exported parse helpers, so the produced objects are identical. The browser
// functions in lib/supabase/appointments.ts are left untouched.

import "server-only";
import { startOfMonth, subMonths, format } from "date-fns";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { detectBookingSchema, pickFirst } from "@/lib/dashboardHelpers";
import { TABLES } from "@/lib/data";
import { normalizeCommunicationLanguage } from "@/lib/communicationLanguage";
import {
  parseService,
  parseStaff,
  parseBookingDate,
  extractAdditionalServiceIds,
  extractPricingFields,
  extractPromotionFields,
} from "@/lib/supabase/appointments";
import type { AppointmentWithDetails, Storitev, Zaposleni } from "@/types/appointments";

type Row = Record<string, unknown>;
type ServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

const CLIENT_ID_FIELDS = ["ID stranke", "id", "ID_stranke", "client_id"];
const CLIENT_LAST_NAME_FIELDS = ["Priimek", "priimek", "last_name", "lastName", "surname"];
const LANGUAGE_FIELDS = ["language", "Language", "Jezik komunikacije", "jezik_komunikacije", "Jezik", "jezik", "preferred_language"];

function pickLanguage(row: Row, fallback?: unknown) {
  return normalizeCommunicationLanguage(pickFirst(row, LANGUAGE_FIELDS) ?? fallback);
}

export interface AppointmentsInitialData {
  appointments: AppointmentWithDetails[];
  services: Storitev[];
  employees: (Zaposleni & { initials: string })[];
  /** True when the caller is staff restricted to their own appointments (already
   *  applied server-side). Informational; the client also derives this itself. */
  ownOnly: boolean;
  /** The earliest date (yyyy-MM-dd) included in this fetch. The client uses it as
   *  the "loaded window start": date filters at or after it are handled purely
   *  client-side; a date filter earlier than it triggers a range expansion. */
  windowFrom: string;
}

/** The bookings date column (confirmed a proper Postgres `date`). */
const DATE_COLUMN = "Datum";

/** Default window start: the first day of the previous month. Everything from
 *  here into the future is loaded up front; older history loads on demand. */
export function defaultWindowFrom(now: Date = new Date()): string {
  return format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
}

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
      console.warn(`[Appointments.server] ${tableName} fetch error:`, error.message);
      return [];
    }
  }
  return [];
}

// Bookings scoped to [fromDate, ∞) via a DB-level date filter on "Datum" — this
// is what actually reduces the payload (old history is not fetched). If the date
// column is somehow absent, degrade to a full fetch rather than losing all rows.
async function fetchBookingsFrom(
  supabase: ServerClient,
  companyId: string,
  fromDate: string
): Promise<Row[]> {
  for (const col of COMPANY_COLUMN_CANDIDATES) {
    const { data, error } = await supabase
      .from(TABLES.bookings)
      .select("*")
      .eq(col, companyId)
      .gte(DATE_COLUMN, fromDate)
      .limit(5000);
    if (!error) return (data as Row[] | null) ?? [];
    if (isMissingColumnError(error)) {
      // The missing column could be the company col OR "Datum". Retry this company
      // column without the date filter; if that works, the date column was the
      // problem and we fall back to the full set.
      const { data: d2, error: e2 } = await supabase
        .from(TABLES.bookings)
        .select("*")
        .eq(col, companyId)
        .limit(5000);
      if (!e2) return (d2 as Row[] | null) ?? [];
      continue; // company column invalid — try the next candidate
    }
    console.warn(`[Appointments.server] Termini fetch error:`, error.message);
    return [];
  }
  return [];
}

// Resolve the caller's role/person, and whether they are restricted to their own
// appointments. Mirrors useRolePermissions + the page's staffViewOwnOnly:
//   staffViewOwnOnly = role==='staff' &&
//     (can_view_only_own_appointments === true || can_view_all_appointments === false)
// company_members carries role, person_id AND the company UUID used to key
// staff_role_permissions, so no extra companies lookup is needed.
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

// Assembly ported from fetchAllAppointments (lib/supabase/appointments.ts). Same
// field lists, same normalization, same output shape — reusing the exported parse
// helpers. `ownOnlyPersonId`, when set, restricts to that person's appointments.
function buildAppointments(
  bookings: Row[],
  services: Row[],
  staff: Row[],
  clients: Row[],
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
    if (!bookingDate) continue;

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
      belezi_termin,
      deleted_at,
      storitev: serviceData,
      storitev_2: storitev2,
      storitev_3: storitev3,
      zaposleni: staffMap.get(staffId) || null,
    });
  }

  appointments.sort((a, b) => {
    const dateCompare = new Date(b.datum).getTime() - new Date(a.datum).getTime();
    if (dateCompare !== 0) return dateCompare;
    return b.cas_zacetek.localeCompare(a.cas_zacetek);
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

/**
 * Loads the Termini page's initial data server-side for the given company.
 * Returns null when there is no authenticated session (page should fall back).
 */
export async function fetchAppointmentsDataServer(
  companyId: string,
  fromDate?: string
): Promise<AppointmentsInitialData | null> {
  if (!companyId || companyId.trim() === "") return null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { ownOnly, personId } = await resolveViewScope(supabase, user.id);

  // Default window: previous month → all future. An explicit earlier fromDate
  // (from the range-expansion server action) widens it into older history.
  const windowFrom = fromDate && fromDate.trim() !== "" ? fromDate : defaultWindowFrom();

  const [bookings, services, staff, clients] = await Promise.all([
    fetchBookingsFrom(supabase, companyId, windowFrom),
    fetchTableOnce(supabase, TABLES.services, companyId, 500),
    fetchTableOnce(supabase, TABLES.staff, companyId, 200),
    fetchTableOnce(supabase, TABLES.clients, companyId, 2000),
  ]);

  // For view-own-only staff, restrict to their own person's appointments server-side.
  const ownOnlyPersonId = ownOnly && personId ? personId : null;

  return {
    appointments: buildAppointments(bookings, services, staff, clients, ownOnlyPersonId),
    services: buildServices(services),
    employees: buildEmployees(staff),
    ownOnly: !!ownOnlyPersonId,
    windowFrom,
  };
}
