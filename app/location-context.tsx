"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useCompany } from "./company-context";
import { useLocations } from "@/lib/hooks/useLocations";
import { supabaseReadOnly } from "@/src/lib/supabaseReadOnly";
import type { Location } from "@/types/locations";

type LocationContextValue = {
  /** Active locations of the current company. */
  locations: Location[];
  /** More than one active location — only then do screens show location controls. */
  multi: boolean;
  /** Chosen location in the top bar; null = all locations. Always null with one location. */
  selectedLocationId: string | null;
  setSelectedLocationId: (id: string | null) => void;
  /**
   * Whether a row with this `lokacija_id` belongs to the current selection.
   * A row without a location counts as the main one (same as the database default).
   */
  matchesLocation: (lokacijaId: string | null | undefined) => boolean;
  /** Whether a team member ("ID osebe") works at the selected location. Unknown people count as yes. */
  personAtSelected: (osebaRef: string | null | undefined) => boolean;
  /** Whether a service ("ID storitve") is offered at the selected location. No links = everywhere. */
  serviceAtSelected: (storitevRef: string | null | undefined) => boolean;
  /** Same as personAtSelected, for an explicit location (e.g. the one chosen in a form). */
  personAtLocation: (osebaRef: string | null | undefined, lokacijaId: string | null | undefined) => boolean;
  serviceAtLocation: (storitevRef: string | null | undefined, lokacijaId: string | null | undefined) => boolean;
  /** Ids of the locations a team member works at; null when unknown (no links = every location). */
  locationsOfPerson: (osebaRef: string | null | undefined) => string[] | null;
};

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

const storageKey = (companyId: string) => `jedroplus_location_${companyId}`;

export function LocationProvider({ children }: { children: ReactNode }) {
  const { companyId } = useCompany();
  const { locations, multi } = useLocations();
  const [stored, setStored] = useState<string | null>(null);
  const [personLinks, setPersonLinks] = useState<Map<string, Set<string>>>(new Map());
  const [serviceLinks, setServiceLinks] = useState<Map<string, Set<string>>>(new Map());

  // Who works where and what is offered where; only needed with several locations.
  useEffect(() => {
    if (!companyId || !multi) { setPersonLinks(new Map()); setServiceLinks(new Map()); return; }
    let active = true;
    const group = (rows: Record<string, unknown>[] | null, idColumn: string) => {
      const map = new Map<string, Set<string>>();
      for (const r of rows ?? []) {
        const key = String(r[idColumn]);
        if (!map.has(key)) map.set(key, new Set());
        map.get(key)!.add(String(r.lokacija_id));
      }
      return map;
    };
    Promise.all([
      supabaseReadOnly.from("Osebe_Lokacije").select('"ID osebe", lokacija_id').eq("ID podjetja", companyId),
      supabaseReadOnly.from("Storitve_Lokacije").select('"ID storitve", lokacija_id').eq("ID podjetja", companyId),
    ]).then(([p, sv]) => {
      if (!active) return;
      setPersonLinks(group(p.data as unknown as Record<string, unknown>[] | null, "ID osebe"));
      setServiceLinks(group(sv.data as unknown as Record<string, unknown>[] | null, "ID storitve"));
    });
    return () => { active = false; };
  }, [companyId, multi]);

  useEffect(() => {
    if (!companyId) { setStored(null); return; }
    try {
      setStored(localStorage.getItem(storageKey(companyId)));
    } catch {
      setStored(null);
    }
  }, [companyId]);

  // A remembered location that was archived or never existed means "all".
  const selectedLocationId = useMemo(
    () => (multi && stored && locations.some((l) => l.id === stored) ? stored : null),
    [multi, stored, locations]
  );

  const setSelectedLocationId = useCallback((id: string | null) => {
    setStored(id);
    if (!companyId) return;
    try {
      if (id) localStorage.setItem(storageKey(companyId), id);
      else localStorage.removeItem(storageKey(companyId));
    } catch {
      /* private mode: the choice just isn't remembered */
    }
  }, [companyId]);

  const mainId = useMemo(() => locations.find((l) => l.je_glavna)?.id ?? null, [locations]);

  const matchesLocation = useCallback(
    (lokacijaId: string | null | undefined) =>
      selectedLocationId === null || (lokacijaId ?? mainId) === selectedLocationId,
    [selectedLocationId, mainId]
  );

  const personAtSelected = useCallback(
    (osebaRef: string | null | undefined) => {
      if (selectedLocationId === null || !osebaRef) return true;
      const links = personLinks.get(osebaRef);
      return !links || links.has(selectedLocationId);
    },
    [selectedLocationId, personLinks]
  );

  const serviceAtSelected = useCallback(
    (storitevRef: string | null | undefined) => {
      if (selectedLocationId === null || !storitevRef) return true;
      const links = serviceLinks.get(storitevRef);
      return !links || links.has(selectedLocationId);
    },
    [selectedLocationId, serviceLinks]
  );

  const personAtLocation = useCallback(
    (osebaRef: string | null | undefined, lokacijaId: string | null | undefined) => {
      if (!lokacijaId || !osebaRef) return true;
      const links = personLinks.get(osebaRef);
      return !links || links.has(lokacijaId);
    },
    [personLinks]
  );

  const serviceAtLocation = useCallback(
    (storitevRef: string | null | undefined, lokacijaId: string | null | undefined) => {
      if (!lokacijaId || !storitevRef) return true;
      const links = serviceLinks.get(storitevRef);
      return !links || links.has(lokacijaId);
    },
    [serviceLinks]
  );

  const locationsOfPerson = useCallback(
    (osebaRef: string | null | undefined) => {
      if (!osebaRef) return null;
      const links = personLinks.get(osebaRef);
      return links ? Array.from(links) : null;
    },
    [personLinks]
  );

  const value = useMemo(
    () => ({
      locations, multi, selectedLocationId, setSelectedLocationId, matchesLocation,
      personAtSelected, serviceAtSelected, personAtLocation, serviceAtLocation, locationsOfPerson,
    }),
    [locations, multi, selectedLocationId, setSelectedLocationId, matchesLocation,
      personAtSelected, serviceAtSelected, personAtLocation, serviceAtLocation, locationsOfPerson]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationScope(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocationScope must be used within LocationProvider");
  return ctx;
}
