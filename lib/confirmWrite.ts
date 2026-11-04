// Saves go through n8n, which answers as soon as it receives the request and
// writes to the database a moment later (and only then sends SMS/e-mail). These
// helpers wait for the write itself to show up in the database, instead of
// sleeping for a fixed time and hoping it is done.
//
// A wait that runs out returns false: the caller then tells the user the save
// is not confirmed, rather than reporting success for something that may have
// failed.

import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';

type Row = Record<string, unknown>;

export type RowKey = {
  table: string;
  /** Column that identifies the row, e.g. 'id' or 'ID termina'. */
  column: string;
  value: string | number;
};

export type WaitOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_INTERVAL_MS = 300;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The row as it is now: null when it does not exist, undefined on a read error. */
export async function readRow(key: RowKey): Promise<Row | null | undefined> {
  if (key.value === '' || key.value === null || key.value === undefined) return undefined;
  const { data, error } = await supabaseReadOnly
    .from(key.table)
    .select('*')
    .eq(key.column, key.value)
    .limit(1);
  if (error) return undefined;
  const rows = (data ?? []) as Row[];
  return rows[0] ?? null;
}

async function waitUntil(
  key: RowKey,
  done: (row: Row | null) => boolean,
  { timeoutMs = DEFAULT_TIMEOUT_MS, intervalMs = DEFAULT_INTERVAL_MS }: WaitOptions = {}
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(intervalMs);
    const row = await readRow(key);
    if (row !== undefined && done(row)) return true;
  }
  return false;
}

const sameRow = (a: Row, b: Row) => JSON.stringify(a) === JSON.stringify(b);

/** Waits until a newly created row exists. */
export function waitForRowCreated(key: RowKey, options?: WaitOptions) {
  return waitUntil(key, (row) => row !== null, options);
}

/** Waits until a deleted row is gone. */
export function waitForRowDeleted(key: RowKey, options?: WaitOptions) {
  return waitUntil(key, (row) => row === null, options);
}

/** Waits until a column holds the expected value (e.g. Status = 'completed'). */
export function waitForRowValue(
  key: RowKey,
  column: string,
  expected: string,
  options?: WaitOptions
) {
  return waitUntil(
    key,
    (row) => row !== null && String(row[column] ?? '').toLowerCase() === expected.toLowerCase(),
    options
  );
}

/**
 * Waits until the row differs from `before` (read just before the save was
 * sent). With no snapshot to compare against there is nothing to wait for, so
 * this answers true straight away.
 */
export function waitForRowChanged(
  key: RowKey,
  before: Row | null | undefined,
  options?: WaitOptions
) {
  if (!before) return Promise.resolve(true);
  return waitUntil(key, (row) => row === null || !sameRow(row, before), options);
}

/** An appointment row by its numeric `id` (what n8n updates and deletes by). */
export const terminById = (id: string | number): RowKey => ({ table: 'Termini', column: 'id', value: id });

/** An appointment row by its 8-digit `ID termina` (known before it is created). */
export const terminByCode = (code: string): RowKey => ({ table: 'Termini', column: 'ID termina', value: code });

/**
 * Newest `created_at` among the company's rows, read just before a create is
 * sent. Null when the company has none yet, undefined on a read error.
 * Comparing with the database's own timestamps keeps this independent of the
 * device clock.
 */
export async function latestCreatedAt(
  table: string,
  companyColumn: string,
  companyId: string
): Promise<string | null | undefined> {
  const { data, error } = await supabaseReadOnly
    .from(table)
    .select('created_at')
    .eq(companyColumn, companyId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) return undefined;
  const rows = (data ?? []) as Row[];
  return rows[0] ? String(rows[0].created_at) : null;
}

/**
 * Waits until the company has a row newer than `since` — for creates whose id
 * is only assigned by the database. Without a usable snapshot it falls back to
 * a short pause, as before.
 */
export async function waitForNewRowSince(
  table: string,
  companyColumn: string,
  companyId: string,
  since: string | null | undefined,
  { timeoutMs = DEFAULT_TIMEOUT_MS, intervalMs = DEFAULT_INTERVAL_MS }: WaitOptions = {}
): Promise<boolean> {
  if (since === undefined) {
    await sleep(800);
    return true;
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(intervalMs);
    let query = supabaseReadOnly.from(table).select('created_at').eq(companyColumn, companyId);
    if (since) query = query.gt('created_at', since);
    const { data, error } = await query.limit(1);
    if (!error && (data ?? []).length > 0) return true;
  }
  return false;
}

/** The company's settings row ("Podatki podjetij"), which the settings dialogs save. */
export const companySettingsKey = (companyId: string): RowKey => ({
  table: 'Podatki podjetij',
  column: 'ID Podjetja',
  value: companyId,
});
