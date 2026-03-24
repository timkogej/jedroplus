import { supabaseReadOnly } from "@/src/lib/supabaseReadOnly";

const SESSION_CACHE_PREFIX = '__col_cache__';

function readSessionCache(key: string): boolean | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const v = sessionStorage.getItem(SESSION_CACHE_PREFIX + key);
    if (v === null) return undefined;
    return v === '1';
  } catch { return undefined; }
}

function writeSessionCache(key: string, value: boolean) {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(SESSION_CACHE_PREFIX + key, value ? '1' : '0'); } catch { /* ignore */ }
}

const columnExistsCache = new Map<string, boolean>();
const columnExistsPending = new Map<string, Promise<boolean>>();
const detectedColumnCache = new Map<string, string | null>();

const quoteColumn = (column: string) => `"${column.replace(/"/g, '""')}"`;

const isMissingColumnError = (error: { message?: string; code?: string }) => {
  if (error.code === "42703") return true;
  if (!error.message) return false;
  return error.message.includes("does not exist") && error.message.includes("column");
};

export async function checkColumnExists(tableName: string, column: string) {
  const cacheKey = `${tableName}:${column}`;
  const cached = columnExistsCache.get(cacheKey);
  if (cached !== undefined) return cached;

  // Check sessionStorage so results persist across page navigations
  const sessionCached = readSessionCache(cacheKey);
  if (sessionCached !== undefined) {
    columnExistsCache.set(cacheKey, sessionCached);
    return sessionCached;
  }

  // Deduplicate concurrent checks for the same column
  const pending = columnExistsPending.get(cacheKey);
  if (pending) return pending;

  const check = (async () => {
    try {
      const { error } = await supabaseReadOnly
        .from(tableName)
        .select(quoteColumn(column))
        .limit(1);

      columnExistsPending.delete(cacheKey);

      if (!error) {
        columnExistsCache.set(cacheKey, true);
        writeSessionCache(cacheKey, true);
        return true;
      }

      if (isMissingColumnError(error)) {
        columnExistsCache.set(cacheKey, false);
        writeSessionCache(cacheKey, false);
        return false;
      }

      // Log but don't throw - assume column doesn't exist
      console.warn(`[tableIntrospection] Error checking column ${column} in ${tableName}:`, error.message);
      columnExistsCache.set(cacheKey, false);
      writeSessionCache(cacheKey, false);
      return false;
    } catch (err) {
      columnExistsPending.delete(cacheKey);
      console.warn(`[tableIntrospection] Exception checking column ${column} in ${tableName}:`, err);
      columnExistsCache.set(cacheKey, false);
      writeSessionCache(cacheKey, false);
      return false;
    }
  })();

  columnExistsPending.set(cacheKey, check);
  return check;
}

export async function detectColumnForTable(
  tableName: string,
  candidates: string[],
  cacheKey: string
) {
  const cacheId = `${tableName}:${cacheKey}`;
  if (detectedColumnCache.has(cacheId)) {
    return detectedColumnCache.get(cacheId) ?? null;
  }

  for (const candidate of candidates) {
    const exists = await checkColumnExists(tableName, candidate);
    if (exists) {
      detectedColumnCache.set(cacheId, candidate);
      return candidate;
    }
  }

  detectedColumnCache.set(cacheId, null);
  return null;
}

export async function detectIdColumn(tableName: string, candidates: string[]) {
  return detectColumnForTable(tableName, candidates, "id-column");
}

export async function detectPrimaryKey(
  tableName: string,
  fallbackIdColumn?: string | null
) {
  const primary = await detectColumnForTable(tableName, ["id"], "primary-key");
  return primary ?? fallbackIdColumn ?? null;
}

export async function getNextPrefixedId(
  tableName: string,
  idColumn: string,
  prefix: string
) {
  try {
    const { data, error } = await supabaseReadOnly
      .from(tableName)
      .select(quoteColumn(idColumn))
      .order(idColumn, { ascending: false })
      .limit(50);

    if (error) {
      console.warn(`[tableIntrospection] Error getting next prefixed ID:`, error.message);
      return `${prefix}-${Date.now()}`;
    }

    const regex = new RegExp(`^${prefix}-(\\d+)$`, "i");
    let max = 0;
    for (const row of data ?? []) {
      const value = (row as unknown as Record<string, unknown>)[idColumn];
      if (typeof value !== "string") continue;
      const match = value.match(regex);
      if (!match) continue;
      const numeric = Number(match[1]);
      if (!Number.isNaN(numeric)) {
        max = Math.max(max, numeric);
      }
    }

    if (max === 0) {
      return `${prefix}-${Date.now()}`;
    }

    const next = max + 1;
    return `${prefix}-${String(next).padStart(5, "0")}`;
  } catch (err) {
    console.warn(`[tableIntrospection] Exception getting next prefixed ID:`, err);
    return `${prefix}-${Date.now()}`;
  }
}
