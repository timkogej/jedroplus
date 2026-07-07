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
import type { IzmenicenUrnik, UrnikData } from '@/types/resursi';
import { isIzmenicenUrnik } from '@/types/resursi';
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

const WEEK_LABELS = ['Teden A', 'Teden B', 'Teden C', 'Teden D'];

function nearestUpcomingMonday(): string {
  const today = new Date();
  const day = today.getDay();
  const daysUntilMonday = day === 1 ? 0 : (8 - day) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysUntilMonday);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function defaultVzorec(): ScheduleWithIntervals {
  const result: ScheduleWithIntervals = {};
  for (const day of DAYS) {
    result[day] = { enabled: false, intervals: [{ start: '08:00', end: '17:00' }] };
  }
  return result;
}

function urnikDataToSchedule(urnikData: UrnikData): ScheduleWithIntervals {
  const result: ScheduleWithIntervals = {};
  for (const day of DAYS) {
    const d = urnikData[day as keyof UrnikData];
    result[day] = d
      ? { enabled: d.enabled, intervals: d.intervals.length ? d.intervals : [{ start: '08:00', end: '17:00' }] }
      : { enabled: false, intervals: [{ start: '08:00', end: '17:00' }] };
  }
  return result;
}

function toUrnikData(schedule: ScheduleWithIntervals): UrnikData {
  const result = {} as UrnikData;
  for (const day of DAYS) {
    const d = schedule[day] || { enabled: false, intervals: [] };
    result[day as keyof UrnikData] = { enabled: d.enabled, intervals: d.intervals };
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

  // Rotating schedule state
  const [isIzmenicen, setIsIzmenicen] = useState<boolean>(() => {
    return isIzmenicenUrnik(employee?.urnik);
  });
  const [cikelTednov, setCikelTednov] = useState<2 | 3 | 4>(() => {
    const u = employee?.urnik;
    if (isIzmenicenUrnik(u)) return u.cikel_tednov as 2 | 3 | 4;
    return 2;
  });
  const [zacetekCikla, setZacetekCikla] = useState<string>(() => {
    const u = employee?.urnik;
    if (isIzmenicenUrnik(u)) return u.zacetek_cikla;
    return nearestUpcomingMonday();
  });
  const [vzorci, setVzorci] = useState<Record<string, ScheduleWithIntervals>>(() => {
    const u = employee?.urnik;
    if (isIzmenicenUrnik(u)) {
      return Object.fromEntries(
        Object.entries(u.vzorci).map(([k, v]) => [k, urnikDataToSchedule(v)])
      );
    }
    return { '0': defaultVzorec(), '1': defaultVzorec() };
  });

  // Reset form when modal opens with new employee
  useEffect(() => {
    if (isOpen && employee) {
      setUsesCompanySchedule(employee.ali_ima_urnik_podjetja ?? true);

      const rawUrnik = employee.urnik as unknown;

      if (isIzmenicenUrnik(rawUrnik)) {
        setIsIzmenicen(true);
        setCikelTednov(rawUrnik.cikel_tednov as 2 | 3 | 4);
        setZacetekCikla(rawUrnik.zacetek_cikla);
        setVzorci(
          Object.fromEntries(
            Object.entries(rawUrnik.vzorci).map(([k, v]) => [k, urnikDataToSchedule(v)])
          )
        );
        // Still set standard schedule from the first pattern for display
        setSchedule(urnikDataToSchedule(rawUrnik.vzorci['0'] ?? {} as UrnikData));
      } else {
        setIsIzmenicen(false);
        setCikelTednov(2);
        setZacetekCikla(nearestUpcomingMonday());
        setVzorci({ '0': defaultVzorec(), '1': defaultVzorec() });

        if (employee.urnik) {
          setSchedule(toIntervalsFormat(employee.urnik));
        } else {
          const initial: ScheduleWithIntervals = {};
          for (const day of DAYS) {
            const companyDay = companySchedule[day] || defaultWorkingHours[day];
            const intervals = companyDay?.intervals || [{ start: companyDay?.start ?? '08:00', end: companyDay?.end ?? '17:00' }];
            initial[day] = { enabled: companyDay?.enabled ?? true, intervals };
          }
          setSchedule(initial);
        }
      }

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

  // Handle cikel_tednov change — ensure all week slots exist
  const handleCikelTednovChange = useCallback((val: 2 | 3 | 4) => {
    setCikelTednov(val);
    setVzorci((prev) => {
      const next = { ...prev };
      for (let i = 0; i < val; i++) {
        if (!next[String(i)]) next[String(i)] = defaultVzorec();
      }
      return next;
    });
  }, []);

  // Vzorci callbacks (rotating schedule)
  const toggleVzorciDay = useCallback((weekKey: string, day: string) => {
    setVzorci((prev) => {
      console.log('[toggleVzorciDay] weekKey:', weekKey, 'day:', day);
      console.log('[toggleVzorciDay] prev state:', JSON.stringify(prev));
      const week = prev[weekKey] ?? defaultVzorec();
      const next = {
        ...prev,
        [weekKey]: { ...week, [day]: { ...week[day], enabled: !week[day]?.enabled } },
      };
      console.log('[toggleVzorciDay] next[weekKey][day]:', JSON.stringify(next[weekKey]?.[day]));
      return next;
    });
  }, []);

  const updateVzorciIntervalTime = useCallback((weekKey: string, day: string, idx: number, field: 'start' | 'end', value: string) => {
    setVzorci((prev) => {
      const week = prev[weekKey] ?? defaultVzorec();
      const dayData = week[day];
      if (!dayData) return prev;
      const newIntervals = [...dayData.intervals];
      newIntervals[idx] = { ...newIntervals[idx], [field]: value };
      return { ...prev, [weekKey]: { ...week, [day]: { ...dayData, intervals: newIntervals } } };
    });
  }, []);

  const addVzorciInterval = useCallback((weekKey: string, day: string) => {
    setVzorci((prev) => {
      const week = prev[weekKey] ?? defaultVzorec();
      const dayData = week[day];
      if (!dayData) return prev;
      const last = dayData.intervals[dayData.intervals.length - 1];
      return {
        ...prev,
        [weekKey]: {
          ...week,
          [day]: { ...dayData, intervals: [...dayData.intervals, { start: last?.end ?? '13:00', end: '17:00' }] },
        },
      };
    });
  }, []);

  const removeVzorciInterval = useCallback((weekKey: string, day: string, idx: number) => {
    setVzorci((prev) => {
      const week = prev[weekKey] ?? defaultVzorec();
      const dayData = week[day];
      if (!dayData || dayData.intervals.length <= 1) return prev;
      return {
        ...prev,
        [weekKey]: {
          ...week,
          [day]: { ...dayData, intervals: dayData.intervals.filter((_, i) => i !== idx) },
        },
      };
    });
  }, []);

  const copyFromTedanA = useCallback((weekKey: string) => {
    setVzorci((prev) => ({ ...prev, [weekKey]: { ...prev['0'] } }));
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

    let urnikToSave: EmployeeSchedule | ScheduleWithIntervals | IzmenicenUrnik = usesCompanySchedule ? {} : schedule;

    if (!usesCompanySchedule && isIzmenicen) {
      const vzorciUrnikData: Record<string, UrnikData> = {};
      for (let i = 0; i < cikelTednov; i++) {
        vzorciUrnikData[String(i)] = toUrnikData(vzorci[String(i)] ?? defaultVzorec());
      }
      urnikToSave = {
        tip: 'izmenicen',
        cikel_tednov: cikelTednov,
        zacetek_cikla: zacetekCikla,
        vzorci: vzorciUrnikData,
      } satisfies IzmenicenUrnik;
    }

    await onSave({
      urnik: urnikToSave as ScheduleWithIntervals,
      storitve: selectedServices,
      aliImaUrnikPodjetja: usesCompanySchedule && !isIzmenicen,
    });
  }, [schedule, selectedServices, usesCompanySchedule, isIzmenicen, cikelTednov, zacetekCikla, vzorci, onSave]);

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

  const employeeAccent = employee.barva || 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)';
  const gradientTextStyle = {
    backgroundImage: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
  };
  const sectionClass = 'rounded-2xl border border-gray-100 bg-white p-4 shadow-sm shadow-gray-100/60';
  const labelClass = 'mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500';
  const timeSelectClass = 'appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-sm font-medium text-[#1A1F36] transition-colors cursor-pointer hover:border-gray-300 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10';

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
            className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-100 bg-[#F7F8FA] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 w-full flex-shrink-0" style={{ background: employeeAccent }} />

            {/* Header */}
            <div className="border-b border-gray-100 bg-white px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <EmployeeAvatar
                    firstName={employee.ime}
                    lastName={employee.priimek}
                    gradient={employee.barva}
                    size="lg"
                  />
                  <div>
                    <h2 className="bg-clip-text text-xl font-semibold text-transparent" style={gradientTextStyle}>
                      {t('settings.title')}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {employee.ime} {employee.priimek}
                    </p>
                  </div>
                </div>
                <motion.button
                  type="button"
                  onClick={onClose}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                >
                  <X className="h-5 w-5" weight="bold" />
                </motion.button>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-100 bg-white px-4 py-3 sm:px-5">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('schedule')}
                className={`flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all
                           ${activeTab === 'schedule'
                             ? 'bg-white text-gray-900 shadow-sm'
                             : 'text-gray-500 hover:text-gray-900'
                           }`}
              >
                <CalendarBlank className="h-4 w-4" weight={activeTab === 'schedule' ? 'fill' : 'regular'} />
                {t('settings.tabSchedule')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('services')}
                className={`flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all
                           ${activeTab === 'services'
                             ? 'bg-white text-gray-900 shadow-sm'
                             : 'text-gray-500 hover:text-gray-900'
                           }`}
              >
                <Briefcase className="h-4 w-4" weight={activeTab === 'services' ? 'fill' : 'regular'} />
                {t('settings.tabServices')} ({selectedServices.length}/{allServices.length})
              </button>
              </div>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {activeTab === 'schedule' && (
                <div className="space-y-4">
                  {/* Use company schedule toggle - CRITICAL */}
                  <div className={sectionClass}>
                    <div className="flex items-center justify-between gap-4">
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
                        <ToggleRight className="h-8 w-8 text-gray-900" weight="fill" />
                      ) : (
                        <ToggleLeft className="h-8 w-8 text-gray-400" weight="regular" />
                      )}
                    </button>
                    </div>
                  </div>

                  {/* Custom schedule - Only shown if NOT using company schedule */}
                  {!usesCompanySchedule && (
                    <>
                      {/* Rotating schedule toggle */}
                      <div className={sectionClass}>
                        <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-semibold text-[#1A1F36]">Izmenični urnik</div>
                          <div className="text-sm text-gray-500">Urnik se menjava po tednih v ciklu</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const enabling = !isIzmenicen;
                            if (enabling) {
                              // Re-initialize vzorci so all week slots have all 7 days populated
                              setVzorci((prev) => {
                                const next: Record<string, ScheduleWithIntervals> = {};
                                for (let i = 0; i < cikelTednov; i++) {
                                  const key = String(i);
                                  const existing = prev[key];
                                  // Keep existing only if it already has all 7 days
                                  next[key] = (existing && DAYS.every((d) => d in existing))
                                    ? existing
                                    : defaultVzorec();
                                }
                                return next;
                              });
                            }
                            setIsIzmenicen(enabling);
                          }}
                          className="flex items-center gap-2"
                        >
                          {isIzmenicen ? (
                            <ToggleRight className="h-8 w-8 text-gray-900" weight="fill" />
                          ) : (
                            <ToggleLeft className="h-8 w-8 text-gray-400" weight="regular" />
                          )}
                        </button>
                        </div>
                      </div>

                      {/* Rotating schedule configuration */}
                      {isIzmenicen ? (
                        <div className="space-y-4">
                          {/* Cycle settings */}
                          <div className={`${sectionClass} space-y-4`}>
                            <div>
                              <label className={labelClass}>
                                Število tednov v ciklu
                              </label>
                              <div className="flex gap-2">
                                {([2, 3, 4] as const).map((n) => (
                                  <button
                                    key={n}
                                    type="button"
                                    onClick={() => handleCikelTednovChange(n)}
                                    className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors
                                      ${cikelTednov === n
                                        ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
                                      }`}
                                  >
                                    {n} tedna
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label className={labelClass}>
                                Datum začetka cikla
                              </label>
                              <p className="text-xs text-gray-500 mb-2">Izberi ponedeljek kot začetek cikla</p>
                              <input
                                type="date"
                                value={zacetekCikla}
                                onChange={(e) => {
                                  const d = new Date(e.target.value);
                                  if (d.getDay() === 1) setZacetekCikla(e.target.value);
                                }}
                                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-[#1A1F36] transition-colors focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                              />
                              {zacetekCikla && new Date(zacetekCikla).getDay() !== 1 && (
                                <p className="text-xs text-red-500 mt-1">Izbrani datum mora biti ponedeljek.</p>
                              )}
                            </div>
                          </div>

                          {/* Week patterns */}
                          {Array.from({ length: cikelTednov }, (_, i) => {
                            const weekKey = String(i);
                            // Include enabled-state fingerprint in key so React remounts this
                            // subtree whenever vzorci changes — required because React's
                            // reconciler reuses the stable-keyed div and the Framer Motion
                            // ancestor can suppress intermediate re-renders of the subtree.
                            const weekStateKey = `${weekKey}-${DAYS.map((d) => vzorci[weekKey]?.[d]?.enabled ? '1' : '0').join('')}`;
                            return (
                              <div key={weekStateKey} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm shadow-gray-100/60">
                                {/* Week header */}
                                <div className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
                                  <h4 className="font-semibold text-gray-900">{WEEK_LABELS[i]}</h4>
                                  {i > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => copyFromTedanA(weekKey)}
                                      className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                                    >
                                      Kopiraj iz Tedna A
                                    </button>
                                  )}
                                </div>

                                {/* Days */}
                                <div className="space-y-2 bg-[#F7F8FA] p-3">
                                  {DAYS.map((day) => {
                                    // Read directly from vzorci state each render — never from a cached weekSchedule
                                    const liveDaySchedule: DayScheduleWithIntervals =
                                      vzorci[weekKey]?.[day] ?? { enabled: false, intervals: [{ start: '08:00', end: '17:00' }] };
                                    const isEnabled = liveDaySchedule.enabled;
                                    const intervals = liveDaySchedule.intervals;
                                    return (
                                      <div
                                        key={day}
                                        className={`rounded-xl border bg-white p-4 transition-colors
                                                   ${isEnabled ? 'border-gray-100 shadow-sm shadow-gray-100/60' : 'border-gray-100 opacity-60'}`}
                                      >
                                        {/* Day header with toggle */}
                                        <div className="flex items-center justify-between mb-3">
                                          <button
                                            type="button"
                                            onClick={() => toggleVzorciDay(weekKey, day)}
                                            className="flex items-center gap-3"
                                          >
                                            {isEnabled ? (
                                              <CheckSquare className="h-5 w-5 text-gray-900" weight="fill" />
                                            ) : (
                                              <Square className="h-5 w-5 text-gray-400" weight="regular" />
                                            )}
                                            <span className={`font-semibold ${isEnabled ? 'text-[#1A1F36]' : 'text-gray-400'}`}>
                                              {dayLabel[day]}
                                            </span>
                                          </button>
                                          {!isEnabled && (
                                            <span className="text-xs text-gray-400 italic">{t('settings.dayOff')}</span>
                                          )}
                                        </div>

                                        {/* Intervals */}
                                        {isEnabled && (
                                          <div className="space-y-2">
                                            {intervals.map((interval, idx) => (
                                              <div key={idx} className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" weight="regular" />
                                                <select
                                                  value={interval.start}
                                                  onChange={(e) => updateVzorciIntervalTime(weekKey, day, idx, 'start', e.target.value)}
                                                  className={timeSelectClass}
                                                >
                                                  {TIME_OPTIONS.map((time) => (
                                                    <option key={time} value={time}>{time}</option>
                                                  ))}
                                                </select>
                                                <span className="text-gray-400 text-sm">-</span>
                                                <select
                                                  value={interval.end}
                                                  onChange={(e) => updateVzorciIntervalTime(weekKey, day, idx, 'end', e.target.value)}
                                                  className={timeSelectClass}
                                                >
                                                  {TIME_OPTIONS.map((time) => (
                                                    <option key={time} value={time}>{time}</option>
                                                  ))}
                                                </select>
                                                {intervals.length > 1 && (
                                                  <button
                                                    type="button"
                                                    onClick={() => removeVzorciInterval(weekKey, day, idx)}
                                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                  >
                                                    <Trash className="h-4 w-4" weight="regular" />
                                                  </button>
                                                )}
                                              </div>
                                            ))}
                                            <button
                                              type="button"
                                              onClick={() => addVzorciInterval(weekKey, day)}
                                              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-gray-900 hover:bg-gray-50 hover:text-gray-900"
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
                            );
                          })}
                        </div>
                      ) : (
                        <div className={sectionClass}>
                          <div className="flex items-center gap-2 mb-3">
                            <Clock className="h-5 w-5 text-gray-500" weight="regular" />
                            <h3 className="text-base font-semibold text-gray-900">{t('settings.customScheduleTitle')}</h3>
                          </div>
                          <p className="text-sm text-gray-500 mb-4">
                            {t('settings.customScheduleDesc')}
                          </p>

                          <div className="space-y-3">
                            {DAYS.map((day) => {
                              const daySchedule = schedule[day] || { enabled: true, intervals: [{ start: '08:00', end: '17:00' }] };
                              return (
                                <div
                                  key={day}
                                  className={`rounded-xl border bg-white p-4 transition-colors
                                             ${daySchedule.enabled ? 'border-gray-100 shadow-sm shadow-gray-100/60' : 'border-gray-100 opacity-60'}`}
                                >
                                  <div className="flex items-center justify-between mb-3">
                                    <button
                                      type="button"
                                      onClick={() => toggleDay(day)}
                                      className="flex items-center gap-3"
                                    >
                                      {daySchedule.enabled ? (
                                        <CheckSquare className="h-5 w-5 text-gray-900" weight="fill" />
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

                                  {daySchedule.enabled && (
                                    <div className="space-y-2">
                                      {daySchedule.intervals.map((interval, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                          <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" weight="regular" />
                                          <select
                                            value={interval.start}
                                            onChange={(e) => updateIntervalTime(day, idx, 'start', e.target.value)}
                                            className={timeSelectClass}
                                          >
                                            {TIME_OPTIONS.map((time) => (
                                              <option key={time} value={time}>{time}</option>
                                            ))}
                                          </select>
                                          <span className="text-gray-400 text-sm">-</span>
                                          <select
                                            value={interval.end}
                                            onChange={(e) => updateIntervalTime(day, idx, 'end', e.target.value)}
                                            className={timeSelectClass}
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

                                      <button
                                        type="button"
                                        onClick={() => addInterval(day)}
                                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-gray-900 hover:bg-gray-50 hover:text-gray-900"
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
                      )}
                    </>
                  )}

                  {usesCompanySchedule && (
                    <div className={`${sectionClass} space-y-3`}>
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
                  <div className={sectionClass}>
                    <div className="flex items-center justify-between gap-4">
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
                        <ToggleRight className="h-8 w-8 text-gray-900" weight="fill" />
                      ) : (
                        <ToggleLeft className="h-8 w-8 text-gray-400" weight="regular" />
                      )}
                    </button>
                    </div>
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
                            className="text-xs font-medium text-gray-900 hover:text-gray-700"
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

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {allServices.map((service) => {
                      const isSelected = selectedServices.includes(service.id);
                      return (
                        <motion.button
                          key={service.id}
                          type="button"
                          onClick={() => toggleService(service.id)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all
                                     ${isSelected
                                       ? 'border-gray-900 bg-white shadow-sm ring-1 ring-gray-900/10'
                                       : 'border-gray-100 bg-white hover:border-gray-300'
                                     }`}
                        >
                          {/* Color indicator */}
                          <div
                            className="h-4 w-4 rounded-full flex-shrink-0"
                            style={{ background: service.barva || '#6366F1' }}
                          />

                          {/* Service info */}
                          <div className="flex-1 min-w-0">
                            <p className={`truncate font-medium ${isSelected ? 'text-gray-900' : 'text-[#1A1F36]'}`}>
                              {service.naziv}
                            </p>
                            <p className="text-xs text-gray-500">
                              {service.trajanje} min
                              {service.cena && ` • ${service.cena} EUR`}
                            </p>
                          </div>

                          {/* Checkbox */}
                          {isSelected ? (
                            <CheckSquare className="h-5 w-5 text-gray-900 flex-shrink-0" weight="fill" />
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
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-white px-5 py-4 sm:px-6">
              <motion.button
                type="button"
                onClick={onClose}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="rounded-lg px-5 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
              >
                {tCommon('buttons.cancel')}
              </motion.button>
              <motion.button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                whileHover={{ scale: isSaving ? 1 : 1.02 }}
                whileTap={{ scale: isSaving ? 1 : 0.98 }}
                className="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-70"
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
