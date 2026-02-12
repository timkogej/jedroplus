// Calendar utility functions for date/time operations

export type ViewMode = 'day' | 'week' | 'month';

// Get date key in local timezone (YYYY-MM-DD format)
// This avoids timezone issues with toISOString() which converts to UTC
export function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Time constants
export const START_HOUR = 5; // 5:00 AM - Start from 5:00, first labeled hour is 6:00
export const END_HOUR = 23; // 11:00 PM
export const HOUR_HEIGHT = 60; // pixels per hour in week/day view
export const SLOT_DURATION = 60; // minutes per slot

// Day names in Slovenian
export const DAYS_FULL = ['Nedelja', 'Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota'];
export const DAYS_SHORT = ['Ned', 'Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob'];
export const DAYS_ABBR = ['Ne', 'Po', 'To', 'Sr', 'Če', 'Pe', 'So'];

// Month names in Slovenian
export const MONTHS_FULL = [
  'Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij',
  'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'
];
export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
  'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'
];

// Get start of day (midnight)
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

// Get end of day (23:59:59.999)
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

// Get start of week (Monday)
export function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday is first day
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

// Get end of week (Sunday)
export function endOfWeek(date: Date): Date {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
}

// Get start of month
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

// Get end of month
export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

// Add days to date
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Add weeks to date
export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

// Add months to date
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

// Check if two dates are the same day
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// Check if date is today
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

// Check if date is in current week
export function isCurrentWeek(date: Date): boolean {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  return date >= weekStart && date <= weekEnd;
}

// Get days of week starting from a date
export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// Get all days in a month grid (including prev/next month days)
export function getMonthGrid(date: Date): Date[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const gridStart = startOfWeek(monthStart);

  const days: Date[] = [];
  let current = gridStart;

  // Generate 6 weeks (42 days) to ensure full grid
  for (let i = 0; i < 42; i++) {
    days.push(new Date(current));
    current = addDays(current, 1);
  }

  return days;
}

// Format time string (HH:MM)
export function formatTime(time: string): string {
  if (!time) return '';
  // Handle HH:MM:SS format
  const parts = time.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return time;
}

// Parse time string to minutes from midnight
export function parseTimeToMinutes(time: string): number {
  if (!time) return 0;
  const parts = time.split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

// Convert minutes from midnight to time string
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Get position in time grid (pixels from top)
export function getTimePosition(time: string): number {
  const minutes = parseTimeToMinutes(time);
  const startMinutes = START_HOUR * 60;
  const offsetMinutes = minutes - startMinutes;
  return (offsetMinutes / 60) * HOUR_HEIGHT;
}

// Get height based on duration
export function getDurationHeight(startTime: string, endTime: string): number {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  const durationMinutes = endMinutes - startMinutes;
  return Math.max((durationMinutes / 60) * HOUR_HEIGHT, 30); // Minimum 30px height
}

// Generate time slots for grid (supports half-hour start like 5:30)
export function generateTimeSlots(): string[] {
  const slots: string[] = [];
  // Start from START_HOUR (e.g., 5.5 = 5:30)
  const startMinutes = Math.floor(START_HOUR * 60);

  // Generate slots from start hour to end hour
  for (let minutes = startMinutes; minutes <= END_HOUR * 60; minutes += 60) {
    const hour = Math.floor(minutes / 60);
    const min = minutes % 60;
    slots.push(`${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
  }
  return slots;
}

// Generate half-hour time slots for more detailed grid
export function generateHalfHourTimeSlots(): string[] {
  const slots: string[] = [];
  const startMinutes = Math.floor(START_HOUR * 60);

  for (let minutes = startMinutes; minutes <= END_HOUR * 60; minutes += 30) {
    const hour = Math.floor(minutes / 60);
    const min = minutes % 60;
    slots.push(`${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
  }
  return slots;
}

// Format date for display
export function formatDate(date: Date, format: 'full' | 'short' | 'dayMonth' = 'full'): string {
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  const dayOfWeek = date.getDay();

  switch (format) {
    case 'full':
      return `${DAYS_FULL[dayOfWeek]}, ${day}. ${MONTHS_FULL[month]} ${year}`;
    case 'short':
      return `${day}. ${MONTHS_SHORT[month]}`;
    case 'dayMonth':
      return `${day}. ${MONTHS_FULL[month]}`;
    default:
      return date.toLocaleDateString('sl-SI');
  }
}

// Format week range for display
export function formatWeekRange(date: Date, isMobile = false): string {
  const start = startOfWeek(date);
  const end = endOfWeek(date);

  if (isMobile) {
    // Mobile: use month as number (e.g., "2. 2. - 8. 2. 2026")
    const startMonth = start.getMonth() + 1;
    const endMonth = end.getMonth() + 1;
    if (start.getFullYear() === end.getFullYear()) {
      return `${start.getDate()}. ${startMonth}. - ${end.getDate()}. ${endMonth}. ${start.getFullYear()}`;
    } else {
      return `${start.getDate()}. ${startMonth}. ${start.getFullYear()} - ${end.getDate()}. ${endMonth}. ${end.getFullYear()}`;
    }
  }

  // Desktop: use full month names
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}. - ${end.getDate()}. ${MONTHS_FULL[start.getMonth()]} ${start.getFullYear()}`;
  } else if (start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()}. ${MONTHS_SHORT[start.getMonth()]} - ${end.getDate()}. ${MONTHS_SHORT[end.getMonth()]} ${start.getFullYear()}`;
  } else {
    return `${start.getDate()}. ${MONTHS_SHORT[start.getMonth()]} ${start.getFullYear()} - ${end.getDate()}. ${MONTHS_SHORT[end.getMonth()]} ${end.getFullYear()}`;
  }
}

// Format date for display with mobile/desktop options
export function formatDateResponsive(date: Date, view: ViewMode, isMobile = false): string {
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  const dayOfWeek = date.getDay();

  switch (view) {
    case 'day':
      if (isMobile) {
        // Mobile: "2. 2. 2026" (month as number)
        return `${day}. ${month + 1}. ${year}`;
      }
      // Desktop: "Ponedeljek, 2. februar 2026"
      return `${DAYS_FULL[dayOfWeek]}, ${day}. ${MONTHS_FULL[month]} ${year}`;
    case 'week':
      return formatWeekRange(date, isMobile);
    case 'month':
      if (isMobile) {
        // Mobile: "2. 2026" (month as number)
        return `${month + 1}. ${year}`;
      }
      // Desktop: "Februar 2026"
      return `${MONTHS_FULL[month]} ${year}`;
    default:
      return date.toLocaleDateString('sl-SI');
  }
}

// Get current time position for "now" indicator
export function getCurrentTimePosition(): number {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = START_HOUR * 60;
  const offsetMinutes = minutes - startMinutes;
  return (offsetMinutes / 60) * HOUR_HEIGHT;
}

// Check if current time is within visible range
export function isCurrentTimeVisible(): boolean {
  const now = new Date();
  const currentHour = now.getHours();
  return currentHour >= START_HOUR && currentHour <= END_HOUR;
}

// Local storage helpers for view preference
export const VIEW_STORAGE_KEY = 'jedroplus_calendar_view';

export function saveViewPreference(view: ViewMode): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  }
}

export function loadViewPreference(): ViewMode {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === 'day' || saved === 'week' || saved === 'month') {
      return saved;
    }
  }
  return 'day'; // Default to day view
}

// Generate gradient from base color (for legacy hex colors)
export function generateGradient(baseColor: string): {
  from: string;
  to: string;
  text: string;
  border: string;
} {
  // Parse hex color for single-color gradients
  const hex = baseColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 100;
  const g = parseInt(hex.substring(2, 4), 16) || 100;
  const b = parseInt(hex.substring(4, 6), 16) || 240;

  // Create lighter version for gradient start
  const lighterR = Math.min(255, r + 40);
  const lighterG = Math.min(255, g + 40);
  const lighterB = Math.min(255, b + 40);

  // Create slightly darker version for gradient end
  const darkerR = Math.max(0, r - 20);
  const darkerG = Math.max(0, g - 20);
  const darkerB = Math.max(0, b - 20);

  // Determine text color based on luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const textColor = luminance > 0.5 ? '#1A1F36' : '#FFFFFF';

  // Border color (slightly darker than base)
  const borderR = Math.max(0, r - 30);
  const borderG = Math.max(0, g - 30);
  const borderB = Math.max(0, b - 30);

  return {
    from: `rgb(${lighterR}, ${lighterG}, ${lighterB})`,
    to: `rgb(${darkerR}, ${darkerG}, ${darkerB})`,
    text: textColor,
    border: `rgb(${borderR}, ${borderG}, ${borderB})`,
  };
}

// Helper to get CSS gradient string (for use in components)
// Supports: CSS gradient strings, hex colors (converts to gradient)
export function getGradientCSS(barva: string): string {
  // If it's already a CSS gradient string, return it directly
  if (barva.includes('gradient')) {
    return barva;
  }

  // Otherwise generate from hex color (legacy support)
  const colors = generateGradient(barva);
  return `linear-gradient(135deg, ${colors.from} 0%, ${colors.to} 100%)`;
}
