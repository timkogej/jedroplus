import { supabaseReadOnly } from "@/src/lib/supabaseReadOnly";
import { getCompanyColumnForTable } from "@/lib/companyScope";

// Minimum 7-digit ID (1000000)
const MIN_7_DIGIT_ID = 1000000;

export function parseSeqId(value: string, prefix: string): number | null {
  if (!value || !value.startsWith(prefix)) return null;
  const num = Number(value.slice(prefix.length));
  return Number.isFinite(num) ? num : null;
}

export function formatSeqId(prefix: string, n: number, width = 5): string {
  return `${prefix}${String(n).padStart(width, "0")}`;
}

export function pad6(n: number): string {
  return String(n).padStart(6, "0");
}

// New 7-digit ID format (range: 1000000 - 9999999)
export function pad7(n: number): string {
  return String(n).padStart(7, "0");
}

// Parse a 7-digit numeric ID
export function parse7Digit(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const strValue = String(value);
  // Match 1-7 digit numbers or IDs with prefixes
  const numericPart = strValue.replace(/^[A-Z]+-/, "");
  if (!/^\d+$/.test(numericPart)) return null;
  const num = Number(numericPart);
  return Number.isFinite(num) ? num : null;
}

// Generate random 7-digit number (1000000 - 9999999)
function generateRandom7Digit(): string {
  const num = Math.floor(MIN_7_DIGIT_ID + Math.random() * 9000000);
  return String(num);
}

// Generate unique 7-digit ID with collision checking
async function generateUnique7DigitId(
  tableName: string,
  idColumn: string,
  companyId: string,
  maxAttempts = 20
): Promise<string> {
  // If companyId is invalid, return a random ID without collision checking
  if (!companyId || companyId.trim() === "") {
    return generateRandom7Digit();
  }

  for (let i = 0; i < maxAttempts; i++) {
    const randomId = generateRandom7Digit();

    try {
      // Check if ID exists
      const { data, error } = await supabaseReadOnly
        .from(tableName)
        .select(idColumn)
        .eq(idColumn, randomId)
        .limit(1);

      if (error) {
        console.warn(`[idGenerators] Error checking ID collision:`, error.message);
        return randomId; // Return the ID anyway on error
      }

      if (!data || data.length === 0) {
        return randomId;
      }
    } catch (err) {
      console.warn(`[idGenerators] Error in collision check:`, err);
      return randomId;
    }
  }

  // Fallback: timestamp-based ID
  return String(Date.now()).slice(-7);
}

// Legacy: Generate sequential 7-digit ID for any table
async function generateNext7DigitId(
  tableName: string,
  idColumn: string,
  companyId: string
): Promise<string> {
  // If companyId is invalid, return minimum ID
  if (!companyId || companyId.trim() === "") {
    return pad7(MIN_7_DIGIT_ID);
  }

  try {
    const companyColumn = await getCompanyColumnForTable(tableName, companyId);
    const { data, error } = await supabaseReadOnly
      .from(tableName)
      .select(idColumn)
      .eq(companyColumn, companyId);

    if (error) {
      console.warn(`[idGenerators] Error fetching IDs:`, error.message);
      return pad7(MIN_7_DIGIT_ID);
    }

    let max = MIN_7_DIGIT_ID - 1;
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    for (const row of rows) {
      const value = row[idColumn];
      const parsed = parse7Digit(value as string | number | null | undefined);
      if (parsed !== null && parsed > max) {
        max = parsed;
      }
    }

    return pad7(max + 1);
  } catch (err) {
    console.warn(`[idGenerators] Error generating next ID:`, err);
    return pad7(MIN_7_DIGIT_ID);
  }
}

export function parseHuman6(value: string, prefix: string): number | null {
  if (!value || !value.startsWith(prefix)) return null;
  const numeric = value.slice(prefix.length);
  if (!/^\d{6}$/.test(numeric)) return null;
  return Number(numeric);
}

// Client ID - random unique 7-digit numeric (e.g., "4829371")
export async function getNextClientId(companyId: string): Promise<string> {
  return generateUnique7DigitId("Stranke", "ID stranke", companyId);
}

// Booking/Appointment ID - now 7-digit numeric (e.g., "1000001")
export async function getNextBookingId(companyId: string): Promise<string> {
  return generateNext7DigitId("Termini", "ID termina", companyId);
}

// Service ID - random unique 7-digit (e.g., "4829371")
export async function getNextServiceId(companyId: string): Promise<string> {
  return generateUnique7DigitId("Storitve", "ID storitve", companyId);
}

// Staff/Employee ID - random unique 7-digit (e.g., "7291034")
export async function getNextStaffId(companyId: string): Promise<string> {
  return generateUnique7DigitId("Osebe", "ID osebe", companyId);
}

export function personTypeToPrefix(personType: string): string {
  const normalized = (personType || "").toLowerCase();
  if (normalized.includes("ekipa") || normalized.includes("team")) return "E-";
  if (normalized.includes("zunanji") || normalized.includes("external"))
    return "Z-";
  if (normalized.includes("dobavitelj") || normalized.includes("supplier"))
    return "D-";
  return "0-";
}

// Legacy function for person_human_id - kept for backwards compatibility
export async function getNextPersonHumanId(
  companyId: string,
  personType: string
): Promise<string> {
  const prefix = personTypeToPrefix(personType);

  // If companyId is invalid, return default ID
  if (!companyId || companyId.trim() === "") {
    return `${prefix}${pad6(1)}`;
  }

  try {
    const companyColumn = await getCompanyColumnForTable("Osebe", companyId);
    const { data, error } = await supabaseReadOnly
      .from("Osebe")
      .select("person_human_id")
      .eq(companyColumn, companyId);

    if (error) {
      console.warn(`[idGenerators] Error fetching person IDs:`, error.message);
      return `${prefix}${pad6(1)}`;
    }

    const max = (data ?? []).reduce((acc, row) => {
      const value = String(row.person_human_id ?? "");
      const parsed = parseHuman6(value, prefix);
      return parsed !== null && parsed > acc ? parsed : acc;
    }, 0);
    return `${prefix}${pad6(max + 1)}`;
  } catch (err) {
    console.warn(`[idGenerators] Error generating person ID:`, err);
    return `${prefix}${pad6(1)}`;
  }
}

export function randomBase36(len = 5): string {
  return Math.random().toString(36).slice(2, 2 + len).padEnd(len, "0");
}

export function generatePartnerId(): string {
  return `PTR-${Date.now()}-${randomBase36(5)}`;
}
