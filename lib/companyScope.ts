import { supabaseReadOnly } from "@/src/lib/supabaseReadOnly";

const COMPANY_COLUMN_CANDIDATES = [
  "ID podjetja",
  "ID Podjetja",
  "ID_podjetja",
  "company_id",
  "companyId",
];

const columnCache = new Map<string, string>();
const columnFailedTables = new Set<string>(); // tables where all candidates failed
const columnPending = new Map<string, Promise<string>>();

type CompanyScopedResult<T> = {
  data: T[] | null;
  error: string | null;
};

const isMissingColumnError = (error: { message?: string; code?: string }) => {
  if (error.code === "42703") return true;
  if (!error.message) return false;
  return error.message.includes("does not exist") && error.message.includes("column");
};

export async function getCompanyColumnForTable(
  tableName: string,
  companyId: string
) {
  // Return default if companyId is not valid
  if (!companyId || companyId.trim() === "") {
    return COMPANY_COLUMN_CANDIDATES[0];
  }

  const cached = columnCache.get(tableName);
  if (cached) {
    return cached;
  }

  // If detection already failed once, don't re-probe — return first candidate as
  // a best-effort fallback so callers don't hammer Supabase with 400s on every fetch.
  if (columnFailedTables.has(tableName)) {
    return COMPANY_COLUMN_CANDIDATES[0];
  }

  // Deduplicate concurrent detections for the same table
  const pending = columnPending.get(tableName);
  if (pending) {
    return pending;
  }

  const detection = (async () => {
    let lastError: string | null = null;
    for (const candidate of COMPANY_COLUMN_CANDIDATES) {
      const { error } = await supabaseReadOnly
        .from(tableName)
        .select("*")
        .eq(candidate, companyId)
        .limit(1);

      if (!error) {
        columnCache.set(tableName, candidate);
        columnPending.delete(tableName);
        return candidate;
      }

      lastError = error.message;
      if (!isMissingColumnError(error)) {
        columnPending.delete(tableName);
        throw new Error(error.message);
      }
    }

    // All candidates exhausted — cache the failure so we don't re-probe on
    // every subsequent fetchTableRows call (which caused repeated 400 bursts).
    columnFailedTables.add(tableName);
    columnPending.delete(tableName);
    throw new Error(lastError ?? "Company column not found.");
  })();

  columnPending.set(tableName, detection);
  return detection;
}

export function resolveCompanyTables(settings?: Record<string, unknown> | null) {
  const readSetting = (key: string, fallback: string) => {
    const value = typeof settings?.[key] === "string" ? settings[key] : "";
    const trimmed = typeof value === "string" ? value.trim() : "";
    return trimmed.length > 0 ? trimmed : fallback;
  };

  return {
    strankeTable: readSetting("Tabela stranke", "Stranke"),
    terminiTable: readSetting("Tabela termini", "Termini"),
    osebeTable: readSetting("Tabela osebe", "Osebe"),
    storitveTable: readSetting("Tabela storitve", "Storitve"),
  };
}

export async function fetchTableRows<T>(
  tableName: string,
  companyId: string,
  limit = 200
): Promise<CompanyScopedResult<T>> {
  // Return empty result if companyId is not valid
  if (!companyId || companyId.trim() === "") {
    return { data: [], error: null };
  }

  try {
    const companyColumn = await getCompanyColumnForTable(tableName, companyId);
    const { data, error } = await supabaseReadOnly
      .from(tableName)
      .select("*")
      .eq(companyColumn, companyId)
      .limit(limit);

    return { data: data as T[] | null, error: error?.message ?? null };
  } catch (error) {
    // Log but don't throw - return empty data to prevent cascading failures
    console.warn(`[fetchTableRows] Error fetching ${tableName}:`, error);
    return {
      data: [],
      error: error instanceof Error ? error.message : "Unknown error.",
    };
  }
}

async function fetchCompanyScoped<T>(
  tableName: string,
  companyId: string
): Promise<CompanyScopedResult<T>> {
  return fetchTableRows<T>(tableName, companyId);
}

export function fetchStranke(companyId: string) {
  return fetchCompanyScoped<Record<string, unknown>>("Stranke", companyId);
}

export function fetchTermini(companyId: string) {
  return fetchCompanyScoped<Record<string, unknown>>("Termini", companyId);
}

export function fetchStoritve(companyId: string) {
  return fetchCompanyScoped<Record<string, unknown>>("Storitve", companyId);
}

export function fetchOsebe(companyId: string) {
  return fetchCompanyScoped<Record<string, unknown>>("Osebe", companyId);
}
