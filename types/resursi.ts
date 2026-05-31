// TypeScript types for Resursi (Resources)

export interface UrnikInterval {
  start: string; // HH:MM
  end: string;   // HH:MM
}

export interface UrnikDay {
  enabled: boolean;
  intervals: UrnikInterval[];
}

export interface UrnikData {
  Ponedeljek: UrnikDay;
  Torek: UrnikDay;
  Sreda: UrnikDay;
  Četrtek: UrnikDay;
  Petek: UrnikDay;
  Sobota: UrnikDay;
  Nedelja: UrnikDay;
}

export const URNIK_DAYS: (keyof UrnikData)[] = [
  'Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota', 'Nedelja',
];

export const DEFAULT_URNIK: UrnikData = {
  Ponedeljek: { enabled: true,  intervals: [{ start: '08:00', end: '20:00' }] },
  Torek:      { enabled: true,  intervals: [{ start: '08:00', end: '20:00' }] },
  Sreda:      { enabled: true,  intervals: [{ start: '08:00', end: '20:00' }] },
  Četrtek:    { enabled: true,  intervals: [{ start: '08:00', end: '20:00' }] },
  Petek:      { enabled: true,  intervals: [{ start: '08:00', end: '18:00' }] },
  Sobota:     { enabled: false, intervals: [{ start: '09:00', end: '14:00' }] },
  Nedelja:    { enabled: false, intervals: [{ start: '09:00', end: '14:00' }] },
};

export interface Resurs {
  id: string;           // "ID resursa" — text unique ID
  row_id: number;       // bigint id (auto-increment PK from Resursi table)
  naziv: string;        // internal resource name
  booking_naziv: string | null;
  opis: string | null;
  kolicina: number;     // number of physical units
  kapaciteta: number;   // persons per unit
  prikazi_v_bookingu: boolean;
  urnik: UrnikData | null; // null = always available
  status: 'active' | 'inactive';
  barva: string;        // gradient CSS string
  podjetje_id: string;  // "ID podjetja"
  created_at: string;
  // Computed / joined fields
  storitve?: StoritevResursLink[];
  skupna_kapaciteta?: number; // kolicina × kapaciteta
}

export interface StoritevResursLink {
  id_storitve: string;
  naziv_storitve?: string;
  barva_storitve?: string;
}

export interface StoritevResurs {
  id_podjetja: string;
  id_storitve: string;
  id_resursa: string;
}

export interface TerminResurs {
  id_podjetja: string;
  id_termina: string;
  id_resursa: string;
}

export interface ResursFormData {
  naziv: string;
  booking_naziv: string;
  opis: string;
  barva: string;
  kolicina: number;
  kapaciteta: number;
  prikazi_v_bookingu: boolean;
  urnik: UrnikData | null;
  status: 'active' | 'inactive';
  storitve_ids: string[];
}
