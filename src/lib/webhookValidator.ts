const REQUIRED_COMPANY_KEYS = [
  "id",
  "company_id",
  "display_name",
  "email",
  "phone",
  "address",
  "tax_number",
  "website",
];

const REQUIRED_CLIENT_KEYS = [
  "id",
  "client_id",
  "first_name",
  "last_name",
  "email",
  "phone",
  "notes",
  "tags",
  "status",
  "last_interaction",
];

const REQUIRED_BOOKING_KEYS = [
  "id",
  "booking_id",
  "client_id",
  "client_name",
  "service_ids",
  "service_name",
  "assigned_person_id",
  "assigned_person_name",
  "assigned_person_human_id",
  "assigned_person_initials",
  "start_date",
  "start_time",
  "end_time",
  "start_at",
  "end_at",
  "location_id",
  "status",
  "base_total_price",
  "final_total_price",
  "currency",
  "discount",
  "prepaid",
  "notes",
  "notes_internal",
  "custom",
];

const REQUIRED_SERVICE_KEYS = [
  "id",
  "service_id",
  "name",
  "description",
  "duration_min",
  "price",
  "price_type",
  "currency",
  "buffer_before_min",
  "buffer_after_min",
  "service_color",
  "service_color_from",
  "service_color_to",
  "total_duration_min",
  "active",
  "category",
];

const REQUIRED_PARTNER_KEYS = [
  "id",
  "partner_id",
  "person_human_id",
  "name",
  "email",
  "phone",
  "notes",
  "person_schedule",
  "person_services",
  "person_permissions",
  "person_type",
  "roles",
  "active",
];

const hasKeys = (obj: Record<string, unknown>, keys: string[], prefix: string) =>
  keys
    .filter((key) => !Object.prototype.hasOwnProperty.call(obj, key))
    .map((key) => `${prefix}.${key}`);

export function validateWebhookData(
  _event: string,
  _entity: string,
  data: Record<string, unknown>
): string[] {
  const missing: string[] = [];
  const event = _event.toUpperCase();
  const isAppointmentDelete =
    event === "IZBRIS_TERMINA" || event === "APPOINTMENT_DELETED";
  if (!Object.prototype.hasOwnProperty.call(data, "company_id")) {
    missing.push("data.company_id");
  }
  if (!Object.prototype.hasOwnProperty.call(data, "user_id")) {
    missing.push("data.user_id");
  }

  if (data.podatkiPodjetja && typeof data.podatkiPodjetja === "object") {
    missing.push(
      ...hasKeys(
        data.podatkiPodjetja as Record<string, unknown>,
        REQUIRED_COMPANY_KEYS,
        "data.podatkiPodjetja"
      )
    );
  }
  if (data.podatkiStranke && typeof data.podatkiStranke === "object") {
    missing.push(
      ...hasKeys(
        data.podatkiStranke as Record<string, unknown>,
        REQUIRED_CLIENT_KEYS,
        "data.podatkiStranke"
      )
    );
  }
  if (data.podatkiTermina && typeof data.podatkiTermina === "object") {
    const bookingData = data.podatkiTermina as Record<string, unknown>;
    if (isAppointmentDelete) {
      missing.push(
        ...hasKeys(bookingData, ["id", "ID"], "data.podatkiTermina")
      );
    } else {
      missing.push(
        ...hasKeys(bookingData, REQUIRED_BOOKING_KEYS, "data.podatkiTermina")
      );
    }
  }
  if (data.podatkiStoritve && typeof data.podatkiStoritve === "object") {
    missing.push(
      ...hasKeys(
        data.podatkiStoritve as Record<string, unknown>,
        REQUIRED_SERVICE_KEYS,
        "data.podatkiStoritve"
      )
    );
  }
  if (data.podatkiPartnerja && typeof data.podatkiPartnerja === "object") {
    missing.push(
      ...hasKeys(
        data.podatkiPartnerja as Record<string, unknown>,
        REQUIRED_PARTNER_KEYS,
        "data.podatkiPartnerja"
      )
    );
  }

  return missing;
}
