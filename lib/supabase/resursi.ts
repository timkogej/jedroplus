import { supabase } from '@/lib/supabaseClient';
import { generateUnique8DigitId } from '@/lib/utils/uniqueIdGenerator';
import { getUrnikZaDan } from '@/lib/utils/urnik';
import type { IzmenicenUrnik, Resurs, ResursFormData, StoritevResurs, UrnikData, UrnikInterval } from '@/types/resursi';

const TABLE_RESURSI = 'Resursi';
const TABLE_STORITVE_RESURSI = 'Storitve_Resursi';
const TABLE_TERMINI_RESURSI = 'Termini_Resursi';

// ─── Parse helpers ──────────────────────────────────────────────────────────

function parseResurs(row: Record<string, unknown>): Resurs | null {
  const id = String(row['ID resursa'] ?? '');
  if (!id) return null;

  let urnik: UrnikData | null = null;
  const urnikRaw = row['Urnik'];
  if (urnikRaw && typeof urnikRaw === 'string') {
    try { urnik = JSON.parse(urnikRaw) as UrnikData; } catch { urnik = null; }
  } else if (urnikRaw && typeof urnikRaw === 'object') {
    urnik = urnikRaw as UrnikData;
  }

  const kolicina = positiveNumber(row['Kolicina']);
  const kapaciteta = positiveNumber(row['Kapaciteta']);

  const prikaziRaw = row['Prikazi v bookingu'];
  const prikazi = prikaziRaw === 'true' || prikaziRaw === true;

  const statusRaw = String(row['Status'] ?? 'active').toLowerCase();
  const status: 'active' | 'inactive' = statusRaw === 'inactive' ? 'inactive' : 'active';

  const rowId = Number(row['id']) || 0;

  return {
    id,
    row_id: rowId,
    naziv: String(row['Naziv'] ?? ''),
    booking_naziv: row['Booking naziv'] ? String(row['Booking naziv']) : null,
    opis: row['Opis'] ? String(row['Opis']) : null,
    kolicina,
    kapaciteta,
    prikazi_v_bookingu: prikazi,
    urnik,
    status,
    barva: String(row['Barva'] ?? 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 50%, #8B5CF6 100%)'),
    podjetje_id: String(row['ID podjetja'] ?? ''),
    created_at: String(row['created_at'] ?? new Date().toISOString()),
    skupna_kapaciteta: kolicina * kapaciteta,
  };
}

function positiveNumber(value: unknown, fallback = 1): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isEnabledValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', '1', 'yes', 'enabled', 'omogoceno', 'omogočeno'].includes(normalized);
  }
  return false;
}

function resourceCapacity(row: Record<string, unknown>): number {
  return positiveNumber(row['Kolicina']) * positiveNumber(row['Kapaciteta']);
}

function parseDateKey(datum: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(datum);
  if (!match) return new Date(datum);

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function parseMinutes(time: unknown): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(time ?? ''));
  if (!match) return null;

  const [, hours, minutes] = match;
  const total = Number(hours) * 60 + Number(minutes);
  return Number.isFinite(total) ? total : null;
}

function parseUrnik(raw: unknown): UrnikData | IzmenicenUrnik | null {
  if (!raw) return null;

  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as UrnikData | IzmenicenUrnik;
    } catch {
      return null;
    }
  }

  if (typeof raw === 'object') return raw as UrnikData | IzmenicenUrnik;

  return null;
}

function getIntervals(daySchedule: unknown): UrnikInterval[] {
  if (!daySchedule || typeof daySchedule !== 'object') return [];

  const day = daySchedule as Record<string, unknown>;
  if (Array.isArray(day.intervals)) {
    return day.intervals.filter((interval): interval is UrnikInterval => {
      if (!interval || typeof interval !== 'object') return false;
      const candidate = interval as Record<string, unknown>;
      return typeof candidate.start === 'string' && typeof candidate.end === 'string';
    });
  }

  if (typeof day.start === 'string' && typeof day.end === 'string') {
    return [{ start: day.start, end: day.end }];
  }

  return [];
}

function isTimeInResourceSchedule(
  urnik: UrnikData | IzmenicenUrnik,
  datum: string,
  casZacetek: string,
  casKonec: string,
): boolean {
  const dayMap: Record<number, keyof UrnikData> = {
    0: 'Nedelja',
    1: 'Ponedeljek',
    2: 'Torek',
    3: 'Sreda',
    4: 'Četrtek',
    5: 'Petek',
    6: 'Sobota',
  };

  const date = parseDateKey(datum);
  const activeUrnik = getUrnikZaDan(urnik, date);
  const daySchedule = activeUrnik[dayMap[date.getDay()]] as unknown;

  if (!daySchedule || typeof daySchedule !== 'object') return false;
  if (!isEnabledValue((daySchedule as Record<string, unknown>).enabled)) return false;

  const intervals = getIntervals(daySchedule);
  if (intervals.length === 0) return true;

  const start = parseMinutes(casZacetek);
  const end = parseMinutes(casKonec);
  if (start === null || end === null) return false;

  return intervals.some((interval) => {
    const intervalStart = parseMinutes(interval.start);
    const intervalEnd = parseMinutes(interval.end);
    if (intervalStart === null || intervalEnd === null) return false;

    return start >= intervalStart && end <= intervalEnd;
  });
}

function isBlockingAppointment(row: Record<string, unknown>): boolean {
  const status = String(row['Status'] ?? '').trim().toLowerCase();
  return !['cancelled', 'canceled', 'odpovedan', 'odpovedano'].includes(status);
}

// ─── Fetch resources for a company ──────────────────────────────────────────

export async function fetchResursi(companyId: string): Promise<{
  data: Resurs[];
  error: string | null;
}> {
  if (!companyId) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLE_RESURSI)
    .select('*')
    .eq('ID podjetja', companyId)
    .order('Naziv');

  if (error) return { data: [], error: error.message };

  const resursi: Resurs[] = [];
  for (const row of data ?? []) {
    const r = parseResurs(row as Record<string, unknown>);
    if (r) resursi.push(r);
  }

  return { data: resursi, error: null };
}

// ─── Fetch active resources ──────────────────────────────────────────────────

export async function fetchActiveResursi(companyId: string): Promise<{
  data: Resurs[];
  error: string | null;
}> {
  if (!companyId) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLE_RESURSI)
    .select('*')
    .eq('ID podjetja', companyId)
    .eq('Status', 'active')
    .order('Naziv');

  if (error) return { data: [], error: error.message };

  const resursi: Resurs[] = [];
  for (const row of data ?? []) {
    const r = parseResurs(row as Record<string, unknown>);
    if (r) resursi.push(r);
  }

  return { data: resursi, error: null };
}

// ─── Fetch Storitve_Resursi links for a company ──────────────────────────────

export async function fetchStoritveResursi(companyId: string): Promise<{
  data: StoritevResurs[];
  error: string | null;
}> {
  if (!companyId) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLE_STORITVE_RESURSI)
    .select('*')
    .eq('ID podjetja', companyId);

  if (error) return { data: [], error: error.message };

  const links: StoritevResurs[] = (data ?? []).map((row) => ({
    id_podjetja: String(row['ID podjetja'] ?? ''),
    id_storitve: String(row['ID storitve'] ?? ''),
    id_resursa: String(row['ID resursa'] ?? ''),
  }));

  return { data: links, error: null };
}

// ─── Fetch resource IDs linked to a list of service IDs ──────────────────────

export async function fetchResursiForStoritve(
  companyId: string,
  storitveIds: string[],
): Promise<{ data: Array<{ resursRowId: number; resursTextId: string }>; error: string | null }> {
  if (!companyId || storitveIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLE_STORITVE_RESURSI)
    .select('resurs_id, "ID resursa"')
    .eq('ID podjetja', companyId)
    .in('ID storitve', storitveIds);

  if (error) return { data: [], error: error.message };

  const linked = (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      resursRowId: Number(row['resurs_id']),
      resursTextId: String(row['ID resursa'] ?? ''),
    };
  });

  const missingRowIds = linked
    .filter((r) => (!Number.isFinite(r.resursRowId) || r.resursRowId <= 0) && r.resursTextId)
    .map((r) => r.resursTextId);

  const rowIdByTextId = new Map<string, number>();
  if (missingRowIds.length > 0) {
    const { data: resursiRows, error: resursiErr } = await supabase
      .from(TABLE_RESURSI)
      .select('id, "ID resursa"')
      .eq('ID podjetja', companyId)
      .in('ID resursa', [...new Set(missingRowIds)]);

    if (resursiErr) return { data: [], error: resursiErr.message };

    for (const row of (resursiRows ?? []) as Record<string, unknown>[]) {
      const textId = String(row['ID resursa'] ?? '');
      const rowId = Number(row['id']);
      if (textId && Number.isFinite(rowId) && rowId > 0) {
        rowIdByTextId.set(textId, rowId);
      }
    }
  }

  const unique = new Map<string, { resursRowId: number; resursTextId: string }>();
  for (const item of linked) {
    const resursRowId = Number.isFinite(item.resursRowId) && item.resursRowId > 0
      ? item.resursRowId
      : rowIdByTextId.get(item.resursTextId) ?? 0;
    if (!resursRowId || !item.resursTextId) continue;
    unique.set(`${resursRowId}:${item.resursTextId}`, { resursRowId, resursTextId: item.resursTextId });
  }

  return { data: [...unique.values()], error: null };
}

// ─── Save resource (create or update) ────────────────────────────────────────

export async function saveResurs(
  companyId: string,
  formData: ResursFormData,
  existingId?: string,
): Promise<{ id: string; error: string | null }> {
  if (!companyId) return { id: '', error: 'Manjka ID podjetja.' };

  const id = existingId ?? await generateUnique8DigitId(TABLE_RESURSI, 'ID resursa');

  const row = {
    'ID resursa': id,
    'ID podjetja': companyId,
    'Naziv': formData.naziv,
    'Booking naziv': formData.booking_naziv || null,
    'Opis': formData.opis || null,
    'Barva': formData.barva,
    'Kolicina': positiveNumber(formData.kolicina),
    'Kapaciteta': positiveNumber(formData.kapaciteta),
    'Prikazi v bookingu': formData.prikazi_v_bookingu ? 'true' : 'false',
    'Urnik': formData.urnik ? JSON.stringify(formData.urnik) : null,
    'Status': formData.status,
  };

  if (existingId) {
    const { error } = await supabase
      .from(TABLE_RESURSI)
      .update(row)
      .eq('ID resursa', existingId)
      .eq('ID podjetja', companyId);
    if (error) return { id: existingId, error: error.message };
  } else {
    const { error } = await supabase
      .from(TABLE_RESURSI)
      .insert(row);
    if (error) return { id, error: error.message };
  }

  const { data: resursRow } = await supabase
    .from(TABLE_RESURSI)
    .select('id')
    .eq('ID resursa', id)
    .eq('ID podjetja', companyId)
    .maybeSingle();
  const resursRowId = Number(resursRow?.id ?? 0);

  const storitveTextIds: string[] = formData.storitve_ids ?? [];
  const { error: delError } = await supabase
    .from(TABLE_STORITVE_RESURSI)
    .delete()
    .eq('ID podjetja', companyId)
    .eq('ID resursa', id);
  if (delError) return { id, error: delError.message };

  if (storitveTextIds.length > 0) {
    const junctionRows = storitveTextIds.map((sid) => ({
      'ID podjetja': companyId,
      'ID storitve': sid,
      'ID resursa': id,
      'resurs_id': resursRowId,
    }));
    const { error: insError } = await supabase
      .from(TABLE_STORITVE_RESURSI)
      .insert(junctionRows);
    if (insError) return { id, error: insError.message };
  }

  return { id, error: null };
}

// ─── Sync Storitve_Resursi from the service side ─────────────────────────────

export async function syncStoritevResursi(
  companyId: string,
  storitevTextId: string,
  resursiTextIds: string[],
): Promise<string | null> {
  const { error: delError } = await supabase
    .from(TABLE_STORITVE_RESURSI)
    .delete()
    .eq('ID podjetja', companyId)
    .eq('ID storitve', storitevTextId);
  if (delError) return delError.message;

  if (resursiTextIds.length === 0) return null;

  const { data: resursiRows, error: resursiErr } = await supabase
    .from(TABLE_RESURSI)
    .select('id, "ID resursa"')
    .eq('ID podjetja', companyId)
    .in('ID resursa', resursiTextIds);
  if (resursiErr) return resursiErr.message;
  if (!resursiRows?.length) return null;

  const rows = resursiRows.map((r) => ({
    'ID podjetja': companyId,
    'ID storitve': storitevTextId,
    'ID resursa': String(r['ID resursa']),
    'resurs_id': Number(r.id),
  }));

  const { error: insError } = await supabase
    .from(TABLE_STORITVE_RESURSI)
    .insert(rows);
  return insError?.message ?? null;
}

// ─── Sync Storitve_Resursi from the resource side ────────────────────────────

export async function syncStoritveResursi(
  companyId: string,
  resursRowId: number,
  resursTextId: string,
  storitveTextIds: string[],
): Promise<string | null> {
  const { error: delError } = await supabase
    .from(TABLE_STORITVE_RESURSI)
    .delete()
    .eq('ID podjetja', companyId)
    .eq('ID resursa', resursTextId);
  if (delError) return delError.message;

  if (storitveTextIds.length === 0) return null;

  const rows = storitveTextIds.map((sid) => ({
    'ID podjetja': companyId,
    'ID storitve': sid,
    'ID resursa': resursTextId,
    'resurs_id': resursRowId,
  }));

  const { error: insError } = await supabase
    .from(TABLE_STORITVE_RESURSI)
    .insert(rows);
  return insError?.message ?? null;
}

// ─── Delete resource ──────────────────────────────────────────────────────────

export async function deleteResurs(
  companyId: string,
  resursId: string,
): Promise<string | null> {
  const { error: e1 } = await supabase
    .from(TABLE_TERMINI_RESURSI)
    .delete()
    .eq('ID resursa', resursId)
    .eq('ID podjetja', companyId);

  if (e1) return e1.message;

  const { error: e2 } = await supabase
    .from(TABLE_STORITVE_RESURSI)
    .delete()
    .eq('ID resursa', resursId)
    .eq('ID podjetja', companyId);

  if (e2) return e2.message;

  const { error: e3 } = await supabase
    .from(TABLE_RESURSI)
    .delete()
    .eq('ID resursa', resursId)
    .eq('ID podjetja', companyId);

  return e3 ? e3.message : null;
}

// ─── Termini_Resursi ──────────────────────────────────────────────────────────

export async function syncTerminResursi(
  companyId: string,
  terminRowId: number,
  resursi: { rowId: number; textId: string }[],
): Promise<string | null> {
  const { error: delError } = await supabase
    .from(TABLE_TERMINI_RESURSI)
    .delete()
    .eq('ID podjetja', companyId)
    .eq('termin_id', terminRowId);
  if (delError) return delError.message;

  if (resursi.length === 0) return null;

  const rows = resursi.map(({ rowId, textId }) => ({
    'ID podjetja': companyId,
    'termin_id': terminRowId,
    'resurs_id': rowId,
    'ID resursa': textId,
  }));

  const { error: insError } = await supabase
    .from(TABLE_TERMINI_RESURSI)
    .insert(rows);
  return insError?.message ?? null;
}

export async function deleteTerminResursi(
  companyId: string,
  terminRowId: number,
): Promise<string | null> {
  const { error } = await supabase
    .from(TABLE_TERMINI_RESURSI)
    .delete()
    .eq('ID podjetja', companyId)
    .eq('termin_id', terminRowId);
  return error?.message ?? null;
}

// ─── Fetch resource IDs for a termin ─────────────────────────────────────────

export async function fetchResursiForTermin(
  companyId: string,
  terminId: string,
): Promise<{ data: string[]; error: string | null }> {
  if (!companyId || !terminId) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLE_TERMINI_RESURSI)
    .select('*')
    .eq('ID podjetja', companyId)
    .eq('ID termina', terminId);

  if (error) return { data: [], error: error.message };

  return { data: (data ?? []).map((r) => String(r['ID resursa'])), error: null };
}

// Resource row-ids (resurs_id) already attached to a single termin row.
// Used to suppress conflict warnings for resources the termin itself occupies.
export async function fetchResursIdsForTerminRow(
  companyId: string,
  terminRowId: number,
): Promise<{ data: Set<number>; error: string | null }> {
  if (!companyId || !terminRowId) return { data: new Set(), error: null };

  const { data, error } = await supabase
    .from(TABLE_TERMINI_RESURSI)
    .select('resurs_id')
    .eq('ID podjetja', companyId)
    .eq('termin_id', terminRowId);

  if (error) return { data: new Set(), error: error.message };

  const ids = new Set<number>(
    (data ?? [])
      .map((r) => Number((r as Record<string, unknown>)['resurs_id']))
      .filter((n) => !isNaN(n) && n > 0)
  );
  return { data: ids, error: null };
}

export async function fetchTerminIdsWithResursi(
  companyId: string,
): Promise<{ data: Set<number>; error: string | null }> {
  if (!companyId) return { data: new Set(), error: null };

  const { data, error } = await supabase
    .from(TABLE_TERMINI_RESURSI)
    .select('termin_id')
    .eq('ID podjetja', companyId);

  if (error) return { data: new Set(), error: error.message };

  const ids = new Set<number>(
    (data ?? [])
      .map((r) => Number((r as Record<string, unknown>)['termin_id']))
      .filter((n) => !isNaN(n) && n > 0)
  );
  return { data: ids, error: null };
}

export async function fetchTerminResursiMap(
  companyId: string,
): Promise<{ data: Map<number, Set<number>>; error: string | null }> {
  if (!companyId) return { data: new Map(), error: null };

  const { data, error } = await supabase
    .from(TABLE_TERMINI_RESURSI)
    .select('termin_id, resurs_id')
    .eq('ID podjetja', companyId);

  if (error) return { data: new Map(), error: error.message };

  const map = new Map<number, Set<number>>();
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const resursId = Number(row['resurs_id']);
    const terminId = Number(row['termin_id']);
    if (!resursId || !terminId) continue;
    if (!map.has(resursId)) map.set(resursId, new Set());
    map.get(resursId)!.add(terminId);
  }
  return { data: map, error: null };
}

// ─── Real-time resource conflict detection ────────────────────────────────────

export interface ResourceConflict {
  resursId: number;
  resursTextId: string;
  naziv: string;
  trenutnoZasedeno: number;
  maxKapaciteta: number;
  tip: 'zaseden' | 'urnik';
}

export async function checkResourceConflicts(
  companyId: string,
  serviceIds: string[],
  datum: string,
  casZacetek: string,
  casKonec: string,
  excludeTerminId?: number,
): Promise<{ conflicts: ResourceConflict[]; error: string | null }> {
  if (!companyId || serviceIds.length === 0 || !datum || !casZacetek || !casKonec) {
    return { conflicts: [], error: null };
  }

  const { data: resursiData, error: resursiErr } = await fetchResursiForStoritve(
    companyId,
    serviceIds,
  );
  if (resursiErr || !resursiData?.length) return { conflicts: [], error: resursiErr };

  const resursRowIds = [...new Set(
    resursiData
      .map((r) => r.resursRowId)
      .filter((id) => Number.isFinite(id) && id > 0)
  )];

  if (resursRowIds.length === 0) return { conflicts: [], error: null };

  // Fetch resursiRows with Urnik for schedule validation
  const { data: resursiRows, error: resursiRowsErr } = await supabase
    .from(TABLE_RESURSI)
    .select('id, "Naziv", "Kolicina", "Kapaciteta", "Urnik"')
    .eq('ID podjetja', companyId)
    .in('id', resursRowIds);

  if (resursiRowsErr) return { conflicts: [], error: resursiRowsErr.message };

  // Fetch all termini for this date without time filter
  const { data: terminiOnDate, error: terminiErr } = await supabase
    .from('Termini')
    .select('id, "Čas", "Konec", "Status", deleted_at')
    .eq('ID podjetja', companyId)
    .eq('Datum', datum);

  if (terminiErr) return { conflicts: [], error: terminiErr.message };

  const requestedStart = parseMinutes(casZacetek);
  const requestedEnd = parseMinutes(casKonec);
  if (requestedStart === null || requestedEnd === null || requestedStart >= requestedEnd) {
    return { conflicts: [], error: null };
  }

  // Filter time overlap in JavaScript (avoids special character issues with PostgREST)
  const overlappingIds = (terminiOnDate ?? [])
    .filter((t) => {
      const row = t as Record<string, unknown>;
      if (!isBlockingAppointment(row)) return false;
      if (row['deleted_at']) return false;
      if (excludeTerminId && Number(row['id']) === excludeTerminId) return false;
      const tStart = parseMinutes(row['Čas']);
      const tEnd = parseMinutes(row['Konec']);
      if (tStart === null || tEnd === null) return false;
      // Overlap: existing starts before our end AND existing ends after our start
      return tStart < requestedEnd && tEnd > requestedStart;
    })
    .map((t) => Number((t as Record<string, unknown>)['id']));

  const conflicts: ResourceConflict[] = [];
  const schedulePassedIds: number[] = [];

  for (const r of (resursiRows ?? []) as Record<string, unknown>[]) {
    const rid = Number(r['id']);
    if (!Number.isFinite(rid) || rid <= 0) continue;

    const naziv = String(r['Naziv'] ?? '');
    const textId = resursiData.find((x) => x.resursRowId === rid)?.resursTextId ?? '';

    // Schedule check
    const urnik = parseUrnik(r['Urnik']);
    if (urnik !== null) {
      if (!isTimeInResourceSchedule(urnik, datum, casZacetek, casKonec)) {
        conflicts.push({
          resursId: rid,
          resursTextId: textId,
          naziv,
          trenutnoZasedeno: 0,
          maxKapaciteta: resourceCapacity(r),
          tip: 'urnik',
        });
        continue;
      }
    }

    schedulePassedIds.push(rid);
  }

  // Occupancy check only for resources that passed schedule validation
  if (schedulePassedIds.length > 0 && overlappingIds.length > 0) {
    const { data: usedResursi } = await supabase
      .from(TABLE_TERMINI_RESURSI)
      .select('resurs_id')
      .eq('ID podjetja', companyId)
      .in('termin_id', overlappingIds)
      .in('resurs_id', schedulePassedIds);

    const usageMap = new Map<number, number>();
    for (const row of (usedResursi ?? []) as Record<string, unknown>[]) {
      const rid = Number(row['resurs_id']);
      usageMap.set(rid, (usageMap.get(rid) ?? 0) + 1);
    }

    for (const rid of schedulePassedIds) {
      const r = ((resursiRows ?? []) as Record<string, unknown>[]).find((row) => Number(row['id']) === rid);
      if (!r) continue;
      const max = resourceCapacity(r);
      const used = usageMap.get(rid) ?? 0;
      if (used >= max) {
        conflicts.push({
          resursId: rid,
          resursTextId: resursiData.find((x) => x.resursRowId === rid)?.resursTextId ?? '',
          naziv: String(r['Naziv'] ?? ''),
          trenutnoZasedeno: used,
          maxKapaciteta: max,
          tip: 'zaseden',
        });
      }
    }
  }

  return { conflicts, error: null };
}
