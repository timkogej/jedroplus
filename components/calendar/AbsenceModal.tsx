'use client';

import { useState, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  CalendarBlank,
  Clock,
  User,
  Users,
  CheckSquare,
  Square,
  FloppyDisk,
  SpinnerGap,
  Warning,
} from '@phosphor-icons/react';
import type { Zaposleni } from '@/types/appointments';

interface AbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: (Zaposleni & { initials: string })[];
  onSave: (data: AbsenceFormData) => Promise<void>;
  isSaving?: boolean;
}

export interface AbsenceFormData {
  employeeIds: string[]; // Selected employee IDs (or all if "vsi")
  allEmployees: boolean;
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

function AbsenceModal({
  isOpen,
  onClose,
  employees,
  onSave,
  isSaving = false,
}: AbsenceModalProps) {
  // Form state
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [allEmployees, setAllEmployees] = useState(false);
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

  // Toggle employee selection
  const toggleEmployee = useCallback((employeeId: string) => {
    setSelectedEmployeeIds((prev) => {
      if (prev.includes(employeeId)) {
        return prev.filter((id) => id !== employeeId);
      }
      return [...prev, employeeId];
    });
    setAllEmployees(false);
  }, []);

  // Select all employees
  const handleAllEmployees = useCallback(() => {
    if (allEmployees) {
      setAllEmployees(false);
      setSelectedEmployeeIds([]);
    } else {
      setAllEmployees(true);
      setSelectedEmployeeIds(employees.map((e) => e.id));
    }
  }, [allEmployees, employees]);

  // Validate form
  const validate = useCallback(() => {
    const newErrors: string[] = [];

    if (!allEmployees && selectedEmployeeIds.length === 0) {
      newErrors.push('Izberite vsaj enega zaposlenega');
    }

    if (!dateFrom) {
      newErrors.push('Izberite datum začetka');
    }

    if (!singleDay && !dateTo) {
      newErrors.push('Izberite datum konca');
    }

    if (!singleDay && dateFrom && dateTo && dateFrom > dateTo) {
      newErrors.push('Datum konca mora biti po datumu začetka');
    }

    if (singleDay && timeFrom && timeTo && timeFrom >= timeTo) {
      newErrors.push('Čas konca mora biti po času začetka');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  }, [allEmployees, selectedEmployeeIds, dateFrom, dateTo, singleDay, timeFrom, timeTo]);

  // Handle submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    await onSave({
      employeeIds: allEmployees ? employees.map((e) => e.id) : selectedEmployeeIds,
      allEmployees,
      dateFrom,
      dateTo: singleDay ? dateFrom : dateTo,
      singleDay,
      timeFrom: singleDay ? timeFrom : undefined,
      timeTo: singleDay ? timeTo : undefined,
      reason: reason.trim() || undefined,
    });
  }, [validate, onSave, allEmployees, employees, selectedEmployeeIds, dateFrom, dateTo, singleDay, timeFrom, timeTo, reason]);

  // Reset form when modal opens
  const resetForm = useCallback(() => {
    setSelectedEmployeeIds([]);
    setAllEmployees(false);
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
                    Dodaj odsotnost
                  </h2>
                  <p className="mt-1 text-sm text-white/80">
                    Označite dneve ali ure odsotnosti zaposlenega
                  </p>
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

            {/* Form */}
            <form onSubmit={handleSubmit} className="max-h-[calc(90vh-200px)] overflow-y-auto p-6 space-y-5">
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
                  Zaposleni
                </label>

                {/* All employees toggle */}
                <motion.button
                  type="button"
                  onClick={handleAllEmployees}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left
                             ${allEmployees
                               ? 'bg-orange-50 border-orange-200 ring-1 ring-orange-200'
                               : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                             }`}
                >
                  {allEmployees ? (
                    <CheckSquare className="h-5 w-5 text-orange-500" weight="fill" />
                  ) : (
                    <Square className="h-5 w-5 text-gray-400" weight="regular" />
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-gray-600" weight="regular" />
                    <span className={`font-medium ${allEmployees ? 'text-orange-700' : 'text-[#1A1F36]'}`}>
                      Vsi zaposleni
                    </span>
                  </div>
                </motion.button>

                {/* Individual employees */}
                {!allEmployees && (
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {employees.map((employee, idx) => {
                      const isSelected = selectedEmployeeIds.includes(employee.id);
                      return (
                        <motion.button
                          key={`emp-${idx}-${employee.id}`}
                          type="button"
                          onClick={() => toggleEmployee(employee.id)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`flex items-center gap-2 p-3 rounded-xl border transition-all text-left
                                     ${isSelected
                                       ? 'bg-orange-50 border-orange-200'
                                       : 'bg-white border-gray-200 hover:border-gray-300'
                                     }`}
                        >
                          <div
                            className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                            style={{
                              background: employee.barva || 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)',
                            }}
                          >
                            {employee.initials}
                          </div>
                          <span className={`text-sm truncate ${isSelected ? 'text-orange-700 font-medium' : 'text-[#1A1F36]'}`}>
                            {employee.ime} {employee.priimek}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Single day vs Date range toggle */}
              <div className="flex gap-2">
                <motion.button
                  type="button"
                  onClick={() => setSingleDay(true)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all
                             ${singleDay
                               ? 'bg-[#1A1F36] text-white border-[#1A1F36]'
                               : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                             }`}
                >
                  <Clock className="h-4 w-4" weight={singleDay ? 'fill' : 'regular'} />
                  <span className="text-sm font-medium">Samo ure</span>
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => setSingleDay(false)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all
                             ${!singleDay
                               ? 'bg-[#1A1F36] text-white border-[#1A1F36]'
                               : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                             }`}
                >
                  <CalendarBlank className="h-4 w-4" weight={!singleDay ? 'fill' : 'regular'} />
                  <span className="text-sm font-medium">Več dni</span>
                </motion.button>
              </div>

              {/* Date selection */}
              <div className="space-y-3">
                <div className={singleDay ? '' : 'grid grid-cols-2 gap-3'}>
                  <div>
                    <label className="text-sm font-medium text-[#1A1F36] mb-1.5 block">
                      {singleDay ? 'Datum' : 'Od datuma'}
                    </label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-[#1A1F36]
                               focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                  {!singleDay && (
                    <div>
                      <label className="text-sm font-medium text-[#1A1F36] mb-1.5 block">
                        Do datuma
                      </label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        min={dateFrom}
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-[#1A1F36]
                                 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                  )}
                </div>

                {/* Time selection (only for single day) */}
                {singleDay && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-[#1A1F36] mb-1.5 block">
                        Od ure
                      </label>
                      <select
                        value={timeFrom}
                        onChange={(e) => setTimeFrom(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-[#1A1F36]
                                 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                      >
                        {TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[#1A1F36] mb-1.5 block">
                        Do ure
                      </label>
                      <select
                        value={timeTo}
                        onChange={(e) => setTimeTo(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-[#1A1F36]
                                 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                      >
                        {TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="text-sm font-medium text-[#1A1F36] mb-1.5 block">
                  Razlog (neobvezno)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="npr. Bolniška, dopust, izlet..."
                  rows={2}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-[#1A1F36]
                           placeholder-gray-400 resize-none
                           focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
              </div>
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
                Prekliči
              </motion.button>
              <motion.button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                whileHover={{ scale: isSaving ? 1 : 1.02 }}
                whileTap={{ scale: isSaving ? 1 : 0.98 }}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-2.5
                           text-sm font-medium text-white shadow-lg shadow-orange-500/25 transition-all
                           hover:shadow-xl hover:shadow-orange-500/30 disabled:opacity-70"
              >
                {isSaving ? (
                  <>
                    <SpinnerGap className="h-4 w-4 animate-spin" />
                    Shranjujem...
                  </>
                ) : (
                  <>
                    <FloppyDisk className="h-4 w-4" weight="bold" />
                    Shrani odsotnost
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

export default memo(AbsenceModal);
