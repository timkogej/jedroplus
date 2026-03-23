export interface CalendarEvent {
  id: string;
  company_id: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  /** Primary date: YYYY-MM-DD */
  event_date: string;
  /** Optional end date for multi-day events: YYYY-MM-DD */
  end_date?: string | null;
  /** Optional start time: HH:mm */
  start_time?: string | null;
  /** Optional end time: HH:mm */
  end_time?: string | null;
  all_day: boolean;
  /** CSS color or gradient string */
  color: string;
  location?: string | null;
  status: string;
  is_visible: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  enable_booking?: boolean | string | null;
}
