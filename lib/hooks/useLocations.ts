'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCompany } from '@/app/company-context';
import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';
import { locationFromRow, type Location } from '@/types/locations';

/**
 * The company's active locations (read through the user's session, so RLS
 * applies). `multi` is true only when there is more than one — screens use it
 * to show location controls, so a single-location company sees no change.
 */
export function useLocations() {
  const { companyId } = useCompany();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    supabaseReadOnly
      .from('Lokacije')
      .select('*')
      .eq('ID podjetja', companyId)
      .eq('status', 'active')
      .order('je_glavna', { ascending: false })
      .order('zaporedje')
      .then(({ data }) => {
        if (!active) return;
        setLocations((data ?? []).map(locationFromRow));
        setLoading(false);
      });
    return () => { active = false; };
  }, [companyId]);

  return { locations, multi: locations.length > 1, loading };
}

export type LocationKind = 'staff' | 'service';

/**
 * Locations picked in a staff or service form. Loads the saved choice when
 * editing; for a new row, a person starts at the main location and a service
 * at all of them. `ids` is null while the picker is hidden (one location).
 */
export function useEntityLocations(kind: LocationKind, rowId: string | null, isOpen: boolean) {
  const { locations, multi } = useLocations();
  const [ids, setIds] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    if (!multi) { setIds(null); return; }
    if (!rowId) {
      setIds(kind === 'staff' ? locations.filter((l) => l.je_glavna).map((l) => l.id) : locations.map((l) => l.id));
      return;
    }
    try {
      const res = await fetch(`/api/locations/assign?kind=${kind}&id=${encodeURIComponent(rowId)}`, { cache: 'no-store' });
      const data = (await res.json()) as { ok?: boolean; locations?: string[] };
      setIds(res.ok && data.ok && data.locations ? data.locations : locations.map((l) => l.id));
    } catch {
      setIds(locations.map((l) => l.id));
    }
  }, [kind, rowId, multi, locations]);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  return { locations, multi, ids, setIds };
}

/** Saves the choice after the row itself was saved. Resolves true on success. */
export async function saveEntityLocations(
  kind: LocationKind,
  target: { id: string } | { ref: string },
  ids: string[] | null
): Promise<boolean> {
  if (!ids) return true;
  try {
    const res = await fetch('/api/locations/assign', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, ...target, locations: ids }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
