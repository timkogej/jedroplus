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

  return (
    <AnimatePresence onExitComplete={resetForm}>
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
            className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {t('calendarView.absenceModal.title')}
                  </h2>
                  <p className="mt-1 text-sm text-white/80">
                    {t('calendarView.absenceModal.subtitle')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                >
                  <X className="h-5 w-5" weight="bold" />
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="max-h-[calc(90vh-200px)] overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 space-y-5">
              {/* Errors */}
              {errors.length > 0 && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                  <div className="flex items-start gap-3">
                    <Warning className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" weight="fill" />
                    <div className="space-y-1">
                      {errors.map((error, i) => (
                        <p key={i} className="text-sm text-red-600">{error}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Employee Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-[#1A1F36]">
                  {t('calendarView.absenceModal.fields.employee')}
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto overflow-x-hidden p-1">
                  {employees.map((employee, idx) => {
                    const isSelected = selectedEmployeeId === employee.id;
                    const color = extractColor(employee.barva || '');
                    return (
                      <button
                        key={`emp-${idx}-${employee.id}`}
                        type="button"
                        onClick={() => setSelectedEmployeeId(employee.id)}
                        className={`flex items-center gap-2 p-3 rounded-xl border transition-all text-left
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
                        <span className={`text-sm truncate ${isSelected ? 'text-orange-700 font-medium' : 'text-[#1A1F36]'}`}>
                          {employee.ime} {employee.priimek}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Single day vs Date range toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSingleDay(true)}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all
                             ${singleDay
                               ? 'bg-[#1A1F36] text-white border-[#1A1F36]'
                               : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                             }`}
                >
                  <Clock className="h-4 w-4" weight={singleDay ? 'fill' : 'regular'} />
                  <span className="text-sm font-medium">{t('calendarView.absenceModal.fields.hoursOnly')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSingleDay(false)}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all
                             ${!singleDay
                               ? 'bg-[#1A1F36] text-white border-[#1A1F36]'
                               : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                             }`}
                >
                  <CalendarBlank className="h-4 w-4" weight={!singleDay ? 'fill' : 'regular'} />
                  <span className="text-sm font-medium">{t('calendarView.absenceModal.fields.multipleDays')}</span>
                </button>
              </div>

              {/* Date selection */}
              <div className="space-y-3">
                <div className={singleDay ? '' : 'grid grid-cols-1 gap-3 sm:grid-cols-2'}>
                  <div>
                    <label className="text-sm font-medium text-[#1A1F36] mb-1.5 block">
                      {singleDay ? t('calendarView.absenceModal.fields.date') : t('calendarView.absenceModal.fields.dateFrom')}
                    </label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full max-w-full min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#1A1F36]
                               focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                  {!singleDay && (
                    <div>
                      <label className="text-sm font-medium text-[#1A1F36] mb-1.5 block">
                        {t('calendarView.absenceModal.fields.dateTo')}
                      </label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        min={dateFrom}
                        className="w-full max-w-full min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#1A1F36]
                                 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                  )}
                </div>

                {/* Time selection (only for single day) */}
                {singleDay && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <label className="text-sm font-medium text-[#1A1F36] mb-1.5 block">
                        {t('calendarView.absenceModal.fields.timeFrom')}
                      </label>
                      {isMobile ? (
                        <input
                          type="time"
                          value={timeFrom}
                          onChange={(e) => setTimeFrom(e.target.value)}
                          className="w-full max-w-full min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#1A1F36]
                                   focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
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
                      <label className="text-sm font-medium text-[#1A1F36] mb-1.5 block">
                        {t('calendarView.absenceModal.fields.timeTo')}
                      </label>
                      {isMobile ? (
                        <input
                          type="time"
                          value={timeTo}
                          onChange={(e) => setTimeTo(e.target.value)}
                          className="w-full max-w-full min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#1A1F36]
                                   focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
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
              <div>
                <label className="text-sm font-medium text-[#1A1F36] mb-1.5 block">
                  {t('calendarView.absenceModal.fields.reason')}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('calendarView.absenceModal.fields.reasonPlaceholder')}
                  rows={2}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-[#1A1F36]
                           placeholder-gray-400 resize-none
                           focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
              </div>
            </form>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
              >
                {t('calendarView.absenceModal.actions.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-2.5
                           text-sm font-medium text-white shadow-lg shadow-orange-500/25 transition-all
                           hover:shadow-xl hover:shadow-orange-500/30 disabled:opacity-70"
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
