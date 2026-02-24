'use client';

import { memo, useMemo } from 'react';
import type { AppointmentWithDetails, Storitev } from '@/types/appointments';
import type { Absence } from '@/lib/supabase/appointments';
import TimeGrid from './TimeGrid';
import AppointmentCard from './AppointmentCard';
import {
  isToday,
  DAYS_SHORT,
  HOUR_HEIGHT,
  getTimePosition,
  getDurationHeight,
  parseTimeToMinutes,
  getLocalDateKey,
  START_HOUR,
  END_HOUR,
  addDays,
} from '@/lib/utils/calendar';

interface TwoDayViewProps {
  currentDate: Date;
  appointments: AppointmentWithDetails[];
  absences?: Absence[];
  services?: Storitev[];
  onAppointmentClick: (appointment: AppointmentWithDetails) => void;
  onDateClick?: (date: Date) => void;
}

function calculateAppointmentLayout(appointments: AppointmentWithDetails[]): Map<string, { column: number; totalColumns: number }> {
  const layout = new Map<string, { column: number; totalColumns: number }>();
  if (appointments.length === 0) return layout;

  const sorted = [...appointments].sort((a, b) =>
    parseTimeToMinutes(a.cas_zacetek) - parseTimeToMinutes(b.cas_zacetek)
  );

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

  for (const group of groups) {
    const columns: AppointmentWithDetails[][] = [];

    for (const apt of group) {
      const aptStart = parseTimeToMinutes(apt.cas_zacetek);

      let columnIndex = 0;
      while (columnIndex < columns.length) {
        const column = columns[columnIndex];
        const lastInColumn = column[column.length - 1];
        const lastEnd = parseTimeToMinutes(lastInColumn.cas_konec || lastInColumn.cas_zacetek) || parseTimeToMinutes(lastInColumn.cas_zacetek) + 30;

        if (aptStart >= lastEnd) break;
        columnIndex++;
      }

      if (columnIndex >= columns.length) {
        columns.push([]);
      }
      columns[columnIndex].push(apt);
    }

    const totalColumns = columns.length;
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      for (const apt of columns[colIndex]) {
        layout.set(apt.id, { column: colIndex, totalColumns });
      }
    }
  }

  return layout;
}

function TwoDayView({ currentDate, appointments, absences = [], services = [], onAppointmentClick, onDateClick }: TwoDayViewProps) {
  const days = useMemo(() => [currentDate, addDays(currentDate, 1)], [currentDate]);

  const getAbsencesForDay = useMemo(() => {
    return (day: Date) => {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      return absences.filter((absence) => {
        const absenceStart = new Date(absence.start_at);
        const absenceEnd = new Date(absence.end_at);
        return absenceStart <= dayEnd && absenceEnd >= dayStart;
      });
    };
  }, [absences]);

  const appointmentsByDay = useMemo(() => {
    const grouped = new Map<string, AppointmentWithDetails[]>();

    for (const day of days) {
      grouped.set(getLocalDateKey(day), []);
    }

    for (const apt of appointments) {
      const rawDatum = apt.datum;
      const aptDate = rawDatum.length === 10
        ? new Date(rawDatum + 'T12:00:00')
        : new Date(rawDatum);
      const dateKey = getLocalDateKey(aptDate);
      const existing = grouped.get(dateKey);
      if (existing) {
        existing.push(apt);
      }
    }

    return grouped;
  }, [days, appointments]);

  return (
    <div className="flex h-full flex-col">
      {/* Day headers */}
      <div className="flex bg-white flex-shrink-0">
        <div className="w-[52px] flex-shrink-0" />
        <div className="flex-1 grid grid-cols-2">
          {days.map((day, idx) => {
            const isCurrentDay = isToday(day);
            const dayAbsences = getAbsencesForDay(day);
            const hasAbsence = dayAbsences.length > 0;
            const isPrimary = idx === 0;

            return (
              <button
                key={getLocalDateKey(day)}
                type="button"
                onClick={() => onDateClick?.(day)}
                className={`flex flex-col items-center py-2 gap-[3px] transition-colors hover:bg-gray-50
                  ${idx === 0 ? 'border-r border-gray-100' : ''}`}
              >
                <span
                  className="text-[9px] font-semibold uppercase tracking-wider"
                  style={isPrimary ? {
                    background: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  } : { color: '#9CA3AF' }}
                >
                  {DAYS_SHORT[day.getDay()]}
                </span>
                <div
                  className="w-[30px] h-[30px] rounded-full flex items-center justify-center"
                  style={isPrimary ? {
                    background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                  } : {
                    background: '#E5E7EB',
                  }}
                >
                  <span className={`text-[14px] font-semibold leading-none
                    ${isPrimary ? 'text-white' : 'text-gray-500'}
                    ${isCurrentDay && !isPrimary ? 'underline decoration-1 underline-offset-2' : ''}`}>
                    {day.getDate()}
                  </span>
                </div>
                {hasAbsence && (
                  <span className="w-1 h-1 rounded-full bg-amber-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Separator */}
      <div
        className="flex-shrink-0"
        style={{
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.06) 10%, rgba(0,0,0,0.06) 90%, transparent 100%)',
        }}
      />

      {/* Time grid */}
      <TimeGrid columnCount={2} showCurrentTime>
        <div className="grid h-full grid-cols-2">
          {days.map((day, dayIndex) => {
            const dateKey = getLocalDateKey(day);
            const dayAppointments = appointmentsByDay.get(dateKey) || [];
            const layout = calculateAppointmentLayout(dayAppointments);
            const isCurrentDay = isToday(day);
            const dayAbsencesForGrid = getAbsencesForDay(day);

            return (
              <div
                key={dateKey}
                className={`relative
                           ${isCurrentDay ? 'bg-[#1A1F36]/[0.015]' : ''}
                           ${dayIndex < days.length - 1 ? 'border-r' : ''}`}
                style={dayIndex < days.length - 1 ? { borderColor: 'rgba(0,0,0,0.04)' } : undefined}
              >
                {/* Absences */}
                {dayAbsencesForGrid.map((absence) => {
                  const absenceStart = new Date(absence.start_at);
                  const absenceEnd = new Date(absence.end_at);
                  const dayStart = new Date(day);
                  dayStart.setHours(0, 0, 0, 0);
                  const dayEnd = new Date(day);
                  dayEnd.setHours(23, 59, 59, 999);

                  const visibleStart = absenceStart < dayStart ? dayStart : absenceStart;
                  const visibleEnd = absenceEnd > dayEnd ? dayEnd : absenceEnd;

                  const startMinutes = visibleStart.getHours() * 60 + visibleStart.getMinutes();
                  const endMinutes = visibleEnd.getHours() * 60 + visibleEnd.getMinutes();

                  if (endMinutes <= START_HOUR * 60 || startMinutes >= END_HOUR * 60) return null;

                  const clampedStart = Math.max(startMinutes, START_HOUR * 60);
                  const clampedEnd = Math.min(endMinutes, END_HOUR * 60);
                  const top = ((clampedStart - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                  const height = ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT;

                  return (
                    <div
                      key={absence.id}
                      className="absolute left-0 right-0 bg-amber-100/60 border-l-4 border-amber-400 mx-1 rounded-r-lg overflow-hidden"
                      style={{ top: `${top}px`, height: `${Math.max(height, 30)}px` }}
                      title={`${absence.employee_name || 'Vsi zaposleni'}: ${absence.reason || 'Odsotnost'}`}
                    >
                      <div className="p-1.5 h-full flex flex-col justify-center">
                        <p className="text-[10px] font-semibold text-amber-800 truncate">
                          {absence.employee_name || 'Vsi'}
                        </p>
                        {absence.reason && (
                          <p className="text-[9px] text-amber-700 truncate">{absence.reason}</p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Appointments */}
                {dayAppointments.map((apt) => {
                  const startMinutes = parseTimeToMinutes(apt.cas_zacetek);
                  if (startMinutes < START_HOUR * 60 || startMinutes >= END_HOUR * 60) return null;

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
                      style={{ top: `${top}px`, height: `${height}px`, left, width, right: 'auto' }}
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

export default memo(TwoDayView);
