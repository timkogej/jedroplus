// TypeScript types for calendar appointments
import type { CommunicationLanguageCode } from '@/lib/communicationLanguage';

export interface Termin {
  id: string;
  datum: string; // ISO date string (timestamp)
  cas_zacetek: string; // Time in HH:MM format
  cas_konec: string; // Time in HH:MM format
  stranka_ime: string; // Client name/description
  storitev_id: string; // Foreign key to Storitve
  zaposleni_id: string; // Foreign key to Zaposleni
  status: TerminStatus;
}

export type TerminStatus =
  | 'scheduled'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  // Slovenian variants (from database)
  | 'Odpovedan'
  | 'Ni prišel'
  | 'Zaključen'
  | 'zaključen';

export interface Storitev {
  id: string;
  naziv: string; // Service name
  barva: string; // HEX color code or gradient CSS string
  trajanje: number; // Duration in minutes
  skupni_cas?: number; // Total time including buffers (optional for backward compat)
  cena?: number | null; // Price (optional for backward compat)
  status?: string | null; // e.g. 'active' | 'inactive'
}

export interface Zaposleni {
  id: string;
  ime: string; // First name
  priimek: string; // Last name
  email: string;
  barva?: string; // Full gradient CSS string e.g. "linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)"
  storitve?: string[] | null; // Array of service IDs this employee can perform (null = all services)
}

// Combined appointment with related data for display
export interface AppointmentWithDetails {
  id: string;
  datum: string;
  cas_zacetek: string;
  cas_konec: string;
  stranka_id?: string;
  stranka_ime: string;
  stranka_priimek?: string; // Last name from Stranke table (for smart name truncation)
  stranka_email?: string;
  stranka_telefon?: string;
  stranka_barva?: string; // Client color - gradient CSS string
  language?: CommunicationLanguageCode;
  storitev_id?: string;
  storitev_id_2?: string; // Second service ID (from "ID storitev 2" column)
  storitev_id_3?: string; // Third service ID (from "ID storitev 3" column)
  add_on_storitev_id?: string | null;
  add_on_naziv?: string | null;
  add_on_trajanje?: number | null;
  zaposleni_id?: string;
  status: TerminStatus;
  opombe?: string;
  interne_opombe?: string;
  // Pricing fields
  cena?: number | null; // Base price
  popust?: number | null; // Discount amount
  popust_tip?: 'eur' | 'percent' | null; // Discount type
  koncna_cena?: number | null; // Final price after discount
  // Promotion fields
  promocija_tip?: 'popust' | 'happy_hour' | 'add_on' | null;
  promocija_naziv?: string | null;
  popust_id?: string | null;
  happy_hour_id?: string | null;
  add_on_popust?: string | null;
  add_on_popust_tip?: string | null;
  add_on_final_cena?: string | null;
  valuta?: string | null;
  // Ghost termin fields
  belezi_termin?: boolean; // false = ghost termin (excluded from analytics/history)
  deleted_at?: string | null; // set when ghost termin is soft-deleted after completion
  id_termina?: string; // text "ID termina" column value (e.g. "T-12345678"), distinct from bigint `id`
  // Service details
  storitev: {
    id: string;
    naziv: string;
    barva: string;
    trajanje: number;
    cena?: number | null;
  } | null;
  storitev_2?: {
    id: string;
    naziv: string;
    barva: string;
    trajanje: number;
  } | null;
  storitev_3?: {
    id: string;
    naziv: string;
    barva: string;
    trajanje: number;
  } | null;
  add_on_storitev?: {
    id: string;
    naziv: string;
    barva: string;
    trajanje: number;
  } | null;
  // Employee details
  zaposleni: {
    id: string;
    ime: string;
    priimek: string;
    email: string;
    initials: string; // Computed: e.g., "JN" for Jana Novak
    barva?: string; // Full gradient CSS string e.g. "linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)"
  } | null;
}

// Calendar view state
export interface CalendarState {
  currentMonth: Date;
  selectedDate: Date | null;
  selectedAppointment: AppointmentWithDetails | null;
  filterEmployeeId: string | null;
  searchQuery: string;
}

// Day cell data for calendar grid
export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  appointments: AppointmentWithDetails[];
}

// Filter options
export interface CalendarFilters {
  employeeId: string | null;
  searchQuery: string;
  status: TerminStatus | null;
}
