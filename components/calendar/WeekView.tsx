'use client';

import { memo, useMemo } from 'react';
import type { AppointmentWithDetails, Storitev } from '@/types/appointments';
import type { Absence } from '@/lib/supabase/appointments';
import TimeGrid from './TimeGrid';
import AppointmentCard from './AppointmentCard';
import {
  getWeekDays,
  isSameDay,
  isToday,
  DAYS_SHORT,
  HOUR_HEIGHT,
  getTimePosition,
  getDurationHeight,
  parseTimeToMinutes,
  getLocalDateKey,
  START_HOUR,
  END_HOUR,
} from '@/lib/utils/calendar';

interface WeekViewProps {
  currentDate: Date;
  appointments: AppointmentWithDetails[];
  absences?: Absence[];
  services?: Storitev[];
  onAppointmentClick: (appointment: AppointmentWithDetails) => void;
  onDateClick?: (date: Date) => void;
  showAllDays?: boolean;
}

// Calculate overlapping appointments and assign columns
function calculateAppointmentLayout(appointments: AppointmentWithDetails[]): Map<string, { column: number; totalColumns: number }> {
  const layout = new Map<string, { column: number; totalColumns: number }>();

  if (appointments.length === 0) return layout;

  // Sort by start time
  const sorted = [...appointments].sort((a, b) =>
    parseTimeToMinutes(a.cas_zacetek) - parseTimeToMinutes(b.cas_zacetek)
  );

  // Group overlapping appointments
  const groups: AppointmentWithDetails[][] = [];
  let currentGroup: AppointmentWithDetails[] = [];
  let groupEnd = 0;

  for (const apt of sorted) {
    const aptStart = parseTimeToMinutes(apt.cas_zacetek);
    const aptEnd = parseTimeToMinutes(apt.cas_konec || apt.cas_zacetek) || aptStart + 30;

    if (aptStart >= groupEnd && currentGroup.length > 0) {
      groups.push(currentGroup);
      currentGroup = [];
      groupEnd = 0;
    }

    currentGroup.push(apt);
    groupEnd = Math.max(groupEnd, aptEnd);
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  // Assign columns within each group
  for (const group of groups) {
    const columns: AppointmentWithDetails[][] = [];

    for (const apt of group) {
      const aptStart = parseTimeToMinutes(apt.cas_zacetek);

      // Find first available column
      let columnIndex = 0;
      while (columnIndex < columns.length) {
        const column = columns[columnIndex];
        const lastInColumn = column[column.length - 1];
        const lastEnd = parseTimeToMinutes(lastInColumn.cas_konec || lastInColumn.cas_zacetek) || parseTimeToMinutes(lastInColumn.cas_zacetek) + 30;

        if (aptStart >= lastEnd) {
          break;
        }
        columnIndex++;
      }

      if (columnIndex >= columns.length) {
        columns.push([]);
      }
      columns[columnIndex].push(apt);
    }

    // Assign layout info
    const totalColumns = columns.length;
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      for (const apt of columns[colIndex]) {
        layout.set(apt.id, { column: colIndex, totalColumns });
      }
    }
  }

  return layout;
}

function WeekView({ currentDate, appointments, absences = [], services = [], onAppointmentClick, onDateClick, showAllDays = true }: WeekViewProps) {
  // Get all week days, then filter if showAllDays is false
  const allWeekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const weekDays = useMemo(() => {
    if (showAllDays) return allWeekDays;
    // Filter to only show weekdays (Mon-Fri), exclude Saturday (6) and Sunday (0)
    return allWeekDays.filter(day => {
      const dayOfWeek = day.getDay();
      return dayOfWeek !== 0 && dayOfWeek !== 6;
    });
  }, [allWeekDays, showAllDays]);

  const columnCount = weekDays.length;

  // Log absences for debugging
  console.log('[WeekView] Received absences:', absences.length, absences);

  // Get absences for a specific day
  const getAbsencesForDay = useMemo(() => {
    return (day: Date) => {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const filtered = absences.filter((absence) => {
        const absenceStart = new Date(absence.start_at);
        const absenceEnd = new Date(absence.end_at);
        // Check if absence overlaps with this day
        const overlaps = absenceStart <= dayEnd && absenceEnd >= dayStart;
        console.log('[WeekView] Checking absence:', absence.id, 'start:', absence.start_at, '→', absenceStart, 'end:', absence.end_at, '→', absenceEnd, 'day:', day.toISOString(), 'overlaps:', overlaps);
        return overlaps;
      });
      return filtered;
    };
  }, [absences]);

  // Group appointments by day using local date keys to avoid timezone issues
  const appointmentsByDay = useMemo(() => {
    const grouped = new Map<string, AppointmentWithDetails[]>();

    for (const day of weekDays) {
      const dateKey = getLocalDateKey(day);
      grouped.set(dateKey, []);
    }

    for (const apt of appointments) {
      const aptDate = new Date(apt.datum);
      const dateKey = getLocalDateKey(aptDate);
      const existing = grouped.get(dateKey);
      if (existing) {
        existing.push(apt);
      }
    }

    return grouped;
  }, [weekDays, appointments]);

  return (
    <div className="flex h-full flex-col">
      {/* Day headers - Apple Calendar style */}
      <div className="flex bg-white">
        {/* Time column spacer */}
        <div className="w-[52px] flex-shrink-0" />

        {/* Day headers */}
        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
          {weekDays.map((day, index) => {
            const isCurrentDay = isToday(day);
            const dayAbsences = getAbsencesForDay(day);
            const hasAbsence = dayAbsences.length > 0;
            return (
              <div
                key={index}
                className={`flex flex-col items-center py-2.5
                           ${hasAbsence ? 'bg-amber-50/50' : ''}`}
              >
                {/* Day abbreviation - same style for all days */}
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {DAYS_SHORT[day.getDay()]}
                </span>
                {/* Date number - gradient border ring for today */}
                <button
                  type="button"
                  onClick={() => onDateClick?.(day)}
                  className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold
                             transition-all duration-200 text-[#1A1F36] hover:bg-gray-100
                             ${isCurrentDay ? 'font-bold' : ''}`}
                  style={isCurrentDay ? {
                    border: '2px solid transparent',
                    backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                    backgroundOrigin: 'border-box',
                    backgroundClip: 'padding-box, border-box',
                  } : undefined}
                >
                  {day.getDate()}
                </button>
                {/* Show absences with employee name and reason */}
                {hasAbsence && (
                  <div className="mt-1 flex flex-col gap-0.5 w-full px-1">
                    {dayAbsences.slice(0, 2).map((absence) => (
                      <span
                        key={absence.id}
                        className="text-[9px] font-medium text-amber-700 truncate text-center"
                        title={`${absence.employee_name || 'Vsi'}${absence.reason ? ` - ${absence.reason}` : ''}`}
                      >
                        {absence.employee_name || 'Vsi'}{absence.reason ? `: ${absence.reason}` : ''}
                      </span>
                    ))}
                    {dayAbsences.length > 2 && (
                      <span className="text-[9px] text-amber-600 text-center">
                        +{dayAbsences.length - 2} več
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Separator line - Apple Calendar style: subtle gradient line */}
      <div
        className="flex-shrink-0"
        style={{
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.06) 10%, rgba(0,0,0,0.06) 90%, transparent 100%)',
        }}
      />

      {/* Time grid with appointments */}
      <TimeGrid columnCount={columnCount} showCurrentTime>
        <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
          {weekDays.map((day, dayIndex) => {
            const dateKey = getLocalDateKey(day);
            const dayAppointments = appointmentsByDay.get(dateKey) || [];
            const layout = calculateAppointmentLayout(dayAppointments);
            const isCurrentDay = isToday(day);

            const dayAbsencesForGrid = getAbsencesForDay(day);

            return (
              <div
                key={dayIndex}
                className={`relative
                           ${isCurrentDay ? 'bg-[#1A1F36]/[0.015]' : ''}
                           ${dayIndex < weekDays.length - 1 ? 'border-r' : ''}`}
                style={dayIndex < weekDays.length - 1 ? { borderColor: 'rgba(0,0,0,0.04)' } : undefined}
              >
                {/* Render absences as background blocks */}
                {dayAbsencesForGrid.map((absence) => {
                  const absenceStart = new Date(absence.start_at);
                  const absenceEnd = new Date(absence.end_at);
                  const dayStart = new Date(day);
                  dayStart.setHours(0, 0, 0, 0);
                  const dayEnd = new Date(day);
                  dayEnd.setHours(23, 59, 59, 999);

                  // Calculate visible time range for this day
                  const visibleStart = absenceStart < dayStart ? dayStart : absenceStart;
                  const visibleEnd = absenceEnd > dayEnd ? dayEnd : absenceEnd;

                  // Get hours and minutes
                  const startHour = visibleStart.getHours();
                  const startMin = visibleStart.getMinutes();
                  const endHour = visibleEnd.getHours();
                  const endMin = visibleEnd.getMinutes();

                  // Calculate position (relative to START_HOUR)
                  const startMinutes = startHour * 60 + startMin;
                  const endMinutes = endHour * 60 + endMin;

                  // Skip if completely outside visible range
                  if (endMinutes <= START_HOUR * 60 || startMinutes >= END_HOUR * 60) {
                    return null;
                  }

                  // Clamp to visible range
                  const clampedStart = Math.max(startMinutes, START_HOUR * 60);
                  const clampedEnd = Math.min(endMinutes, END_HOUR * 60);

                  const top = ((clampedStart - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                  const height = ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT;

                  return (
                    <div
                      key={absence.id}
                      className="absolute left-0 right-0 bg-amber-100/60 border-l-4 border-amber-400 mx-1 rounded-r-lg overflow-hidden"
                      style={{
                        top: `${top}px`,
                        height: `${Math.max(height, 30)}px`,
                      }}
                      title={`${absence.employee_name || 'Vsi zaposleni'}: ${absence.reason || 'Odsotnost'}`}
                    >
                      <div className="p-1.5 h-full flex flex-col justify-center">
                        <p className="text-[10px] font-semibold text-amber-800 truncate">
                          {absence.employee_name || 'Vsi'}
                        </p>
                        {absence.reason && (
                          <p className="text-[9px] text-amber-700 truncate">
                            {absence.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Render appointments */}
                {dayAppointments.map((apt) => {
                  const startMinutes = parseTimeToMinutes(apt.cas_zacetek);

                  // Skip if outside visible range
                  if (startMinutes < START_HOUR * 60 || startMinutes >= END_HOUR * 60) {
                    return null;
                  }

                  const top = getTimePosition(apt.cas_zacetek);
                  const height = getDurationHeight(apt.cas_zacetek, apt.cas_konec || apt.cas_zacetek);
                  const layoutInfo = layout.get(apt.id) || { column: 0, totalColumns: 1 };
                  const width = `calc(${100 / layoutInfo.totalColumns}% - 4px)`;
                  const left = `calc(${(100 / layoutInfo.totalColumns) * layoutInfo.column}% + 2px)`;

                  return (
                    <AppointmentCard
                      key={apt.id}
                      appointment={apt}
                      onClick={onAppointmentClick}
                      variant="grid"
                      services={services}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        left,
                        width,
                        right: 'auto',
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </TimeGrid>
    </div>
  );
}

export default memo(WeekView);
