// TypeScript types for clients
import type { CommunicationLanguageCode } from '@/lib/communicationLanguage';

export type Gender = 'moški' | 'ženska' | 'drugo';

export type ClientType = 'nova' | 'redna' | 'vip';

export interface Client {
  id: string;
  ime: string;
  priimek: string;
  spol?: Gender | null;
  tip_stranke?: ClientType | null; // "Tip stranke" column
  language?: CommunicationLanguageCode | null; // Communication language
  email: string;
  telefon?: string | null;
  opombe?: string | null;
  interne_opombe?: string | null; // Internal notes - not sent to client
  barva?: string | null; // Gradient CSS string for client avatar color
  podjetje_id?: string;
  created_at?: string;
  updated_at?: string;
  zadnja_interakcija?: string | null; // Last interaction date
  appointment_count?: number;
}

export interface ClientFormData {
  ime: string;
  priimek: string;
  spol: Gender | '';
  tip_stranke: ClientType | '';
  language: CommunicationLanguageCode;
  email: string;
  telefon: string;
  opombe: string;
  interne_opombe: string; // Internal notes - not sent to client
}

export interface ClientWithAppointments extends Client {
  appointments: ClientAppointment[];
}

export interface ClientAppointment {
  id: string;
  datum: string;
  cas_zacetek: string;
  cas_konec: string;
  storitev_naziv: string;
  storitev_barva: string;
  add_on_naziv?: string | null;
  add_on_barva?: string | null;
  add_on_trajanje?: number | null;
  zaposleni_ime: string;
  status: string;
  opombe?: string | null;
  interne_opombe?: string | null;
  koncna_cena?: string | null;
  valuta?: string | null;
  opombe_po_zakljucku?: string | null;
}

// Filter and sort types
export type ClientSortField = 'ime' | 'priimek' | 'email' | 'created_at' | 'appointment_count';
export type SortDirection = 'asc' | 'desc';

export interface ClientFilters {
  search: string;
  sortField: ClientSortField;
  sortDirection: SortDirection;
}

// Stats for clients overview
export interface ClientStats {
  total: number;
  withAppointments: number;
  newThisMonth: number;
}
