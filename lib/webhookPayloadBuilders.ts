import { supabaseReadOnly } from "@/src/lib/supabaseReadOnly";
import { getCompanyColumnForTable } from "@/lib/companyScope";
import { checkColumnExists } from "@/lib/tableIntrospection";
import { combineDateAndTime, safeDate } from "@/lib/dashboardHelpers";
import {
  normalizeBooking,
  normalizeClient,
  normalizeCompanyProfile,
  normalizePartner,
  normalizeService,
} from "@/src/lib/webhookFieldNormalizer";

type AnyRow = Record<string, unknown>;

const toDateString = (value: Date | null) => {
  if (!value) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toTimeString = (value: Date | null) => {
  if (!value) return "";
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const pickFirst = (row: AnyRow, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
};

const normalizeBookingStart = (row: AnyRow) => {
  const startAt = row.start_at ?? row.startAt;
  if (startAt) {
    return safeDate(startAt);
  }
  if (row.Datum && row["Čas"]) {
    return combineDateAndTime(row.Datum, row["Čas"]);
  }
  if (row.Datum) {
    return safeDate(row.Datum);
  }
  return null;
};

const normalizeBookingEnd = (row: AnyRow) => {
  const endAt = row.end_at ?? row.endAt;
  if (endAt) {
    return safeDate(endAt);
  }
  if (row.Datum && row["Konec"]) {
    return combineDateAndTime(row.Datum, row["Konec"]);
  }
  return null;
};

export function getPodatkiPodjetja(companyProfileRow: AnyRow | null | undefined) {
  return companyProfileRow ? normalizeCompanyProfile(companyProfileRow) : undefined;
}

export function buildClientCreateData({
  companyId,
  userEmail,
  companyProfile,
  clientRow,
}: {
  companyId: string;
  userEmail: string;
  companyProfile: AnyRow | null | undefined;
  clientRow: AnyRow;
}) {
  return {
    company_id: companyId,
    user_id: userEmail,
    podatkiPodjetja: companyProfile ? normalizeCompanyProfile(companyProfile) : undefined,
    podatkiStranke: normalizeClient(clientRow),
  };
}

export const buildClientUpdateData = buildClientCreateData;

export function buildClientDeleteData({
  companyId,
  userEmail,
  companyProfile,
  clientId,
}: {
  companyId: string;
  userEmail: string;
  companyProfile: AnyRow | null | undefined;
  clientId: string | number;
}) {
  return {
    company_id: companyId,
    user_id: userEmail,
    podatkiPodjetja: companyProfile ? normalizeCompanyProfile(companyProfile) : undefined,
    client_id: clientId,
  };
}

export async function getCustomerAppointmentsCount(
  companyId: string,
  clientIdOrName: string | number | null
) {
  if (!clientIdOrName) return 0;
  if (!companyId || companyId.trim() === "") return 0;

  try {
    const companyColumn = await getCompanyColumnForTable("Termini", companyId);
    let query = supabaseReadOnly
      .from("Termini")
      .select("*", { count: "exact", head: true })
      .eq(companyColumn, companyId);

    const idColumn =
      (await checkColumnExists("Termini", "ID stranke"))
        ? "ID stranke"
        : (await checkColumnExists("Termini", "client_id"))
        ? "client_id"
        : "";
    const nameColumn =
      (await checkColumnExists("Termini", "Stranka"))
        ? "Stranka"
        : (await checkColumnExists("Termini", "client_name"))
        ? "client_name"
        : "";

    if (idColumn) {
      query = query.eq(idColumn, clientIdOrName);
    } else if (nameColumn) {
      query = query.eq(nameColumn, String(clientIdOrName));
    }

    const { count, error } = await query;
    if (error) {
      console.warn("[webhookPayloadBuilders] Error getting customer appointments count:", error.message);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.warn("[webhookPayloadBuilders] Error in getCustomerAppointmentsCount:", err);
    return 0;
  }
}

export function buildBookingCreateData({
  companyId,
  userEmail,
  companyProfile,
  bookingRow,
  clientRow,
  customerAppointmentsCount,
}: {
  companyId: string;
  userEmail: string;
  companyProfile: AnyRow | null | undefined;
  bookingRow: AnyRow;
  clientRow?: AnyRow | null;
  customerAppointmentsCount?: number;
}) {
  return {
    company_id: companyId,
    user_id: userEmail,
    podatkiPodjetja: companyProfile ? normalizeCompanyProfile(companyProfile) : undefined,
    podatkiTermina: {
      ...normalizeBooking(bookingRow),
      customer_appointments_count: customerAppointmentsCount ?? 0,
    },
    podatkiStranke: clientRow ? normalizeClient(clientRow) : undefined,
  };
}

export const buildBookingUpdateData = buildBookingCreateData;

export function buildBookingCompleteData({
  companyId,
  userEmail,
  companyProfile,
  bookingRowUpdated,
  customerAppointmentsCount,
}: {
  companyId: string;
  userEmail: string;
  companyProfile: AnyRow | null | undefined;
  bookingRowUpdated: AnyRow;
  customerAppointmentsCount?: number;
}) {
  return {
    company_id: companyId,
    user_id: userEmail,
    podatkiPodjetja: companyProfile ? normalizeCompanyProfile(companyProfile) : undefined,
    podatkiTermina: {
      ...normalizeBooking(bookingRowUpdated),
      customer_appointments_count: customerAppointmentsCount ?? 0,
    },
  };
}

export function buildAppointmentSlimData({
  companyId,
  userEmail,
  companyProfile,
  bookingRow,
  clientRow,
  serviceRowOrId,
  assignedPersonRow,
  status,
}: {
  companyId: string;
  userEmail: string;
  companyProfile: AnyRow | null | undefined;
  bookingRow: AnyRow;
  clientRow?: AnyRow | null;
  serviceRowOrId?: AnyRow | string | number | null;
  assignedPersonRow?: AnyRow | null;
  status: "ni_prisel" | "odpovedal";
}) {
  const start = normalizeBookingStart(bookingRow);
  const end = normalizeBookingEnd(bookingRow);
  const appointmentId = pickFirst(bookingRow, [
    "booking_id",
    "appointment_id",
    "ID termina",
    "ID_termina",
    "id",
  ]);
  const serviceId =
    typeof serviceRowOrId === "object" && serviceRowOrId
      ? pickFirst(serviceRowOrId, ["service_id", "ID storitve", "ID_storitve", "id"])
      : serviceRowOrId;
  const price = Number(
    pickFirst(bookingRow, ["final_total_price", "price", "Cena"]) ?? 0
  );

  return {
    company_id: companyId,
    user_id: userEmail,
    podatkiPodjetja: companyProfile ? normalizeCompanyProfile(companyProfile) : undefined,
    podatkiTermina: {
      appointment_id: appointmentId ?? null,
      status,
      datum: toDateString(start),
      ura_od: toTimeString(start),
      ura_do: toTimeString(end),
      service_id: serviceId ?? null,
      cena: Number.isFinite(price) ? price : 0,
      assigned_person: {
        id:
          assignedPersonRow
            ? pickFirst(assignedPersonRow, [
                "partner_id",
                "person_id",
                "ID osebe",
                "ID Osebe",
                "id",
              ])
            : null,
        human_id: assignedPersonRow?.person_human_id ?? null,
        ime:
          assignedPersonRow
            ? pickFirst(assignedPersonRow, ["name", "Naziv", "Oseba", "Ime"])
            : null,
        initials: assignedPersonRow?.initials ?? null,
        tip: assignedPersonRow?.person_type ?? null,
      },
      stranka: {
        id:
          clientRow
            ? pickFirst(clientRow, ["client_id", "ID stranke", "id"])
            : null,
        ime:
          clientRow
            ? String(
                pickFirst(clientRow, [
                  "Stranka",
                  "name",
                  "Naziv",
                  "Ime",
                ]) ?? ""
              ).trim() ||
              `${String(clientRow.first_name ?? "").trim()} ${String(
                clientRow.last_name ?? ""
              ).trim()}`.trim() ||
              null
            : null,
      },
    },
  };
}

export function buildBookingDeleteData({
  companyId,
  userEmail,
  companyProfile,
  appointmentId,
}: {
  companyId: string;
  userEmail: string;
  companyProfile: AnyRow | null | undefined;
  appointmentId: string | number;
}) {
  const normalizedId = String(appointmentId);
  return {
    company_id: companyId,
    user_id: userEmail,
    podatkiPodjetja: companyProfile ? normalizeCompanyProfile(companyProfile) : undefined,
    appointment_id: normalizedId,
    booking_id: normalizedId,
    id: normalizedId,
    ID: normalizedId,
    podatkiTermina: {
      appointment_id: normalizedId,
      booking_id: normalizedId,
      id: normalizedId,
      ID: normalizedId,
    },
  };
}

export function buildServiceCreateData({
  companyId,
  userEmail,
  companyProfile,
  serviceRow,
  allServiceIds,
}: {
  companyId: string;
  userEmail: string;
  companyProfile: AnyRow | null | undefined;
  serviceRow: AnyRow;
  allServiceIds?: string[]; // CRITICAL - all company service IDs for n8n webhook
}) {
  return {
    company_id: companyId,
    user_id: userEmail,
    podatkiPodjetja: companyProfile ? normalizeCompanyProfile(companyProfile) : undefined,
    podatkiStoritve: normalizeService(serviceRow),
    // CRITICAL - Send all service IDs when creating new service
    all_service_ids: allServiceIds ?? [],
    vsi_id_storitev: allServiceIds ?? [], // Slovenian alias
  };
}

export const buildServiceUpdateData = buildServiceCreateData;

export function buildServiceDeleteData({
  companyId,
  userEmail,
  companyProfile,
  serviceId,
}: {
  companyId: string;
  userEmail: string;
  companyProfile: AnyRow | null | undefined;
  serviceId: string | number;
}) {
  return {
    company_id: companyId,
    user_id: userEmail,
    podatkiPodjetja: companyProfile ? normalizeCompanyProfile(companyProfile) : undefined,
    service_id: serviceId,
  };
}

export function buildServiceActivityData({
  companyId,
  userEmail,
  companyProfile,
  serviceId,
  active,
  serviceRow,
}: {
  companyId: string;
  userEmail: string;
  companyProfile: AnyRow | null | undefined;
  serviceId: string | number;
  active: boolean;
  serviceRow?: AnyRow | null;
}) {
  return {
    company_id: companyId,
    user_id: userEmail,
    podatkiPodjetja: companyProfile ? normalizeCompanyProfile(companyProfile) : undefined,
    service_id: serviceId,
    active,
    status: active ? 'active' : 'inactive',
    podatkiStoritve: serviceRow ? { ...normalizeService(serviceRow), active, status: active ? 'active' : 'inactive' } : undefined,
  };
}

export function buildPartnerCreateData({
  companyId,
  userEmail,
  companyProfile,
  partnerRow,
}: {
  companyId: string;
  userEmail: string;
  companyProfile: AnyRow | null | undefined;
  partnerRow: AnyRow;
}) {
  return {
    company_id: companyId,
    user_id: userEmail,
    podatkiPodjetja: companyProfile ? normalizeCompanyProfile(companyProfile) : undefined,
    podatkiPartnerja: normalizePartner(partnerRow),
  };
}

export const buildPartnerUpdateData = buildPartnerCreateData;

export function buildPartnerDeleteData({
  companyId,
  userEmail,
  companyProfile,
  partnerId,
}: {
  companyId: string;
  userEmail: string;
  companyProfile: AnyRow | null | undefined;
  partnerId: string | number;
}) {
  return {
    company_id: companyId,
    user_id: userEmail,
    podatkiPodjetja: companyProfile ? normalizeCompanyProfile(companyProfile) : undefined,
    partner_id: partnerId,
  };
}

export function buildPartnerActivityData({
  companyId,
  userEmail,
  companyProfile,
  partnerId,
  active,
}: {
  companyId: string;
  userEmail: string;
  companyProfile: AnyRow | null | undefined;
  partnerId: string | number;
  active: boolean;
}) {
  return {
    company_id: companyId,
    user_id: userEmail,
    podatkiPodjetja: companyProfile ? normalizeCompanyProfile(companyProfile) : undefined,
    partner_id: partnerId,
    active,
  };
}

export function buildGeneralSettingsData({
  companyId,
  userEmail,
  companyProfile,
  schedule,
}: {
  companyId: string;
  userEmail: string;
  companyProfile: AnyRow | null | undefined;
  schedule: AnyRow;
}) {
  return {
    company_id: companyId,
    schedule,
    user_id: userEmail,
    podatkiPodjetja: companyProfile ? normalizeCompanyProfile(companyProfile) : undefined,
  };
}

export function buildCompanyProfileData({
  companyId,
  userEmail,
  companyProfile,
  updatedProfile,
}: {
  companyId: string;
  userEmail: string;
  companyProfile: AnyRow | null | undefined;
  updatedProfile: AnyRow;
}) {
  return {
    company_id: companyId,
    company_profile: updatedProfile,
    user_id: userEmail,
    podatkiPodjetja: companyProfile ? normalizeCompanyProfile(companyProfile) : undefined,
  };
}

export function buildBookingsSettingsData({
  companyId,
  userEmail,
  companyProfile,
  bookingUrl,
  colors,
}: {
  companyId: string;
  userEmail: string;
  companyProfile: AnyRow | null | undefined;
  bookingUrl: string;
  colors: {
    Booking_primary: string;
    Booking_secondary: string;
    Booking_bg_from: string;
    Booking_bg_to: string;
  };
}) {
  return {
    company_id: companyId,
    podatkiPodjetja: companyProfile ? normalizeCompanyProfile(companyProfile) : undefined,
    rezervacije: {
      booking_url: bookingUrl,
      colors,
    },
    user_id: userEmail,
  };
}

export function buildChatbotSettingsData({
  companyId,
  userEmail,
  companyProfile,
  chatbot,
}: {
  companyId: string;
  userEmail: string;
  companyProfile: AnyRow | null | undefined;
  chatbot: AnyRow;
}) {
  return {
    company_id: companyId,
    podatkiPodjetja: companyProfile ? normalizeCompanyProfile(companyProfile) : undefined,
    chatbot,
    user_id: userEmail,
  };
}

export function buildRemindersSettingsData({
  companyId,
  userEmail,
  companyProfile,
  nastavitveOpomnikov,
}: {
  companyId: string;
  userEmail: string;
  companyProfile: AnyRow | null | undefined;
  nastavitveOpomnikov: AnyRow;
}) {
  return {
    company_id: companyId,
    podatkiPodjetja: companyProfile ? normalizeCompanyProfile(companyProfile) : undefined,
    nastavitveOpomnikov,
    user_id: userEmail,
  };
}

export function buildLostLeadsSettingsData({
  companyId,
  userEmail,
  companyProfile,
  nastavitveLostLeads,
}: {
  companyId: string;
  userEmail: string;
  companyProfile: AnyRow | null | undefined;
  nastavitveLostLeads: AnyRow;
}) {
  return {
    company_id: companyId,
    podatkiPodjetja: companyProfile ? normalizeCompanyProfile(companyProfile) : undefined,
    nastavitveLostLeads,
    user_id: userEmail,
  };
}

export function buildAnalyticsRequestData({
  companyId,
  userEmail,
  companyProfile,
  period,
  filters,
  requestText,
}: {
  companyId: string;
  userEmail: string;
  companyProfile: AnyRow | null | undefined;
  period: { from: string; to: string };
  filters: AnyRow;
  requestText: string;
}) {
  return {
    company_id: companyId,
    user_id: userEmail,
    podatkiPodjetja: companyProfile ? normalizeCompanyProfile(companyProfile) : undefined,
    obdobje: period,
    filtri: filters,
    zeljenaAnaliza: requestText,
  };
}

/**
 * Helper function to calculate final price based on discount
 */
function calculateFinalPrice(
  basePrice: number,
  discountValue: number,
  discountType: '€' | '%'
): number {
  if (discountType === '%') {
    return Math.max(0, basePrice - (basePrice * discountValue / 100));
  } else {
    return Math.max(0, basePrice - discountValue);
  }
}

/**
 * Enhanced appointment payload builder that includes full service and employee details.
 * Use this when creating/updating appointments via the AppointmentModal.
 * Includes all required fields for webhook validation.
 * Now includes 8-digit unique ID, client gender (Spol), and complete price data.
 *
 * CRITICAL PRICE FIELDS:
 * - cena: Base price from form
 * - popust: Discount value (e.g., 10 for 10€ or 10%)
 * - popust_tip: Discount type - MUST be '€' or '%'
 * - koncna_cena: Final price = cena - discount calculation
 * - valuta: Currency
 * - internal_opombe: Internal notes (not sent to client)
 */
export function buildEnhancedAppointmentData({
  companyId,
  userEmail,
  companyProfile,
  appointmentData,
  serviceDetails,
  serviceDetails2,
  serviceDetails3,
  employeeDetails,
  clientDetails,
  unique8DigitId,
}: {
  companyId: string;
  userEmail: string;
  companyProfile: AnyRow | null | undefined;
  appointmentData: {
    id?: string;
    datum: string;
    cas_zacetek: string;
    cas_konec: string;
    stranka_id?: string;
    stranka_ime: string;
    stranka_email?: string;
    stranka_telefon?: string;
    storitev_id: string;
    storitev_id_2?: string; // Second service ID (optional)
    storitev_id_3?: string; // Third service ID (optional)
    stevilo_storitev?: number; // Number of services (1, 2, or 3)
    zaposleni_id: string;
    status: string;
    opombe?: string;
    internal_opombe?: string; // Internal notes - not sent to client
    cena?: number; // Base price
    popust?: number; // Discount value
    popust_tip?: '€' | '%'; // Discount type
    valuta?: string; // Currency
    belezi_termin?: boolean; // false = ghost termin
  };
  serviceDetails: {
    id: string;
    naziv: string;
    trajanje: number;
    skupni_cas?: number;
    cena?: number | null;
    barva?: string;
  } | null;
  serviceDetails2?: {
    id: string;
    naziv: string;
    trajanje: number;
    skupni_cas?: number;
    cena?: number | null;
    barva?: string;
  } | null;
  serviceDetails3?: {
    id: string;
    naziv: string;
    trajanje: number;
    skupni_cas?: number;
    cena?: number | null;
    barva?: string;
  } | null;
  employeeDetails: {
    id: string;
    ime: string;
    priimek: string;
    email: string;
    barva?: string;
  } | null;
  clientDetails?: {
    id: string;
    ime: string;
    priimek: string;
    email?: string | null;
    telefon?: string | null;
    spol?: string | null;
    barva?: string | null;
    notes?: string | null;
    tags?: string[] | string | null;
    status?: string | null;
    last_interaction?: string | null;
  } | null;
  unique8DigitId?: string;
}) {
  // Build ISO datetime strings
  const startAt = `${appointmentData.datum}T${appointmentData.cas_zacetek}:00`;
  const endAt = `${appointmentData.datum}T${appointmentData.cas_konec}:00`;

  // Get employee initials
  const employeeInitials = employeeDetails
    ? `${employeeDetails.ime.charAt(0)}${employeeDetails.priimek.charAt(0)}`.toUpperCase()
    : '';

  // Get currency from appointment data or company profile
  const currency = appointmentData.valuta
    ?? (companyProfile as AnyRow)?.valuta
    ?? (companyProfile as AnyRow)?.currency
    ?? 'EUR';

  // Use the 8-digit unique ID if provided, otherwise use the existing ID
  const appointmentUniqueId = unique8DigitId ?? appointmentData.id ?? null;

  // CRITICAL: Calculate price data
  const basePrice = appointmentData.cena ?? serviceDetails?.cena ?? 0;
  const discountValue = appointmentData.popust ?? 0;
  const discountType = appointmentData.popust_tip ?? '€';
  const finalPrice = calculateFinalPrice(basePrice, discountValue, discountType);

  // Build service IDs array for multiple services
  const serviceIds: string[] = [];
  if (serviceDetails?.id) serviceIds.push(serviceDetails.id);
  if (serviceDetails2?.id) serviceIds.push(serviceDetails2.id);
  if (serviceDetails3?.id) serviceIds.push(serviceDetails3.id);

  // Count number of services
  const steviloStoritev = appointmentData.stevilo_storitev ?? serviceIds.length;

  // Build service names array
  const serviceNames: string[] = [];
  if (serviceDetails?.naziv) serviceNames.push(serviceDetails.naziv);
  if (serviceDetails2?.naziv) serviceNames.push(serviceDetails2.naziv);
  if (serviceDetails3?.naziv) serviceNames.push(serviceDetails3.naziv);

  return {
    company_id: companyId,
    user_id: userEmail,
    podatkiPodjetja: companyProfile ? normalizeCompanyProfile(companyProfile) : undefined,
    // Full appointment data with all required fields for validation
    podatkiTermina: {
      // Basic IDs - now includes unique 8-digit ID
      id: appointmentUniqueId,
      booking_id: appointmentUniqueId,
      appointment_id: appointmentUniqueId,
      unique_id: appointmentUniqueId, // 8-digit unique ID
      // Client info
      client_id: clientDetails?.id ?? appointmentData.stranka_id ?? null,
      client_name: appointmentData.stranka_ime,
      // Service info - now supports multiple services
      service_ids: serviceIds,
      service_id: serviceDetails?.id ?? null, // Primary service ID
      service_id_2: serviceDetails2?.id ?? null, // Second service ID
      service_id_3: serviceDetails3?.id ?? null, // Third service ID
      stevilo_storitev: steviloStoritev, // Number of services (1, 2, or 3)
      service_name: serviceDetails?.naziv ?? null,
      service_names: serviceNames, // Array of all service names
      // Employee info
      assigned_person_id: employeeDetails?.id ?? appointmentData.zaposleni_id,
      assigned_person_name: employeeDetails
        ? `${employeeDetails.ime} ${employeeDetails.priimek}`.trim()
        : null,
      assigned_person_human_id: employeeDetails?.id ?? null,
      assigned_person_initials: employeeInitials,
      // Date/time info
      datum: appointmentData.datum,
      start_date: appointmentData.datum,
      start_time: appointmentData.cas_zacetek,
      end_time: appointmentData.cas_konec,
      cas_zacetek: appointmentData.cas_zacetek,
      cas_konec: appointmentData.cas_konec,
      start_at: startAt,
      end_at: endAt,
      // Other info
      location_id: null,
      status: appointmentData.status,
      // CRITICAL PRICE FIELDS - Required for n8n webhook
      cena: basePrice, // Base price from form
      popust: discountValue, // Discount value (e.g., 10 for 10€ or 10%)
      popust_tip: discountType, // Discount type - MUST be '€' or '%'
      koncna_cena: finalPrice, // Final price = cena - discount calculation
      valuta: currency, // Currency
      base_total_price: basePrice,
      final_total_price: finalPrice,
      currency: currency,
      discount: discountValue,
      discount_type: discountType,
      prepaid: null,
      // Notes
      notes: appointmentData.opombe ?? null,
      opombe: appointmentData.opombe ?? null,
      notes_internal: appointmentData.internal_opombe ?? null,
      internal_opombe: appointmentData.internal_opombe ?? null,
      custom: null,
      // Ghost termin flag
      belezi_termin: appointmentData.belezi_termin !== false,
    },
    // Client data - now includes gender (Spol) and id_vrstice
    podatkiStranke: {
      id: clientDetails?.id ?? appointmentData.stranka_id ?? null,
      client_id: clientDetails?.id ?? appointmentData.stranka_id ?? null,
      id_vrstice: clientDetails?.id ?? appointmentData.stranka_id ?? null, // Row ID for client
      first_name: clientDetails?.ime ?? appointmentData.stranka_ime.split(' ')[0] ?? '',
      last_name: clientDetails?.priimek ?? appointmentData.stranka_ime.split(' ').slice(1).join(' ') ?? '',
      ime: clientDetails ? `${clientDetails.ime} ${clientDetails.priimek}` : appointmentData.stranka_ime,
      email: clientDetails?.email ?? appointmentData.stranka_email ?? null,
      phone: clientDetails?.telefon ?? appointmentData.stranka_telefon ?? null,
      telefon: clientDetails?.telefon ?? appointmentData.stranka_telefon ?? null,
      spol: clientDetails?.spol ?? null, // Gender (Spol)
      barva: clientDetails?.barva ?? null, // Client color
      notes: clientDetails?.notes ?? null,
      tags: clientDetails?.tags ?? null,
      status: clientDetails?.status ?? 'active',
      last_interaction: clientDetails?.last_interaction ?? null,
    },
    // Service data (simplified, not using full REQUIRED_SERVICE_KEYS)
    podatkiStoritve: serviceDetails
      ? {
          id: serviceDetails.id,
          service_id: serviceDetails.id,
          name: serviceDetails.naziv,
          naziv: serviceDetails.naziv,
          description: null,
          duration_min: serviceDetails.trajanje,
          trajanje: serviceDetails.trajanje,
          skupni_cas: serviceDetails.skupni_cas ?? serviceDetails.trajanje,
          total_duration_min: serviceDetails.skupni_cas ?? serviceDetails.trajanje,
          price: serviceDetails.cena ?? null,
          cena: serviceDetails.cena ?? null,
          price_type: 'fiksna',
          currency: currency,
          buffer_before_min: 0,
          buffer_after_min: 0,
          service_color: serviceDetails.barva ?? null,
          service_color_from: null,
          service_color_to: null,
          barva: serviceDetails.barva ?? null,
          active: true,
          category: null,
        }
      : null,
    // Employee data
    podatkiZaposlenega: employeeDetails
      ? {
          id: employeeDetails.id,
          ime: employeeDetails.ime,
          priimek: employeeDetails.priimek,
          polno_ime: `${employeeDetails.ime} ${employeeDetails.priimek}`.trim(),
          email: employeeDetails.email,
          barva: employeeDetails.barva ?? null,
        }
      : null,
  };
}
