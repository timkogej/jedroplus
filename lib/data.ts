import { supabaseReadOnly } from "@/src/lib/supabaseReadOnly";
import { getCompanyColumnForTable } from "./companyScope";
import { detectIdColumn, detectPrimaryKey } from "./tableIntrospection";

export const TABLES = {
  clients: "Stranke",
  bookings: "Termini",
  services: "Storitve",
  staff: "Osebe",
};

const idColumnCache = new Map<string, string | null>();
const primaryKeyCache = new Map<string, string | null>();

async function getIdColumn(tableName: string, candidates: string[]) {
  if (idColumnCache.has(tableName)) {
    return idColumnCache.get(tableName) ?? null;
  }
  const column = await detectIdColumn(tableName, candidates);
  idColumnCache.set(tableName, column);
  return column;
}

async function getPrimaryKey(tableName: string, fallbackIdColumn?: string | null) {
  if (primaryKeyCache.has(tableName)) {
    return primaryKeyCache.get(tableName) ?? null;
  }
  const column = await detectPrimaryKey(tableName, fallbackIdColumn);
  primaryKeyCache.set(tableName, column);
  return column;
}

export async function fetchClients(companyId: string, limit = 500) {
  const companyColumn = await getCompanyColumnForTable(TABLES.clients, companyId);
  return supabaseReadOnly
    .from(TABLES.clients)
    .select("*")
    .eq(companyColumn, companyId)
    .limit(limit);
}

export async function fetchBookings(companyId: string, limit = 1000) {
  const companyColumn = await getCompanyColumnForTable(TABLES.bookings, companyId);
  return supabaseReadOnly
    .from(TABLES.bookings)
    .select("*")
    .eq(companyColumn, companyId)
    .limit(limit);
}

export async function getClientIdentifier(row: Record<string, unknown>) {
  const idColumn = await getIdColumn(TABLES.clients, [
    "id",
    "ID stranke",
    "client_id",
    "ID",
  ]);
  const primaryKey = await getPrimaryKey(TABLES.clients, idColumn);
  const column = primaryKey ?? idColumn;
  if (!column) return null;
  const value = row[column];
  if (!value) return null;
  return { column, value };
}

export async function getBookingIdentifier(row: Record<string, unknown>) {
  const idColumn = await getIdColumn(TABLES.bookings, [
    "id",
    "ID termina",
    "booking_id",
    "appointment_id",
    "ID_termina",
  ]);
  const primaryKey = await getPrimaryKey(TABLES.bookings, idColumn);
  const column = primaryKey ?? idColumn;
  if (!column) return null;
  const value = row[column];
  if (!value) return null;
  return { column, value };
}

export async function getServiceIdentifier(row: Record<string, unknown>) {
  const idColumn = await getIdColumn(TABLES.services, [
    "id",
    "service_id",
    "ID storitve",
    "ID_storitve",
  ]);
  const primaryKey = await getPrimaryKey(TABLES.services, idColumn);
  const column = primaryKey ?? idColumn;
  if (!column) return null;
  const value = row[column];
  if (!value) return null;
  return { column, value };
}

export async function getStaffIdentifier(row: Record<string, unknown>) {
  const idColumn = await getIdColumn(TABLES.staff, [
    "id",
    "partner_id",
    "person_id",
    "person_human_id",
    "ID osebe",
    "ID Osebe",
    "oseba_id",
  ]);
  const primaryKey = await getPrimaryKey(TABLES.staff, idColumn);
  const column = primaryKey ?? idColumn;
  if (!column) return null;
  const value = row[column];
  if (!value) return null;
  return { column, value };
}

export async function createClient(companyId: string, payload: Record<string, unknown>) {
  throw new Error(
    "Frontend write blocked: use n8n workflow (callN8nAction) instead."
  );
}

export async function updateClient(
  companyId: string,
  identifier: { column: string; value: unknown },
  payload: Record<string, unknown>
) {
  throw new Error(
    "Frontend write blocked: use n8n workflow (callN8nAction) instead."
  );
}

export async function deleteClient(
  companyId: string,
  identifier: { column: string; value: unknown }
) {
  throw new Error(
    "Frontend write blocked: use n8n workflow (callN8nAction) instead."
  );
}

export async function createBooking(companyId: string, payload: Record<string, unknown>) {
  throw new Error(
    "Frontend write blocked: use n8n workflow (callN8nAction) instead."
  );
}

export async function updateBooking(
  companyId: string,
  identifier: { column: string; value: unknown },
  payload: Record<string, unknown>
) {
  throw new Error(
    "Frontend write blocked: use n8n workflow (callN8nAction) instead."
  );
}

export async function deleteBooking(
  companyId: string,
  identifier: { column: string; value: unknown }
) {
  throw new Error(
    "Frontend write blocked: use n8n workflow (callN8nAction) instead."
  );
}

export async function fetchServices(companyId: string, limit = 500) {
  const companyColumn = await getCompanyColumnForTable(TABLES.services, companyId);
  return supabaseReadOnly
    .from(TABLES.services)
    .select("*")
    .eq(companyColumn, companyId)
    .limit(limit);
}

export async function createService(
  companyId: string,
  payload: Record<string, unknown>
) {
  throw new Error(
    "Frontend write blocked: use n8n workflow (callN8nAction) instead."
  );
}

export async function updateService(
  companyId: string,
  identifier: { column: string; value: unknown },
  payload: Record<string, unknown>
) {
  throw new Error(
    "Frontend write blocked: use n8n workflow (callN8nAction) instead."
  );
}

export async function deleteService(
  companyId: string,
  identifier: { column: string; value: unknown }
) {
  throw new Error(
    "Frontend write blocked: use n8n workflow (callN8nAction) instead."
  );
}

export async function fetchStaff(companyId: string, limit = 500) {
  const companyColumn = await getCompanyColumnForTable(TABLES.staff, companyId);
  return supabaseReadOnly
    .from(TABLES.staff)
    .select("*")
    .eq(companyColumn, companyId)
    .limit(limit);
}

export async function createStaff(companyId: string, payload: Record<string, unknown>) {
  throw new Error(
    "Frontend write blocked: use n8n workflow (callN8nAction) instead."
  );
}

export async function updateStaff(
  companyId: string,
  identifier: { column: string; value: unknown },
  payload: Record<string, unknown>
) {
  throw new Error(
    "Frontend write blocked: use n8n workflow (callN8nAction) instead."
  );
}

export async function deleteStaff(
  companyId: string,
  identifier: { column: string; value: unknown }
) {
  throw new Error(
    "Frontend write blocked: use n8n workflow (callN8nAction) instead."
  );
}
