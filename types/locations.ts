// TypeScript types for company locations ("Lokacije").

export type LocationStatus = 'active' | 'archived';

export interface Location {
  id: string;
  company_id: string; // "ID podjetja" (text id, e.g. 7LHB28)
  naziv: string;
  naslov: string | null;
  telefon: string | null;
  email: string | null;
  urnik: string | null; // JSON text, same shape as "Podatki podjetij".urnik
  povezava_ocena: string | null;
  je_glavna: boolean;
  status: LocationStatus;
  zaporedje: number;
  cas_poti_min: number;
}

export interface LocationsResponse {
  ok: true;
  locations: Location[];
  /** Included in the plan plus purchased extra locations. */
  max: number;
  active: number;
}

/** Fields an owner/admin can set when creating or editing a location. */
export interface LocationInput {
  naziv?: string;
  naslov?: string | null;
  telefon?: string | null;
  email?: string | null;
  urnik?: string | null;
  povezava_ocena?: string | null;
  cas_poti_min?: number;
  zaporedje?: number;
}

/** Database row → Location. */
export function locationFromRow(row: Record<string, unknown>): Location {
  return {
    id: String(row.id),
    company_id: String(row['ID podjetja']),
    naziv: String(row.naziv ?? ''),
    naslov: (row.naslov as string | null) ?? null,
    telefon: (row.telefon as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    urnik: (row.urnik as string | null) ?? null,
    povezava_ocena: (row.povezava_ocena as string | null) ?? null,
    je_glavna: Boolean(row.je_glavna),
    status: row.status === 'archived' ? 'archived' : 'active',
    zaporedje: Number(row.zaporedje ?? 0),
    cas_poti_min: Number(row.cas_poti_min ?? 0),
  };
}
