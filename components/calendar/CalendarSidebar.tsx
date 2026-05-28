'use client';

import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MagnifyingGlass,
  Plus,
  CaretLeft,
  CaretRight,
  ProhibitInset,
  Check,
  Calendar,
  Star,
} from '@phosphor-icons/react';
import type { Storitev, Zaposleni } from '@/types/appointments';
import type { ViewMode } from '@/lib/utils/calendar';
import { useTranslations } from 'next-intl';
import {
  getMonthGrid,
  isToday,
  isSameDay,
  startOfMonth,
  MONTHS_FULL,
  DAYS_ABBR,
  addMonths,
  getLocalDateKey,
} from '@/lib/utils/calendar';

interface CalendarSidebarProps {
  currentDate: Date;
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  onTodayClick: () => void;
  onNewAppointment: () => void;
  onNewEvent?: () => void;
  onAbsence?: () => void;
  services: Storitev[];
  employees: (Zaposleni & { initials: string })[];
  selectedEmployeeId: string | null;
  onEmployeeFilterChange: (employeeId: string | null) => void;
  selectedServiceId: string | null;
  onServiceFilterChange: (serviceId: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  isOpen: boolean;
  onToggle: () => void;
  showAllDays: boolean;
  onShowAllDaysChange: (showAll: boolean) => void;
  appointmentDates?: Set<string>; // YYYY-MM-DD keys of future dates with appointments
  restrictedToEmployeeId?: string | null; // When set, employee filter is locked to this employee only
}

function CalendarSidebar({
  currentDate,
  selectedDate,
  onDateSelect,
  onTodayClick,
  onNewAppointment,
  onNewEvent,
  onAbsence,
  services,
  employees,
  selectedEmployeeId,
  onEmployeeFilterChange,
  selectedServiceId,
  onServiceFilterChange,
  searchQuery,
  onSearchChange,
  isOpen,
  onToggle,
  showAllDays,
  onShowAllDaysChange,
  appointmentDates,
  restrictedToEmployeeId,
}: CalendarSidebarProps) {
  const t = useTranslations('appointments');

  // Mini calendar state - always shows current selected month
  const miniCalendarDate = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const miniCalendarDays = useMemo(() => getMonthGrid(miniCalendarDate), [miniCalendarDate]);

  // Days header (Monday first)
  const daysHeader = [1, 2, 3, 4, 5, 6, 0].map((i) => DAYS_ABBR[i]);

  // Check if any filters are active
  const hasActiveFilters = selectedEmployeeId || selectedServiceId || searchQuery.trim();

  return (
    <>
      {/* Sidebar overlay - slides in/out from right */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
              className="fixed inset-0 bg-black/20 z-40"
              onClick={onToggle}
            />

            {/* Sidebar Panel */}
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl z-50 overflow-y-auto"
            >
              <div className="p-5 space-y-5">
              {/* Action buttons */}
              <div className="space-y-3">
                {/* New appointment button */}
                <motion.button
                  type="button"
                  onClick={onNewAppointment}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500
                             px-4 py-3 text-sm font-medium text-white shadow-lg shadow-cyan-500/25
                             transition-shadow hover:shadow-xl hover:shadow-cyan-500/30"
                >
                  <Plus className="h-4 w-4" weight="bold" />
                  {t('page.newAppointment')}
                </motion.button>

                {/* Dogodek button */}
                <motion.button
                  type="button"
                  onClick={onNewEvent}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1A1F36] px-4 py-2.5
                             text-sm font-medium text-white shadow-md transition-all hover:bg-[#2D3350]"
                >
                  <Star className="h-4 w-4" weight="regular" />
                  {t('calendarView.sidebar.newEvent')}
                </motion.button>

                {/* Absence button */}
                {onAbsence && (
                  <motion.button
                    type="button"
                    onClick={onAbsence}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2.5
                               text-sm font-medium text-white shadow-md shadow-orange-500/25 transition-all
                               hover:shadow-lg hover:shadow-orange-500/30"
                  >
                    <ProhibitInset className="h-4 w-4" weight="bold" />
                    {t('calendarView.sidebar.newAbsence')}
                  </motion.button>
                )}
              </div>

              {/* Mini calendar */}
              <div className="rounded-xl bg-gray-50 p-4">
                {/* Month header */}
                <div className="mb-3 flex items-center justify-between">
                  <motion.button
                    type="button"
                    onClick={() => onDateSelect(addMonths(currentDate, -1))}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-200"
                    aria-label={t('calendarView.sidebar.prevMonth')}
                  >
                    <CaretLeft className="h-4 w-4" weight="bold" />
                  </motion.button>
                  <span className="text-sm font-semibold text-gray-900">
                    {MONTHS_FULL[miniCalendarDate.getMonth()]} {miniCalendarDate.getFullYear()}
                  </span>
                  <motion.button
                    type="button"
                    onClick={() => onDateSelect(addMonths(currentDate, 1))}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-200"
                    aria-label={t('calendarView.sidebar.nextMonth')}
                  >
                    <CaretRight className="h-4 w-4" weight="bold" />
                  </motion.button>
                </div>

                {/* Days header */}
                <div className="mb-1.5 grid grid-cols-7 gap-0.5">
                  {daysHeader.map((day, index) => (
                    <div key={index} className="text-center text-[10px] font-medium uppercase text-gray-400">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-0.5">
                  {miniCalendarDays.map((day, index) => {
                    const isCurrentMonth = day.getMonth() === miniCalendarDate.getMonth();
                    const isCurrentDay = isToday(day);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);

                    // Show purple dot for future dates (after today) that have appointments
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const dayNorm = new Date(day);
                    dayNorm.setHours(0, 0, 0, 0);
                    const isFuture = dayNorm > today;
                    const hasAppointments = isFuture && appointmentDates?.has(getLocalDateKey(day));

                    return (
                      <div key={index} className="flex flex-col items-center">
                        <motion.button
                          type="button"
                          onClick={() => onDateSelect(day)}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs transition-all
                                     ${isCurrentDay ? 'font-bold' : isSelected ? 'font-semibold' : 'font-medium'}
                                     ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700 hover:bg-gray-200'}
                                     ${isSelected && !isCurrentDay ? 'bg-gray-200' : ''}`}
                          style={isCurrentDay ? {
                            background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                          } : undefined}
                        >
                          {day.getDate()}
                        </motion.button>
                        {/* Purple dot for future days with appointments */}
                        <div className="h-1 flex items-center justify-center">
                          {hasAppointments && (
                            <div className="w-1 h-1 rounded-full bg-violet-500" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <MagnifyingGlass
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  weight="regular"
                />
                <input
                  type="text"
                  placeholder={t('calendarView.sidebar.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900
                             placeholder-gray-400 transition-all focus:border-violet-400 focus:outline-none"
                />
              </div>

              {/* Filters section */}
              <div>
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">
                  {t('calendarView.sidebar.filters')}
                </h3>

                {/* Days filter */}
                <div className="mb-4">
                  <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {t('calendarView.sidebar.displayDays')}
                  </div>
                  <motion.button
                    type="button"
                    onClick={() => onShowAllDaysChange(!showAllDays)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 transition-all text-left
                               ${showAllDays
                                 ? 'border-violet-500 bg-violet-50'
                                 : 'border-blue-500 bg-blue-50'
                               }`}
                  >
                    <Calendar className="w-5 h-5 flex-shrink-0" weight="bold" style={{
                      backgroundImage: showAllDays
                        ? 'linear-gradient(90deg, #8B5CF6 0%, #06B6D4 100%)'
                        : 'linear-gradient(90deg, #3B82F6 0%, #06B6D4 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }} />
                    <span className="flex-1 text-sm font-medium text-gray-900">
                      {showAllDays ? t('calendarView.sidebar.showAllDays') : t('calendarView.sidebar.weekdaysOnly')}
                    </span>
                    <Check className={`w-4 h-4 flex-shrink-0 ${showAllDays ? 'text-violet-600' : 'text-blue-600'}`} weight="bold" />
                  </motion.button>
                </div>

                {/* Employees filter */}
                <div className="mb-4">
                  <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {t('calendarView.sidebar.employeesSection')}
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {restrictedToEmployeeId ? (
                      // Staff with can_view_all_appointments=false: show only their own employee entry
                      (() => {
                        const emp = employees.find(e => e.id === restrictedToEmployeeId);
                        if (!emp) return null;
                        return (
                          <div
                            className="w-full flex items-center gap-3 p-2.5 rounded-xl border-2 border-violet-500 bg-violet-50 text-left"
                          >
                            <div
                              className="w-7 h-7 flex items-center justify-center text-sm font-bold flex-shrink-0"
                              style={{
                                backgroundImage: emp.barva || 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                              }}
                            >
                              {emp.initials}
                            </div>
                            <span className="flex-1 text-sm font-medium truncate text-gray-900">
                              {emp.ime} {emp.priimek}
                            </span>
                            <Check className="w-4 h-4 text-violet-600 flex-shrink-0" weight="bold" />
                          </div>
                        );
                      })()
                    ) : (
                      <>
                        {/* All employees option */}
                        <button
                          type="button"
                          onClick={() => onEmployeeFilterChange(null)}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 transition-all text-left
                                     ${!selectedEmployeeId
                                       ? 'border-violet-500 bg-violet-50'
                                       : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                     }`}
                        >
                          <span className={`flex-1 text-sm font-medium ${!selectedEmployeeId ? 'text-gray-900' : 'text-gray-700'}`}>
                            {t('filters.allEmployees')}
                          </span>
                          {!selectedEmployeeId && (
                            <Check className="w-4 h-4 text-violet-600 flex-shrink-0" weight="bold" />
                          )}
                        </button>
                        {employees.map((employee, idx) => {
                          const isSelected = selectedEmployeeId === employee.id;
                          return (
                            <button
                              key={`emp-${idx}-${employee.id}`}
                              type="button"
                              onClick={() => onEmployeeFilterChange(employee.id)}
                              className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 transition-all text-left
                                         ${isSelected
                                           ? 'border-violet-500 bg-violet-50'
                                           : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                         }`}
                            >
                              <div
                                className="w-7 h-7 flex items-center justify-center text-sm font-bold flex-shrink-0"
                                style={{
                                  backgroundImage: employee.barva || 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                                  WebkitBackgroundClip: 'text',
                                  WebkitTextFillColor: 'transparent',
                                }}
                              >
                                {employee.initials}
                              </div>
                              <span className={`flex-1 text-sm font-medium truncate ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                                {employee.ime} {employee.priimek}
                              </span>
                              {isSelected && (
                                <Check className="w-4 h-4 text-violet-600 flex-shrink-0" weight="bold" />
                              )}
                            </button>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>

                {/* Services filter */}
                <div>
                  <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {t('calendarView.sidebar.servicesSection')}
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {/* All services option */}
                    <button
                      type="button"
                      onClick={() => onServiceFilterChange(null)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 transition-all text-left
                                 ${!selectedServiceId
                                   ? 'border-violet-500 bg-violet-50'
                                   : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                 }`}
                    >
                      <span className={`flex-1 text-sm font-medium ${!selectedServiceId ? 'text-gray-900' : 'text-gray-700'}`}>
                        {t('filters.allServices')}
                      </span>
                      {!selectedServiceId && (
                        <Check className="w-4 h-4 text-violet-600 flex-shrink-0" weight="bold" />
                      )}
                    </button>
                    {services.map((service, idx) => {
                      const isSelected = selectedServiceId === service.id;
                      const colorStyle = service.barva?.includes('gradient')
                        ? { background: service.barva }
                        : { background: service.barva || '#6366F1' };

                      return (
                        <button
                          key={`svc-${idx}-${service.id}`}
                          type="button"
                          onClick={() => onServiceFilterChange(service.id)}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 transition-all text-left
                                     ${isSelected
                                       ? 'border-violet-500 bg-violet-50'
                                       : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                     }`}
                        >
                          {/* Service color indicator */}
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                            style={colorStyle}
                          />
                          <span className={`flex-1 text-sm font-medium truncate ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                            {service.naziv}
                          </span>
                          {isSelected && (
                            <Check className="w-4 h-4 text-violet-600 flex-shrink-0" weight="bold" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Service legend */}
              <div>
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">
                  {t('calendarView.sidebar.legend')}
                </h3>
                <div className="space-y-2">
                  {services.map((service, idx) => {
                    const colorStyle = service.barva?.includes('gradient')
                      ? { background: service.barva }
                      : { background: service.barva || '#6366F1' };

                    const displayDuration = service.trajanje && !isNaN(service.trajanje) && service.trajanje > 0
                      ? `${service.trajanje} min`
                      : null;

                    return (
                      <div
                        key={`svc-leg-${idx}-${service.id}`}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div
                          className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-sm"
                          style={colorStyle}
                        />
                        <span className="text-sm text-gray-700 font-medium flex-1 truncate">
                          {service.naziv}
                        </span>
                        {displayDuration && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            {displayDuration}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {services.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">{t('calendarView.sidebar.noServices')}</p>
                  )}
                </div>
              </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default memo(CalendarSidebar);
