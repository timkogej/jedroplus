'use client';

import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  CalendarBlank,
  Clock,
  User,
  Scissors,
  CheckCircle,
  NotePencil,
  FloppyDisk,
  SpinnerGap,
} from '@phosphor-icons/react';
import { Select, SelectOption } from '@/components/ui/animated-select';
import ClientSearch from '@/components/appointments/ClientSearch';
import type { Client } from '@/lib/supabase/clients';
import type { Storitev, Zaposleni, AppointmentWithDetails } from '@/types/appointments';
import { minutesToTime, parseTimeToMinutes } from '@/lib/utils/calendar';

export type ModalMode = 'view' | 'edit' | 'create';

export interface CalendarAppointmentFormData {
  id?: string;
  datum: string;
  cas_zacetek: string;
  cas_konec: string;
  stranka_id: string | null;
  stranka_ime: string;
  storitev_id: string | null;
  zaposleni_id: string | null;
  status: string;
  opombe: string;
}

interface CalendarAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment?: AppointmentWithDetails | null;
  mode: ModalMode;
  services: Storitev[];
  employees: (Zaposleni & { initials: string })[];
  onSave: (data: CalendarAppointmentFormData) => Promise<void>;
  isSaving?: boolean;
  initialDate?: Date;
  initialTime?: string;
  onCreateClient?: () => void;
}

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Načrtovan', color: '#8B5CF6' },
  { value: 'confirmed', label: 'Potrjen', color: '#10B981' },
  { value: 'pending', label: 'Čakajoč', color: '#F59E0B' },
  { value: 'completed', label: 'Zaključen', color: '#3B82F6' },
  { value: 'cancelled', label: 'Odpovedan', color: '#EF4444' },
  { value: 'no_show', label: 'Ni prišel', color: '#6B7280' },
];

// Generate time options from 5:30 to 23:00 in 15-minute intervals
function generateTimeOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  // Start from 5:30 (330 minutes from midnight)
  const startMinutes = 5 * 60 + 30; // 5:30
  const endMinutes = 23 * 60; // 23:00

  for (let minutes = startMinutes; minutes <= endMinutes; minutes += 15) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    options.push({ value: time, label: time });
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

function CalendarAppointmentModal({
  isOpen,
  onClose,
  appointment,
  mode,
  services,
  employees,
  onSave,
  isSaving = false,
  initialDate,
  initialTime,
  onCreateClient,
}: CalendarAppointmentModalProps) {
  // Form state
  const [formData, setFormData] = useState<CalendarAppointmentFormData>({
    datum: '',
    cas_zacetek: '09:00',
    cas_konec: '10:00',
    stranka_id: null,
    stranka_ime: '',
    storitev_id: null,
    zaposleni_id: null,
    status: 'scheduled',
    opombe: '',
  });

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (mode === 'create') {
        const date = initialDate || new Date();
        const dateStr = date.toISOString().split('T')[0];
        const startTime = initialTime || '09:00';

        setFormData({
          datum: dateStr,
          cas_zacetek: startTime,
          cas_konec: calculateEndTime(startTime, 60),
          stranka_id: null,
          stranka_ime: '',
          storitev_id: null,
          zaposleni_id: null,
          status: 'scheduled',
          opombe: '',
        });
        setSelectedClient(null);
      } else if (appointment) {
        const dateStr = new Date(appointment.datum).toISOString().split('T')[0];
        setFormData({
          id: appointment.id,
          datum: dateStr,
          cas_zacetek: appointment.cas_zacetek?.substring(0, 5) || '09:00',
          cas_konec: appointment.cas_konec?.substring(0, 5) || '10:00',
          stranka_id: appointment.stranka_id || null,
          stranka_ime: appointment.stranka_ime || '',
          storitev_id: appointment.storitev_id || null,
          zaposleni_id: appointment.zaposleni_id || null,
          status: appointment.status || 'scheduled',
          opombe: appointment.opombe || '',
        });

        // Set selected client if available
        if (appointment.stranka_id) {
          setSelectedClient({
            id: appointment.stranka_id,
            ime: appointment.stranka_ime?.split(' ')[0] || '',
            priimek: appointment.stranka_ime?.split(' ').slice(1).join(' ') || '',
            email: '',
            telefon: '',
          });
        } else {
          setSelectedClient(null);
        }
      }
      setErrors({});
    }
  }, [isOpen, mode, appointment, initialDate, initialTime]);

  // Calculate end time based on service duration
  const calculateEndTime = useCallback((startTime: string, durationMinutes: number): string => {
    const startMinutes = parseTimeToMinutes(startTime);
    const endMinutes = Math.min(startMinutes + durationMinutes, 23 * 60 + 59);
    return minutesToTime(endMinutes);
  }, []);

  // Update end time when service changes, and check employee compatibility
  const handleServiceChange = useCallback((serviceId: string) => {
    setFormData(prev => {
      const service = services.find(s => s.id === serviceId);
      const duration = service?.trajanje || service?.skupni_cas || 60;
      const endTime = calculateEndTime(prev.cas_zacetek, duration);

      const newData = {
        ...prev,
        storitev_id: serviceId || null,
        cas_konec: endTime,
      };

      // Check if current employee can perform the new service
      if (prev.zaposleni_id) {
        const currentEmployee = employees.find(e => e.id === prev.zaposleni_id);
        if (currentEmployee) {
          const canDo = !currentEmployee.storitve || currentEmployee.storitve.length === 0 || currentEmployee.storitve.includes(serviceId);
          if (!canDo) {
            // Reset employee if they can't do the new service
            newData.zaposleni_id = null;
          }
        }
      }

      return newData;
    });
  }, [services, employees, calculateEndTime]);

  // Handle client selection
  const handleClientSelect = useCallback((client: Client | null) => {
    setSelectedClient(client);
    setFormData(prev => ({
      ...prev,
      stranka_id: client?.id || null,
      stranka_ime: client ? `${client.ime} ${client.priimek}` : '',
    }));
  }, []);

  // Helper: Check if employee can perform a specific service
  const canPerformService = useCallback((employee: (Zaposleni & { initials: string }), serviceId: string) => {
    // If no storitve specified (null or empty), employee can do all services
    if (!employee.storitve || employee.storitve.length === 0) {
      return true;
    }
    return employee.storitve.includes(serviceId);
  }, []);

  // Get filtered employees based on selected service
  const filteredEmployees = useMemo(() => {
    if (!formData.storitev_id) {
      return employees;
    }
    return employees.filter(emp => canPerformService(emp, formData.storitev_id!));
  }, [employees, formData.storitev_id, canPerformService]);

  // Get filtered services based on selected employee
  const filteredServices = useMemo(() => {
    if (!formData.zaposleni_id) {
      return services;
    }
    const employee = employees.find(e => e.id === formData.zaposleni_id);
    if (!employee) return services;

    // If employee can do all services (null or empty storitve)
    if (!employee.storitve || employee.storitve.length === 0) {
      return services;
    }

    return services.filter(s => employee.storitve?.includes(s.id));
  }, [services, employees, formData.zaposleni_id]);

  // Handle employee change with filtering
  const handleEmployeeChange = useCallback((employeeId: string | null) => {
    setFormData((prev) => {
      const newData = { ...prev, zaposleni_id: employeeId };

      // Check if new employee can perform the current service
      if (prev.storitev_id && employeeId) {
        const newEmployee = employees.find(e => e.id === employeeId);
        if (newEmployee && !canPerformService(newEmployee, prev.storitev_id)) {
          // Reset service if new employee can't do it
          newData.storitev_id = null;
        }
      }

      return newData;
    });
  }, [employees, canPerformService]);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.datum) {
      newErrors.datum = 'Datum je obvezen';
    }
    if (!formData.cas_zacetek) {
      newErrors.cas_zacetek = 'Čas začetka je obvezen';
    }
    if (!formData.stranka_id && !formData.stranka_ime) {
      newErrors.stranka = 'Stranka je obvezna';
    }
    if (!formData.storitev_id) {
      newErrors.storitev_id = 'Storitev je obvezna';
    }
    if (!formData.zaposleni_id) {
      newErrors.zaposleni_id = 'Zaposleni je obvezen';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) return;
    await onSave(formData);
  };

  // Modal animation variants
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

  const isViewMode = mode === 'view';

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
            className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gradient header - NO X BUTTON */}
            <div className="bg-gradient-to-r from-violet-500 to-cyan-500 p-6">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {mode === 'create' ? 'Nov termin' : mode === 'edit' ? 'Uredi termin' : 'Podrobnosti termina'}
                </h2>
                <p className="mt-1 text-sm text-white/80">
                  {mode === 'create' ? 'Ustvarite nov termin' : 'Pregled in urejanje termina'}
                </p>
              </div>
            </div>

            {/* Modal body */}
            <div className="max-h-[60vh] overflow-y-auto p-6 custom-scrollbar">
              <div className="space-y-6">
                {/* Section 1: Appointment details */}
                <div>
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#1A1F36]">
                    <CalendarBlank className="h-4 w-4" weight="regular" />
                    Podatki o terminu
                  </h3>

                  <div className="space-y-4">
                    {/* Date */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-500">
                        Datum
                      </label>
                      <input
                        type="date"
                        value={formData.datum}
                        onChange={(e) => setFormData(prev => ({ ...prev, datum: e.target.value }))}
                        disabled={isViewMode}
                        className={`w-full rounded-xl border px-4 py-2.5 text-sm text-[#1A1F36]
                                   transition-all focus:outline-none focus:ring-2 focus:ring-[#1A1F36]/20
                                   ${errors.datum ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}
                                   ${isViewMode ? 'cursor-not-allowed bg-gray-50' : ''}`}
                      />
                      {errors.datum && (
                        <p className="mt-1 text-xs text-red-500">{errors.datum}</p>
                      )}
                    </div>

                    {/* Time range */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-500">
                          Čas začetka
                        </label>
                        <Select
                          value={formData.cas_zacetek}
                          setValue={(value) => {
                            const service = services.find(s => s.id === formData.storitev_id);
                            const duration = service?.trajanje || service?.skupni_cas || 60;
                            setFormData(prev => ({
                              ...prev,
                              cas_zacetek: value,
                              cas_konec: calculateEndTime(value, duration),
                            }));
                          }}
                          placeholder="Izberi čas"
                          disabled={isViewMode}
                        >
                          {TIME_OPTIONS.map(option => (
                            <SelectOption key={option.value} value={option.value}>
                              {option.label}
                            </SelectOption>
                          ))}
                        </Select>
                        {errors.cas_zacetek && (
                          <p className="mt-1 text-xs text-red-500">{errors.cas_zacetek}</p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-500">
                          Čas konca
                        </label>
                        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-600">
                          <Clock className="h-4 w-4" weight="regular" />
                          {formData.cas_konec}
                        </div>
                      </div>
                    </div>

                    {/* Service - uses filtered list */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-500">
                        Storitev
                      </label>
                      <Select
                        value={formData.storitev_id || ''}
                        setValue={handleServiceChange}
                        placeholder="Izberi storitev"
                        disabled={isViewMode}
                      >
                        {filteredServices.map((service, idx) => (
                          <SelectOption
                            key={`svc-${idx}-${service.id}`}
                            value={service.id}
                            colorDot={service.barva || '#6366F1'}
                            description={`${service.trajanje || service.skupni_cas || 60} min`}
                          >
                            {service.naziv}
                          </SelectOption>
                        ))}
                      </Select>
                      {errors.storitev_id && (
                        <p className="mt-1 text-xs text-red-500">{errors.storitev_id}</p>
                      )}
                    </div>

                    {/* Employee - uses filtered list and proper handler */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-500">
                        Zaposleni
                      </label>
                      <Select
                        value={formData.zaposleni_id || ''}
                        setValue={(value) => handleEmployeeChange(value || null)}
                        placeholder="Izberi zaposlenega"
                        disabled={isViewMode}
                      >
                        {filteredEmployees.map((employee, idx) => (
                          <SelectOption key={`emp-${idx}-${employee.id}`} value={employee.id}>
                            {employee.ime} {employee.priimek}
                          </SelectOption>
                        ))}
                      </Select>
                      {errors.zaposleni_id && (
                        <p className="mt-1 text-xs text-red-500">{errors.zaposleni_id}</p>
                      )}
                    </div>

                    {/* Status */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-500">
                        Status
                      </label>
                      <Select
                        value={formData.status}
                        setValue={(value) => setFormData(prev => ({ ...prev, status: value }))}
                        placeholder="Izberi status"
                        disabled={isViewMode}
                      >
                        {STATUS_OPTIONS.map(option => (
                          <SelectOption
                            key={option.value}
                            value={option.value}
                            colorDot={option.color}
                          >
                            {option.label}
                          </SelectOption>
                        ))}
                      </Select>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-500">
                        Opombe
                      </label>
                      <textarea
                        value={formData.opombe}
                        onChange={(e) => setFormData(prev => ({ ...prev, opombe: e.target.value }))}
                        disabled={isViewMode}
                        rows={3}
                        placeholder="Dodatne opombe..."
                        className={`w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm
                                   text-[#1A1F36] placeholder-gray-400 transition-all resize-none
                                   focus:outline-none focus:ring-2 focus:ring-[#1A1F36]/20
                                   ${isViewMode ? 'cursor-not-allowed bg-gray-50' : ''}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Section 2: Client details */}
                <div>
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#1A1F36]">
                    <User className="h-4 w-4" weight="regular" />
                    Podatki o stranki
                  </h3>

                  {isViewMode ? (
                    <div className="rounded-xl bg-gray-50 p-4">
                      <p className="font-medium text-[#1A1F36]">{formData.stranka_ime || 'Ni podatka'}</p>
                    </div>
                  ) : (
                    <div>
                      <ClientSearch
                        selectedClient={selectedClient}
                        onSelect={handleClientSelect}
                        placeholder="Išči stranko po imenu, emailu ali telefonu..."
                        onCreateNew={onCreateClient}
                      />
                      {errors.stranka && (
                        <p className="mt-1 text-xs text-red-500">{errors.stranka}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
              <motion.button
                type="button"
                onClick={onClose}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium
                           text-gray-700 transition-colors hover:bg-gray-50"
              >
                {isViewMode ? 'Zapri' : 'Prekliči'}
              </motion.button>

              {!isViewMode && (
                <motion.button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  whileHover={{ scale: isSaving ? 1 : 1.02 }}
                  whileTap={{ scale: isSaving ? 1 : 0.98 }}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500
                             px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-cyan-500/25
                             transition-all disabled:cursor-not-allowed disabled:opacity-70
                             hover:shadow-xl hover:shadow-cyan-500/30"
                >
                  {isSaving ? (
                    <>
                      <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                      Shranjujem...
                    </>
                  ) : (
                    <>
                      <FloppyDisk className="h-4 w-4" weight="bold" />
                      Shrani termin
                    </>
                  )}
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(CalendarAppointmentModal);
