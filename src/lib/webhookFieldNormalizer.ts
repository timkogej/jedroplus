type AnyRow = Record<string, unknown>;

const toValue = (value: unknown) => (value === undefined ? null : value);

const pickFirst = (row: AnyRow, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
};

const toIsoString = (value: unknown) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
};

const buildServiceIds = (raw: AnyRow) => {
  const explicit = raw.service_ids;
  if (explicit) return explicit;
  const fromSingle =
    raw.service_id ?? raw["ID storitve"] ?? raw["ID_storitve"];
  if (fromSingle) return [fromSingle];
  const collected = [
    raw.service_id_1,
    raw.service_id_2,
    raw.service_id_3,
  ].filter((value) => value !== undefined && value !== null);
  return collected.length > 0 ? collected : null;
};

export function normalizeCompanyProfile(raw: AnyRow | null | undefined) {
  const data = raw ?? {};
  const normalized = {
    id: toValue(data.id ?? data.ID ?? data["ID Podjetja"]),
    company_id: toValue(data.company_id ?? data["ID Podjetja"]),
    display_name: toValue(data.display_name ?? data["Naziv Podjetja"]),
    email: toValue(data.email ?? data.from_email),
    phone: toValue(data.phone ?? data.telefon),
    address: toValue(data.address ?? data.naslov),
    tax_number: toValue(data.tax_number ?? data["Davčna številka"]),
    website: toValue(data.website),
    language: toValue(data.language ?? data.Language ?? data.preferred_language),
  };
  return { ...data, ...normalized };
}

export function normalizeClient(raw: AnyRow | null | undefined) {
  const data = raw ?? {};
  const normalized = {
    id: toValue(data.id),
    client_id: toValue(data.client_id ?? data["ID stranke"]),
    first_name: toValue(data.first_name ?? data.Ime ?? data.ime),
    last_name: toValue(data.last_name ?? data.Priimek ?? data.priimek),
    email: toValue(
      data.email ?? data["Email stranke"] ?? data.Email ?? data.to_email
    ),
    phone: toValue(data.phone ?? data.Telefon ?? data["Telefonska številka"] ?? data.telefon),
    // Notes - check multiple column name variations
    notes: toValue(data.notes ?? data.Opombe ?? data["Opombe stranke"] ?? data.opombe),
    opombe: toValue(data["Opombe stranke"] ?? data.opombe ?? data.notes ?? data.Opombe),
    // Internal notes - not sent to client
    notes_internal: toValue(data.notes_internal ?? data["Interne opombe"] ?? data.interne_opombe),
    interne_opombe: toValue(data["Interne opombe"] ?? data.interne_opombe ?? data.notes_internal),
    tags: toValue(data.tags ?? data.Tags),
    status: toValue(data.status ?? data.Status),
    last_interaction: toValue(
      data.last_interaction ?? data["Zadnja interakc"] ?? data.created_at
    ),
    // Gender (Spol)
    spol: toValue(data.spol ?? data.Spol ?? data.gender),
    gender: toValue(data.gender ?? data.Spol ?? data.spol),
    // Client type (Tip stranke): 'nova' | 'redna' | 'vip'
    tip_stranke: toValue(data["Tip stranke"] ?? data.tip_stranke),
    "Tip stranke": toValue(data["Tip stranke"] ?? data.tip_stranke),
    // Communication language
    language: toValue(data.language ?? data.Language ?? data.preferred_language),
    // Color
    barva: toValue(data.barva ?? data.Barva ?? data.color),
  };
  return { ...data, ...normalized };
}

export function normalizeBooking(raw: AnyRow | null | undefined) {
  const data = raw ?? {};
  const clientName =
    data.client_name ??
    data.Stranka ??
    `${String(data.first_name ?? "").trim()} ${String(
      data.last_name ?? ""
    ).trim()}`.trim() ??
    null;
  const assignedName =
    data.assigned_person_name ?? data.Oseba ?? data.assigned_person;
  const startAt = toIsoString(
    data.start_at ??
      (data.Datum && data["Čas"] ? `${data.Datum}T${data["Čas"]}` : data.Datum)
  );
  const endAt = toIsoString(
    data.end_at ??
      (data.Datum && data.Konec ? `${data.Datum}T${data.Konec}` : null)
  );

  const normalized = {
    id: toValue(data.id),
    booking_id: toValue(
      data.booking_id ?? data["ID termina"] ?? data.appointment_id ?? data.ID_termina
    ),
    client_id: toValue(data.client_id ?? data["ID stranke"]),
    client_name: toValue(clientName),
    service_ids: toValue(buildServiceIds(data)),
    service_name: toValue(data.service_name ?? data.Storitev),
    assigned_person_id: toValue(data.assigned_person_id ?? data["ID Osebe"]),
    assigned_person_name: toValue(assignedName),
    assigned_person_human_id: toValue(data.assigned_person_human_id),
    assigned_person_initials: toValue(data.assigned_person_initials),
    start_date: toValue(data.start_date ?? data.Datum),
    start_time: toValue(data.start_time ?? data["Čas"]),
    end_time: toValue(data.end_time ?? data.Konec),
    start_at: toValue(startAt),
    end_at: toValue(endAt),
    status: toValue(data.status ?? data.Status),
    language: toValue(data.language ?? data.Language),
    location_id: toValue(data.location_id),
    base_total_price: toValue(data.base_total_price),
    final_total_price: toValue(
      data.final_total_price ?? data.price ?? data.Cena
    ),
    currency: toValue(data.currency),
    discount: toValue(data.discount),
    prepaid: toValue(data.prepaid),
    notes: toValue(data.notes ?? data.Opombe ?? data.opombe),
    opombe: toValue(data.opombe ?? data.Opombe ?? data.notes),
    notes_internal: toValue(data.notes_internal ?? data["Internal opombe"] ?? data.internal_opombe),
    internal_opombe: toValue(data["Internal opombe"] ?? data.internal_opombe ?? data.notes_internal),
    // Price data - critical for n8n
    cena: toValue(data.cena ?? data.Cena ?? data.price ?? data.base_total_price),
    popust: toValue(data.popust ?? data.Popust ?? data.discount),
    popust_tip: toValue(data.popust_tip ?? data.Popust_tip ?? data.discount_type),
    koncna_cena: toValue(data.koncna_cena ?? data.Koncna_cena ?? data.final_total_price),
    valuta: toValue(data.valuta ?? data.Valuta ?? data.currency),
    custom: toValue(data.custom),
  };
  return { ...data, ...normalized };
}

export function normalizeService(raw: AnyRow | null | undefined) {
  const data = raw ?? {};
  const rawServiceId = data.service_id ?? data["ID storitve"] ?? data.ID_storitve;
  const serviceId =
    typeof rawServiceId === "number"
      ? String(rawServiceId).padStart(6, "0")
      : typeof rawServiceId === "string" && /^\d{1,6}$/.test(rawServiceId)
      ? rawServiceId.padStart(6, "0")
      : rawServiceId;

  // Get duration values with Slovenian field name fallbacks
  const trajanje = Number(data.duration_min ?? data.Trajanje ?? data["Trajanje (min)"] ?? 0);
  const bufferPred = Number(data.buffer_before_min ?? data.buffer_pred ?? data.Buffer_pred ?? 0);
  const bufferPo = Number(data.buffer_after_min ?? data.buffer_po ?? data.Buffer_po ?? 0);
  const skupniCas = Number(data.total_duration_min ?? data.skupni_cas ?? data.Skupni_cas ?? (trajanje + bufferPred + bufferPo));

  const normalized = {
    id: toValue(data.id),
    service_id: toValue(serviceId),
    name: toValue(data.name ?? data.Naziv ?? data.Storitev),
    description: toValue(data.description ?? data.Opis),
    duration_min: toValue(trajanje),
    price: toValue(data.price ?? data.Cena),
    price_type: toValue(data.price_type ?? data.tip_cene ?? data.Tip_cene),
    currency: toValue(data.currency ?? data.valuta ?? data.Valuta),
    buffer_before_min: toValue(bufferPred),
    buffer_after_min: toValue(bufferPo),
    total_duration_min: toValue(skupniCas),
    service_color: toValue(data.service_color ?? data.Barva ?? data.barva),
    service_color_from: toValue(data.service_color_from),
    service_color_to: toValue(data.service_color_to),
    active: toValue(data.active ?? data.Aktivna ?? data.Aktivno ?? data.Active),
    category: toValue(data.category ?? data.Kategorija ?? data.kategorija),
    online_booking: toValue(data.online_booking ?? data.Spletne_rezervacije ?? data.spletne_rezervacije ?? data.online_rezervacije),
    spletne_rezervacije: toValue(data.Spletne_rezervacije ?? data.spletne_rezervacije ?? data.online_booking ?? data.online_rezervacije),
    requires_payment: toValue(data.requires_payment ?? data.zahteva_placilo ?? data.Zahteva_placilo ?? data['Zahteva plačilo']),
    zahteva_placilo: toValue(data.zahteva_placilo ?? data.Zahteva_placilo ?? data['Zahteva plačilo'] ?? data.requires_payment),
  };
  return { ...data, ...normalized };
}

export function normalizePartner(raw: AnyRow | null | undefined) {
  const data = raw ?? {};

  // Extract both row_id (ID vrstice) and employee_id (ID osebe)
  const rowId = toValue(data.id ?? data.row_id);
  const employeeId = toValue(
    data.partner_id ?? data["ID osebe"] ?? data["ID Osebe"] ?? data.person_id ?? data.employee_id
  );

  const normalized = {
    id: rowId,
    row_id: rowId, // ID vrstice (database primary key)
    employee_id: employeeId, // ID osebe (person identifier)
    partner_id: employeeId, // Alias for backward compatibility
    person_human_id: toValue(data.person_human_id),
    name: toValue(data.name ?? data.Oseba ?? data.Naziv ?? data.Ime),
    email: toValue(data.email ?? data.Email),
    phone: toValue(data.phone ?? data.Telefon ?? data["Telefonska številka"]),
    notes: toValue(data.notes ?? data.Opombe),
    person_schedule: toValue(data.person_schedule ?? data.Urnik ?? data.urnik),
    urnik: toValue(data.Urnik ?? data.urnik ?? data.person_schedule),
    person_services: toValue(data.person_services ?? data.Storitve ?? data.storitve),
    storitve: toValue(data.Storitve ?? data.storitve ?? data.person_services),
    person_permissions: toValue(data.person_permissions),
    person_type: toValue(data.person_type ?? data.Tip ?? data.Vrsta ?? data.pozicija),
    roles: toValue(data.roles ?? data.Vloge),
    active: toValue(data.active ?? data.Aktivno ?? data.aktivna),
    // Additional Slovenian field names
    ime: toValue(data.ime ?? data.Ime),
    priimek: toValue(data.priimek ?? data.Priimek),
    barva: toValue(data.barva ?? data.Barva),
    // CRITICAL: Boolean flags for n8n webhook
    ali_opravlja_vse: toValue(data.ali_opravlja_vse ?? data["Ali opravlja vse"] ?? true),
    ali_ima_urnik_podjetja: toValue(data.ali_ima_urnik_podjetja ?? data["Ali ima urnik podjetja"] ?? true),
  };
  return { ...data, ...normalized };
}
