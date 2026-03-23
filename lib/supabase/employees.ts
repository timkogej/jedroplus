import { fetchTableRows } from '@/lib/companyScope';
import { TABLES } from '@/lib/data';
import type { Employee, EmployeeStats, EmployeeSchedule, ScheduleWithIntervals } from '@/types/employees';
import { getDefaultGradient, getGradientById, isValidGradient } from '@/lib/constants/gradients';

import { checkColumnExists } from '@/lib/tableIntrospection';

// Re-export Employee type for convenience
export type { Employee } from '@/types/employees';

// Detect employee schema from a row
function detectEmployeeSchema(row: Record<string, unknown>) {
  const keys = Object.keys(row);
  const pickField = (candidates: string[]) =>
    candidates.find((candidate) => keys.includes(candidate));

  return {
    idField: pickField(['id', 'ID osebe', 'ID_osebe', 'partner_id', 'person_id', 'oseba_id']),
    firstNameField: pickField(['ime', 'Ime', 'first_name', 'firstName', 'name', 'Naziv']),
    lastNameField: pickField(['priimek', 'Priimek', 'last_name', 'lastName', 'surname']),
    emailField: pickField(['email', 'Email', 'e-mail', 'E-mail']),
    phoneField: pickField(['telefon', 'Telefon', 'Telefonska številka', 'phone', 'Phone']),
    positionField: pickField(['pozicija', 'Pozicija', 'position', 'Position', 'vloga', 'Vloga', 'role']),
    gradientField: pickField(['Barva', 'barva', 'barva_gradient_id', 'gradient_id', 'avatar_color']),
    activeField: pickField(['Status', 'aktivna', 'Aktivna', 'active', 'Active', 'is_active']),
    notesField: pickField(['opombe', 'Opombe', 'notes', 'Notes']),
    companyField: pickField(['podjetje_id', 'company_id', 'Podjetje']),
    createdAtField: pickField(['created_at', 'Created', 'datum_vnosa']),
    updatedAtField: pickField(['updated_at', 'Updated', 'datum_posodobitve']),
    scheduleField: pickField(['Urnik', 'urnik', 'schedule', 'Schedule', 'working_hours']),
    servicesField: pickField(['Storitve', 'storitve', 'services', 'Services', 'service_ids']),
    usesCompanyScheduleField: pickField(['Ali ima urnik podjetja', 'ali_ima_urnik_podjetja', 'uses_company_schedule']),
  };
}

// Parse employee from raw row
function parseEmployee(row: Record<string, unknown>): Employee | null {
  const schema = detectEmployeeSchema(row);
  const id = schema.idField ? String(row[schema.idField] ?? '') : '';
  if (!id) return null;

  // Parse gradient - can be full CSS string or legacy ID
  let gradient = getDefaultGradient();
  if (schema.gradientField) {
    const gradientValue = row[schema.gradientField];
    if (typeof gradientValue === 'string') {
      // Check if it's a full CSS gradient string
      if (isValidGradient(gradientValue)) {
        gradient = gradientValue;
      } else {
        // Try to parse as legacy ID
        const legacyId = parseInt(gradientValue, 10);
        if (!isNaN(legacyId) && legacyId >= 1 && legacyId <= 5) {
          gradient = getGradientById(legacyId).gradient;
        }
      }
    } else if (typeof gradientValue === 'number') {
      // Legacy numeric ID
      gradient = getGradientById(gradientValue).gradient;
    }
  }

  // Parse active status
  let aktivna = true;
  if (schema.activeField) {
    const activeValue = row[schema.activeField];
    if (typeof activeValue === 'boolean') {
      aktivna = activeValue;
    } else if (typeof activeValue === 'string') {
      const v = activeValue.toLowerCase();
      aktivna = v === 'true' || v === '1' || v === 'active';
    } else if (typeof activeValue === 'number') {
      aktivna = activeValue === 1;
    }
  }

  // Parse schedule (urnik) - JSON object (supports both simple and intervals format)
  let urnik: EmployeeSchedule | ScheduleWithIntervals | null = null;
  if (schema.scheduleField) {
    const scheduleValue = row[schema.scheduleField];
    if (scheduleValue) {
      if (typeof scheduleValue === 'string') {
        try {
          urnik = JSON.parse(scheduleValue);
        } catch {
          urnik = null;
        }
      } else if (typeof scheduleValue === 'object') {
        urnik = scheduleValue as EmployeeSchedule | ScheduleWithIntervals;
      }
    }
  }

  // Parse services (storitve) - array of service IDs
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

  // Parse "Ali ima urnik podjetja" (uses company schedule) - default to true if not set
  let aliImaUrnikPodjetja = true;
  if (schema.usesCompanyScheduleField) {
    const usesCompanyValue = row[schema.usesCompanyScheduleField];
    if (typeof usesCompanyValue === 'boolean') {
      aliImaUrnikPodjetja = usesCompanyValue;
    } else if (typeof usesCompanyValue === 'string') {
      aliImaUrnikPodjetja = usesCompanyValue.toLowerCase() === 'true' || usesCompanyValue === '1';
    } else if (typeof usesCompanyValue === 'number') {
      aliImaUrnikPodjetja = usesCompanyValue === 1;
    }
  }

  return {
    id,
    ime: schema.firstNameField ? String(row[schema.firstNameField] ?? '') : '',
    priimek: schema.lastNameField ? String(row[schema.lastNameField] ?? '') : '',
    email: schema.emailField ? String(row[schema.emailField] ?? '') : '',
    telefon: schema.phoneField ? String(row[schema.phoneField] ?? '') || null : null,
    pozicija: schema.positionField ? String(row[schema.positionField] ?? '') || null : null,
    barva: gradient, // Full CSS gradient string
    aktivna,
    opombe: schema.notesField ? String(row[schema.notesField] ?? '') || null : null,
    podjetje_id: schema.companyField ? String(row[schema.companyField] ?? '') : '',
    created_at: schema.createdAtField ? String(row[schema.createdAtField] ?? new Date().toISOString()) : new Date().toISOString(),
    updated_at: schema.updatedAtField ? String(row[schema.updatedAtField] ?? new Date().toISOString()) : new Date().toISOString(),
    urnik, // Schedule (inherits from company if null)
    storitve, // Services this employee can perform
    ali_ima_urnik_podjetja: aliImaUrnikPodjetja, // Whether employee uses company schedule
    auth_user_id: (row['auth_user_id'] as string | null | undefined) ?? null,
  };
}

// Fetch all employees with appointment counts
export async function fetchEmployeesWithCount(companyId: string): Promise<{
  data: Employee[] | null;
  error: Error | null;
}> {
  try {
    // Fetch employees
    const employeesResult = await fetchTableRows<Record<string, unknown>>(TABLES.staff, companyId, 1000);

    if (employeesResult.error) {
      throw new Error(employeesResult.error);
    }

    // Fetch appointments to count per employee
    const appointmentsResult = await fetchTableRows<Record<string, unknown>>(TABLES.bookings, companyId, 5000);

    // Get today's date string
    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Build a map of employee ID to appointment counts
    const appointmentData = new Map<string, { today: number; week: number; total: number }>();

    for (const apt of appointmentsResult.data ?? []) {
      const employeeId = apt['ID osebe'] || apt['ID Osebe'] || apt['oseba_id'] || apt['partner_id'] || apt['zaposleni_id'];
      const date = apt['datum'] || apt['Datum'] || apt['date'];

      if (employeeId) {
        const id = String(employeeId);
        const dateStr = date ? String(date).split('T')[0] : null;

        const existing = appointmentData.get(id) || { today: 0, week: 0, total: 0 };
        existing.total += 1;

        if (dateStr === today) {
          existing.today += 1;
        }
        if (dateStr && dateStr >= weekStartStr) {
          existing.week += 1;
        }

        appointmentData.set(id, existing);
      }
    }

    const employees: Employee[] = [];
    for (const row of employeesResult.data ?? []) {
      const employee = parseEmployee(row);
      if (employee) {
        const data = appointmentData.get(employee.id);
        employee.appointments_today = data?.today || 0;
        employee.appointments_week = data?.week || 0;
        employee.total_appointments = data?.total || 0;
        employees.push(employee);
      }
    }

    // Sort by name
    employees.sort((a, b) => {
      const nameA = `${a.ime} ${a.priimek}`.toLowerCase();
      const nameB = `${b.ime} ${b.priimek}`.toLowerCase();
      return nameA.localeCompare(nameB, 'sl');
    });

    return { data: employees, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch employees'),
    };
  }
}

// Get employee by ID
export async function getEmployeeById(
  companyId: string,
  employeeId: string
): Promise<{ data: Employee | null; error: Error | null }> {
  try {
    const result = await fetchTableRows<Record<string, unknown>>(TABLES.staff, companyId, 1000);

    if (result.error) {
      throw new Error(result.error);
    }

    for (const row of result.data ?? []) {
      const employee = parseEmployee(row);
      if (employee && employee.id === employeeId) {
        return { data: employee, error: null };
      }
    }

    return { data: null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to get employee'),
    };
  }
}

// Check if email already exists for another employee
export async function checkEmployeeEmailExists(
  companyId: string,
  email: string,
  excludeEmployeeId?: string
): Promise<{ exists: boolean; error: Error | null }> {
  try {
    const result = await fetchTableRows<Record<string, unknown>>(TABLES.staff, companyId, 1000);

    if (result.error) {
      throw new Error(result.error);
    }

    const emailLower = email.toLowerCase().trim();

    for (const row of result.data ?? []) {
      const employee = parseEmployee(row);
      if (employee && employee.email.toLowerCase() === emailLower) {
        if (excludeEmployeeId && employee.id === excludeEmployeeId) {
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

// Get employee statistics
export async function getEmployeeStats(companyId: string): Promise<EmployeeStats | null> {
  try {
    const result = await fetchEmployeesWithCount(companyId);

    if (result.error) {
      throw result.error;
    }

    const employees = result.data ?? [];
    const activeEmployees = employees.filter((e) => e.aktivna);
    const appointmentsToday = employees.reduce((sum, e) => sum + (e.appointments_today || 0), 0);

    const stats: EmployeeStats = {
      total: employees.length,
      active: activeEmployees.length,
      inactive: employees.length - activeEmployees.length,
      appointmentsToday,
    };

    return stats;
  } catch (err) {
    console.error('Failed to get employee stats:', err);
    return null;
  }
}

// Get only active employees (for use in appointment creation)
export async function getActiveEmployees(companyId: string): Promise<{
  data: Employee[] | null;
  error: Error | null;
}> {
  try {
    const result = await fetchEmployeesWithCount(companyId);

    if (result.error) {
      throw result.error;
    }

    const activeEmployees = (result.data ?? []).filter((e) => e.aktivna);
    return { data: activeEmployees, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to get active employees'),
    };
  }
}

// Search employees by name or email
export async function searchEmployees(
  companyId: string,
  query: string
): Promise<{ data: Employee[] | null; error: Error | null }> {
  try {
    const result = await fetchTableRows<Record<string, unknown>>(TABLES.staff, companyId, 1000);

    if (result.error) {
      throw new Error(result.error);
    }

    const searchLower = query.toLowerCase().trim();
    if (!searchLower) {
      return { data: [], error: null };
    }

    const employees: Employee[] = [];
    for (const row of result.data ?? []) {
      const employee = parseEmployee(row);
      if (!employee) continue;

      const fullName = `${employee.ime} ${employee.priimek}`.toLowerCase();
      const email = employee.email.toLowerCase();

      if (fullName.includes(searchLower) || email.includes(searchLower)) {
        employees.push(employee);
      }
    }

    return { data: employees, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to search employees'),
    };
  }
}

// Alias for fetchEmployeesWithCount - used in staff page
export const fetchEmployees = fetchEmployeesWithCount;

// Detect employee columns from table schema
export async function detectEmployeeColumns(): Promise<Record<string, string>> {
  const exists = async (col: string) => checkColumnExists(TABLES.staff, col);

  return {
    id: (await exists('partner_id'))
      ? 'partner_id'
      : (await exists('person_id'))
      ? 'person_id'
      : (await exists('ID osebe'))
      ? 'ID osebe'
      : (await exists('ID Osebe'))
      ? 'ID Osebe'
      : (await exists('oseba_id'))
      ? 'oseba_id'
      : 'id',
    name: (await exists('name'))
      ? 'name'
      : (await exists('Ime'))
      ? 'Ime'
      : (await exists('Oseba'))
      ? 'Oseba'
      : 'ime',
    firstName: (await exists('ime'))
      ? 'ime'
      : (await exists('Ime'))
      ? 'Ime'
      : (await exists('first_name'))
      ? 'first_name'
      : 'ime',
    lastName: (await exists('priimek'))
      ? 'priimek'
      : (await exists('Priimek'))
      ? 'Priimek'
      : (await exists('last_name'))
      ? 'last_name'
      : 'priimek',
    email: (await exists('email'))
      ? 'email'
      : (await exists('Email'))
      ? 'Email'
      : 'email',
    phone: (await exists('phone'))
      ? 'phone'
      : (await exists('telefon'))
      ? 'telefon'
      : (await exists('Telefon'))
      ? 'Telefon'
      : 'telefon',
    position: (await exists('pozicija'))
      ? 'pozicija'
      : (await exists('Pozicija'))
      ? 'Pozicija'
      : (await exists('position'))
      ? 'position'
      : 'pozicija',
    barva: (await exists('Barva'))
      ? 'Barva'
      : (await exists('barva'))
      ? 'barva'
      : 'Barva',
    active: (await exists('active'))
      ? 'active'
      : (await exists('aktivna'))
      ? 'aktivna'
      : (await exists('Aktivna'))
      ? 'Aktivna'
      : 'aktivna',
    personHumanId: (await exists('person_human_id'))
      ? 'person_human_id'
      : '',
  };
}

// Build employee row for Supabase from form data
export function buildEmployeeRow(
  data: {
    ime: string;
    priimek: string;
    email: string;
    telefon?: string | null;
    pozicija?: string | null;
    barva: string; // Full CSS gradient string
    opombe?: string | null;
    urnik?: EmployeeSchedule | ScheduleWithIntervals | null;
    storitve?: string[] | null;
  },
  columns: Record<string, string>,
  aktivna = true
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (columns.firstName) row[columns.firstName] = data.ime;
  if (columns.lastName) row[columns.lastName] = data.priimek;
  if (columns.email) row[columns.email] = data.email;
  if (columns.phone) row[columns.phone] = data.telefon || null;
  if (columns.position) row[columns.position] = data.pozicija || null;
  if (columns.barva) row[columns.barva] = data.barva; // Full CSS gradient
  if (columns.active) row[columns.active] = aktivna;

  // Also set canonical field names
  row.ime = data.ime;
  row.priimek = data.priimek;
  row.email = data.email;
  row.telefon = data.telefon || null;
  row.pozicija = data.pozicija || null;
  row.Barva = data.barva; // Store in "Barva" column
  row.aktivna = aktivna;
  row.opombe = data.opombe || null;

  // Add schedule and services if provided
  if (data.urnik) {
    row.Urnik = JSON.stringify(data.urnik);
    row.urnik = data.urnik;
  }
  if (data.storitve) {
    row.Storitve = JSON.stringify(data.storitve);
    row.storitve = data.storitve;
  }

  return row;
}

// Get employee identifier for API calls
export async function getEmployeeIdentifier(
  employee: Employee
): Promise<{ key: string; value: string | number } | null> {
  const id = employee.id;
  if (!id) return null;

  // Check which column exists
  if (await checkColumnExists(TABLES.staff, 'partner_id')) {
    return { key: 'partner_id', value: id };
  }
  if (await checkColumnExists(TABLES.staff, 'person_id')) {
    return { key: 'person_id', value: id };
  }
  if (await checkColumnExists(TABLES.staff, 'ID osebe')) {
    return { key: 'ID osebe', value: id };
  }
  if (await checkColumnExists(TABLES.staff, 'ID Osebe')) {
    return { key: 'ID Osebe', value: id };
  }
  if (await checkColumnExists(TABLES.staff, 'oseba_id')) {
    return { key: 'oseba_id', value: id };
  }
  if (await checkColumnExists(TABLES.staff, 'id')) {
    return { key: 'id', value: id };
  }

  return null;
}
