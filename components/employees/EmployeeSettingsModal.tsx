'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslations } from 'next-intl';
import {
  X,
  Clock,
  CheckSquare,
  Square,
  FloppyDisk,
  SpinnerGap,
  CalendarBlank,
  Briefcase,
  ToggleRight,
  ToggleLeft,
  Plus,
  Trash,
} from '@phosphor-icons/react';
import type { Employee, EmployeeSchedule, EmployeeWorkingHours } from '@/types/employees';
import type { Service } from '@/types/services';
import { defaultWorkingHoursDay as defaultWorkingHours } from '@/types/settings';
import EmployeeAvatar from './EmployeeAvatar';

// Schedule with intervals support
interface TimeInterval {
  start: string;
  end: string;
}

interface DayScheduleWithIntervals {
  enabled: boolean;
  intervals: TimeInterval[];
}

type ScheduleWithIntervals = Record<string, DayScheduleWithIntervals>;

interface EmployeeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  companySchedule: Record<string, { enabled: boolean; start?: string; end?: string; intervals?: TimeInterval[] }>;
  allServices: Service[];
  onSave: (data: { urnik: EmployeeSchedule | ScheduleWithIntervals; storitve: string[]; aliImaUrnikPodjetja: boolean }) => Promise<void>;
  isSaving?: boolean;
}

// Day names in Slovenian
const DAYS = [
  'Ponedeljek',
  'Torek',
  'Sreda',
  'Četrtek',
  'Petek',
  'Sobota',
  'Nedelja',
];

// Time options for dropdowns
function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let hour = 6; hour <= 22; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = hour.toString().padStart(2, '0');
      const m = minute.toString().padStart(2, '0');
      options.push(`${h}:${m}`);
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

// Helper to convert simple schedule to intervals format
function toIntervalsFormat(schedule: EmployeeSchedule | ScheduleWithIntervals): ScheduleWithIntervals {
  const result: ScheduleWithIntervals = {};
  for (const day of DAYS) {
    const dayData = schedule[day];
    if (!dayData) {
      result[day] = { enabled: false, intervals: [{ start: '08:00', end: '17:00' }] };
    } else if ('intervals' in dayData && Array.isArray(dayData.intervals)) {
      result[day] = dayData as DayScheduleWithIntervals;
    } else {
      // Convert from simple format
      const simple = dayData as { enabled: boolean; start?: string; end?: string };
      result[day] = {
        enabled: simple.enabled ?? false,
        intervals: [{ start: simple.start ?? '08:00', end: simple.end ?? '17:00' }],
      };
    }
  }
  return result;
}

function EmployeeSettingsModal({
  isOpen,
  onClose,
  employee,
  companySchedule,
  allServices,
  onSave,
  isSaving = false,
}: EmployeeSettingsModalProps) {
  const t = useTranslations('staff');
  const tCommon = useTranslations('common');

  const dayLabel: Record<string, string> = {
    Ponedeljek: t('days.Ponedeljek'),
    Torek: t('days.Torek'),
    Sreda: t('days.Sreda'),
    Četrtek: t('days.Četrtek'),
    Petek: t('days.Petek'),
    Sobota: t('days.Sobota'),
    Nedelja: t('days.Nedelja'),
  };

  // Track if employee uses company schedule
  const [usesCompanySchedule, setUsesCompanySchedule] = useState<boolean>(() => {
    // Check employee.ali_ima_urnik_podjetja field (parsed from database)
    return employee?.ali_ima_urnik_podjetja ?? true;
  });

  // Initialize schedule with intervals support
  const [schedule, setSchedule] = useState<ScheduleWithIntervals>(() => {
    if (employee?.urnik) {
      return toIntervalsFormat(employee.urnik);
    }
    // Use company schedule as default
    const initial: ScheduleWithIntervals = {};
    for (const day of DAYS) {
      const companyDay = companySchedule[day] || defaultWorkingHours[day];
      const intervals = companyDay?.intervals || [{ start: companyDay?.start ?? '08:00', end: companyDay?.end ?? '17:00' }];
      initial[day] = {
        enabled: companyDay?.enabled ?? true,
        intervals: intervals,
      };
    }
    return initial;
  });

  // Initialize selected services (all if not set)
  const [selectedServices, setSelectedServices] = useState<string[]>(() => {
    if (employee?.storitve && employee.storitve.length > 0) {
      return employee.storitve;
    }
    // Default to all services
    return allServices.map((s) => s.id);
  });

  // Track which tab is active
  const [activeTab, setActiveTab] = useState<'schedule' | 'services'>('schedule');

  // Reset form when modal opens with new employee
  useEffect(() => {
    if (isOpen && employee) {
      // Check if uses company schedule from employee.ali_ima_urnik_podjetja
      setUsesCompanySchedule(employee.ali_ima_urnik_podjetja ?? true);

      // Set schedule with intervals
      if (employee.urnik) {
        setSchedule(toIntervalsFormat(employee.urnik));
      } else {
        const initial: ScheduleWithIntervals = {};
        for (const day of DAYS) {
          const companyDay = companySchedule[day] || defaultWorkingHours[day];
          const intervals = companyDay?.intervals || [{ start: companyDay?.start ?? '08:00', end: companyDay?.end ?? '17:00' }];
          initial[day] = {
            enabled: companyDay?.enabled ?? true,
            intervals: intervals,
          };
        }
        setSchedule(initial);
      }

      // Set services
      if (employee.storitve && employee.storitve.length > 0) {
        setSelectedServices(employee.storitve);
      } else {
        setSelectedServices(allServices.map((s) => s.id));
      }
    }
  }, [isOpen, employee, companySchedule, allServices]);

  // Toggle day enabled/disabled
  const toggleDay = useCallback((day: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day]?.enabled,
      },
    }));
  }, []);

  // Update interval time
  const updateIntervalTime = useCallback((day: string, intervalIndex: number, field: 'start' | 'end', value: string) => {
    setSchedule((prev) => {
      const dayData = prev[day];
      if (!dayData) return prev;
      const newIntervals = [...dayData.intervals];
      newIntervals[intervalIndex] = { ...newIntervals[intervalIndex], [field]: value };
      return {
        ...prev,
        [day]: { ...dayData, intervals: newIntervals },
      };
    });
  }, []);

  // Add interval to day
  const addInterval = useCallback((day: string) => {
    setSchedule((prev) => {
      const dayData = prev[day];
      if (!dayData) return prev;
      const lastInterval = dayData.intervals[dayData.intervals.length - 1];
      // Start new interval 1 hour after last interval ends
      const newStart = lastInterval?.end ?? '13:00';
      const newEnd = '17:00';
      return {
        ...prev,
        [day]: { ...dayData, intervals: [...dayData.intervals, { start: newStart, end: newEnd }] },
      };
    });
  }, []);

  // Remove interval from day
  const removeInterval = useCallback((day: string, intervalIndex: number) => {
    setSchedule((prev) => {
      const dayData = prev[day];
      if (!dayData || dayData.intervals.length <= 1) return prev; // Keep at least one interval
      const newIntervals = dayData.intervals.filter((_, idx) => idx !== intervalIndex);
      return {
        ...prev,
        [day]: { ...dayData, intervals: newIntervals },
      };
    });
  }, []);

  // Toggle service selection
  const toggleService = useCallback((serviceId: string) => {
    setSelectedServices((prev) => {
      if (prev.includes(serviceId)) {
        return prev.filter((id) => id !== serviceId);
      }
      return [...prev, serviceId];
    });
  }, []);

  // Select all services
  const selectAllServices = useCallback(() => {
    setSelectedServices(allServices.map((s) => s.id));
  }, [allServices]);

  // Deselect all services
  const deselectAllServices = useCallback(() => {
    setSelectedServices([]);
  }, []);

  // Handle save
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      urnik: usesCompanySchedule ? {} : schedule,
      storitve: selectedServices,
      aliImaUrnikPodjetja: usesCompanySchedule,
    });
  }, [schedule, selectedServices, usesCompanySchedule, onSave]);

  // Animation variants
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
    },
    exit: { opacity: 0, scale: 0.95, y: 20 },
  };

  if (!employee) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gradient header */}
            <div className="bg-gradient-to-r from-violet-500 to-cyan-500 p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <EmployeeAvatar
                    firstName={employee.ime}
                    lastName={employee.priimek}
                    gradient={employee.barva}
                    size="lg"
                  />
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      {t('settings.title')}
                    </h2>
                    <p className="mt-1 text-sm text-white/80">
                      {employee.ime} {employee.priimek}
                    </p>
                  </div>
                </div>
                <motion.button
                  type="button"
                  onClick={onClose}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                >
                  <X className="h-5 w-5" weight="bold" />
                </motion.button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                type="button"
                onClick={() => setActiveTab('schedule')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors
                           ${activeTab === 'schedule'
                             ? 'border-b-2 border-violet-500 text-violet-600 bg-violet-50/50'
                             : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                           }`}
              >
                <CalendarBlank className="h-4 w-4" weight={activeTab === 'schedule' ? 'fill' : 'regular'} />
                {t('settings.tabSchedule')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('services')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors
                           ${activeTab === 'services'
                             ? 'border-b-2 border-violet-500 text-violet-600 bg-violet-50/50'
                             : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                           }`}
              >
                <Briefcase className="h-4 w-4" weight={activeTab === 'services' ? 'fill' : 'regular'} />
                {t('settings.tabServices')} ({selectedServices.length}/{allServices.length})
              </button>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="max-h-[calc(90vh-280px)] overflow-y-auto p-6">
              {activeTab === 'schedule' && (
                <div className="space-y-4">
                  {/* Use company schedule toggle - CRITICAL */}
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-cyan-50 rounded-xl border border-violet-100">
                    <div>
                      <div className="font-semibold text-[#1A1F36]">{t('settings.companyScheduleTitle')}</div>
                      <div className="text-sm text-gray-500">
                        {t('settings.companyScheduleSubtitle')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (usesCompanySchedule) {
                          // Switching from company → custom: pre-fill with company schedule
                          const prefilled: ScheduleWithIntervals = {};
                          for (const day of DAYS) {
                            const companyDay = companySchedule[day] || defaultWorkingHours[day];
                            const intervals = companyDay?.intervals || [{ start: companyDay?.start ?? '08:00', end: companyDay?.end ?? '17:00' }];
                            prefilled[day] = {
                              enabled: companyDay?.enabled ?? true,
                              intervals,
                            };
                          }
                          setSchedule(prefilled);
                        }
                        setUsesCompanySchedule(!usesCompanySchedule);
                      }}
                      className="flex items-center gap-2"
                    >
                      {usesCompanySchedule ? (
                        <ToggleRight className="h-8 w-8 text-violet-500" weight="fill" />
                      ) : (
                        <ToggleLeft className="h-8 w-8 text-gray-400" weight="regular" />
                      )}
                    </button>
                  </div>

                  {/* Custom schedule - Only shown if NOT using company schedule */}
                  {!usesCompanySchedule && (
                    <>
                      <div className="p-4 border-2 border-orange-200 rounded-xl bg-orange-50/30">
                        <div className="flex items-center gap-2 mb-3">
                          <Clock className="h-5 w-5 text-orange-600" weight="fill" />
                          <h3 className="text-base font-semibold text-orange-900">{t('settings.customScheduleTitle')}</h3>
                        </div>
                        <p className="text-sm text-orange-700 mb-4">
                          {t('settings.customScheduleDesc')}
                        </p>

                        <div className="space-y-3">
                          {DAYS.map((day) => {
                            const daySchedule = schedule[day] || { enabled: true, intervals: [{ start: '08:00', end: '17:00' }] };
                            return (
                              <div
                                key={day}
                                className={`p-4 rounded-xl border transition-colors bg-white
                                           ${daySchedule.enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}
                              >
                                {/* Day header with toggle */}
                                <div className="flex items-center justify-between mb-3">
                                  <button
                                    type="button"
                                    onClick={() => toggleDay(day)}
                                    className="flex items-center gap-3"
                                  >
                                    {daySchedule.enabled ? (
                                      <CheckSquare className="h-5 w-5 text-violet-500" weight="fill" />
                                    ) : (
                                      <Square className="h-5 w-5 text-gray-400" weight="regular" />
                                    )}
                                    <span className={`font-semibold ${daySchedule.enabled ? 'text-[#1A1F36]' : 'text-gray-400'}`}>
                                      {dayLabel[day]}
                                    </span>
                                  </button>
                                  {!daySchedule.enabled && (
                                    <span className="text-xs text-gray-400 italic">{t('settings.dayOff')}</span>
                                  )}
                                </div>

                                {/* Intervals */}
                                {daySchedule.enabled && (
                                  <div className="space-y-2">
                                    {daySchedule.intervals.map((interval, idx) => (
                                      <div key={idx} className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-violet-500 flex-shrink-0" weight="fill" />
                                        <select
                                          value={interval.start}
                                          onChange={(e) => updateIntervalTime(day, idx, 'start', e.target.value)}
                                          className="appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-sm font-medium text-[#1A1F36]
                                                   shadow-sm transition-all cursor-pointer hover:border-violet-300
                                                   focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/10"
                                        >
                                          {TIME_OPTIONS.map((time) => (
                                            <option key={time} value={time}>{time}</option>
                                          ))}
                                        </select>
                                        <span className="text-gray-400 text-sm">-</span>
                                        <select
                                          value={interval.end}
                                          onChange={(e) => updateIntervalTime(day, idx, 'end', e.target.value)}
                                          className="appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-sm font-medium text-[#1A1F36]
                                                   shadow-sm transition-all cursor-pointer hover:border-violet-300
                                                   focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/10"
                                        >
                                          {TIME_OPTIONS.map((time) => (
                                            <option key={time} value={time}>{time}</option>
                                          ))}
                                        </select>
                                        {daySchedule.intervals.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => removeInterval(day, idx)}
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                          >
                                            <Trash className="h-4 w-4" weight="regular" />
                                          </button>
                                        )}
                                      </div>
                                    ))}

                                    {/* Add interval button */}
                                    <button
                                      type="button"
                                      onClick={() => addInterval(day)}
                                      className="flex items-center gap-1.5 w-full justify-center py-2 rounded-lg border border-dashed border-violet-300
                                               text-sm font-medium text-violet-600 hover:bg-violet-50 transition-colors mt-2"
                                    >
                                      <Plus className="h-4 w-4" weight="bold" />
                                      {t('settings.addInterval')}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {usesCompanySchedule && (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                      <p className="text-sm text-gray-500 mb-2">
                        {t('settings.usingCompanySchedule')}
                      </p>
                      {DAYS.map((day) => {
                        const companyDay = companySchedule[day];
                        if (!companyDay) return null;
                        const intervals: TimeInterval[] = companyDay.intervals || [{ start: companyDay.start ?? '08:00', end: companyDay.end ?? '17:00' }];
                        return (
                          <div key={day} className={`flex items-start gap-3 text-sm ${companyDay.enabled ? 'text-[#1A1F36]' : 'text-gray-400'}`}>
                            <span className="w-24 font-medium flex-shrink-0">{dayLabel[day]}</span>
                            {companyDay.enabled ? (
                              <span className="text-gray-600">
                                {intervals.map((iv, i) => (
                                  <span key={i}>{i > 0 ? ', ' : ''}{iv.start}–{iv.end}</span>
                                ))}
                              </span>
                            ) : (
                              <span className="italic">{t('settings.dayOff')}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'services' && (
                <div className="space-y-4">
                  {/* Performs all services toggle */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <div className="font-semibold text-[#1A1F36]">{t('settings.allServicesTitle')}</div>
                      <div className="text-sm text-gray-500">
                        {t('settings.allServicesSubtitle')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedServices.length === allServices.length) {
                          deselectAllServices();
                        } else {
                          selectAllServices();
                        }
                      }}
                      className="flex items-center gap-2"
                    >
                      {selectedServices.length === allServices.length ? (
                        <ToggleRight className="h-8 w-8 text-violet-500" weight="fill" />
                      ) : (
                        <ToggleLeft className="h-8 w-8 text-gray-400" weight="regular" />
                      )}
                    </button>
                  </div>

                  {selectedServices.length !== allServices.length && (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                          {t('settings.selectServicesHint')}
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={selectAllServices}
                            className="text-xs font-medium text-violet-600 hover:text-violet-700"
                          >
                            {t('settings.selectAll')}
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            type="button"
                            onClick={deselectAllServices}
                            className="text-xs font-medium text-gray-500 hover:text-gray-700"
                          >
                            {t('settings.clearAll')}
                          </button>
                        </div>
                      </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {allServices.map((service) => {
                      const isSelected = selectedServices.includes(service.id);
                      return (
                        <motion.button
                          key={service.id}
                          type="button"
                          onClick={() => toggleService(service.id)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left
                                     ${isSelected
                                       ? 'bg-violet-50 border-violet-200 ring-1 ring-violet-200'
                                       : 'bg-white border-gray-200 hover:border-gray-300'
                                     }`}
                        >
                          {/* Color indicator */}
                          <div
                            className="h-4 w-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: service.barva || '#6366F1' }}
                          />

                          {/* Service info */}
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium truncate ${isSelected ? 'text-violet-700' : 'text-[#1A1F36]'}`}>
                              {service.naziv}
                            </p>
                            <p className="text-xs text-gray-500">
                              {service.trajanje} min
                              {service.cena && ` • ${service.cena} EUR`}
                            </p>
                          </div>

                          {/* Checkbox */}
                          {isSelected ? (
                            <CheckSquare className="h-5 w-5 text-violet-500 flex-shrink-0" weight="fill" />
                          ) : (
                            <Square className="h-5 w-5 text-gray-300 flex-shrink-0" weight="regular" />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>

                      {allServices.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <Briefcase className="h-12 w-12 mx-auto mb-3 text-gray-300" weight="duotone" />
                          <p>{t('settings.noServices')}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </form>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
              <motion.button
                type="button"
                onClick={onClose}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="rounded-xl px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
              >
                {tCommon('buttons.cancel')}
              </motion.button>
              <motion.button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                whileHover={{ scale: isSaving ? 1 : 1.02 }}
                whileTap={{ scale: isSaving ? 1 : 0.98 }}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-2.5
                           text-sm font-medium text-white shadow-lg shadow-cyan-500/25 transition-all
                           hover:shadow-xl hover:shadow-cyan-500/30 disabled:opacity-70"
              >
                {isSaving ? (
                  <>
                    <SpinnerGap className="h-4 w-4 animate-spin" />
                    {t('settings.saving')}
                  </>
                ) : (
                  <>
                    <FloppyDisk className="h-4 w-4" weight="bold" />
                    {t('settings.save')}
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(EmployeeSettingsModal);
