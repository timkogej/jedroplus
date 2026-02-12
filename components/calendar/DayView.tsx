'use client';

import { memo, useMemo } from 'react';
import type { AppointmentWithDetails, Zaposleni, Storitev } from '@/types/appointments';
import type { Absence } from '@/lib/supabase/appointments';
import TimeGrid from './TimeGrid';
import AppointmentCard from './AppointmentCard';
import {
  isSameDay,
  isToday,
  formatDate,
  DAYS_FULL,
  HOUR_HEIGHT,
  getTimePosition,
  getDurationHeight,
  parseTimeToMinutes,
  START_HOUR,
  END_HOUR,
} from '@/lib/utils/calendar';

interface DayViewProps {
  currentDate: Date;
  appointments: AppointmentWithDetails[];
  absences?: Absence[];
  services?: Storitev[];
  onAppointmentClick: (appointment: AppointmentWithDetails) => void;
  employees?: (Zaposleni & { initials: string })[];
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

function DayView({ currentDate, appointments, absences = [], services = [], onAppointmentClick, employees = [] }: DayViewProps) {
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

  return (
    <div className="flex h-full flex-col">
      {/* Day header - Apple Calendar style */}
      <div className="flex bg-white">
        {/* Time column spacer */}
        <div className="w-[52px] flex-shrink-0" />

        {/* Day header */}
        <div className="flex flex-1 items-center gap-4 px-6 py-3">
          {/* Date circle - only number, no day name above */}
          <div className="flex flex-col items-center">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-[#1A1F36]`}
              style={isCurrentDay ? {
                border: '2px solid transparent',
                backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                backgroundOrigin: 'border-box',
                backgroundClip: 'padding-box, border-box',
              } : undefined}
            >
              {currentDate.getDate()}
            </div>
          </div>
          <div>
            <p className="text-base font-semibold text-[#1A1F36]">
              {DAYS_FULL[currentDate.getDay()]}
            </p>
            <p className="text-xs text-gray-400">
              {formatDate(currentDate, 'dayMonth')} {currentDate.getFullYear()}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {/* Absence indicators */}
            {hasAbsence && (
              <div className="flex flex-wrap items-center gap-2">
                {dayAbsences.map((absence) => (
                  <div
                    key={absence.id}
                    className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5"
                  >
                    {absence.employee_name && (
                      <span className="text-xs font-semibold text-amber-800">
                        {absence.employee_name}
                      </span>
                    )}
                    {absence.reason && (
                      <span className="text-xs text-amber-700">
                        {absence.employee_name ? `- ${absence.reason}` : absence.reason}
                      </span>
                    )}
                    {!absence.employee_name && !absence.reason && (
                      <span className="text-xs text-amber-700">Odsotnost</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5 rounded-full bg-[#F7F8FA] px-3 py-1.5">
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
                {/* Employee initials with gradient */}
                <div
                  className="w-9 h-9 flex items-center justify-center text-base font-bold mb-0.5"
                  style={{
                    background: employee.barva || 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {employee.initials}
                </div>
                <span className="text-xs font-medium text-gray-900 truncate max-w-full px-2">
                  {employee.ime} {employee.priimek}
                </span>
                <span className="text-[10px] text-gray-400">
                  {appointmentsByEmployee.get(employee.id)?.length || 0} {(appointmentsByEmployee.get(employee.id)?.length || 0) === 1 ? 'termin' : 'terminov'}
                </span>
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
                             ${empIndex < displayEmployees.length - 1 ? 'border-r' : ''}`}
                  style={empIndex < displayEmployees.length - 1 ? { borderColor: 'rgba(0,0,0,0.04)' } : undefined}
                >
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

                    return (
                      <div
                        className="absolute left-1 right-1 bg-amber-100/60 border-l-4 border-amber-400 rounded-r-lg overflow-hidden"
                        style={{
                          top: `${top}px`,
                          height: `${Math.max(height, 30)}px`,
                        }}
                        title={`${employeeAbsence.reason || 'Odsotnost'}`}
                      >
                        <div className="p-1.5 h-full flex flex-col justify-center">
                          <p className="text-[10px] font-semibold text-amber-800 truncate">
                            Odsotnost
                          </p>
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
          <div className={`relative h-full ${isCurrentDay ? 'bg-[#1A1F36]/[0.015]' : ''}`}>
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

              return (
                <div
                  key={absence.id}
                  className="absolute left-4 right-4 bg-amber-100/60 border-l-4 border-amber-400 rounded-r-lg overflow-hidden"
                  style={{
                    top: `${top}px`,
                    height: `${Math.max(height, 40)}px`,
                  }}
                  title={`${absence.employee_name || 'Vsi zaposleni'}: ${absence.reason || 'Odsotnost'}`}
                >
                  <div className="p-2 h-full flex flex-col justify-center">
                    <p className="text-sm font-semibold text-amber-800">
                      {absence.employee_name || 'Vsi zaposleni'}
                    </p>
                    {absence.reason && (
                      <p className="text-xs text-amber-700">
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
