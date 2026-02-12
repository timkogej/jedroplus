export const pickFirst = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim().length === 0) continue;
    return value;
  }
  return undefined;
};

export const safeDate = (value: unknown) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    const match = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (match) {
      const day = Number(match[1]);
      const month = Number(match[2]) - 1;
      const year = Number(match[3]);
      const date = new Date(year, month, day);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  return null;
};

export const safeFormat = (
  value: unknown,
  locale: string,
  options?: Intl.DateTimeFormatOptions
) => {
  const date = safeDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat(locale, options).format(date);
};

const parseTime = (value: unknown) => {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
    seconds: match[3] ? Number(match[3]) : 0,
  };
};

export const combineDateAndTime = (dateValue: unknown, timeValue: unknown) => {
  const date = safeDate(dateValue);
  if (!date) return null;
  const time = parseTime(timeValue);
  if (!time) return date;
  const combined = new Date(date);
  combined.setHours(time.hours, time.minutes, time.seconds, 0);
  return combined;
};

export type BookingSchema = {
  idField?: string;
  statusField?: string;
  dateField?: string;
  startTimeField?: string;
  endTimeField?: string;
  startAtField?: string;
  completedDateField?: string;
  updatedAtField?: string;
  clientNameField?: string;
  clientIdField?: string;
  serviceNameField?: string;
  serviceIdField?: string;
  notesField?: string;
};

export const detectBookingSchema = (row: Record<string, unknown>): BookingSchema => {
  const keys = Object.keys(row);
  const pickField = (candidates: string[]) =>
    candidates.find((candidate) => keys.includes(candidate));

  return {
    idField: pickField(["id", "ID termina", "ID", "id_termina", "booking_id", "appointment_id"]),
    statusField: pickField(["status", "Status", "stanje", "Stanje"]),
    dateField: pickField(["Datum", "datum", "date", "Date", "start_date", "booking_date"]),
    startTimeField: pickField(["Čas", "Cas", "cas_zacetek", "start_time", "time", "ura_od"]),
    endTimeField: pickField(["Konec", "konec", "cas_konec", "end_time", "End", "ura_do"]),
    startAtField: pickField(["start_at", "Start", "startAt", "Zacetek", "začetek"]),
    completedDateField: pickField(["completed_date", "completed_at"]),
    updatedAtField: pickField(["updated_at", "Updated_at"]),
    clientNameField: pickField([
      "Stranka",
      "stranka_ime",
      "Naziv stranke",
      "Ime stranke",
      "client_name",
      "client",
      "Client",
    ]),
    clientIdField: pickField(["ID stranke", "stranka_id", "client_id"]),
    serviceNameField: pickField([
      "Storitev",
      "Naziv storitve",
      "service_name",
      "service",
      "Service",
    ]),
    serviceIdField: pickField(["ID storitev", "ID storitve", "storitev_id", "service_id"]),
    notesField: pickField(["Opombe", "opombe", "Opombe stranke", "notes", "Notes"]),
  };
};

export const normalizeStatus = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
};
