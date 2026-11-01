"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useCompany } from "./company-context";
import { useLocations } from "@/lib/hooks/useLocations";
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
};

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

const storageKey = (companyId: string) => `jedroplus_location_${companyId}`;

export function LocationProvider({ children }: { children: ReactNode }) {
  const { companyId } = useCompany();
  const { locations, multi } = useLocations();
  const [stored, setStored] = useState<string | null>(null);

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

  const value = useMemo(
    () => ({ locations, multi, selectedLocationId, setSelectedLocationId, matchesLocation }),
    [locations, multi, selectedLocationId, setSelectedLocationId, matchesLocation]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationScope(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocationScope must be used within LocationProvider");
  return ctx;
}
