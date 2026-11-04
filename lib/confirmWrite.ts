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
