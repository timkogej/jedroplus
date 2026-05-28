'use client';

import { memo, useMemo, useRef, useCallback, useEffect, useState } from 'react';
import type { AppointmentWithDetails, Storitev } from '@/types/appointments';
import type { Absence } from '@/lib/supabase/appointments';
import type { CalendarEvent } from '@/types/events';
import TimeGrid from './TimeGrid';
import AppointmentCard from './AppointmentCard';
import EventCard from './EventCard';
import { useTranslations, useLocale } from 'next-intl';
import {
  getWeekDays,
  isSameDay,
  isToday,
  getDaysShort,
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
  onAbsenceClick?: (absence: Absence) => void;
  onDateClick?: (date: Date) => void;
  showAllDays?: boolean;
  onGridSlotClick?: (date: Date, time: string) => void;
  companySchedule?: CompanySchedule | null;
  onAppointmentReschedule?: (appointment: AppointmentWithDetails, newDate: string, newStartTime: string, newEndTime: string) => void;
}

interface DragInfo {
  apt: AppointmentWithDetails;
  duration: number; // minutes
  offsetY: number; // pixels from card top where pointer started
}

interface DropTarget {
  dateKey: string;
  startTime: string;
  endTime: string;
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

function WeekView({ currentDate, appointments, absences = [], events = [], services = [], onAppointmentClick, onEventClick, onAbsenceClick, onDateClick, showAllDays = true, onGridSlotClick, companySchedule, onAppointmentReschedule }: WeekViewProps) {
  const t = useTranslations('appointments');
  const locale = useLocale();
  const [isMobile, setIsMobile] = useState(false);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);

  // ── Drag state ────────────────────────────────────────────────────────────
  const [dragging, setDragging] = useState<DragInfo | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

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

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleAppointmentLongPress = useCallback((
    apt: AppointmentWithDetails,
    info: { clientX: number; clientY: number; cardRect: DOMRect }
  ) => {
    if (!onAppointmentReschedule) return;
    const [sh, sm] = apt.cas_zacetek.split(':').map(Number);
    const [eh, em] = apt.cas_konec.split(':').map(Number);
    const duration = (eh * 60 + em) - (sh * 60 + sm);
    const offsetY = info.clientY - info.cardRect.top;
    setDragging({ apt, duration, offsetY });
    setGhostPos({ x: info.clientX, y: info.clientY });
    setDropTarget(null);
  }, [onAppointmentReschedule]);

  const calcDropTarget = useCallback((clientX: number, clientY: number, offsetY: number, duration: number): DropTarget | null => {
    const gridEl = gridScrollRef.current;
    if (!gridEl) return null;
    const rect = gridEl.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;

    // Calculate time from Y position (accounting for scroll and pointer offset in card)
    const relativeY = clientY - rect.top + gridEl.scrollTop - offsetY;
    const rawMinutes = (relativeY / HOUR_HEIGHT) * 60 + START_HOUR * 60;
    const roundedStart = Math.max(START_HOUR * 60, Math.round(rawMinutes / 15) * 15);
    const roundedEnd = roundedStart + duration;
    const sh = Math.floor(roundedStart / 60);
    const sm = roundedStart % 60;
    const eh = Math.floor(roundedEnd / 60);
    const em = roundedEnd % 60;
    const startTime = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
    const endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;

    // Find which date column the cursor is over using data-date attribute
    const elements = document.elementsFromPoint(clientX, clientY);
    let dateKey: string | null = null;
    for (const el of elements) {
      if (el instanceof HTMLElement && el.dataset.date) {
        dateKey = el.dataset.date;
        break;
      }
    }
    if (!dateKey) return null;
    return { dateKey, startTime, endTime };
  }, []);

  // Window-level pointer events during drag
  useEffect(() => {
    if (!dragging) return;

    let currentDrop: DropTarget | null = null;

    const handleMove = (e: PointerEvent) => {
      setGhostPos({ x: e.clientX, y: e.clientY });
      currentDrop = calcDropTarget(e.clientX, e.clientY, dragging.offsetY, dragging.duration);
      setDropTarget(currentDrop);
    };

    const handleUp = () => {
      if (currentDrop && onAppointmentReschedule) {
        const originalDate = dragging.apt.datum.slice(0, 10);
        const changed = currentDrop.dateKey !== originalDate || currentDrop.startTime !== dragging.apt.cas_zacetek;
        if (changed) {
          onAppointmentReschedule(dragging.apt, currentDrop.dateKey, currentDrop.startTime, currentDrop.endTime);
        }
      }
      setDragging(null);
      setGhostPos(null);
      setDropTarget(null);
    };

    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

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
                  className="flex flex-col items-center py-2.5"
                  style={isMobile ? { scrollSnapAlign: 'start' } as React.CSSProperties : undefined}
                >
                  <span
                    className="text-[10px] font-normal uppercase tracking-wider"
                    style={isCurrentDay ? {
                      background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    } : { color: '#9CA3AF' }}
                  >
                    {getDaysShort(locale)[day.getDay()]}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDateClick?.(day)}
                    className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-normal
                               transition-all duration-200 hover:bg-gray-100
                               ${isCurrentDay ? '' : 'text-[#1A1F36]'}`}
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
                            onClick={() => onAbsenceClick?.(absence)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onAbsenceClick?.(absence); }}
                            title={`${absence.employee_name || t('calendarView.allEmployees')}${absence.reason ? ` - ${absence.reason}` : ''}`}
                            className="cursor-pointer w-full flex items-center gap-1 min-w-0 overflow-hidden"
                            style={{ background: '#FFFBEB', borderRadius: '5px', padding: '1.5px 5px' }}
                          >
                            <span className="text-[9px] font-semibold truncate flex-1 leading-tight" style={titleStyle}>
                              {absence.employee_name || t('calendarView.allEmployees')}
                            </span>
                          </div>
                        );
                      })}
                      {dayAbsences.length > 2 && (
                        <span className="text-[9px] text-amber-600 text-right">
                          {t('calendarView.weekView.moreAbsences', { count: dayAbsences.length - 2 })}
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
                          {t('calendarView.weekView.moreEvents', { count: dayEventsForCell.length - 2 })}
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
                data-date={dateKey}
                className={`relative
                           ${isCurrentDay ? 'bg-[#1A1F36]/[0.015]' : ''}
                           ${dayIndex < weekDays.length - 1 ? 'border-r' : ''}
                           ${onGridSlotClick && !dragging ? 'cursor-pointer' : ''}`}
                style={dayIndex < weekDays.length - 1 ? { borderColor: 'rgba(0,0,0,0.04)' } : undefined}
                onClick={onGridSlotClick && !dragging ? (e) => handleColumnClick(e, day) : undefined}
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
                      title={`${absence.employee_name || t('calendarView.allEmployees')}: ${fmt(visibleStart)} – ${fmt(visibleEnd)}${absence.reason ? ` · ${absence.reason}` : ''}`}
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
                          {absence.employee_name || t('calendarView.allEmployees')}
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

                {/* Drop indicator */}
                {dragging && dropTarget && dropTarget.dateKey === dateKey && (
                  <div
                    className="pointer-events-none absolute left-1 right-1 rounded-lg z-25"
                    style={{
                      top: `${getTimePosition(dropTarget.startTime)}px`,
                      height: `${Math.max(getDurationHeight(dropTarget.startTime, dropTarget.endTime), 20)}px`,
                      background: dragging.apt.storitev?.barva || '#6366F1',
                      opacity: 0.35,
                      border: '2px dashed rgba(255,255,255,0.6)',
                      zIndex: 25,
                    }}
                  />
                )}

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
                      onLongPress={onAppointmentReschedule ? handleAppointmentLongPress : undefined}
                      isDragging={dragging?.apt.id === apt.id}
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

      {/* Drag ghost element – fixed position, follows cursor */}
      {dragging && ghostPos && (
        <div
          className="pointer-events-none fixed z-[200] rounded-lg shadow-2xl select-none"
          style={{
            left: ghostPos.x - 40,
            top: ghostPos.y - dragging.offsetY,
            width: 120,
            background: dragging.apt.storitev?.barva || 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)',
            opacity: 0.88,
            transform: 'rotate(2deg) scale(1.04)',
            padding: '8px 10px',
            minHeight: 36,
          }}
        >
          <div className="text-white text-xs font-bold truncate leading-tight">{dragging.apt.stranka_ime}</div>
          {dropTarget && (
            <div className="text-white/80 text-[10px] mt-0.5">{dropTarget.startTime} – {dropTarget.endTime}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(WeekView);
