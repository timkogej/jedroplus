import { supabase } from '@/lib/supabaseClient';
import type { UrnikData } from '@/types/resursi';

export interface ResourceConflict {
  resursId: string;
  resursNaziv: string;
  trenutnaZasedenost: number;
  maxKapaciteta: number; // kolicina × kapaciteta
}

export interface ResourceConflictResult {
  hasConflict: boolean;
  conflicts: ResourceConflict[];
}

// Check if a time slot falls within a resource's schedule
function isTimeInUrnik(
  urnik: UrnikData,
  datum: string,
  casZacetek: string,
  casKonec: string,
): boolean {
  const dayNames: (keyof UrnikData)[] = [
    'Nedelja', 'Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota',
  ];

  const date = new Date(datum);
  const dayName = dayNames[date.getDay()];
  const daySchedule = urnik[dayName];

  if (!daySchedule?.enabled) return false;

  const [startH, startM] = casZacetek.split(':').map(Number);
  const [endH, endM] = casKonec.split(':').map(Number);
  const startMins = startH * 60 + startM;
  const endMins = endH * 60 + endM;

  for (const interval of daySchedule.intervals) {
    const [iStartH, iStartM] = interval.start.split(':').map(Number);
    const [iEndH, iEndM] = interval.end.split(':').map(Number);
    const iStart = iStartH * 60 + iStartM;
    const iEnd = iEndH * 60 + iEndM;

    if (startMins >= iStart && endMins <= iEnd) return true;
  }

  return false;
}

// Count overlapping appointments for a resource on a given date/time
async function countOverlappingBookings(
  companyId: string,
  resursId: string,
  datum: string,
  casZacetek: string,
  casKonec: string,
  excludeTerminId?: string,
): Promise<number> {
  // Get Termini_Resursi records for this resource
  const { data: terminResursi, error: trError } = await supabase
    .from('Termini_Resursi')
    .select('*')
    .eq('ID podjetja', companyId)
    .eq('ID resursa', resursId);

  if (trError || !terminResursi?.length) return 0;

  const terminIds = terminResursi
    .map((r) => String(r['ID termina']))
    .filter((id) => id !== excludeTerminId);

  if (terminIds.length === 0) return 0;

  // Fetch the corresponding Termini to check time overlap
  const { data: termini, error: tError } = await supabase
    .from('Termini')
    .select('*')
    .eq('ID podjetja', companyId)
    .in('ID termina', terminIds)
    .eq('Datum', datum);

  if (tError || !termini?.length) return 0;

  // Count overlapping appointments
  // Overlap: appt.start < casKonec AND appt.end > casZacetek
  let count = 0;
  for (const t of termini) {
    const status = String(t['Status'] ?? '').toLowerCase();
    if (status === 'odpovedan' || status === 'cancelled') continue;

    const apptStart = String(t['Čas'] ?? t['cas_zacetek'] ?? '');
    const apptEnd = String(t['Konec'] ?? t['cas_konec'] ?? '');

    if (!apptStart || !apptEnd) continue;

    if (apptStart < casKonec && apptEnd > casZacetek) {
      count++;
    }
  }

  return count;
}

export async function checkResourceConflicts(
  companyId: string,
  serviceIds: string[],
  datum: string,
  casZacetek: string,
  casKonec: string,
  excludeTerminId?: string,
): Promise<ResourceConflictResult> {
  if (!companyId || serviceIds.length === 0) {
    return { hasConflict: false, conflicts: [] };
  }

  try {
    // 1. Get all required resources for these services
    const { data: links, error: linksError } = await supabase
      .from('Storitve_Resursi')
      .select('*')
      .eq('ID podjetja', companyId)
      .in('ID storitve', serviceIds);

    if (linksError || !links?.length) {
      return { hasConflict: false, conflicts: [] };
    }

    const resursIds = [...new Set(links.map((l) => String(l['ID resursa'])))];

    // 2. Fetch resource details (Kolicina, Kapaciteta, Urnik, Naziv)
    const { data: resursiData, error: rError } = await supabase
      .from('Resursi')
      .select('*')
      .eq('ID podjetja', companyId)
      .in('ID resursa', resursIds);

    if (rError || !resursiData?.length) {
      return { hasConflict: false, conflicts: [] };
    }

    const conflicts: ResourceConflict[] = [];

    for (const row of resursiData) {
      const resursId = String(row['ID resursa']);
      const naziv = String(row['Naziv'] ?? '');
      const kolicina = Number(row['Kolicina'] ?? 1);
      const kapaciteta = Number(row['Kapaciteta'] ?? 1);
      const maxKapaciteta = kolicina * kapaciteta;

      // Check schedule availability
      const urnikRaw = row['Urnik'];
      if (urnikRaw) {
        let urnik: UrnikData | null = null;
        try {
          urnik = typeof urnikRaw === 'string'
            ? JSON.parse(urnikRaw) as UrnikData
            : urnikRaw as UrnikData;
        } catch { /* ignore parse errors */ }

        if (urnik && !isTimeInUrnik(urnik, datum, casZacetek, casKonec)) {
          conflicts.push({
            resursId,
            resursNaziv: naziv,
            trenutnaZasedenost: maxKapaciteta,
            maxKapaciteta,
          });
          continue;
        }
      }

      // Count overlapping bookings
      const count = await countOverlappingBookings(
        companyId,
        resursId,
        datum,
        casZacetek,
        casKonec,
        excludeTerminId,
      );

      if (count >= maxKapaciteta) {
        conflicts.push({
          resursId,
          resursNaziv: naziv,
          trenutnaZasedenost: count,
          maxKapaciteta,
        });
      }
    }

    return { hasConflict: conflicts.length > 0, conflicts };
  } catch (err) {
    console.warn('[checkResourceConflicts] Error:', err);
    return { hasConflict: false, conflicts: [] };
  }
}
