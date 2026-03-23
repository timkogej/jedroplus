// TypeScript types for employees/staff

// Working hours for a single day
export interface EmployeeWorkingHours {
  enabled: boolean;
  start: string; // HH:mm format
  end: string;
}

// Full schedule for an employee
export type EmployeeSchedule = Record<string, EmployeeWorkingHours>;

// Schedule with intervals support (new format)
export interface TimeInterval {
  start: string;
  end: string;
}

export interface DayScheduleWithIntervals {
  enabled: boolean;
  intervals: TimeInterval[];
}

export type ScheduleWithIntervals = Record<string, DayScheduleWithIntervals>;

export interface Employee {
  id: string;
  ime: string;
  priimek: string;
  email: string;
  telefon?: string | null;
  pozicija?: string | null;
  barva: string; // Full gradient CSS string e.g. "linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)"
  aktivna: boolean;
  opombe?: string | null;
  podjetje_id: string;
  created_at: string;
  updated_at: string;
  // Schedule (urnik) - JSON object with day names as keys (supports intervals)
  urnik?: EmployeeSchedule | ScheduleWithIntervals | null;
  // Services this employee can perform - array of service IDs
  storitve?: string[] | null;
  // Whether employee uses company schedule (true) or custom schedule (false)
  ali_ima_urnik_podjetja?: boolean;
  // Auth user linked to this person (null = not yet connected to any user account)
  auth_user_id?: string | null;
  // Computed fields from joins
  appointments_today?: number;
  appointments_week?: number;
  appointments_month?: number;
  total_appointments?: number;
}

export interface EmployeeFormData {
  ime: string;
  priimek: string;
  email: string;
  telefon: string;
  pozicija: string;
  barva: string; // Full gradient CSS string
  opombe: string;
  urnik?: EmployeeSchedule; // Schedule (optional - inherits from company if not set)
  storitve?: string[]; // Service IDs this employee can perform
}

// Filter and sort types
export type EmployeeSortField = 'ime' | 'priimek' | 'email' | 'created_at' | 'appointments_today';
export type SortDirection = 'asc' | 'desc';

export interface EmployeeFilters {
  search: string;
  sortField: EmployeeSortField;
  sortDirection: SortDirection;
  showInactive: boolean;
}

// Stats for employees overview
export interface EmployeeStats {
  total: number;
  active: number;
  inactive: number;
  appointmentsToday: number;
  weeklyGrowth?: number;
}
