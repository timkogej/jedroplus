'use client';

import { memo, useMemo } from 'react';
import type { AppointmentWithDetails, Storitev } from '@/types/appointments';
import type { Absence } from '@/lib/supabase/appointments';
import AppointmentCard from './AppointmentCard';
import {
  getMonthGrid,
  isSameDay,
  isToday,
  startOfMonth,
  getLocalDateKey,
  DAYS_ABBR,
} from '@/lib/utils/calendar';

interface MonthViewProps {
  currentDate: Date;
  appointments: AppointmentWithDetails[];
  absences?: Absence[];
  services?: Storitev[];
  onAppointmentClick: (appointment: AppointmentWithDetails) => void;
  onDateClick: (date: Date) => void;
}

function MonthView({ currentDate, appointments, absences = [], services = [], onAppointmentClick, onDateClick }: MonthViewProps) {
  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const monthDays = useMemo(() => getMonthGrid(currentDate), [currentDate]);

  // Group appointments by day using local date keys to avoid timezone issues
  const appointmentsByDay = useMemo(() => {
    const grouped = new Map<string, AppointmentWithDetails[]>();

    for (const apt of appointments) {
      const aptDate = new Date(apt.datum);
      const dateKey = getLocalDateKey(aptDate);
      const existing = grouped.get(dateKey) || [];
      existing.push(apt);
      grouped.set(dateKey, existing);
    }

    return grouped;
  }, [appointments]);

  // Get absences for a specific day
  const getAbsencesForDay = useMemo(() => {
    return (day: Date): Absence[] => {
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

  // Days header (Monday first)
  const daysHeader = [1, 2, 3, 4, 5, 6, 0].map((i) => DAYS_ABBR[i]);

  return (
    <div className="flex h-full flex-col bg-white overflow-auto">
      {/* Days header - Apple Calendar style */}
      <div className="grid grid-cols-7">
        {daysHeader.map((day, index) => (
          <div
            key={index}
            className="flex h-9 items-center justify-center"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {day}
            </span>
          </div>
        ))}
      </div>

      {/* Separator */}
      <div
        style={{
          height: '1px',
          background: 'rgba(0, 0, 0, 0.06)',
        }}
      />

      {/* Calendar grid - Apple Calendar style: clean, minimal borders */}
      <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-[840px]">
        {monthDays.map((day, index) => {
          const dateKey = getLocalDateKey(day);
          const dayAppointments = appointmentsByDay.get(dateKey) || [];
          const dayAbsences = getAbsencesForDay(day);
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const isCurrentDay = isToday(day);
          const hasAppointments = dayAppointments.length > 0;
          const hasAbsence = dayAbsences.length > 0;

          return (
            <div
              key={index}
              className={`group relative flex min-h-[140px] flex-col overflow-hidden p-2 transition-colors cursor-pointer
                         ${!isCurrentMonth ? 'bg-gray-50/30' : 'bg-white hover:bg-gray-50/50'}
                         ${hasAbsence ? 'bg-amber-50/30' : ''}`}
              style={{
                borderRight: (index + 1) % 7 !== 0 ? '1px solid rgba(0,0,0,0.04)' : undefined,
                borderBottom: index < 35 ? '1px solid rgba(0,0,0,0.04)' : undefined,
              }}
              onClick={() => onDateClick(day)}
            >
              {/* Date header */}
              <div className="mb-1 flex items-center justify-between">
                {/* Date number - gradient border ring for today */}
                <button
                  type="button"
                  onClick={() => onDateClick(day)}
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium
                             transition-all
                             ${!isCurrentMonth ? 'text-gray-300' : ''}
                             ${isCurrentDay
                               ? 'font-bold text-[#1A1F36]'
                               : isCurrentMonth
                                 ? 'text-[#1A1F36] hover:bg-gray-100'
                                 : ''
                             }`}
                  style={isCurrentDay ? {
                    border: '2px solid transparent',
                    backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                    backgroundOrigin: 'border-box',
                    backgroundClip: 'padding-box, border-box',
                  } : undefined}
                >
                  {day.getDate()}
                </button>
                {hasAppointments && (
                  <span className="rounded-full bg-[#1A1F36]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#1A1F36]">
                    {dayAppointments.length}
                  </span>
                )}
              </div>

              {/* Absence indicators with employee name and reason */}
              {hasAbsence && (
                <div className="mb-1 space-y-0.5">
                  {dayAbsences.slice(0, 2).map((absence) => (
                    <div
                      key={absence.id}
                      className="truncate rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium text-amber-700"
                      title={`${absence.employee_name || 'Vsi zaposleni'}${absence.reason ? ` - ${absence.reason}` : ''}`}
                    >
                      {absence.employee_name || 'Vsi'}{absence.reason ? `: ${absence.reason}` : ''}
                    </div>
                  ))}
                  {dayAbsences.length > 2 && (
                    <div className="text-[8px] text-amber-600 px-1">
                      +{dayAbsences.length - 2} odsotnosti
                    </div>
                  )}
                </div>
              )}

              {/* Appointments */}
              <div className="flex-1 space-y-0.5 overflow-hidden">
                {dayAppointments.slice(0, 3).map((apt) => (
                  <AppointmentCard
                    key={apt.id}
                    appointment={apt}
                    onClick={onAppointmentClick}
                    variant="mini"
                    services={services}
                  />
                ))}
                {dayAppointments.length > 3 && (
                  <button
                    type="button"
                    onClick={() => onDateClick(day)}
                    className="w-full rounded px-1.5 py-0.5 text-left text-[10px] font-medium
                               text-gray-500 transition-colors hover:bg-gray-100 hover:text-[#1A1F36]"
                  >
                    +{dayAppointments.length - 3} več
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(MonthView);
