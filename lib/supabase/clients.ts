import { fetchTableRows } from '@/lib/companyScope';
import { TABLES } from '@/lib/data';
import { detectBookingSchema, pickFirst, safeDate } from '@/lib/dashboardHelpers';
import { normalizeCommunicationLanguage } from '@/lib/communicationLanguage';
import type { Client, ClientWithAppointments, ClientAppointment, ClientStats, Gender, ClientType } from '@/types/clients';

// Re-export Client type for backward compatibility
export type { Client } from '@/types/clients';

// Same candidates as detectClientSchema()'s createdAtField, tried in order.
// Used so `fetchTableRows` orders by newest client first: without this, a
// `.limit()` on a company with more clients than the limit returns an
// arbitrary subset and can silently drop the most recently added clients.
const CLIENT_ORDER_CANDIDATES = ['Datum vpisa', 'datum_vpisa', 'created_at', 'Created', 'datum_vnosa', 'Datum vnosa'];

// Detect client schema from a row
function detectClientSchema(row: Record<string, unknown>) {
  const keys = Object.keys(row);
  const pickField = (candidates: string[]) =>
    candidates.find((candidate) => keys.includes(candidate));

  return {
    idField: pickField(['ID stranke', 'id', 'ID_stranke', 'client_id']),
    firstNameField: pickField(['Ime', 'ime', 'first_name', 'firstName', 'name']),
    lastNameField: pickField(['Priimek', 'priimek', 'last_name', 'lastName', 'surname']),
    genderField: pickField(['Spol', 'spol', 'gender', 'Gender']),
    clientTypeField: pickField(['Tip stranke', 'tip_stranke', 'client_type', 'Tip Stranke']),
    languageField: pickField(['language', 'Language', 'Jezik komunikacije', 'jezik_komunikacije', 'Jezik', 'jezik', 'preferred_language']),
    emailField: pickField(['Email', 'email', 'e-mail', 'E-mail', 'Email stranke']),
    phoneField: pickField(['Telefonska številka', 'Telefon', 'telefon', 'phone', 'Phone', 'tel']),
    notesField: pickField(['Opombe stranke', 'Opombe', 'opombe', 'notes', 'Notes', 'Opombe strank']),
    internalNotesField: pickField(['Interne opombe', 'interne_opombe', 'internal_notes', 'Internal notes']),
    colorField: pickField(['Barva', 'barva', 'color', 'Color']),
    companyField: pickField(['podjetje_id', 'company_id', 'Podjetje']),
    createdAtField: pickField(['Datum vpisa', 'datum_vpisa', 'created_at', 'Created', 'datum_vnosa', 'Datum vnosa']),
    updatedAtField: pickField(['updated_at', 'Updated', 'datum_posodobitve']),
    lastInteractionField: pickField(['Zadnja interakcija', 'zadnja_interakcija', 'last_interaction', 'Last Interaction']),
  };
}

// Parse client from raw row
export function parseClient(row: Record<string, unknown>): Client | null {
  const schema = detectClientSchema(row);
  const id = schema.idField ? String(row[schema.idField] ?? '') : '';
  if (!id) return null;

  // Parse gender
  let spol: Gender | null = null;
  if (schema.genderField) {
    const genderValue = row[schema.genderField];
    if (typeof genderValue === 'string') {
      const genderLower = genderValue.toLowerCase().trim();
      if (genderLower === 'moški' || genderLower === 'moski' || genderLower === 'male' || genderLower === 'm') {
        spol = 'moški';
      } else if (genderLower === 'ženska' || genderLower === 'zenska' || genderLower === 'female' || genderLower === 'f') {
        spol = 'ženska';
      } else if (genderLower === 'drugo' || genderLower === 'other' || genderLower === 'o') {
        spol = 'drugo';
      }
    }
  }

  // Parse client type (Tip stranke) — read stored value, no override fallback
  let tipStranke: ClientType | null = null;
  if (schema.clientTypeField) {
    const typeValue = row[schema.clientTypeField];
    if (typeof typeValue === 'string') {
      const v = typeValue.toLowerCase().trim();
      if (v === 'redna') tipStranke = 'redna';
      else if (v === 'vip') tipStranke = 'vip';
      else if (v === 'nova') tipStranke = 'nova';
    }
  }

  // Parse last interaction date - return null if empty or invalid
  let zadnjaInterakcija: string | null = null;
  if (schema.lastInteractionField) {
    const rawValue = row[schema.lastInteractionField];
    if (rawValue && typeof rawValue === 'string' && rawValue.trim() !== '') {
      zadnjaInterakcija = rawValue;
    }
  }

  return {
    id,
    ime: schema.firstNameField ? String(row[schema.firstNameField] ?? '') : '',
    priimek: schema.lastNameField ? String(row[schema.lastNameField] ?? '') : '',
    spol, // Read from "Spol" column
    tip_stranke: tipStranke, // Read from "Tip stranke" column
    language: normalizeCommunicationLanguage(schema.languageField ? row[schema.languageField] : undefined),
    email: schema.emailField ? String(row[schema.emailField] ?? '') : '',
    telefon: schema.phoneField ? String(row[schema.phoneField] ?? '') || null : null,
    opombe: schema.notesField ? String(row[schema.notesField] ?? '') || null : null, // Always include opombe
    interne_opombe: schema.internalNotesField ? String(row[schema.internalNotesField] ?? '') || null : null,
    barva: schema.colorField ? String(row[schema.colorField] ?? '') || null : null,
    podjetje_id: schema.companyField ? String(row[schema.companyField] ?? '') : '',
    created_at: schema.createdAtField ? String(row[schema.createdAtField] ?? new Date().toISOString()) : new Date().toISOString(),
    updated_at: schema.updatedAtField ? String(row[schema.updatedAtField] ?? '') : undefined,
    zadnja_interakcija: zadnjaInterakcija, // Read from "Zadnja interakcija" column
  };
}

const normalizeText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const normalizeOptionalText = (value: unknown): string | null => {
  const normalized = normalizeText(value);
  return normalized ? normalized : null;
};

const extractFirstId = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeText(item);
      if (normalized) return normalized;
    }
    return '';
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return extractFirstId(parsed);
      } catch {
        // Fall through to comma parsing.
      }
    }
    if (trimmed.includes(',')) {
      return trimmed.split(',')[0].trim();
    }
    return trimmed;
  }
  if (typeof value === 'number') return String(value);
  return '';
};

const pickValue = (row: Record<string, unknown>, keys: Array<string | undefined>) => {
  const filtered = keys.filter((key): key is string => Boolean(key && key.length > 0));
  return pickFirst(row, filtered);
};

const resolveServiceId = (
  row: Record<string, unknown>,
  schema: ReturnType<typeof detectBookingSchema>
) => {
  const raw = pickValue(row, [
    schema.serviceIdField,
    'ID storitev',
    'ID storitve',
    'ID_storitve',
    'storitev_id',
    'service_id',
    'service_ids',
    'ID storitve 2',
    'ID storitev 2',
    'ID storitve 3',
    'ID storitev 3',
  ]);
  return extractFirstId(raw);
};

const buildServiceLookups = (rows: Record<string, unknown>[]) => {
  const byId = new Map<string, { naziv: string; barva: string }>();
  const byName = new Map<string, { naziv: string; barva: string }>();

  for (const row of rows) {
    const id = normalizeText(pickValue(row, ['id', 'ID storitev', 'ID storitve', 'ID_storitve', 'service_id']));
    const naziv = normalizeText(pickValue(row, ['Naziv', 'naziv', 'Storitev', 'name', 'service_name']));
    const barva = normalizeText(pickValue(row, ['Barva', 'barva', 'color', 'Color'])) || '#6366F1';

    if (id) {
      byId.set(id, { naziv, barva });
    }
    if (naziv) {
      byName.set(naziv.toLowerCase(), { naziv, barva });
    }
  }

  return { byId, byName };
};

// Fetch all clients with appointment count
export async function fetchClientsWithCount(companyId: string): Promise<{
  data: Client[] | null;
  error: Error | null;
}> {
  try {
    // Fetch clients
    const clientsResult = await fetchTableRows<Record<string, unknown>>(TABLES.clients, companyId, 1000, CLIENT_ORDER_CANDIDATES);

    if (clientsResult.error) {
      throw new Error(clientsResult.error);
    }

    // Fetch appointments to count per client
    const appointmentsResult = await fetchTableRows<Record<string, unknown>>(TABLES.bookings, companyId, 5000);

    // Build a map of client ID to appointment count
    const appointmentCounts = new Map<string, number>();
    for (const apt of appointmentsResult.data ?? []) {
      const clientId = apt['ID stranke'] || apt['stranka_id'] || apt['client_id'];
      if (clientId) {
        const id = String(clientId);
        appointmentCounts.set(id, (appointmentCounts.get(id) || 0) + 1);
      }
    }

    const clients: Client[] = [];
    for (const row of clientsResult.data ?? []) {
      const client = parseClient(row);
      if (client) {
        client.appointment_count = appointmentCounts.get(client.id) || 0;
        clients.push(client);
      }
    }

    // Sort by last name, then first name
    clients.sort((a, b) => {
      const lastNameCompare = a.priimek.localeCompare(b.priimek, 'sl');
      if (lastNameCompare !== 0) return lastNameCompare;
      return a.ime.localeCompare(b.ime, 'sl');
    });

    return { data: clients, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch clients'),
    };
  }
}

// Legacy function for backward compatibility
export async function fetchClients(companyId: string): Promise<{
  data: Client[] | null;
  error: Error | null;
}> {
  return fetchClientsWithCount(companyId);
}

// Search clients by query (searches name, email, phone)
export async function searchClients(
  companyId: string,
  query: string
): Promise<{ data: Client[] | null; error: Error | null }> {
  try {
    const result = await fetchTableRows<Record<string, unknown>>(TABLES.clients, companyId, 1000);

    if (result.error) {
      throw new Error(result.error);
    }

    const searchLower = query.toLowerCase().trim();
    if (!searchLower) {
      return { data: [], error: null };
    }

    const clients: Client[] = [];
    for (const row of result.data ?? []) {
      const client = parseClient(row);
      if (!client) continue;

      // Search in all fields
      const fullName = `${client.ime} ${client.priimek}`.toLowerCase();
      const email = client.email.toLowerCase();
      const phone = (client.telefon || '').toLowerCase();

      if (
        fullName.includes(searchLower) ||
        email.includes(searchLower) ||
        phone.includes(searchLower) ||
        client.ime.toLowerCase().includes(searchLower) ||
        client.priimek.toLowerCase().includes(searchLower)
      ) {
        clients.push(client);
      }
    }

    // Limit results
    return { data: clients.slice(0, 10), error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to search clients'),
    };
  }
}

// Get client by ID with appointments
export async function getClientWithAppointments(
  companyId: string,
  clientId: string
): Promise<{ data: ClientWithAppointments | null; error: Error | null }> {
  try {
    const [clientsResult, appointmentsResult, servicesResult] = await Promise.all([
      fetchTableRows<Record<string, unknown>>(TABLES.clients, companyId, 1000),
      fetchTableRows<Record<string, unknown>>(TABLES.bookings, companyId, 1000),
      fetchTableRows<Record<string, unknown>>(TABLES.services, companyId, 1000),
    ]);

    if (clientsResult.error) {
      throw new Error(clientsResult.error);
    }
    if (appointmentsResult.error) {
      throw new Error(appointmentsResult.error);
    }

    // Find the client
    let client: Client | null = null;
    for (const row of clientsResult.data ?? []) {
      const parsed = parseClient(row);
      if (parsed && parsed.id === clientId) {
        client = parsed;
        break;
      }
    }

    if (!client) {
      return { data: null, error: null };
    }

    const { byId: serviceById, byName: serviceByName } = buildServiceLookups(servicesResult.data ?? []);

    const appointments: ClientAppointment[] = [];
    for (const apt of appointmentsResult.data ?? []) {
      const aptClientId = apt['ID stranke'] || apt['stranka_id'] || apt['client_id'];
      if (String(aptClientId) === clientId) {
        const schema = detectBookingSchema(apt);
        const serviceId = resolveServiceId(apt, schema);
        const rawServiceName = pickValue(apt, [
          schema.serviceNameField,
          'storitev_naziv',
          'Storitev',
          'service',
          'service_name',
        ]);
        const normalizedServiceName = normalizeText(rawServiceName);
        const serviceFromId = serviceId ? serviceById.get(serviceId) : undefined;
        const serviceFromName = !serviceFromId && normalizedServiceName
          ? serviceByName.get(normalizedServiceName.toLowerCase())
          : undefined;
        const addOnServiceId = normalizeOptionalText(
          pickValue(apt, ['add_on_storitev_id', 'add_on_service_id', 'addOnStoritevId'])
        );
        const addOnService = addOnServiceId ? serviceById.get(addOnServiceId) : undefined;
        const addOnNaziv = normalizeOptionalText(
          pickValue(apt, ['add_on_naziv', 'add_on_name', 'addOnNaziv'])
        );
        const addOnTrajanjeValue = pickValue(apt, ['add_on_trajanje', 'add_on_duration', 'addOnTrajanje']);
        const addOnTrajanje = addOnTrajanjeValue !== null && addOnTrajanjeValue !== undefined && String(addOnTrajanjeValue).trim() !== ''
          ? Number(addOnTrajanjeValue)
          : null;
        const appointmentNotes = normalizeOptionalText(pickValue(apt, ['Opombe', 'opombe', 'notes', 'Notes']));
        const appointmentInternalNotes = normalizeOptionalText(
          pickValue(apt, ['Interne opombe', 'interne_opombe', 'internal_notes', 'Internal notes'])
        );
        const finalPrice = normalizeOptionalText(
          pickValue(apt, ['Final cena', 'FInal cena', 'final_cena', 'koncna_cena', 'finalna_cena', 'final_total_price'])
        );
        const valuta = normalizeOptionalText(
          pickValue(apt, ['Valuta', 'valuta', 'currency', 'Currency'])
        );
        const opombePoZakljucku = normalizeOptionalText(
          pickValue(apt, ['opombe_po_zakljucku', 'Opombe po zaključku', 'opombe po zakljucku'])
        );
        const statusValue = pickValue(apt, [schema.statusField, 'status', 'Status', 'stanje', 'Stanje']);
        const idValue = pickValue(apt, [schema.idField, 'id', 'ID', 'ID termina', 'ID_termina']);
        const dateValue = pickValue(apt, [schema.dateField, 'datum', 'Datum', 'date', 'Date', schema.startAtField]);
        const startTimeValue = pickValue(apt, [
          schema.startTimeField,
          'cas_zacetek',
          'Čas',
          'Cas',
          'start_time',
          'time',
          schema.startAtField,
        ]);
        const endTimeValue = pickValue(apt, [
          schema.endTimeField,
          'cas_konec',
          'Konec',
          'konec',
          'end_time',
          'ura_do',
        ]);

        appointments.push({
          id: normalizeText(idValue),
          datum: normalizeText(dateValue),
          cas_zacetek: normalizeText(startTimeValue),
          cas_konec: normalizeText(endTimeValue),
          storitev_naziv: normalizedServiceName || serviceFromId?.naziv || serviceFromName?.naziv || '',
          storitev_barva: normalizeText(pickValue(apt, ['storitev_barva'])) || serviceFromId?.barva || serviceFromName?.barva || '#6366F1',
          add_on_naziv: addOnNaziv,
          add_on_barva: addOnService?.barva || null,
          add_on_trajanje: addOnTrajanje !== null && Number.isFinite(addOnTrajanje) ? addOnTrajanje : null,
          zaposleni_ime: normalizeText(pickValue(apt, ['zaposleni_ime', 'Zaposleni', 'employee', 'Oseba', 'oseba'])),
          status: normalizeText(statusValue) || 'scheduled',
          opombe: appointmentNotes,
          interne_opombe: appointmentInternalNotes,
          koncna_cena: finalPrice,
          valuta: valuta,
          opombe_po_zakljucku: opombePoZakljucku,
        });
      }
    }

    // Sort by date descending
    appointments.sort((a, b) => {
      const dateA = safeDate(a.datum)?.getTime() ?? 0;
      const dateB = safeDate(b.datum)?.getTime() ?? 0;
      return dateB - dateA;
    });

    return {
      data: {
        ...client,
        appointments,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to get client'),
    };
  }
}

// Get client by ID
export async function getClientById(
  companyId: string,
  clientId: string
): Promise<{ data: Client | null; error: Error | null }> {
  try {
    const result = await fetchTableRows<Record<string, unknown>>(TABLES.clients, companyId, 1000);

    if (result.error) {
      throw new Error(result.error);
    }

    for (const row of result.data ?? []) {
      const client = parseClient(row);
      if (client && client.id === clientId) {
        return { data: client, error: null };
      }
    }

    return { data: null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to get client'),
    };
  }
}

// Check if email already exists for another client
export async function checkEmailExists(
  companyId: string,
  email: string,
  excludeClientId?: string
): Promise<{ exists: boolean; error: Error | null }> {
  try {
    const result = await fetchTableRows<Record<string, unknown>>(TABLES.clients, companyId, 1000);

    if (result.error) {
      throw new Error(result.error);
    }

    const emailLower = email.toLowerCase().trim();

    for (const row of result.data ?? []) {
      const client = parseClient(row);
      if (client && client.email.toLowerCase() === emailLower) {
        if (excludeClientId && client.id === excludeClientId) {
          continue;
        }
        return { exists: true, error: null };
      }
    }

    return { exists: false, error: null };
  } catch (err) {
    return {
      exists: false,
      error: err instanceof Error ? err : new Error('Failed to check email'),
    };
  }
}

// Get client statistics
export async function getClientStats(companyId: string): Promise<{
  data: ClientStats | null;
  error: Error | null;
}> {
  try {
    const result = await fetchClientsWithCount(companyId);

    if (result.error) {
      throw result.error;
    }

    const clients = result.data ?? [];
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const stats: ClientStats = {
      total: clients.length,
      withAppointments: clients.filter(c => (c.appointment_count || 0) > 0).length,
      newThisMonth: clients.filter(c => {
        if (!c.created_at) return false;
        // Use safeDate to handle various date formats (dd.mm.yyyy, ISO, etc.)
        const parsedDate = safeDate(c.created_at);
        if (!parsedDate) return false;
        return parsedDate >= startOfMonth;
      }).length,
    };

    return { data: stats, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to get client stats'),
    };
  }
}
