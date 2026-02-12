import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  endOfDay,
  endOfWeek,
  endOfMonth,
  endOfYear,
  subDays,
  eachDayOfInterval,
  format,
} from 'date-fns';
import { sl } from 'date-fns/locale';

export type TimePeriod = 'danes' | 'ta_teden' | 'ta_mesec' | 'zadnjih_30' | 'ta_leto' | 'custom';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface CustomRange {
  start: Date | null;
  end: Date | null;
}

/**
 * Get date range for a given time period
 */
export function getDateRangeForPeriod(
  period: TimePeriod,
  customRange?: CustomRange
): DateRange {
  const now = new Date();

  switch (period) {
    case 'danes':
      return {
        startDate: startOfDay(now),
        endDate: endOfDay(now),
      };
    case 'ta_teden':
      return {
        startDate: startOfWeek(now, { weekStartsOn: 1 }), // Monday
        endDate: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case 'ta_mesec':
      return {
        startDate: startOfMonth(now),
        endDate: endOfMonth(now),
      };
    case 'zadnjih_30':
      return {
        startDate: startOfDay(subDays(now, 29)),
        endDate: endOfDay(now),
      };
    case 'ta_leto':
      return {
        startDate: startOfYear(now),
        endDate: endOfYear(now),
      };
    case 'custom':
      if (customRange?.start && customRange?.end) {
        return {
          startDate: startOfDay(customRange.start),
          endDate: endOfDay(customRange.end),
        };
      }
      // Default to last 30 days if custom range is not set
      return {
        startDate: startOfDay(subDays(now, 29)),
        endDate: endOfDay(now),
      };
    default:
      return {
        startDate: startOfMonth(now),
        endDate: endOfMonth(now),
      };
  }
}

/**
 * Get previous period date range for comparison
 */
export function getPreviousPeriodRange(
  period: TimePeriod,
  currentRange: DateRange
): DateRange {
  const daysDiff = Math.ceil(
    (currentRange.endDate.getTime() - currentRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    startDate: subDays(currentRange.startDate, daysDiff + 1),
    endDate: subDays(currentRange.startDate, 1),
  };
}

/**
 * Get array of days between two dates
 */
export function getDaysArray(startDate: Date, endDate: Date): Date[] {
  return eachDayOfInterval({ start: startDate, end: endDate });
}

/**
 * Format date for display
 */
export function formatDate(date: Date, formatStr: string = 'd.M'): string {
  return format(date, formatStr, { locale: sl });
}

/**
 * Format date for API
 */
export function formatDateForApi(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Get period label for display
 */
export function getPeriodLabel(period: TimePeriod): string {
  const labels: Record<TimePeriod, string> = {
    danes: 'Danes',
    ta_teden: 'Ta Teden',
    ta_mesec: 'Ta Mesec',
    zadnjih_30: 'Zadnjih 30 Dni',
    ta_leto: 'Letos',
    custom: 'Obdobje po Meri',
  };
  return labels[period] || period;
}

/**
 * Get day of week index (Monday = 0, Sunday = 6)
 */
export function getDayOfWeekIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/**
 * Days of week labels in Slovenian
 */
export const DAYS_OF_WEEK = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned'];

/**
 * Working hours (8:00 - 20:00)
 */
// Working hours from 7:00 to 21:00 (15 hours)
export const WORKING_HOURS = Array.from({ length: 15 }, (_, i) => i + 7);
