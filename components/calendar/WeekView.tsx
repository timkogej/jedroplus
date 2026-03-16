'use client';

import { memo, useMemo, useRef, useCallback, useEffect, useState } from 'react';
import type { AppointmentWithDetails, Storitev } from '@/types/appointments';
import type { Absence } from '@/lib/supabase/appointments';
import type { CalendarEvent } from '@/types/events';
import TimeGrid from './TimeGrid';
import AppointmentCard from './AppointmentCard';
import EventCard from './EventCard';
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
  type CompanySchedule,
  JS_DAY_TO_SLOVENIAN,
  getOffHourRanges,
} from '@/lib/utils/calendar';

interface WeekViewProps {
  currentDate: Date;
  appointments: AppointmentWithDetails[];
  absences?: Absence[];
  events?: CalendarEvent[];
  services?: Storitev[];
  onAppointmentClick: (appointment: AppointmentWithDetails) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
  showAllDays?: boolean;
  onGridSlotClick?: (date: Date, time: string) => void;
  companySchedule?: CompanySchedule | null;
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

function WeekView({ currentDate, appointments, absences = [], events = [], services = [], onAppointmentClick, onEventClick, onDateClick, showAllDays = true, onGridSlotClick, companySchedule }: WeekViewProps) {
  const [isMobile, setIsMobile] = useState(false);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Sync horizontal scroll between header and grid
  const handleHeaderScroll = useCallback(() => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    if (headerScrollRef.current && gridScrollRef.current) {
      gridScrollRef.current.scrollLeft = headerScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => { isSyncing.current = false; });
  }, []);

  const handleGridHorizontalScroll = useCallback(() => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    if (headerScrollRef.current && gridScrollRef.current) {
      headerScrollRef.current.scrollLeft = gridScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => { isSyncing.current = false; });
  }, []);

  // Get all week days, then filter if showAllDays is false
  const allWeekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const weekDays = useMemo(() => {
    if (showAllDays) return allWeekDays;
    return allWeekDays.filter(day => {
      const dayOfWeek = day.getDay();
      return dayOfWeek !== 0 && dayOfWeek !== 6;
    });
  }, [allWeekDays, showAllDays]);

  const columnCount = weekDays.length;

  // Mobile column width: show 4 days at a time
  const mobileColWidth = `calc((100vw - 52px) / 4)`;

  // Get absences for a specific day
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

  // Get events for a specific day (handles multi-day spans)
  const getEventsForDay = useMemo(() => {
    return (day: Date): CalendarEvent[] => {
      const dayKey = getLocalDateKey(day);
      return events.filter((ev) => {
        const endKey = ev.end_date ?? ev.event_date;
        return ev.event_date <= dayKey && endKey >= dayKey;
      });
    };
  }, [events]);

  // Group appointments by day
  const appointmentsByDay = useMemo(() => {
    const grouped = new Map<string, AppointmentWithDetails[]>();

    for (const day of weekDays) {
      const dateKey = getLocalDateKey(day);
      grouped.set(dateKey, []);
    }

    for (const apt of appointments) {
      // Parse date safely: if datum is a date-only string like "2024-02-16",
      // append T12:00:00 to avoid timezone shifting to wrong day
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
  }, [weekDays, appointments]);

  // Grid template for columns - fixed width on mobile, flexible on desktop
  const gridTemplateColumns = isMobile
    ? weekDays.map(() => mobileColWidth).join(' ')
    : `repeat(${columnCount}, minmax(0, 1fr))`;

  // Content min-width for TimeGrid so horizontal lines span full scrollable width
  const contentMinWidth = isMobile ? `calc(${columnCount} * (100vw - 52px) / 4)` : undefined;

  // Auto-scroll to current day on mobile
  useEffect(() => {
    if (!isMobile) return;

    const todayIndex = weekDays.findIndex(day => isToday(day));
    if (todayIndex === -1) return;

    const colWidth = (window.innerWidth - 52) / 4;
    const maxScroll = Math.max(0, (columnCount - 4) * colWidth);
    const targetScroll = Math.max(0, Math.min((todayIndex - 1) * colWidth, maxScroll));

    requestAnimationFrame(() => {
      if (gridScrollRef.current) {
        gridScrollRef.current.scrollLeft = targetScroll;
      }
      if (headerScrollRef.current) {
        headerScrollRef.current.scrollLeft = targetScroll;
      }
    });
  }, [isMobile, weekDays, columnCount]);

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
        {/* Time column spacer */}
        <div className="w-[52px] flex-shrink-0" />

        {/* Day headers - horizontally scrollable on mobile */}
        <div
          ref={headerScrollRef}
          onScroll={handleHeaderScroll}
          className={`flex-1 ${isMobile ? 'overflow-x-auto' : ''}`}
          style={isMobile ? { scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', scrollSnapType: 'x proximity' } as React.CSSProperties : undefined}
        >
          <div className="grid" style={{ gridTemplateColumns }}>
            {weekDays.map((day) => {
              const isCurrentDay = isToday(day);
              const dayAbsences = getAbsencesForDay(day);
              const hasAbsence = dayAbsences.length > 0;
              const dayEventsForCell = getEventsForDay(day);
              const hasEventsForCell = dayEventsForCell.length > 0;
              return (
                <div
                  key={getLocalDateKey(day)}
                  className={`flex flex-col items-center py-2.5
                             ${hasAbsence ? 'bg-amber-50/50' : ''}`}
                  style={isMobile ? { scrollSnapAlign: 'start' } as React.CSSProperties : undefined}
                >
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={isCurrentDay ? {
                      background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    } : { color: '#9CA3AF' }}
                  >
                    {DAYS_SHORT[day.getDay()]}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDateClick?.(day)}
                    className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold
                               transition-all duration-200 hover:bg-gray-100
                               ${isCurrentDay ? 'font-bold' : 'text-[#1A1F36]'}`}
                    style={isCurrentDay ? {
                      background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    } : undefined}
                  >
                    {day.getDate()}
                  </button>
                  {hasAbsence && !isMobile && (
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
                  {hasEventsForCell && !isMobile && (
                    <div className="mt-1 flex flex-col gap-0.5 w-full px-1">
                      {dayEventsForCell.slice(0, 2).map((ev) => (
                        <EventCard
                          key={ev.id}
                          event={ev}
                          onClick={onEventClick ?? (() => {})}
                          variant="banner"
                        />
                      ))}
                      {dayEventsForCell.length > 2 && (
                        <span className="text-[9px] text-gray-500 text-center">
                          +{dayEventsForCell.length - 2} več
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Separator line */}
      <div
        className="flex-shrink-0"
        style={{
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.06) 10%, rgba(0,0,0,0.06) 90%, transparent 100%)',
        }}
      />

      {/* Time grid with appointments */}
      <TimeGrid
        columnCount={columnCount}
        showCurrentTime
        gridScrollRef={gridScrollRef}
        onHorizontalScroll={handleGridHorizontalScroll}
        isMobile={isMobile}
        contentMinWidth={contentMinWidth}
      >
        <div className="grid h-full" style={{ gridTemplateColumns }}>
          {weekDays.map((day, dayIndex) => {
            const dateKey = getLocalDateKey(day);
            const dayAppointments = appointmentsByDay.get(dateKey) || [];
            const layout = calculateAppointmentLayout(dayAppointments);
            const isCurrentDay = isToday(day);
            const dayAbsencesForGrid = getAbsencesForDay(day);

            // Company schedule shading for this day
            const slDayName = JS_DAY_TO_SLOVENIAN[day.getDay()];
            const dayScheduleEntry = companySchedule?.[slDayName];
            const offRanges = companySchedule ? getOffHourRanges(dayScheduleEntry) : [];

            return (
              <div
                key={dateKey}
                className={`relative
                           ${isCurrentDay ? 'bg-[#1A1F36]/[0.015]' : ''}
                           ${dayIndex < weekDays.length - 1 ? 'border-r' : ''}
                           ${onGridSlotClick ? 'cursor-pointer' : ''}`}
                style={dayIndex < weekDays.length - 1 ? { borderColor: 'rgba(0,0,0,0.04)' } : undefined}
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
                        background: 'rgba(0,0,0,0.018)',
                      }}
                    />
                  );
                })}

                {/* Render absences as background blocks */}
                {dayAbsencesForGrid.map((absence) => {
                  const absenceStart = new Date(absence.start_at);
                  const absenceEnd = new Date(absence.end_at);
                  const dayStart = new Date(day);
                  dayStart.setHours(0, 0, 0, 0);
                  const dayEnd = new Date(day);
                  dayEnd.setHours(23, 59, 59, 999);

                  const visibleStart = absenceStart < dayStart ? dayStart : absenceStart;
                  const visibleEnd = absenceEnd > dayEnd ? dayEnd : absenceEnd;

                  const startHour = visibleStart.getHours();
                  const startMin = visibleStart.getMinutes();
                  const endHour = visibleEnd.getHours();
                  const endMin = visibleEnd.getMinutes();

                  const startMinutes = startHour * 60 + startMin;
                  const endMinutes = endHour * 60 + endMin;

                  if (endMinutes <= START_HOUR * 60 || startMinutes >= END_HOUR * 60) {
                    return null;
                  }

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
                      style={{
                        top: `${top}px`,
                        height: `${Math.max(height, 36)}px`,
                      }}
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
                          <p className="truncate mt-0.5" style={{ fontSize: '10px', fontWeight: 400, opacity: 0.75 }}>
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
