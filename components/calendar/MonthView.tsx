'use client';

import { memo, useMemo, useRef, useEffect } from 'react';
import type { AppointmentWithDetails, Storitev } from '@/types/appointments';
import type { Absence } from '@/lib/supabase/appointments';
import type { CalendarEvent } from '@/types/events';
import AppointmentCard from './AppointmentCard';
import EventCard from './EventCard';
import {
  getMonthGrid,
  isSameDay,
  isToday,
  startOfMonth,
  getLocalDateKey,
  getDaysAbbr,
} from '@/lib/utils/calendar';
import { useTranslations, useLocale } from 'next-intl';

interface MonthViewProps {
  currentDate: Date;
  appointments: AppointmentWithDetails[];
  absences?: Absence[];
  events?: CalendarEvent[];
  services?: Storitev[];
  onAppointmentClick: (appointment: AppointmentWithDetails) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onAbsenceClick?: (absence: Absence) => void;
  onDateClick: (date: Date) => void;
  isMobile?: boolean;
  appointmentsWithResursi?: Set<number>;
}

function MonthView({ currentDate, appointments, absences = [], events = [], services = [], onAppointmentClick, onEventClick, onAbsenceClick, onDateClick, isMobile = false, appointmentsWithResursi }: MonthViewProps) {
  const t = useTranslations('appointments');
  const locale = useLocale();
  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const monthDays = useMemo(() => getMonthGrid(currentDate), [currentDate]);
  const todayRef = useRef<HTMLDivElement>(null);

  // Scroll to today's date when the view mounts or month changes
  useEffect(() => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
  }, [currentDate]);

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

  // Days header (Monday first)
  const daysHeader = [1, 2, 3, 4, 5, 6, 0].map((i) => getDaysAbbr(locale)[i]);

  return (
    <div className="flex h-full flex-col bg-white overflow-auto">
      {/* Days header - Apple Calendar style */}
      <div className="grid grid-cols-7">
        {daysHeader.map((day, index) => (
          <div
            key={index}
            className="flex h-9 items-center justify-center"
          >
            <span className="text-[10px] font-normal uppercase tracking-wider text-gray-400">
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
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const isCurrentDay = isToday(day);
          const hasAppointments = dayAppointments.length > 0;
          const hasAbsence = dayAbsences.length > 0;
          const hasEvents = dayEvents.length > 0;

          return (
            <div
              key={index}
              ref={isCurrentDay ? todayRef : undefined}
              className={`group relative flex min-h-[140px] flex-col overflow-hidden p-2 transition-colors cursor-pointer
                         ${!isCurrentMonth ? 'bg-gray-50/30' : 'bg-white hover:bg-gray-50/50'}`}
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
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs transition-all
                             ${isCurrentDay ? 'font-normal' : 'font-normal'}
                             ${!isCurrentMonth ? 'text-gray-300' : ''}
                             ${!isCurrentDay && isCurrentMonth ? 'text-[#1A1F36] hover:bg-gray-100' : ''}`}
                  style={isCurrentDay ? {
                    background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
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

              {/* Event cards — rendered above absences and appointments */}
              {hasEvents && (
                <div className="mb-1 space-y-0.5">
                  {dayEvents.slice(0, 2).map((ev) => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      onClick={onEventClick ?? (() => {})}
                      variant="mini"
                    />
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-[8px] text-[#1A1F36] opacity-60 px-1">
                      {t('calendarView.monthView.moreEvents', { count: dayEvents.length - 2 })}
                    </div>
                  )}
                </div>
              )}

              {/* Absence indicators - yellow box with gradient text */}
              {hasAbsence && (
                <div className="mb-1 space-y-0.5">
                  {dayAbsences.slice(0, 2).map((absence) => (
                    <button
                      key={absence.id}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onAbsenceClick?.(absence); }}
                      className="flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 truncate w-full text-left hover:bg-amber-100 transition-colors"
                      title={`${absence.employee_name || t('calendarView.allEmployees')}${absence.reason ? ` - ${absence.reason}` : ''}`}
                    >
                      <span
                        className="text-[9px] font-semibold truncate"
                        style={absence.employee_color ? {
                          background: absence.employee_color,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                        } : { color: '#92400E' }}
                      >
                        {absence.employee_name || t('calendarView.allEmployees')}
                      </span>
                      {absence.reason && (
                        <span className="text-[8px] text-amber-700 truncate">{absence.reason}</span>
                      )}
                    </button>
                  ))}
                  {dayAbsences.length > 2 && (
                    <div className="text-[8px] text-amber-600 opacity-80 px-1">
                      {t('calendarView.monthView.moreAbsences', { count: dayAbsences.length - 2 })}
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
                    timeOnly={isMobile}
                    hasResursi={appointmentsWithResursi?.has(Number(apt.id))}
                  />
                ))}
                {dayAppointments.length > 3 && (
                  <button
                    type="button"
                    onClick={() => onDateClick(day)}
                    className="w-full rounded px-1.5 py-0.5 text-left text-[10px] font-medium
                               text-gray-500 transition-colors hover:bg-gray-100 hover:text-[#1A1F36]"
                  >
                    {t('calendarView.monthView.more', { count: dayAppointments.length - 3 })}
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
