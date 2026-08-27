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

const orderColumnCache = new Map<string, string | null>();
const orderColumnPending = new Map<string, Promise<string | null>>();

type CompanyScopedResult<T> = {
  data: T[] | null;
  error: string | null;
};

const DEFAULT_PAGE_SIZE = 1000;

const DEFAULT_ORDER_CANDIDATES_BY_TABLE: Record<string, string[]> = {
  Termini: [
    "start_at",
    "Start",
    "startAt",
    "Zacetek",
    "začetek",
    "Datum",
    "datum",
    "date",
    "Date",
    "start_date",
    "booking_date",
    "id",
    "ID termina",
  ],
  Stranke: [
    "Datum vpisa",
    "datum_vpisa",
    "created_at",
    "Created",
    "datum_vnosa",
    "Datum vnosa",
    "id",
    "ID stranke",
  ],
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

// Detect which of a set of candidate columns exists on the table, so we can
// order by it (e.g. a date/timestamp column). Without this, Postgres/PostgREST
// returns rows in an unspecified order, and a `.limit()` on a table with more
// rows than the limit can silently drop the newest (e.g. just-inserted-by-n8n)
// rows instead of the oldest.
export async function detectOrderColumn(
  tableName: string,
  companyColumn: string,
  companyId: string,
  candidates: string[]
): Promise<string | null> {
  const cacheKey = `${tableName}:${candidates.join(",")}`;
  const cached = orderColumnCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const pending = orderColumnPending.get(cacheKey);
  if (pending) return pending;

  const detection = (async () => {
    for (const candidate of candidates) {
      const { error } = await supabaseReadOnly
        .from(tableName)
        .select(candidate)
        .eq(companyColumn, companyId)
        .order(candidate, { ascending: false })
        .limit(1);

      if (!error) {
        orderColumnCache.set(cacheKey, candidate);
        orderColumnPending.delete(cacheKey);
        return candidate;
      }
    }

    orderColumnCache.set(cacheKey, null);
    orderColumnPending.delete(cacheKey);
    return null;
  })();

  orderColumnPending.set(cacheKey, detection);
  return detection;
}

export async function fetchTableRows<T>(
  tableName: string,
  companyId: string,
  limit = 200,
  orderByCandidates?: string[]
): Promise<CompanyScopedResult<T>> {
  // Return empty result if companyId is not valid
  if (!companyId || companyId.trim() === "") {
    return { data: [], error: null };
  }

  try {
    const companyColumn = await getCompanyColumnForTable(tableName, companyId);
    let query = supabaseReadOnly
      .from(tableName)
      .select("*")
      .eq(companyColumn, companyId);

    if (orderByCandidates && orderByCandidates.length > 0) {
      const orderColumn = await detectOrderColumn(
        tableName,
        companyColumn,
        companyId,
        orderByCandidates
      );
      if (orderColumn) {
        query = query.order(orderColumn, { ascending: false });
      }
    }

    const { data, error } = await query.limit(limit);

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

export async function fetchAllTableRows<T>(
  tableName: string,
  companyId: string,
  orderByCandidates?: string[],
  pageSize = DEFAULT_PAGE_SIZE
): Promise<CompanyScopedResult<T>> {
  if (!companyId || companyId.trim() === "") {
    return { data: [], error: null };
  }

  try {
    const companyColumn = await getCompanyColumnForTable(tableName, companyId);
    const resolvedOrderCandidates =
      orderByCandidates && orderByCandidates.length > 0
        ? orderByCandidates
        : DEFAULT_ORDER_CANDIDATES_BY_TABLE[tableName] ?? [];
    const orderColumn =
      resolvedOrderCandidates.length > 0
        ? await detectOrderColumn(
            tableName,
            companyColumn,
            companyId,
            resolvedOrderCandidates
          )
        : null;
    const rows: T[] = [];
    const normalizedPageSize = Math.max(1, Math.floor(pageSize));

    for (let from = 0; ; from += normalizedPageSize) {
      const to = from + normalizedPageSize - 1;
      let query = supabaseReadOnly
        .from(tableName)
        .select("*")
        .eq(companyColumn, companyId);

      if (orderColumn) {
        query = query.order(orderColumn, { ascending: false });
      }

      const { data, error } = await query.range(from, to);

      if (error) {
        return { data: rows, error: error.message };
      }

      const page = (data ?? []) as T[];
      rows.push(...page);

      if (page.length < normalizedPageSize) {
        break;
      }
    }

    return { data: rows, error: null };
  } catch (error) {
    console.warn(`[fetchAllTableRows] Error fetching ${tableName}:`, error);
    return {
      data: [],
      error: error instanceof Error ? error.message : "Unknown error.",
    };
  }
}

export async function fetchTableRowsByDateRange<T>(
  tableName: string,
  companyId: string,
  dateColumnCandidates: string[],
  fromInclusive: string,
  toExclusive: string,
  orderByCandidates?: string[],
  pageSize = DEFAULT_PAGE_SIZE
): Promise<CompanyScopedResult<T>> {
  if (!companyId || companyId.trim() === "") {
    return { data: [], error: null };
  }

  try {
    const companyColumn = await getCompanyColumnForTable(tableName, companyId);
    const dateColumn = await detectOrderColumn(
      tableName,
      companyColumn,
      companyId,
      dateColumnCandidates
    );

    if (!dateColumn) {
      return fetchAllTableRows<T>(
        tableName,
        companyId,
        orderByCandidates,
        pageSize
      );
    }

    const resolvedOrderCandidates =
      orderByCandidates && orderByCandidates.length > 0
        ? orderByCandidates
        : [dateColumn];
    const orderColumn =
      resolvedOrderCandidates.length > 0
        ? await detectOrderColumn(
            tableName,
            companyColumn,
            companyId,
            resolvedOrderCandidates
          )
        : dateColumn;
    const rows: T[] = [];
    const normalizedPageSize = Math.max(1, Math.floor(pageSize));

    for (let from = 0; ; from += normalizedPageSize) {
      const to = from + normalizedPageSize - 1;
      let query = supabaseReadOnly
        .from(tableName)
        .select("*")
        .eq(companyColumn, companyId)
        .gte(dateColumn, fromInclusive)
        .lt(dateColumn, toExclusive);

      query = query.order(orderColumn ?? dateColumn, { ascending: false });

      const { data, error } = await query.range(from, to);

      if (error) {
        return { data: rows, error: error.message };
      }

      const page = (data ?? []) as T[];
      rows.push(...page);

      if (page.length < normalizedPageSize) {
        break;
      }
    }

    return { data: rows, error: null };
  } catch (error) {
    console.warn(`[fetchTableRowsByDateRange] Error fetching ${tableName}:`, error);
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
