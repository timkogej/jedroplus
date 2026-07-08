// TypeScript types for services

export type PriceType = 'fiksna' | 'po_dogovoru';

export interface Service {
  id: string;
  naziv: string;
  kategorija: string | null; // service category (text input, not dropdown)
  barva: string; // HEX color code
  trajanje: number; // duration in minutes
  buffer_pred: number; // buffer before in minutes (default 0)
  buffer_po: number; // buffer after in minutes (default 0)
  skupni_cas: number; // total time: trajanje + buffer_pred + buffer_po
  tip_cene: PriceType; // 'fiksna' or 'po_dogovoru'
  cena: number | null;
  currency: string | null;
  opis: string | null;
  aktivna: boolean;
  spletne_rezervacije: boolean; // whether this service can be booked online
  zahteva_placilo: boolean; // whether online booking requires payment for this service
  podjetje_id: string;
  created_at: string;
  updated_at: string;
  // Computed fields from joins
  appointment_count?: number;
  last_used?: string;
}

export interface ServiceFormData {
  naziv: string;
  kategorija: string; // text input (not dropdown)
  barva: string;
  trajanje: number;
  buffer_pred: number; // buffer before in minutes (default 0)
  buffer_po: number; // buffer after in minutes (default 0)
  tip_cene: PriceType; // 'fiksna' or 'po_dogovoru'
  cena: string; // string for form input, converted to number when saving
  currency: string;
  opis: string;
  spletne_rezervacije: boolean; // whether this service can be booked online
  zahteva_placilo: boolean; // whether online booking requires payment for this service
}

// Buffer options (displayed as "Rezervni čas" in UI, but stored as buffer internally)
export const BUFFER_OPTIONS = [
  { value: 0, label: 'Brez rezerve' },
  { value: 5, label: '5 minut' },
  { value: 10, label: '10 minut' },
  { value: 15, label: '15 minut' },
  { value: 30, label: '30 minut' },
] as const;

// Price type options
export const PRICE_TYPE_OPTIONS = [
  { value: 'fiksna', label: 'Fiksna cena' },
  { value: 'po_dogovoru', label: 'Cena po dogovoru' },
] as const;

export const CURRENCY_OPTIONS = [
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
  { value: 'GBP', label: 'GBP' },
  { value: 'CHF', label: 'CHF' },
  { value: 'HRK', label: 'HRK' },
  { value: 'BAM', label: 'BAM' },
  { value: 'RSD', label: 'RSD' },
  { value: 'MKD', label: 'MKD' },
  { value: 'HUF', label: 'HUF' },
  { value: 'CZK', label: 'CZK' },
  { value: 'PLN', label: 'PLN' },
] as const;

// Filter and sort types
export type ServiceSortField = 'naziv' | 'trajanje' | 'cena' | 'created_at' | 'appointment_count';
export type SortDirection = 'asc' | 'desc';

export interface ServiceFilters {
  search: string;
  kategorija: string;
  sortField: ServiceSortField;
  sortDirection: SortDirection;
  showInactive: boolean;
}

// Stats for services overview
export interface ServiceStats {
  total: number;
  active: number;
  averageDuration: number;
  highestPrice: number;
}

// Preset colors for color picker
export const PRESET_COLORS = [
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#3B82F6', // Blue
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#6366F1', // Indigo
] as const;

// Duration options
export const DURATION_OPTIONS = [
  { value: 15, label: '15 minut' },
  { value: 30, label: '30 minut' },
  { value: 45, label: '45 minut' },
  { value: 60, label: '60 minut (1 ura)' },
  { value: 90, label: '90 minut (1.5 ure)' },
  { value: 120, label: '120 minut (2 uri)' },
] as const;

// Category options for services
export const SERVICE_CATEGORIES = [
  { value: 'striženje', label: 'Striženje' },
  { value: 'barvanje', label: 'Barvanje' },
  { value: 'styling', label: 'Styling' },
  { value: 'nega', label: 'Nega' },
  { value: 'masaža', label: 'Masaža' },
  { value: 'tretma', label: 'Tretma' },
  { value: 'manikura', label: 'Manikura' },
  { value: 'pedikura', label: 'Pedikura' },
  { value: 'drugo', label: 'Drugo' },
] as const;
