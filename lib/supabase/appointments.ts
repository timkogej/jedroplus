import { fetchTableRows } from '@/lib/companyScope';
import { TABLES } from '@/lib/data';
import { detectBookingSchema, pickFirst } from '@/lib/dashboardHelpers';
import type { AppointmentWithDetails, Storitev, Zaposleni } from '@/types/appointments';
import { supabase } from '@/lib/supabaseClient';

// Absence type with employee details
export interface Absence {
  id: string;
  company_id: string;
  employee_id?: string;
  start_at: string;
  end_at: string;
  reason: string;
  status: string;
  // Employee details (joined from Osebe table)
  employee_name?: string;
  employee_initials?: string;
  employee_color?: string;
}

// Helper function to compute initials from first and last name
function getInitials(ime: string, priimek: string): string {
  const firstInitial = ime?.charAt(0)?.toUpperCase() || '';
  const lastInitial = priimek?.charAt(0)?.toUpperCase() || '';
  return `${firstInitial}${lastInitial}`;
}

// Detect service schema from a row
function detectServiceSchema(row: Record<string, unknown>) {
  const keys = Object.keys(row);
  const pickField = (candidates: string[]) =>
    candidates.find((candidate) => keys.includes(candidate));

  return {
    idField: pickField(['id', 'ID storitev', 'ID storitve', 'ID_storitve', 'service_id']),
    nameField: pickField(['Naziv', 'naziv', 'Storitev', 'name', 'service_name']),
    colorField: pickField(['Barva', 'barva', 'color', 'Color']),
    durationField: pickField(['Trajanje', 'trajanje', 'duration', 'duration_min']),
    totalTimeField: pickField(['skupni_cas', 'Skupni čas', 'total_time', 'total_duration']),
    priceField: pickField(['cena', 'Cena', 'price', 'Price']),
    statusField: pickField(['Status', 'status']),
  };
}

// Detect staff schema from a row
function detectStaffSchema(row: Record<string, unknown>) {
  const keys = Object.keys(row);
  const pickField = (candidates: string[]) =>
    candidates.find((candidate) => keys.includes(candidate));

  return {
    idField: pickField(['id', 'ID osebja', 'ID osebe', 'ID Osebe', 'person_id', 'partner_id']),
    firstNameField: pickField(['Ime', 'ime', 'first_name', 'firstName']),
    lastNameField: pickField(['Priimek', 'priimek', 'last_name', 'lastName']),
    emailField: pickField(['Email', 'email', 'e-mail', 'E-mail']),
    initialsField: pickField(['initials', 'Initials', 'kratice']),
    colorField: pickField(['Barva', 'barva', 'color', 'Color']),
    servicesField: pickField(['Storitve', 'storitve', 'services', 'Services', 'service_ids']),
  };
}

// Parse service from raw row
function parseService(row: Record<string, unknown>): Storitev | null {
  const schema = detectServiceSchema(row);
  const id = schema.idField ? String(row[schema.idField] ?? '') : '';
  if (!id) return null;

  const trajanje = schema.durationField ? Number(row[schema.durationField] ?? 0) : 0;
  const skupni_cas = schema.totalTimeField ? Number(row[schema.totalTimeField] ?? 0) : undefined;
  const rawPrice = schema.priceField ? row[schema.priceField] : null;
  const cena = rawPrice !== null && rawPrice !== undefined && rawPrice !== ''
    ? Number(rawPrice)
    : null;

  return {
    id,
    naziv: schema.nameField ? String(row[schema.nameField] ?? '') : '',
    barva: schema.colorField ? String(row[schema.colorField] ?? '#6366F1') : '#6366F1',
    trajanje,
    skupni_cas: skupni_cas && skupni_cas > 0 ? skupni_cas : undefined,
    cena: cena !== null && !isNaN(cena) ? cena : null,
    status: schema.statusField ? String(row[schema.statusField] ?? '') || null : null,
  };
}

// Parse staff from raw row
function parseStaff(row: Record<string, unknown>): (Zaposleni & { initials: string; barva?: string }) | null {
  const schema = detectStaffSchema(row);
  const id = schema.idField ? String(row[schema.idField] ?? '') : '';
  if (!id) return null;

  const ime = schema.firstNameField ? String(row[schema.firstNameField] ?? '') : '';
  const priimek = schema.lastNameField ? String(row[schema.lastNameField] ?? '') : '';
  const existingInitials = schema.initialsField ? String(row[schema.initialsField] ?? '') : '';
  const barva = schema.colorField ? String(row[schema.colorField] ?? '') : '';

  // Parse services (storitve) - array of service IDs employee can perform
  let storitve: string[] | null = null;
  if (schema.servicesField) {
    const servicesValue = row[schema.servicesField];
    if (servicesValue) {
      if (typeof servicesValue === 'string') {
        try {
          storitve = JSON.parse(servicesValue);
        } catch {
          // Try comma-separated string
          storitve = servicesValue.split(',').map((s) => s.trim()).filter(Boolean);
        }
      } else if (Array.isArray(servicesValue)) {
        storitve = servicesValue.map(String);
      }
    }
  }

  return {
    id,
    ime,
    priimek,
    email: schema.emailField ? String(row[schema.emailField] ?? '') : '',
    initials: existingInitials || getInitials(ime, priimek),
    barva: barva || undefined,
    storitve,
  };
}

// Extract additional service IDs (2 and 3) from raw booking row
function extractAdditionalServiceIds(row: Record<string, unknown>): { serviceId2: string; serviceId3: string } {
  const SERVICE_ID_2_FIELDS = ['ID storitev 2', 'ID storitve 2', 'storitev_id_2', 'service_id_2'];
  const SERVICE_ID_3_FIELDS = ['ID storitev 3', 'ID storitve 3', 'storitev_id_3', 'service_id_3'];

  let serviceId2 = '';
  let serviceId3 = '';

  for (const field of SERVICE_ID_2_FIELDS) {
    const val = row[field];
    if (val && typeof val === 'string' && val.trim() !== '' && val !== 'null') {
      serviceId2 = val.trim();
      break;
    }
  }

  for (const field of SERVICE_ID_3_FIELDS) {
    const val = row[field];
    if (val && typeof val === 'string' && val.trim() !== '' && val !== 'null') {
      serviceId3 = val.trim();
      break;
    }
  }

  return { serviceId2, serviceId3 };
}

// Parse date from booking row - handles various date formats
function parseBookingDate(row: Record<string, unknown>, schema: ReturnType<typeof detectBookingSchema>): Date | null {
  // Try start_at first (ISO timestamp)
  if (schema.startAtField) {
    const startAt = row[schema.startAtField];
    if (startAt) {
      const date = new Date(String(startAt));
      if (!isNaN(date.getTime())) return date;
    }
  }

  // Try date field
  if (schema.dateField) {
    const dateValue = row[schema.dateField];
    if (dateValue) {
      // Handle ISO date string
      if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) return date;

        // Handle dd.mm.yyyy format
        const match = dateValue.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (match) {
          const day = Number(match[1]);
          const month = Number(match[2]) - 1;
          const year = Number(match[3]);
          return new Date(year, month, day);
        }
      }
    }
  }

  return null;
}

// Check if date is within month range
function isDateInMonth(date: Date, year: number, month: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month;
}

// Fetch all appointments for a given month
export async function fetchAppointmentsForMonth(
  companyId: string,
  year: number,
  month: number // 0-indexed (0 = January)
): Promise<{ data: AppointmentWithDetails[] | null; error: Error | null }> {
  try {
    // Fetch all bookings, services, staff, and clients
    const [bookingsRes, servicesRes, staffRes, clientsRes] = await Promise.all([
      fetchTableRows<Record<string, unknown>>(TABLES.bookings, companyId, 2000),
      fetchTableRows<Record<string, unknown>>(TABLES.services, companyId, 500),
      fetchTableRows<Record<string, unknown>>(TABLES.staff, companyId, 200),
      fetchTableRows<Record<string, unknown>>(TABLES.clients, companyId, 2000),
    ]);

    if (bookingsRes.error) {
      throw new Error(bookingsRes.error);
    }

    const bookings = bookingsRes.data ?? [];
    const services = servicesRes.data ?? [];
    const staff = staffRes.data ?? [];
    const clients = clientsRes.data ?? [];

    // Build lookup maps
    const serviceMap = new Map<string, Storitev>();
    for (const row of services) {
      const service = parseService(row);
      if (service) {
        serviceMap.set(service.id, service);
      }
    }

    const staffMap = new Map<string, Zaposleni & { initials: string }>();
    for (const row of staff) {
      const person = parseStaff(row);
      if (person) {
        staffMap.set(person.id, person);
      }
    }

    // Build client surname map: clientId → priimek (from Stranke table)
    const clientPriimekMap = new Map<string, string>();
    for (const row of clients) {
      const rowKeys = Object.keys(row);
      const idField = rowKeys.find(k => ['ID stranke', 'id', 'ID_stranke', 'client_id'].includes(k));
      const priimekField = rowKeys.find(k => ['Priimek', 'priimek', 'last_name', 'lastName', 'surname'].includes(k));
      if (idField && priimekField) {
        const cid = String(row[idField] ?? '');
        const priimek = String(row[priimekField] ?? '');
        if (cid && priimek) clientPriimekMap.set(cid, priimek);
      }
    }

    // Filter and transform bookings for the specified month
    const appointments: AppointmentWithDetails[] = [];

    for (const row of bookings) {
      const schema = detectBookingSchema(row);
      const bookingDate = parseBookingDate(row, schema);

      // Skip if no valid date or not in the target month
      if (!bookingDate || !isDateInMonth(bookingDate, year, month)) {
        continue;
      }

      // Get IDs
      const id = schema.idField ? String(row[schema.idField] ?? '') : '';
      const serviceId = schema.serviceIdField ? String(row[schema.serviceIdField] ?? '') : '';
      const staffId = String(
        pickFirst(row, ['ID osebja', 'ID Osebe', 'ID osebe', 'assigned_person_id', 'oseba_id', 'person_id']) ?? ''
      );

      // Get time fields
      const startTime = schema.startTimeField ? String(row[schema.startTimeField] ?? '') : '';
      const endTime = schema.endTimeField ? String(row[schema.endTimeField] ?? '') : '';

      // Get client name
      const clientId = schema.clientIdField
        ? String(row[schema.clientIdField] ?? '')
        : String(pickFirst(row, ['ID stranke', 'stranka_id', 'client_id']) ?? '');
      const clientName = schema.clientNameField
        ? String(row[schema.clientNameField] ?? '')
        : String(pickFirst(row, ['client_name', 'stranka_ime', 'Ime stranke']) ?? 'Neznana stranka');

      // Get status
      const status = schema.statusField
        ? String(row[schema.statusField] ?? 'scheduled').toLowerCase()
        : 'scheduled';

      // Map status to expected values
      let normalizedStatus: AppointmentWithDetails['status'] = 'scheduled';
      if (status.includes('confirm') || status.includes('potrj')) {
        normalizedStatus = 'confirmed';
      } else if (status.includes('complet') || status.includes('zakljuc') || status.includes('done')) {
        normalizedStatus = 'completed';
      } else if (status.includes('cancel') || status.includes('odpoved') || status.includes('preklic')) {
        normalizedStatus = 'cancelled';
      } else if (status.includes('no_show') || status.includes('ni_prisel') || status.includes('no show')) {
        normalizedStatus = 'no_show';
      }

      // Get additional client fields
      const clientEmail = String(
        pickFirst(row, ['Email', 'client_email', 'stranka_email', 'Email stranke', 'email']) ?? ''
      );
      const clientPhone = String(
        pickFirst(row, ['Telefon', 'Telefonska številka', 'client_phone', 'stranka_telefon', 'Telefon stranke', 'telefon', 'phone']) ?? ''
      );
      const notes = String(
        pickFirst(row, ['opombe', 'notes', 'Opombe', 'description', 'opis']) ?? ''
      );
      const interneOpombe = String(
        pickFirst(row, ['Interne opombe', 'interne_opombe', 'internal_notes']) ?? ''
      );

      // Get service - first try by ID, then try by name lookup, finally use direct name from booking
      let serviceData = serviceMap.get(serviceId) || null;

      // If no service found by ID, try looking up by service name stored in booking
      if (!serviceData && schema.serviceNameField) {
        const directServiceName = String(row[schema.serviceNameField] ?? '');
        if (directServiceName) {
          // Try to find service by name in the map
          for (const [, svc] of serviceMap) {
            if (svc.naziv.toLowerCase() === directServiceName.toLowerCase()) {
              serviceData = svc;
              break;
            }
          }
          // If still no match, create a minimal service object with the name
          if (!serviceData) {
            serviceData = {
              id: '',
              naziv: directServiceName,
              barva: '#6366F1',
              trajanje: 0,
            };
          }
        }
      }

      // Extract additional service IDs from raw row
      const { serviceId2, serviceId3 } = extractAdditionalServiceIds(row);

      // Resolve additional service objects directly (prevents color flash on initial render)
      const storitev2 = serviceId2 ? (serviceMap.get(serviceId2) || null) : null;
      const storitev3 = serviceId3 ? (serviceMap.get(serviceId3) || null) : null;

      appointments.push({
        id,
        datum: bookingDate.toISOString(),
        cas_zacetek: startTime,
        cas_konec: endTime,
        stranka_id: clientId || undefined,
        stranka_ime: clientName,
        stranka_priimek: (clientId && clientPriimekMap.get(clientId)) || undefined,
        stranka_email: clientEmail || undefined,
        stranka_telefon: clientPhone || undefined,
        storitev_id: serviceId || undefined,
        storitev_id_2: serviceId2 || undefined,
        storitev_id_3: serviceId3 || undefined,
        zaposleni_id: staffId || undefined,
        status: normalizedStatus,
        opombe: notes || undefined,
        interne_opombe: interneOpombe || undefined,
        storitev: serviceData,
        storitev_2: storitev2,
        storitev_3: storitev3,
        zaposleni: staffMap.get(staffId) || null,
      });
    }

    // Sort by date and time
    appointments.sort((a, b) => {
      const dateCompare = new Date(a.datum).getTime() - new Date(b.datum).getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.cas_zacetek.localeCompare(b.cas_zacetek);
    });

    return { data: appointments, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch appointments'),
    };
  }
}

// Fetch all services for filtering/legend
export async function fetchServices(companyId: string): Promise<{
  data: Storitev[] | null;
  error: Error | null;
}> {
  try {
    const result = await fetchTableRows<Record<string, unknown>>(TABLES.services, companyId, 500);

    if (result.error) {
      throw new Error(result.error);
    }

    const services: Storitev[] = [];
    for (const row of result.data ?? []) {
      const service = parseService(row);
      if (service) {
        services.push(service);
      }
    }

    // Sort by name
    services.sort((a, b) => a.naziv.localeCompare(b.naziv));

    return { data: services, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch services'),
    };
  }
}

// Fetch all employees for filtering
export async function fetchEmployees(companyId: string): Promise<{
  data: (Zaposleni & { initials: string })[] | null;
  error: Error | null;
}> {
  try {
    const result = await fetchTableRows<Record<string, unknown>>(TABLES.staff, companyId, 200);

    if (result.error) {
      throw new Error(result.error);
    }

    const employees: (Zaposleni & { initials: string })[] = [];
    for (const row of result.data ?? []) {
      const person = parseStaff(row);
      if (person) {
        employees.push(person);
      }
    }

    // Sort by last name
    employees.sort((a, b) => a.priimek.localeCompare(b.priimek));

    return { data: employees, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch employees'),
    };
  }
}

// Fetch a single appointment by ID with full details
export async function fetchAppointmentById(
  companyId: string,
  appointmentId: string
): Promise<{ data: AppointmentWithDetails | null; error: Error | null }> {
  try {
    const [bookingsRes, servicesRes, staffRes] = await Promise.all([
      fetchTableRows<Record<string, unknown>>(TABLES.bookings, companyId, 2000),
      fetchTableRows<Record<string, unknown>>(TABLES.services, companyId, 500),
      fetchTableRows<Record<string, unknown>>(TABLES.staff, companyId, 200),
    ]);

    if (bookingsRes.error) {
      throw new Error(bookingsRes.error);
    }

    const bookings = bookingsRes.data ?? [];

    // Find the specific booking
    const booking = bookings.find((row) => {
      const schema = detectBookingSchema(row);
      const id = schema.idField ? String(row[schema.idField] ?? '') : '';
      return id === appointmentId;
    });

    if (!booking) {
      return { data: null, error: null };
    }

    // Build lookup maps
    const services = servicesRes.data ?? [];
    const staff = staffRes.data ?? [];

    const serviceMap = new Map<string, Storitev>();
    for (const row of services) {
      const service = parseService(row);
      if (service) {
        serviceMap.set(service.id, service);
      }
    }

    const staffMap = new Map<string, Zaposleni & { initials: string }>();
    for (const row of staff) {
      const person = parseStaff(row);
      if (person) {
        staffMap.set(person.id, person);
      }
    }

    // Parse the booking
    const schema = detectBookingSchema(booking);
    const bookingDate = parseBookingDate(booking, schema);
    const id = schema.idField ? String(booking[schema.idField] ?? '') : '';
    const serviceId = schema.serviceIdField ? String(booking[schema.serviceIdField] ?? '') : '';
    const staffId = String(
      pickFirst(booking, ['ID Osebe', 'ID osebe', 'assigned_person_id', 'oseba_id', 'person_id']) ?? ''
    );
    const startTime = schema.startTimeField ? String(booking[schema.startTimeField] ?? '') : '';
    const endTime = schema.endTimeField ? String(booking[schema.endTimeField] ?? '') : '';
    const clientId = schema.clientIdField
      ? String(booking[schema.clientIdField] ?? '')
      : String(pickFirst(booking, ['ID stranke', 'stranka_id', 'client_id']) ?? '');
    const clientName = schema.clientNameField
      ? String(booking[schema.clientNameField] ?? '')
      : String(pickFirst(booking, ['client_name', 'stranka_ime', 'Ime stranke']) ?? 'Neznana stranka');
    const status = schema.statusField
      ? String(booking[schema.statusField] ?? 'scheduled').toLowerCase()
      : 'scheduled';

    let normalizedStatus: AppointmentWithDetails['status'] = 'scheduled';
    if (status.includes('confirm') || status.includes('potrj')) {
      normalizedStatus = 'confirmed';
    } else if (status.includes('complet') || status.includes('zakljuc') || status.includes('done')) {
      normalizedStatus = 'completed';
    } else if (status.includes('cancel') || status.includes('odpoved') || status.includes('preklic')) {
      normalizedStatus = 'cancelled';
    } else if (status.includes('no_show') || status.includes('ni_prisel') || status.includes('no show')) {
      normalizedStatus = 'no_show';
    }

    // Get additional client fields
    const clientEmail = String(
      pickFirst(booking, ['Email', 'client_email', 'stranka_email', 'Email stranke', 'email']) ?? ''
    );
    const clientPhone = String(
      pickFirst(booking, ['Telefon', 'Telefonska številka', 'client_phone', 'stranka_telefon', 'Telefon stranke', 'telefon', 'phone']) ?? ''
    );
    const notes = String(
      pickFirst(booking, ['opombe', 'notes', 'Opombe', 'description', 'opis']) ?? ''
    );
    const interneOpombe = String(
      pickFirst(booking, ['Interne opombe', 'interne_opombe', 'internal_notes']) ?? ''
    );

    // Get service - first try by ID, then try by name lookup, finally use direct name from booking
    let serviceData = serviceMap.get(serviceId) || null;

    // If no service found by ID, try looking up by service name stored in booking
    if (!serviceData && schema.serviceNameField) {
      const directServiceName = String(booking[schema.serviceNameField] ?? '');
      if (directServiceName) {
        // Try to find service by name in the map
        for (const [, svc] of serviceMap) {
          if (svc.naziv.toLowerCase() === directServiceName.toLowerCase()) {
            serviceData = svc;
            break;
          }
        }
        // If still no match, create a minimal service object with the name
        if (!serviceData) {
          serviceData = {
            id: '',
            naziv: directServiceName,
            barva: '#6366F1',
            trajanje: 0,
          };
        }
      }
    }

    // Extract additional service IDs from raw row
    const { serviceId2, serviceId3 } = extractAdditionalServiceIds(booking);

    const appointment: AppointmentWithDetails = {
      id,
      datum: bookingDate?.toISOString() ?? new Date().toISOString(),
      cas_zacetek: startTime,
      cas_konec: endTime,
      stranka_id: clientId || undefined,
      stranka_ime: clientName,
      stranka_email: clientEmail || undefined,
      stranka_telefon: clientPhone || undefined,
      storitev_id: serviceId || undefined,
      storitev_id_2: serviceId2 || undefined,
      storitev_id_3: serviceId3 || undefined,
      zaposleni_id: staffId || undefined,
      status: normalizedStatus,
      opombe: notes || undefined,
      interne_opombe: interneOpombe || undefined,
      storitev: serviceData,
      zaposleni: staffMap.get(staffId) || null,
    };

    return { data: appointment, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch appointment'),
    };
  }
}

// Fetch all appointments (no month filter) for Termini page
export async function fetchAllAppointments(
  companyId: string
): Promise<{ data: AppointmentWithDetails[] | null; error: Error | null }> {
  try {
    // Fetch all bookings, services, staff, and clients
    const [bookingsRes, servicesRes, staffRes, clientsRes] = await Promise.all([
      fetchTableRows<Record<string, unknown>>(TABLES.bookings, companyId, 5000),
      fetchTableRows<Record<string, unknown>>(TABLES.services, companyId, 500),
      fetchTableRows<Record<string, unknown>>(TABLES.staff, companyId, 200),
      fetchTableRows<Record<string, unknown>>(TABLES.clients, companyId, 2000),
    ]);

    if (bookingsRes.error) {
      throw new Error(bookingsRes.error);
    }

    const bookings = bookingsRes.data ?? [];
    const services = servicesRes.data ?? [];
    const staff = staffRes.data ?? [];
    const clients = clientsRes.data ?? [];

    // Build lookup maps
    const serviceMap = new Map<string, Storitev>();
    for (const row of services) {
      const service = parseService(row);
      if (service) {
        serviceMap.set(service.id, service);
      }
    }

    const staffMap = new Map<string, Zaposleni & { initials: string }>();
    for (const row of staff) {
      const person = parseStaff(row);
      if (person) {
        staffMap.set(person.id, person);
      }
    }

    // Build client surname map: clientId → priimek
    const clientPriimekMap = new Map<string, string>();
    for (const row of clients) {
      const rowKeys = Object.keys(row);
      const idField = rowKeys.find(k => ['ID stranke', 'id', 'ID_stranke', 'client_id'].includes(k));
      const priimekField = rowKeys.find(k => ['Priimek', 'priimek', 'last_name', 'lastName', 'surname'].includes(k));
      if (idField && priimekField) {
        const cid = String(row[idField] ?? '');
        const priimek = String(row[priimekField] ?? '');
        if (cid && priimek) clientPriimekMap.set(cid, priimek);
      }
    }

    // Transform all bookings
    const appointments: AppointmentWithDetails[] = [];

    for (const row of bookings) {
      const schema = detectBookingSchema(row);
      const bookingDate = parseBookingDate(row, schema);

      // Skip if no valid date
      if (!bookingDate) {
        continue;
      }

      // Get IDs
      const id = schema.idField ? String(row[schema.idField] ?? '') : '';
      const serviceId = schema.serviceIdField ? String(row[schema.serviceIdField] ?? '') : '';
      const staffId = String(
        pickFirst(row, ['ID osebja', 'ID Osebe', 'ID osebe', 'assigned_person_id', 'oseba_id', 'person_id']) ?? ''
      );

      // Get time fields
      const startTime = schema.startTimeField ? String(row[schema.startTimeField] ?? '') : '';
      const endTime = schema.endTimeField ? String(row[schema.endTimeField] ?? '') : '';

      // Get client name
      const clientId = schema.clientIdField
        ? String(row[schema.clientIdField] ?? '')
        : String(pickFirst(row, ['ID stranke', 'stranka_id', 'client_id']) ?? '');
      const clientName = schema.clientNameField
        ? String(row[schema.clientNameField] ?? '')
        : String(pickFirst(row, ['client_name', 'stranka_ime', 'Ime stranke']) ?? 'Neznana stranka');

      // Get status
      const status = schema.statusField
        ? String(row[schema.statusField] ?? 'scheduled').toLowerCase()
        : 'scheduled';

      // Map status to expected values
      let normalizedStatus: AppointmentWithDetails['status'] = 'scheduled';
      if (status.includes('confirm') || status.includes('potrj')) {
        normalizedStatus = 'confirmed';
      } else if (status.includes('complet') || status.includes('zakljuc') || status.includes('done')) {
        normalizedStatus = 'completed';
      } else if (status.includes('cancel') || status.includes('odpoved') || status.includes('preklic')) {
        normalizedStatus = 'cancelled';
      } else if (status.includes('no_show') || status.includes('ni_prisel') || status.includes('no show')) {
        normalizedStatus = 'no_show';
      }

      // Get additional client fields
      const clientEmail = String(
        pickFirst(row, ['Email', 'client_email', 'stranka_email', 'Email stranke', 'email']) ?? ''
      );
      const clientPhone = String(
        pickFirst(row, ['Telefon', 'Telefonska številka', 'client_phone', 'stranka_telefon', 'Telefon stranke', 'telefon', 'phone']) ?? ''
      );
      const notes = String(
        pickFirst(row, ['opombe', 'notes', 'Opombe', 'description', 'opis']) ?? ''
      );
      const interneOpombe = String(
        pickFirst(row, ['Interne opombe', 'interne_opombe', 'internal_notes']) ?? ''
      );

      // Get service - first try by ID, then try by name lookup, finally use direct name from booking
      let serviceData = serviceMap.get(serviceId) || null;

      // If no service found by ID, try looking up by service name stored in booking
      if (!serviceData && schema.serviceNameField) {
        const directServiceName = String(row[schema.serviceNameField] ?? '');
        if (directServiceName) {
          // Try to find service by name in the map
          for (const [, svc] of serviceMap) {
            if (svc.naziv.toLowerCase() === directServiceName.toLowerCase()) {
              serviceData = svc;
              break;
            }
          }
          // If still no match, create a minimal service object with the name
          if (!serviceData) {
            serviceData = {
              id: '',
              naziv: directServiceName,
              barva: '#6366F1',
              trajanje: 0,
            };
          }
        }
      }

      // Extract additional service IDs from raw row
      const { serviceId2, serviceId3 } = extractAdditionalServiceIds(row);

      // Resolve additional service objects directly (prevents color flash on initial render)
      const storitev2 = serviceId2 ? (serviceMap.get(serviceId2) || null) : null;
      const storitev3 = serviceId3 ? (serviceMap.get(serviceId3) || null) : null;

      appointments.push({
        id,
        datum: bookingDate.toISOString(),
        cas_zacetek: startTime,
        cas_konec: endTime,
        stranka_id: clientId || undefined,
        stranka_ime: clientName,
        stranka_priimek: (clientId && clientPriimekMap.get(clientId)) || undefined,
        stranka_email: clientEmail || undefined,
        stranka_telefon: clientPhone || undefined,
        storitev_id: serviceId || undefined,
        storitev_id_2: serviceId2 || undefined,
        storitev_id_3: serviceId3 || undefined,
        zaposleni_id: staffId || undefined,
        status: normalizedStatus,
        opombe: notes || undefined,
        interne_opombe: interneOpombe || undefined,
        storitev: serviceData,
        storitev_2: storitev2,
        storitev_3: storitev3,
        zaposleni: staffMap.get(staffId) || null,
      });
    }

    // Sort by date (descending - most recent first) and time
    appointments.sort((a, b) => {
      const dateCompare = new Date(b.datum).getTime() - new Date(a.datum).getTime();
      if (dateCompare !== 0) return dateCompare;
      return b.cas_zacetek.localeCompare(a.cas_zacetek);
    });

    return { data: appointments, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch appointments'),
    };
  }
}

// Fetch absences for a company with employee details
export async function fetchAbsences(
  companyId: string
): Promise<{ data: Absence[] | null; error: Error | null }> {
  try {
    console.log('[fetchAbsences] Fetching absences for company_id:', companyId);

    let { data: absencesData, error: absencesError } = await supabase
      .from('absences')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'CONFIRMED');

    console.log('[fetchAbsences] Query result - error:', absencesError, 'data count:', absencesData?.length ?? 0);

    if (absencesError) {
      // Maybe the table doesn't exist or RLS issue — log and continue with empty
      console.warn('[fetchAbsences] Error querying absences:', absencesError.message);
      absencesData = [];
    }


    // Fetch employee names directly from Osebe by employee_id
    const staffMap = new Map<string, { name: string; initials: string; color?: string }>();
    try {
      // employee_id is bigint — collect as numbers/strings, deduplicate
      const employeeIds = [...new Set(
        (absencesData || [])
          .map((r: Record<string, unknown>) => r.employee_id)
          .filter((id) => id !== null && id !== undefined)
          .map((id) => Number(id))
          .filter((id) => !isNaN(id))
      )];

      if (employeeIds.length > 0) {
        const { data: osebe } = await supabase
          .from('Osebe')
          .select('id, Ime, Priimek, Barva')
          .in('id', employeeIds);

        for (const row of osebe ?? []) {
          const id = String(row.id ?? '');
          if (!id) continue;
          const ime = String(row.Ime ?? '');
          const priimek = String(row.Priimek ?? '');
          const name = `${ime} ${priimek}`.trim();
          const initials = `${ime.charAt(0)}${priimek.charAt(0)}`.toUpperCase();
          const color = row.Barva ? String(row.Barva) : undefined;
          staffMap.set(id, { name, initials, color });
        }
      }
    } catch (staffError) {
      console.warn('[fetchAbsences] Could not fetch employee names from Osebe:', staffError);
    }

    console.log('[fetchAbsences] Raw absences data:', absencesData?.length ?? 0, 'records');

    const absences: Absence[] = (absencesData || []).map((row: Record<string, unknown>) => {
      const employeeId = row.employee_id ? String(row.employee_id) : undefined;
      const employeeData = employeeId ? staffMap.get(employeeId) : undefined;

      // Parse timestamps - handle PostgreSQL format "2026-01-30 10:00:00+00" or "+02"
      // Strip timezone suffix so JS treats the value as local time (no UTC conversion)
      const normTs = (raw: string) =>
        raw.replace(' ', 'T').replace(/([+-]\d{2}:\d{2}|[+-]\d{2}|Z)$/, '');
      const rawStartAt = row.start_at ? String(row.start_at) : '';
      const rawEndAt = row.end_at ? String(row.end_at) : '';
      const startAt = normTs(rawStartAt);
      const endAt = normTs(rawEndAt);

      return {
        id: String(row.id ?? ''),
        company_id: String(row.company_id ?? ''),
        employee_id: employeeId,
        start_at: startAt,
        end_at: endAt,
        reason: String(row.reason ?? ''),
        status: String(row.status ?? ''),
        employee_name: employeeData?.name,
        employee_initials: employeeData?.initials,
        employee_color: employeeData?.color,
      };
    });

    console.log('[fetchAbsences] Parsed absences:', absences);
    return { data: absences, error: null };
  } catch (err) {
    console.error('Error fetching absences:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch absences'),
    };
  }
}
