'use client';

import { memo, useMemo, useCallback } from 'react';
import type { AppointmentWithDetails, Storitev } from '@/types/appointments';
import type { Absence } from '@/lib/supabase/appointments';
import type { CalendarEvent } from '@/types/events';
import TimeGrid from './TimeGrid';
import AppointmentCard from './AppointmentCard';
import EventCard from './EventCard';
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
  type CompanySchedule,
  JS_DAY_TO_SLOVENIAN,
  getOffHourRanges,
} from '@/lib/utils/calendar';

interface TwoDayViewProps {
  currentDate: Date;
  appointments: AppointmentWithDetails[];
  absences?: Absence[];
  events?: CalendarEvent[];
  services?: Storitev[];
  onAppointmentClick: (appointment: AppointmentWithDetails) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onAbsenceClick?: (absence: Absence) => void;
  onDateClick?: (date: Date) => void;
  onGridSlotClick?: (date: Date, time: string) => void;
  companySchedule?: CompanySchedule | null;
  showAllDays?: boolean;
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

function TwoDayView({ currentDate, appointments, absences = [], events = [], services = [], onAppointmentClick, onEventClick, onAbsenceClick, onDateClick, onGridSlotClick, companySchedule, showAllDays = true }: TwoDayViewProps) {
  // When showAllDays=false, compute next 3 weekdays skipping Sat/Sun
  const days = useMemo(() => {
    if (showAllDays) return [currentDate, addDays(currentDate, 1), addDays(currentDate, 2)];
    const result: Date[] = [];
    let candidate = currentDate;
    while (result.length < 3) {
      const dow = candidate.getDay();
      if (dow !== 0 && dow !== 6) result.push(candidate);
      if (result.length < 3) candidate = addDays(candidate, 1);
    }
    return result;
  }, [currentDate, showAllDays]);

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

  const getEventsForDay = useMemo(() => {
    return (day: Date): CalendarEvent[] => {
      const dayKey = getLocalDateKey(day);
      return events.filter((ev) => {
        const endKey = ev.end_date ?? ev.event_date;
        return ev.event_date <= dayKey && endKey >= dayKey;
      });
    };
  }, [events]);

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

  const handleColumnClick = useCallback((e: React.MouseEvent, day: Date) => {
    if (!onGridSlotClick) return;
    const col = e.currentTarget as HTMLElement;
    const rect = col.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const totalMinutes = (clickY / HOUR_HEIGHT) * 60;
    let hour = Math.floor(totalMinutes / 60) + START_HOUR;
    let minute = Math.round((totalMinutes % 60) / 30) * 30;
    if (minute >= 60) { hour++; minute = 0; }
    hour = Math.max(START_HOUR, Math.min(hour, END_HOUR - 1));
    const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    onGridSlotClick(day, time);
  }, [onGridSlotClick]);

  return (
    <div className="flex h-full flex-col">
      {/* Day headers */}
      <div className="flex bg-white flex-shrink-0">
        <div className="w-[52px] flex-shrink-0" />
        <div className="flex-1 grid grid-cols-3">
          {days.map((day, idx) => {
            const isCurrentDay = isToday(day);
            const dayAbsences = getAbsencesForDay(day);
            const hasAbsence = dayAbsences.length > 0;
            const dayEventsForCell = getEventsForDay(day);
            const hasEventsForCell = dayEventsForCell.length > 0;
            const isPrimary = isCurrentDay;

            return (
              <div
                key={getLocalDateKey(day)}
                className={`flex flex-col items-center py-2 gap-[3px]
                  ${idx < days.length - 1 ? 'border-r border-gray-100' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => onDateClick?.(day)}
                  className="flex flex-col items-center gap-[3px]"
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
                  <div className="w-[30px] h-[30px] flex items-center justify-center">
                    <span
                      className="text-[14px] font-semibold leading-none"
                      style={isPrimary ? {
                        background: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      } : { color: '#6B7280' }}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                </button>
                {/* Absences - event card style */}
                {hasAbsence && (
                  <div className="flex flex-col gap-0.5 w-full px-1">
                    {dayAbsences.slice(0, 2).map((absence) => {
                      const titleStyle = absence.employee_color ? {
                        background: absence.employee_color,
                        WebkitBackgroundClip: 'text' as const,
                        WebkitTextFillColor: 'transparent' as const,
                        backgroundClip: 'text' as const,
                      } : { color: '#92400E' };
                      return (
                        <div
                          key={absence.id}
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); onAbsenceClick?.(absence); }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onAbsenceClick?.(absence); }}
                          className="cursor-pointer w-full"
                          style={{ padding: '1.5px', background: '#F59E0B', borderRadius: '5px' }}
                        >
                          <div
                            className="w-full flex items-center gap-1 min-w-0 overflow-hidden"
                            style={{ background: '#FFFBEB', borderRadius: '3px', padding: '1.5px 5px' }}
                          >
                            <span className="text-[9px] font-semibold truncate flex-1 leading-tight" style={titleStyle}>
                              {absence.employee_name || 'Vsi'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {dayAbsences.length > 2 && (
                      <span className="text-[8px] text-amber-600">+{dayAbsences.length - 2}</span>
                    )}
                  </div>
                )}
                {/* Events */}
                {hasEventsForCell && (
                  <div className="flex flex-col gap-0.5 w-full px-1">
                    {dayEventsForCell.slice(0, 1).map((ev) => (
                      <EventCard
                        key={ev.id}
                        event={ev}
                        onClick={onEventClick ?? (() => {})}
                        variant="banner"
                      />
                    ))}
                    {dayEventsForCell.length > 1 && (
                      <span className="text-[8px] text-gray-500 text-center">+{dayEventsForCell.length - 1}</span>
                    )}
                  </div>
                )}
              </div>
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
      <TimeGrid columnCount={3} showCurrentTime>
        <div className="grid h-full grid-cols-3">
          {days.map((day, dayIndex) => {
            const dateKey = getLocalDateKey(day);
            const dayAppointments = appointmentsByDay.get(dateKey) || [];
            const layout = calculateAppointmentLayout(dayAppointments);
            const isCurrentDay = isToday(day);
            const dayAbsencesForGrid = getAbsencesForDay(day);
            const slDayName = JS_DAY_TO_SLOVENIAN[day.getDay()];
            const dayScheduleEntry = companySchedule?.[slDayName];
            const offRanges = companySchedule ? getOffHourRanges(dayScheduleEntry) : [];

            return (
              <div
                key={dateKey}
                className={`relative
                           ${isCurrentDay ? 'bg-[#1A1F36]/[0.015]' : ''}
                           ${dayIndex < days.length - 1 ? 'border-r' : ''}
                           ${onGridSlotClick ? 'cursor-pointer' : ''}`}
                style={dayIndex < days.length - 1 ? { borderColor: 'rgba(0,0,0,0.04)' } : undefined}
                onClick={onGridSlotClick ? (e) => handleColumnClick(e, day) : undefined}
              >
                {/* Company schedule: shade off-hours */}
                {offRanges.map((range, i) => {
                  const top = ((range.start - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                  const height = ((range.end - range.start) / 60) * HOUR_HEIGHT;
                  return (
                    <div
                      key={`off-${i}`}
                      className="absolute left-0 right-0 pointer-events-none z-0"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        background: 'repeating-linear-gradient(135deg, transparent, transparent 6px, rgba(0,0,0,0.045) 6px, rgba(0,0,0,0.045) 7px)',
                      }}
                    />
                  );
                })}

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

                  const fmt = (d: Date) =>
                    d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit', hour12: false });

                  return (
                    <div
                      key={absence.id}
                      className="absolute left-0 right-0 bg-amber-50 mx-1 rounded-lg overflow-hidden shadow-sm"
                      style={{ top: `${top}px`, height: `${Math.max(height, 36)}px` }}
                      title={`${absence.employee_name || 'Vsi zaposleni'}: ${fmt(visibleStart)} – ${fmt(visibleEnd)}${absence.reason ? ` · ${absence.reason}` : ''}`}
                    >
                      <div className="px-2.5 pt-2.5 pb-1.5 h-full flex flex-col" style={{ color: '#1A1F36' }}>
                        <p className="truncate leading-tight" style={absence.employee_color ? {
                          background: absence.employee_color,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          fontSize: '12px',
                          fontWeight: 600,
                        } : { fontSize: '12px', fontWeight: 600 }}>
                          {absence.employee_name || 'Vsi zaposleni'}
                        </p>
                        <div className="flex items-center gap-0.5 mt-0.5 overflow-hidden whitespace-nowrap" style={{ fontSize: '10px', fontWeight: 500, opacity: 0.88 }}>
                          <span>{fmt(visibleStart)}</span>
                          <span className="opacity-60 mx-px">–</span>
                          <span>{fmt(visibleEnd)}</span>
                        </div>
                        {absence.reason && (
                          <p className="truncate mt-0.5" style={{ fontSize: '10px', fontWeight: 400, opacity: 0.75 }}>{absence.reason}</p>
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
