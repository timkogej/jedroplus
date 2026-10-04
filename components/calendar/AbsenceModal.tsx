'use client';

import { useState, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  CalendarBlank,
  Clock,
  FloppyDisk,
  SpinnerGap,
  Warning,
} from '@phosphor-icons/react';
import { Select, SelectOption } from '@/components/ui/animated-select';
import type { Zaposleni } from '@/types/appointments';
import { useTranslations } from 'next-intl';
import { sheet } from '@/components/ui/sheetClasses';

interface AbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: (Zaposleni & { initials: string })[];
  onSave: (data: AbsenceFormData) => Promise<void>;
  isSaving?: boolean;
}

export interface AbsenceFormData {
  employeeId: string;
  dateFrom: string;
  dateTo: string;
  singleDay: boolean; // If true, only dateFrom is used with time range
  timeFrom?: string;
  timeTo?: string;
  reason?: string;
}

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

// Extract a solid color from a gradient string for displaying initials
function extractColor(barva: string): string {
  if (!barva) return '#8B5CF6';
  if (barva.includes('gradient')) {
    const m = barva.match(/#[0-9A-Fa-f]{6}/g);
    if (m && m.length > 0) return m[0];
  }
  return barva;
}

function AbsenceModal({
  isOpen,
  onClose,
  employees,
  onSave,
  isSaving = false,
}: AbsenceModalProps) {
  const t = useTranslations('appointments');

  // Form state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [singleDay, setSingleDay] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [timeFrom, setTimeFrom] = useState('08:00');
  const [timeTo, setTimeTo] = useState('17:00');
  const [reason, setReason] = useState('');

  // Validation errors
  const [errors, setErrors] = useState<string[]>([]);

  // Mobile detection for native time picker
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Validate form
  const validate = useCallback(() => {
    const newErrors: string[] = [];

    if (!selectedEmployeeId) {
      newErrors.push(t('calendarView.absenceModal.validation.employeeRequired'));
    }

    if (!dateFrom) {
      newErrors.push(t('calendarView.absenceModal.validation.startDateRequired'));
    }

    if (!singleDay && !dateTo) {
      newErrors.push(t('calendarView.absenceModal.validation.endDateRequired'));
    }

    if (!singleDay && dateFrom && dateTo && dateFrom > dateTo) {
      newErrors.push(t('calendarView.absenceModal.validation.endDateAfterStart'));
    }

    if (singleDay && timeFrom && timeTo && timeFrom >= timeTo) {
      newErrors.push(t('calendarView.absenceModal.validation.endTimeAfterStart'));
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  }, [selectedEmployeeId, dateFrom, dateTo, singleDay, timeFrom, timeTo]);

  // Handle submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    await onSave({
      employeeId: selectedEmployeeId,
      dateFrom,
      dateTo: singleDay ? dateFrom : dateTo,
      singleDay,
      timeFrom: singleDay ? timeFrom : '05:00',
      timeTo: singleDay ? timeTo : '23:59',
      reason: reason.trim() || undefined,
    });
  }, [validate, onSave, selectedEmployeeId, dateFrom, dateTo, singleDay, timeFrom, timeTo, reason]);

  // Reset form when modal opens
  const resetForm = useCallback(() => {
    setSelectedEmployeeId('');
    setSingleDay(true);
    const today = new Date().toISOString().split('T')[0];
    setDateFrom(today);
    setDateTo(today);
    setTimeFrom('08:00');
    setTimeTo('17:00');
    setReason('');
    setErrors([]);
  }, []);

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

  const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500';
  const fieldClass =
    'w-full max-w-full min-w-0 rounded-[10px] border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-[3px] focus:ring-orange-100';

  return (
    <AnimatePresence onExitComplete={resetForm}>
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className={sheet.backdrop}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`${sheet.panel} sm:max-w-lg`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={sheet.header}>
              <div className={sheet.grabber} aria-hidden="true" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className={sheet.title}>
                    {t('calendarView.absenceModal.title')}
                  </h2>
                  <p className={sheet.subtitle}>
                    {t('calendarView.absenceModal.subtitle')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className={sheet.close}
                >
                  <X className="h-5 w-5" weight="regular" />
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className={`${sheet.body} overflow-x-hidden`}>
              {/* Errors */}
              {errors.length > 0 && (
                <div className="rounded-xl bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <Warning className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" weight="regular" />
                    <div className="space-y-1">
                      {errors.map((error, i) => (
                        <p key={i} className="text-sm text-red-600">{error}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Employee Selection */}
              <div className={sheet.group}>
                <label className={labelClass}>
                  {t('calendarView.absenceModal.fields.employee')}
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto overflow-x-hidden p-0.5">
                  {employees.map((employee, idx) => {
                    const isSelected = selectedEmployeeId === employee.id;
                    const color = extractColor(employee.barva || '');
                    return (
                      <button
                        key={`emp-${idx}-${employee.id}`}
                        type="button"
                        onClick={() => setSelectedEmployeeId(employee.id)}
                        className={`flex items-center gap-2 rounded-[10px] border px-3 py-2.5 text-left transition-all
                                   ${isSelected
                                     ? 'bg-orange-50 border-orange-300 ring-1 ring-orange-200'
                                     : 'bg-white border-gray-200 hover:border-gray-300'
                                   }`}
                      >
                        <span
                          className="text-sm font-bold flex-shrink-0 w-6 text-center"
                          style={{ color }}
                        >
                          {employee.initials}
                        </span>
                        <span className={`text-sm truncate ${isSelected ? 'text-orange-700 font-medium' : 'text-gray-900'}`}>
                          {employee.ime} {employee.priimek}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={`${sheet.group} space-y-4`}>
                {/* Single day vs Date range toggle */}
                <div className="flex gap-0.5 rounded-[9px] bg-gray-100 p-0.5">
                  <button
                    type="button"
                    onClick={() => setSingleDay(true)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-[7px] px-3 py-1.5 transition-all
                               ${singleDay
                                 ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.1)]'
                                 : 'text-gray-500 hover:text-gray-900'
                               }`}
                  >
                    <Clock className="h-4 w-4" weight="regular" />
                    <span className="text-sm font-medium">{t('calendarView.absenceModal.fields.hoursOnly')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSingleDay(false)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-[7px] px-3 py-1.5 transition-all
                               ${!singleDay
                                 ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.1)]'
                                 : 'text-gray-500 hover:text-gray-900'
                               }`}
                  >
                    <CalendarBlank className="h-4 w-4" weight="regular" />
                    <span className="text-sm font-medium">{t('calendarView.absenceModal.fields.multipleDays')}</span>
                  </button>
                </div>

                {/* Date selection */}
                <div className={singleDay ? '' : 'grid grid-cols-1 gap-3 sm:grid-cols-2'}>
                  <div>
                    <label className={labelClass}>
                      {singleDay ? t('calendarView.absenceModal.fields.date') : t('calendarView.absenceModal.fields.dateFrom')}
                    </label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  {!singleDay && (
                    <div>
                      <label className={labelClass}>
                        {t('calendarView.absenceModal.fields.dateTo')}
                      </label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        min={dateFrom}
                        className={fieldClass}
                      />
                    </div>
                  )}
                </div>

                {/* Time selection (only for single day) */}
                {singleDay && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <label className={labelClass}>
                        {t('calendarView.absenceModal.fields.timeFrom')}
                      </label>
                      {isMobile ? (
                        <input
                          type="time"
                          value={timeFrom}
                          onChange={(e) => setTimeFrom(e.target.value)}
                          className={fieldClass}
                        />
                      ) : (
                        <Select value={timeFrom} setValue={setTimeFrom} placeholder={t('calendarView.absenceModal.fields.timePlaceholder')}>
                          {TIME_OPTIONS.map((time) => (
                            <SelectOption key={time} value={time}>{time}</SelectOption>
                          ))}
                        </Select>
                      )}
                    </div>
                    <div className="min-w-0">
                      <label className={labelClass}>
                        {t('calendarView.absenceModal.fields.timeTo')}
                      </label>
                      {isMobile ? (
                        <input
                          type="time"
                          value={timeTo}
                          onChange={(e) => setTimeTo(e.target.value)}
                          className={fieldClass}
                        />
                      ) : (
                        <Select value={timeTo} setValue={setTimeTo} placeholder={t('calendarView.absenceModal.fields.timePlaceholder')}>
                          {TIME_OPTIONS.map((time) => (
                            <SelectOption key={time} value={time}>{time}</SelectOption>
                          ))}
                        </Select>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Reason */}
              <div className={sheet.group}>
                <label className={labelClass}>
                  {t('calendarView.absenceModal.fields.reason')}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('calendarView.absenceModal.fields.reasonPlaceholder')}
                  rows={2}
                  className={`${fieldClass} resize-none px-4 placeholder-gray-400`}
                />
              </div>
            </form>

            {/* Footer */}
            <div className={sheet.footer}>
              <button
                type="button"
                onClick={onClose}
                className={sheet.cancel}
              >
                {t('calendarView.absenceModal.actions.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                className={`${sheet.action} bg-gradient-to-r from-orange-500 to-red-500`}
              >
                {isSaving ? (
                  <>
                    <SpinnerGap className="h-4 w-4 animate-spin" />
                    {t('calendarView.absenceModal.actions.saving')}
                  </>
                ) : (
                  <>
                    <FloppyDisk className="h-4 w-4" weight="bold" />
                    {t('calendarView.absenceModal.actions.save')}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(AbsenceModal);
