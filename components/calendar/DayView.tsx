'use client';

import { memo, useMemo, useCallback } from 'react';
import { CalendarBlank } from '@phosphor-icons/react';
import type { AppointmentWithDetails, Zaposleni, Storitev } from '@/types/appointments';
import type { Absence } from '@/lib/supabase/appointments';
import type { CalendarEvent } from '@/types/events';
import TimeGrid from './TimeGrid';
import AppointmentCard from './AppointmentCard';
import EventCard from './EventCard';
import {
  isSameDay,
  isToday,
  formatDate,
  DAYS_FULL,
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

interface DayViewProps {
  currentDate: Date;
  appointments: AppointmentWithDetails[];
  absences?: Absence[];
  events?: CalendarEvent[];
  services?: Storitev[];
  onAppointmentClick: (appointment: AppointmentWithDetails) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onAbsenceClick?: (absence: Absence) => void;
  employees?: (Zaposleni & { initials: string })[];
  onGridSlotClick?: (date: Date, time: string) => void;
  companySchedule?: CompanySchedule | null;
  showAllDays?: boolean;
  isMobile?: boolean;
}

// Calculate overlapping appointments and assign columns (same as WeekView)
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

    const totalColumns = columns.length;
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      for (const apt of columns[colIndex]) {
        layout.set(apt.id, { column: colIndex, totalColumns });
      }
    }
  }

  return layout;
}

function DayView({ currentDate, appointments, absences = [], events = [], services = [], onAppointmentClick, onEventClick, onAbsenceClick, employees = [], onGridSlotClick, companySchedule, showAllDays = true, isMobile = false }: DayViewProps) {
  // If showAllDays=false and it's a weekend, show "not a working day" state
  const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
  const skipDay = !showAllDays && isWeekend;
  // Filter appointments for current day
  const dayAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.datum);
      return isSameDay(aptDate, currentDate);
    });
  }, [appointments, currentDate]);

  // Get absences for current day
  const dayAbsences = useMemo(() => {
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(currentDate);
    dayEnd.setHours(23, 59, 59, 999);

    return absences.filter((absence) => {
      const absenceStart = new Date(absence.start_at);
      const absenceEnd = new Date(absence.end_at);
      return absenceStart <= dayEnd && absenceEnd >= dayStart;
    });
  }, [absences, currentDate]);

  // Get events for current day
  const dayEvents = useMemo(() => {
    const dayKey = getLocalDateKey(currentDate);
    return events.filter((ev) => {
      const endKey = ev.end_date ?? ev.event_date;
      return ev.event_date <= dayKey && endKey >= dayKey;
    });
  }, [events, currentDate]);

  // Group appointments by employee
  const appointmentsByEmployee = useMemo(() => {
    const grouped = new Map<string, AppointmentWithDetails[]>();

    // Initialize with all employees
    for (const emp of employees) {
      grouped.set(emp.id, []);
    }

    // Add appointments to their employee
    for (const apt of dayAppointments) {
      const empId = apt.zaposleni?.id;
      if (empId) {
        const existing = grouped.get(empId) || [];
        existing.push(apt);
        grouped.set(empId, existing);
      }
    }

    // Filter out employees with no appointments (optional - keep all)
    // Return only employees that have appointments or keep all for consistent layout
    return grouped;
  }, [dayAppointments, employees]);

  // Get employees that have appointments today (for display)
  const activeEmployees = useMemo(() => {
    const empIds = new Set(dayAppointments.map(apt => apt.zaposleni?.id).filter(Boolean));
    return employees.filter(emp => empIds.has(emp.id));
  }, [dayAppointments, employees]);

  // Use all employees if there are any, otherwise show single column
  const displayEmployees = activeEmployees.length > 0 ? activeEmployees : [];
  const columnCount = displayEmployees.length > 0 ? displayEmployees.length : 1;

  const isCurrentDay = isToday(currentDate);
  const hasAbsence = dayAbsences.length > 0;
  const hasEvents = dayEvents.length > 0;

  // Company schedule shading for this day
  const slDayName = JS_DAY_TO_SLOVENIAN[currentDate.getDay()];
  const dayScheduleEntry = companySchedule?.[slDayName];
  const offRanges = companySchedule ? getOffHourRanges(dayScheduleEntry) : [];

  const handleColumnClick = useCallback((e: React.MouseEvent) => {
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
    onGridSlotClick(currentDate, time);
  }, [onGridSlotClick, currentDate]);

  if (skipDay) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-sm font-medium text-gray-400">{DAYS_FULL[currentDate.getDay()]} ni delovni dan</p>
        <p className="text-xs text-gray-300 mt-1">{formatDate(currentDate, 'dayMonth')} {currentDate.getFullYear()}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Day header - Apple Calendar style */}
      <div className="flex bg-white">
        {/* Time column spacer */}
        <div className="w-[52px] flex-shrink-0" />

        {/* Day header */}
        <div className={`flex flex-1 gap-3 py-3 ${isMobile ? 'px-2 items-start' : 'px-6 items-center'}`}>
          {/* Date circle */}
          <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${isCurrentDay ? '' : 'text-[#1A1F36]'}`}
              style={isCurrentDay ? {
                background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              } : undefined}
            >
              {currentDate.getDate()}
            </div>
          </div>
          <div className="flex-shrink-0">
            <p className="text-base font-semibold text-[#1A1F36]">
              {DAYS_FULL[currentDate.getDay()]}
            </p>
            <p className="text-xs text-gray-400">
              {formatDate(currentDate, 'dayMonth')} {currentDate.getFullYear()}
            </p>
          </div>

          {/* Right section — all items stack vertically on mobile */}
          <div className="ml-auto flex flex-col gap-1 items-end min-w-0" style={isMobile ? { maxWidth: '46%' } : undefined}>
            {/* Event banners */}
            {hasEvents && dayEvents.slice(0, isMobile ? 2 : 3).map((ev) => (
              <div key={ev.id} className="w-full">
                <EventCard
                  event={ev}
                  onClick={onEventClick ?? (() => {})}
                  variant="banner"
                />
              </div>
            ))}
            {hasEvents && dayEvents.length > (isMobile ? 2 : 3) && (
              <span className="text-[9px] text-gray-500 self-end">+{dayEvents.length - (isMobile ? 2 : 3)}</span>
            )}

            {/* Absence indicators */}
            {hasAbsence && dayAbsences.map((absence) => {
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
                  className="cursor-pointer w-full flex items-center gap-2 min-w-0 overflow-hidden"
                  style={{ background: '#FFFBEB', borderRadius: '5px', padding: '3px 8px' }}
                >
                  <span className="text-xs font-semibold truncate leading-tight" style={titleStyle}>
                    {absence.employee_name || 'Vsi zaposleni'}
                  </span>
                  {!isMobile && absence.reason && (
                    <span className="text-[10px] text-amber-600 truncate max-w-[80px]">{absence.reason}</span>
                  )}
                </div>
              );
            })}

            {/* Appointment count pill */}
            <div className="flex items-center gap-1.5 rounded-full bg-[#F7F8FA] px-3 py-1.5 flex-shrink-0 self-end">
              <span className="text-xs font-semibold text-[#1A1F36]">
                {dayAppointments.length}
              </span>
              <span className="text-xs text-gray-400">
                {dayAppointments.length === 1 ? 'termin' : dayAppointments.length >= 2 && dayAppointments.length <= 4 ? 'termini' : 'terminov'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Employee headers - only show if there are active employees */}
      {displayEmployees.length > 0 && (
        <div className="flex bg-white">
          {/* Time column spacer */}
          <div className="w-[52px] flex-shrink-0" />

          {/* Employee headers */}
          <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
            {displayEmployees.map((employee, index) => (
              <div
                key={employee.id}
                className={`flex flex-col items-center py-2.5
                           ${index < displayEmployees.length - 1 ? 'border-r' : ''}`}
                style={index < displayEmployees.length - 1 ? { borderColor: 'rgba(0,0,0,0.04)' } : undefined}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-sm font-bold"
                    style={{
                      background: employee.barva || 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    {employee.initials}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-500">
                    {appointmentsByEmployee.get(employee.id)?.length || 0}
                  </span>
                  <CalendarBlank className="h-3.5 w-3.5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Separator line - Apple Calendar style */}
      <div
        className="flex-shrink-0"
        style={{
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.06) 10%, rgba(0,0,0,0.06) 90%, transparent 100%)',
        }}
      />

      {/* Time grid with appointments by employee */}
      <TimeGrid columnCount={columnCount} showCurrentTime={isCurrentDay}>
        {displayEmployees.length > 0 ? (
          <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
            {displayEmployees.map((employee, empIndex) => {
              const employeeAppointments = appointmentsByEmployee.get(employee.id) || [];
              const layout = calculateAppointmentLayout(employeeAppointments);

              // Check if this employee has an absence
              const employeeAbsence = dayAbsences.find(a =>
                a.employee_id === employee.id || !a.employee_id // Include general absences
              );

              return (
                <div
                  key={employee.id}
                  className={`relative ${isCurrentDay ? 'bg-[#1A1F36]/[0.01]' : ''}
                             ${empIndex < displayEmployees.length - 1 ? 'border-r' : ''}
                             ${onGridSlotClick ? 'cursor-pointer' : ''}`}
                  style={empIndex < displayEmployees.length - 1 ? { borderColor: 'rgba(0,0,0,0.04)' } : undefined}
                  onClick={onGridSlotClick ? handleColumnClick : undefined}
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

                  {/* Render absence for this employee */}
                  {employeeAbsence && (() => {
                    const absenceStart = new Date(employeeAbsence.start_at);
                    const absenceEnd = new Date(employeeAbsence.end_at);
                    const dayStart = new Date(currentDate);
                    dayStart.setHours(0, 0, 0, 0);
                    const dayEnd = new Date(currentDate);
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
                        className="absolute left-1 right-1 bg-amber-50 rounded-lg overflow-hidden shadow-sm"
                        style={{
                          top: `${top}px`,
                          height: `${Math.max(height, 36)}px`,
                        }}
                        title={`${employeeAbsence.employee_name || 'Odsotnost'}: ${fmt(visibleStart)} – ${fmt(visibleEnd)}${employeeAbsence.reason ? ` · ${employeeAbsence.reason}` : ''}`}
                      >
                        <div className="px-2.5 pt-2.5 pb-1.5 h-full flex flex-col" style={{ color: '#1A1F36' }}>
                          <p className="truncate leading-tight" style={employeeAbsence.employee_color ? {
                            background: employeeAbsence.employee_color,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            fontSize: '12px',
                            fontWeight: 600,
                          } : { fontSize: '12px', fontWeight: 600 }}>
                            {employeeAbsence.employee_name || 'Vsi zaposleni'}
                          </p>
                          <div className="flex items-center gap-0.5 mt-0.5 overflow-hidden whitespace-nowrap" style={{ fontSize: '10px', fontWeight: 500, opacity: 0.88 }}>
                            <span>{fmt(visibleStart)}</span>
                            <span className="opacity-60 mx-px">–</span>
                            <span>{fmt(visibleEnd)}</span>
                          </div>
                          {employeeAbsence.reason && (
                            <p className="truncate mt-0.5" style={{ fontSize: '10px', fontWeight: 400, opacity: 0.75 }}>
                              {employeeAbsence.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Render appointments */}
                  {employeeAppointments.map((apt) => {
                    const startMinutes = parseTimeToMinutes(apt.cas_zacetek);

                    if (startMinutes < START_HOUR * 60 || startMinutes >= END_HOUR * 60) {
                      return null;
                    }

                    const top = getTimePosition(apt.cas_zacetek);
                    const height = getDurationHeight(apt.cas_zacetek, apt.cas_konec || apt.cas_zacetek);
                    const layoutInfo = layout.get(apt.id) || { column: 0, totalColumns: 1 };

                    // Within each employee column, handle overlaps
                    const maxCols = Math.min(layoutInfo.totalColumns, 2);
                    const width = `calc(${100 / maxCols}% - 4px)`;
                    const left = `calc(${(100 / maxCols) * Math.min(layoutInfo.column, maxCols - 1)}% + 2px)`;

                    return (
                      <AppointmentCard
                        key={apt.id}
                        appointment={apt}
                        onClick={onAppointmentClick}
                        variant="grid"
                        services={services}
                        style={{
                          top: `${top}px`,
                          height: `${Math.max(height, 50)}px`,
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
        ) : (
          // Fallback single column view when no employees with appointments
          <div
            className={`relative h-full ${isCurrentDay ? 'bg-[#1A1F36]/[0.015]' : ''} ${onGridSlotClick ? 'cursor-pointer' : ''}`}
            onClick={onGridSlotClick ? handleColumnClick : undefined}
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
            {dayAbsences.map((absence) => {
              const absenceStart = new Date(absence.start_at);
              const absenceEnd = new Date(absence.end_at);
              const dayStart = new Date(currentDate);
              dayStart.setHours(0, 0, 0, 0);
              const dayEnd = new Date(currentDate);
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
                  className="absolute left-4 right-4 bg-amber-50 rounded-lg overflow-hidden shadow-sm"
                  style={{
                    top: `${top}px`,
                    height: `${Math.max(height, 44)}px`,
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

            {/* Empty state */}
            {dayAppointments.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F7F8FA]">
                    <svg
                      className="h-8 w-8 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-500">Ni terminov za ta dan</p>
                </div>
              </div>
            )}
          </div>
        )}
      </TimeGrid>
    </div>
  );
}

export default memo(DayView);
