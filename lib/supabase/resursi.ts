import { supabase } from '@/lib/supabaseClient';
import { generateUnique8DigitId } from '@/lib/utils/uniqueIdGenerator';
import type { Resurs, ResursFormData, StoritevResurs, TerminResurs, UrnikData } from '@/types/resursi';

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

  const kolicina = Number(row['Kolicina'] ?? 1) || 1;
  const kapaciteta = Number(row['Kapaciteta'] ?? 1) || 1;

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

  const result = (data ?? []).map((r) => ({
    resursRowId: Number((r as Record<string, unknown>)['resurs_id']),
    resursTextId: String((r as Record<string, unknown>)['ID resursa'] ?? ''),
  }));
  return { data: result, error: null };
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
    'Kolicina': Number(formData.kolicina),
    'Kapaciteta': Number(formData.kapaciteta),
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

  const resursRowIds = resursiData.map((r) => r.resursRowId);

  // Fetch resursiRows with Urnik for schedule validation
  const { data: resursiRows } = await supabase
    .from(TABLE_RESURSI)
    .select('id, "Naziv", "Kolicina", "Kapaciteta", "Urnik"')
    .eq('ID podjetja', companyId)
    .in('id', resursRowIds);

  // Fetch all termini for this date without time filter
  const { data: terminiOnDate } = await supabase
    .from('Termini')
    .select('id, "Čas", "Konec", "Status"')
    .eq('ID podjetja', companyId)
    .eq('Datum', datum);

  // Filter time overlap in JavaScript (avoids special character issues with PostgREST)
  const overlappingIds = (terminiOnDate ?? [])
    .filter((t) => {
      const row = t as Record<string, unknown>;
      const status = String(row['Status'] ?? '');
      if (status === 'cancelled' || status === 'Odpovedan') return false;
      if (excludeTerminId && Number(row['id']) === excludeTerminId) return false;
      const tStart = String(row['Čas'] ?? '');
      const tEnd = String(row['Konec'] ?? '');
      // Overlap: existing starts before our end AND existing ends after our start
      return tStart < casKonec && tEnd > casZacetek;
    })
    .map((t) => Number((t as Record<string, unknown>)['id']));

  const dayMap: Record<number, string> = {
    0: 'Nedelja', 1: 'Ponedeljek', 2: 'Torek', 3: 'Sreda',
    4: 'Četrtek', 5: 'Petek', 6: 'Sobota',
  };

  const conflicts: ResourceConflict[] = [];
  const schedulePassedIds: number[] = [];

  for (const r of (resursiRows ?? []) as Record<string, unknown>[]) {
    const rid = Number(r['id']);
    const naziv = String(r['Naziv'] ?? '');
    const textId = resursiData.find((x) => x.resursRowId === rid)?.resursTextId ?? '';

    // Schedule check
    const urnikRaw = r['Urnik'];
    let urnik: Record<string, { enabled: boolean; intervals: { start: string; end: string }[] }> | null = null;
    if (urnikRaw && typeof urnikRaw === 'string') {
      try { urnik = JSON.parse(urnikRaw); } catch { urnik = null; }
    } else if (urnikRaw && typeof urnikRaw === 'object') {
      urnik = urnikRaw as typeof urnik;
    }

    if (urnik !== null) {
      const dayName = dayMap[new Date(datum).getDay()];
      const daySchedule = urnik[dayName];
      const available = daySchedule?.enabled === true &&
        daySchedule.intervals.some(
          (interval) => interval.start <= casZacetek && interval.end >= casKonec
        );
      if (!available) {
        conflicts.push({ resursId: rid, resursTextId: textId, naziv, trenutnoZasedeno: 0, maxKapaciteta: 0, tip: 'urnik' });
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
      const kolicina = Number(r['Kolicina'] ?? 1);
      const kapaciteta = Number(r['Kapaciteta'] ?? 1);
      const max = kolicina * kapaciteta;
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
