import { fetchAllTableRows, fetchTableRows } from '@/lib/companyScope';
import { TABLES } from '@/lib/data';
import type { Service, ServiceStats, PriceType } from '@/types/services';

// Re-export Service type for convenience
export type { Service } from '@/types/services';

const APPOINTMENT_SERVICE_FIELDS = [
  'ID storitev',
  'ID storitve',
  'ID stoirtve',
  'ID storitev 2',
  'ID storitve 2',
  'ID stoirtve 2',
  'ID storitev 3',
  'ID storitve 3',
  'ID stoirtve 3',
  'add_on_storitev_id',
  'add_on_service_id',
  'ID_storitve',
  'storitev_id',
  'service_id',
] as const;

function getAppointmentServiceIds(appointment: Record<string, unknown>): string[] {
  const ids: string[] = [];

  for (const field of APPOINTMENT_SERVICE_FIELDS) {
    const value = appointment[field];
    if (!value) continue;

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) ids.push(String(item).trim());
      });
      continue;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      ids.push(String(value).trim());
    }
  }

  return ids.filter((id) => {
    const value = id.trim();
    return value !== '' && value !== 'null';
  });
}

// Detect service schema from a row
function detectServiceSchema(row: Record<string, unknown>) {
  const keys = Object.keys(row);
  const pickField = (candidates: string[]) =>
    candidates.find((candidate) => keys.includes(candidate));

  return {
    idField: pickField(['id', 'ID storitve', 'ID_storitve', 'service_id']),
    nameField: pickField(['naziv', 'Naziv', 'name', 'Name', 'Ime storitve']),
    colorField: pickField(['barva', 'Barva', 'color', 'Color']),
    durationField: pickField(['trajanje', 'Trajanje', 'duration', 'Duration', 'Trajanje (min)', 'Skupno trajanje']),
    bufferBeforeField: pickField(['buffer_pred', 'Buffer pred', 'buffer_before']),
    bufferAfterField: pickField(['buffer_po', 'Buffer po', 'buffer_after']),
    totalTimeField: pickField(['skupni_cas', 'Skupni čas', 'total_time']),
    priceTypeField: pickField(['tip_cene', 'Tip cene', 'price_type']),
    priceField: pickField(['cena', 'Cena', 'price', 'Price']),
    currencyField: pickField(['currency', 'Currency', 'valuta', 'Valuta']),
    descriptionField: pickField(['opis', 'Opis', 'description', 'Description']),
    activeField: pickField(['Status', 'aktivna', 'Aktivna', 'active', 'Active', 'is_active']),
    categoryField: pickField(['kategorija', 'Kategorija', 'category', 'Category']),
    onlineBookingField: pickField(['spletne_rezervacije', 'Spletne_rezervacije', 'online_booking', 'online_rezervacije']),
    requiresPaymentField: pickField(['zahteva_placilo', 'Zahteva_placilo', 'Zahteva plačilo', 'requires_payment', 'payment_required']),
    companyField: pickField(['podjetje_id', 'company_id', 'Podjetje']),
    createdAtField: pickField(['created_at', 'Created', 'datum_vnosa', 'Datum vnosa']),
    updatedAtField: pickField(['updated_at', 'Updated', 'datum_posodobitve']),
  };
}

// Parse service from raw row
function parseService(row: Record<string, unknown>): Service | null {
  const schema = detectServiceSchema(row);
  const id = schema.idField ? String(row[schema.idField] ?? '') : '';
  if (!id) return null;

  // Parse duration - handle both number and string
  let trajanje = 30; // default
  if (schema.durationField) {
    const durationValue = row[schema.durationField];
    if (typeof durationValue === 'number') {
      trajanje = durationValue;
    } else if (typeof durationValue === 'string') {
      trajanje = parseInt(durationValue, 10) || 30;
    }
  }

  // Parse price - handle both number and string
  let cena: number | null = null;
  if (schema.priceField) {
    const priceValue = row[schema.priceField];
    if (typeof priceValue === 'number') {
      cena = priceValue;
    } else if (typeof priceValue === 'string' && priceValue) {
      cena = parseFloat(priceValue) || null;
    }
  }

  // Parse active status
  let aktivna = true; // default
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

  // Parse buffer times
  let bufferPred = 0;
  if (schema.bufferBeforeField) {
    const bufferValue = row[schema.bufferBeforeField];
    if (typeof bufferValue === 'number') {
      bufferPred = bufferValue;
    } else if (typeof bufferValue === 'string') {
      bufferPred = parseInt(bufferValue, 10) || 0;
    }
  }

  let bufferPo = 0;
  if (schema.bufferAfterField) {
    const bufferValue = row[schema.bufferAfterField];
    if (typeof bufferValue === 'number') {
      bufferPo = bufferValue;
    } else if (typeof bufferValue === 'string') {
      bufferPo = parseInt(bufferValue, 10) || 0;
    }
  }

  // Calculate total time
  const skupniCas = trajanje + bufferPred + bufferPo;

  // Parse price type
  let tipCene: PriceType = 'fiksna';
  if (schema.priceTypeField) {
    const priceTypeValue = row[schema.priceTypeField];
    if (typeof priceTypeValue === 'string' && (priceTypeValue === 'fiksna' || priceTypeValue === 'po_dogovoru')) {
      tipCene = priceTypeValue;
    }
  }

  return {
    id,
    naziv: schema.nameField ? String(row[schema.nameField] ?? '') : '',
    kategorija: schema.categoryField ? String(row[schema.categoryField] ?? '') || null : null,
    barva: schema.colorField ? String(row[schema.colorField] ?? '#6366F1') : '#6366F1',
    trajanje,
    buffer_pred: bufferPred,
    buffer_po: bufferPo,
    skupni_cas: skupniCas,
    tip_cene: tipCene,
    cena,
    currency: schema.currencyField ? String(row[schema.currencyField] ?? '') || null : null,
    opis: schema.descriptionField ? String(row[schema.descriptionField] ?? '') || null : null,
    aktivna,
    spletne_rezervacije: schema.onlineBookingField
      ? (() => {
          const v = row[schema.onlineBookingField];
          if (typeof v === 'boolean') return v;
          if (typeof v === 'string') return v.toLowerCase() !== 'false' && v !== '0';
          if (typeof v === 'number') return v !== 0;
          return true; // default: online booking enabled
        })()
      : true,
    zahteva_placilo: schema.requiresPaymentField
      ? (() => {
          const v = row[schema.requiresPaymentField];
          if (typeof v === 'boolean') return v;
          if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1' || v.toLowerCase() === 'yes' || v.toLowerCase() === 'da';
          if (typeof v === 'number') return v !== 0;
          return false;
        })()
      : false,
    podjetje_id: schema.companyField ? String(row[schema.companyField] ?? '') : '',
    created_at: schema.createdAtField ? String(row[schema.createdAtField] ?? new Date().toISOString()) : new Date().toISOString(),
    updated_at: schema.updatedAtField ? String(row[schema.updatedAtField] ?? new Date().toISOString()) : new Date().toISOString(),
  };
}

// Fetch all services with appointment count
export async function fetchServicesWithCount(companyId: string): Promise<{
  data: Service[] | null;
  error: Error | null;
}> {
  try {
    // Fetch services
    const servicesResult = await fetchTableRows<Record<string, unknown>>(TABLES.services, companyId, 1000);

    if (servicesResult.error) {
      throw new Error(servicesResult.error);
    }

    // Fetch appointments to count per service
    const appointmentsResult = await fetchAllTableRows<Record<string, unknown>>(TABLES.bookings, companyId);

    // Build a map of service ID to appointment count and last used date
    const appointmentData = new Map<string, { count: number; lastUsed: string | null }>();
    for (const apt of appointmentsResult.data ?? []) {
      const date = apt['datum'] || apt['Datum'] || apt['date'];
      const serviceIds = getAppointmentServiceIds(apt);
      if (serviceIds.length > 0) {
        const uniqueIds = new Set(serviceIds);
        const dateStr = date ? String(date) : null;

        uniqueIds.forEach((id) => {
          const existing = appointmentData.get(id);
          if (existing) {
            existing.count += 1;
            if (dateStr && (!existing.lastUsed || dateStr > existing.lastUsed)) {
              existing.lastUsed = dateStr;
            }
          } else {
            appointmentData.set(id, { count: 1, lastUsed: dateStr });
          }
        });
      }
    }

    const services: Service[] = [];
    for (const row of servicesResult.data ?? []) {
      const service = parseService(row);
      if (service) {
        const data = appointmentData.get(service.id);
        service.appointment_count = data?.count || 0;
        service.last_used = data?.lastUsed || undefined;
        services.push(service);
      }
    }

    // Sort by name
    services.sort((a, b) => a.naziv.localeCompare(b.naziv, 'sl'));

    return { data: services, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch services'),
    };
  }
}

// Legacy function for backward compatibility
export async function fetchServices(companyId: string): Promise<{
  data: Service[] | null;
  error: Error | null;
}> {
  return fetchServicesWithCount(companyId);
}

// Get service by ID
export async function getServiceById(
  companyId: string,
  serviceId: string
): Promise<{ data: Service | null; error: Error | null }> {
  try {
    const result = await fetchTableRows<Record<string, unknown>>(TABLES.services, companyId, 1000);

    if (result.error) {
      throw new Error(result.error);
    }

    for (const row of result.data ?? []) {
      const service = parseService(row);
      if (service && service.id === serviceId) {
        return { data: service, error: null };
      }
    }

    return { data: null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to get service'),
    };
  }
}

// Check if service has appointments (used before deletion)
export async function checkServiceHasAppointments(
  companyId: string,
  serviceId: string
): Promise<{ hasAppointments: boolean; count: number; error: Error | null }> {
  try {
    const appointmentsResult = await fetchAllTableRows<Record<string, unknown>>(TABLES.bookings, companyId);

    if (appointmentsResult.error) {
      throw new Error(appointmentsResult.error);
    }

    let count = 0;
    for (const apt of appointmentsResult.data ?? []) {
      const serviceIds = getAppointmentServiceIds(apt);
      if (serviceIds.includes(serviceId)) {
        count++;
      }
    }

    return { hasAppointments: count > 0, count, error: null };
  } catch (err) {
    return {
      hasAppointments: false,
      count: 0,
      error: err instanceof Error ? err : new Error('Failed to check appointments'),
    };
  }
}

// Get service statistics
export async function getServiceStats(companyId: string): Promise<{
  data: ServiceStats | null;
  error: Error | null;
}> {
  try {
    const result = await fetchServicesWithCount(companyId);

    if (result.error) {
      throw result.error;
    }

    const services = result.data ?? [];
    const activeServices = services.filter(s => s.aktivna);

    // Calculate average duration
    const totalDuration = activeServices.reduce((sum, s) => sum + s.trajanje, 0);
    const averageDuration = activeServices.length > 0 ? Math.round(totalDuration / activeServices.length) : 0;

    // Find highest price
    const prices = services.filter(s => s.cena !== null).map(s => s.cena as number);
    const highestPrice = prices.length > 0 ? Math.max(...prices) : 0;

    const stats: ServiceStats = {
      total: services.length,
      active: activeServices.length,
      averageDuration,
      highestPrice,
    };

    return { data: stats, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to get service stats'),
    };
  }
}

// Fetch unique categories from existing services
export async function fetchUniqueCategories(companyId: string): Promise<{
  data: string[] | null;
  error: Error | null;
}> {
  try {
    const result = await fetchTableRows<Record<string, unknown>>(TABLES.services, companyId, 1000);

    if (result.error) {
      throw new Error(result.error);
    }

    // Extract unique categories
    const categoriesSet = new Set<string>();
    for (const row of result.data ?? []) {
      const service = parseService(row);
      if (service && service.kategorija && service.kategorija.trim() !== '') {
        categoriesSet.add(service.kategorija.trim());
      }
    }

    // Convert to sorted array
    const categories = Array.from(categoriesSet).sort((a, b) =>
      a.localeCompare(b, 'sl')
    );

    return { data: categories, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch categories'),
    };
  }
}

// Search services by name
export async function searchServices(
  companyId: string,
  query: string
): Promise<{ data: Service[] | null; error: Error | null }> {
  try {
    const result = await fetchTableRows<Record<string, unknown>>(TABLES.services, companyId, 1000);

    if (result.error) {
      throw new Error(result.error);
    }

    const searchLower = query.toLowerCase().trim();
    if (!searchLower) {
      return { data: [], error: null };
    }

    const services: Service[] = [];
    for (const row of result.data ?? []) {
      const service = parseService(row);
      if (!service) continue;

      const name = service.naziv.toLowerCase();
      const description = (service.opis || '').toLowerCase();

      if (name.includes(searchLower) || description.includes(searchLower)) {
        services.push(service);
      }
    }

    return { data: services, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to search services'),
    };
  }
}

// Get only active services (for use in appointment creation)
export async function getActiveServices(companyId: string): Promise<{
  data: Service[] | null;
  error: Error | null;
}> {
  try {
    const result = await fetchServicesWithCount(companyId);

    if (result.error) {
      throw result.error;
    }

    const activeServices = (result.data ?? []).filter(s => s.aktivna);
    return { data: activeServices, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to get active services'),
    };
  }
}
