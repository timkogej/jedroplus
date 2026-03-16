'use client';

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  CalendarBlank,
  Clock,
  ArrowRight,
  ListChecks,
  CheckCircle,
  Plus,
  Warning,
  X,
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import AppointmentFilters, { type FilterState } from '@/components/appointments/AppointmentFilters';
import AppointmentTable from '@/components/appointments/AppointmentTable';
import AppointmentModal, { type AppointmentFormData } from '@/components/appointments/AppointmentModal';
import DeleteConfirmation from '@/components/appointments/DeleteConfirmation';
import { normalizeStatus } from '@/components/appointments/StatusBadge';
import { pickFirst } from '@/lib/dashboardHelpers';
import {
  fetchAllAppointments,
  fetchServices,
  fetchEmployees,
} from '@/lib/supabase/appointments';
import type { AppointmentWithDetails, Storitev, Zaposleni } from '@/types/appointments';
import { callN8nAction } from '@/src/lib/n8nClient';
import {
  buildBookingDeleteData,
  buildBookingCompleteData,
  buildEnhancedAppointmentData,
  getPodatkiPodjetja,
  getCustomerAppointmentsCount,
} from '@/lib/webhookPayloadBuilders';
import { generateUnique8DigitId } from '@/lib/utils/uniqueIdGenerator';
import { supabase } from '@/lib/supabaseClient';

const DEFAULT_FILTERS: FilterState = {
  search: '',
  status: 'all',
  employeeId: null,
  serviceId: null,
  dateFrom: '',
  dateTo: '',
};

// Stats card component - Gradient border with black icon (no circle)
interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  delay?: number;
}

function StatCard({ icon, value, label, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1, duration: 0.3 }}
      className="relative overflow-hidden rounded-2xl p-6 bg-white border border-gray-100 shadow-sm"
    >
      {/* FLEX LAYOUT - Icon on right */}
      <div className="flex items-center justify-between">
        {/* Left side - Numbers */}
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay * 0.1 + 0.2 }}
            className="text-3xl font-bold text-gray-900 mb-1"
          >
            {value}
          </motion.p>
          <p className="text-sm font-medium text-gray-600">{label}</p>
        </div>

        {/* Right side - Icon (black, no circle) */}
        <div className="text-gray-900 flex-shrink-0">
          {icon}
        </div>
      </div>
    </motion.div>
  );
}

function TerminiPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { companyId, companySettings, loading: companyLoading } = useCompany();
  const { user } = useAuth();

  // Data states
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [services, setServices] = useState<Storitev[]>([]);
  const [employees, setEmployees] = useState<(Zaposleni & { initials: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state — initialize from URL params if present
  const [filters, setFilters] = useState<FilterState>(() => {
    const dateFrom = searchParams.get('dateFrom') ?? '';
    const dateTo = searchParams.get('dateTo') ?? '';
    return { ...DEFAULT_FILTERS, dateFrom, dateTo };
  });

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('view');
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithDetails | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<AppointmentWithDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Complete confirmation state
  const [completeTarget, setCompleteTarget] = useState<AppointmentWithDetails | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');

  // Action error
  const [actionError, setActionError] = useState<string | null>(null);

  // Success message
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const actor = user?.email ?? 'unknown';
  const companyPayload = useMemo(
    () => getPodatkiPodjetja(companySettings ?? undefined),
    [companySettings]
  );

  const buildPayload = useCallback(
    (event: string, entity: string, data: Record<string, unknown>) => ({
      event,
      entity,
      data,
      company_id: companyId ?? '',
      actor,
      timestamp: new Date().toISOString(),
      meta: { app: 'Integrate' as const, version: '1.0' as const },
    }),
    [companyId, actor]
  );

  // Redirect if no company
  useEffect(() => {
    if (companyLoading) return;
    if (!companyId) {
      router.replace('/onboarding');
    }
  }, [companyId, companyLoading, router]);

  // Load data
  const loadData = useCallback(async () => {
    if (!companyId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [appointmentsRes, servicesRes, employeesRes] = await Promise.all([
        fetchAllAppointments(companyId),
        fetchServices(companyId),
        fetchEmployees(companyId),
      ]);

      if (appointmentsRes.error) {
        throw appointmentsRes.error;
      }

      setAppointments(appointmentsRes.data ?? []);
      setServices(servicesRes.data ?? []);
      setEmployees(employeesRes.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Napaka pri nalaganju podatkov');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const clientName = (apt.stranka_ime || '').toLowerCase();
        const serviceName = (apt.storitev?.naziv || '').toLowerCase();
        const employeeName = apt.zaposleni
          ? `${apt.zaposleni.ime} ${apt.zaposleni.priimek}`.toLowerCase()
          : '';

        if (
          !clientName.includes(searchLower) &&
          !serviceName.includes(searchLower) &&
          !employeeName.includes(searchLower)
        ) {
          return false;
        }
      }

      // Status filter
      if (filters.status !== 'all') {
        const normalizedAptStatus = normalizeStatus(apt.status || 'scheduled');
        if (normalizedAptStatus !== filters.status) {
          return false;
        }
      }

      // Employee filter
      if (filters.employeeId && apt.zaposleni_id !== filters.employeeId) {
        return false;
      }

      // Service filter
      if (filters.serviceId && apt.storitev_id !== filters.serviceId) {
        return false;
      }

      // Date range filter
      if (filters.dateFrom) {
        const aptDate = new Date(apt.datum);
        const fromDate = new Date(filters.dateFrom);
        if (aptDate < fromDate) return false;
      }

      if (filters.dateTo) {
        const aptDate = new Date(apt.datum);
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (aptDate > toDate) return false;
      }

      return true;
    });
  }, [appointments, filters]);

  // Handlers
  const handleView = (appointment: AppointmentWithDetails) => {
    setSelectedAppointment(appointment);
    setModalMode('view');
    setModalOpen(true);
  };

  const handleEdit = (appointment: AppointmentWithDetails) => {
    setSelectedAppointment(appointment);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedAppointment(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleDelete = (appointment: AppointmentWithDetails) => {
    setDeleteTarget(appointment);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedAppointment(null);
  };

  const handleSave = async (data: AppointmentFormData) => {
    if (!companyId) return;

    setIsSaving(true);
    setActionError(null);

    try {
      const isNewAppointment = !data.id;
      const event = isNewAppointment ? 'NOV_TERMIN' : 'POSODOBITEV_TERMINA';

      // Generate unique 8-digit ID for new appointments
      let unique8DigitId: string | undefined;
      if (isNewAppointment) {
        unique8DigitId = await generateUnique8DigitId('Termini', 'id');
        console.log('Generated unique 8-digit appointment ID:', unique8DigitId);
      }

      // Look up full service details for all services
      const selectedService = services.find((s) => s.id === data.storitev_id) ?? null;
      const selectedService2 = data.storitev_id_2 ? services.find((s) => s.id === data.storitev_id_2) ?? null : null;
      const selectedService3 = data.storitev_id_3 ? services.find((s) => s.id === data.storitev_id_3) ?? null : null;

      // Look up full employee details
      const selectedEmployee = employees.find((e) => e.id === data.zaposleni_id) ?? null;

      // Fetch full client details including gender (Spol)
      let clientDetails: {
        id: string;
        ime: string;
        priimek: string;
        email?: string | null;
        telefon?: string | null;
        spol?: string | null;
        barva?: string | null;
        notes?: string | null;
        tags?: string[] | string | null;
        status?: string | null;
        last_interaction?: string | null;
      } | null = null;

      if (data.stranka_id) {
        const clientId = String(data.stranka_id);
        const clientRow = await (async () => {
          // First detect which ID column exists to avoid 400 errors from non-existent columns
          const { detectColumnForTable } = await import('@/lib/tableIntrospection');
          const idColumn = await detectColumnForTable(
            'Stranke',
            ['ID stranke', 'id', 'ID_stranke', 'client_id'],
            'client-id'
          );
          if (!idColumn) return null;

          const { data: row } = await supabase
            .from('Stranke')
            .select('*')
            .eq(idColumn, clientId)
            .maybeSingle();

          return row as Record<string, unknown> | null;
        })();

        if (clientRow) {
          const resolvedClientId = String(
            pickFirst(clientRow, ['ID stranke', 'id', 'ID_stranke', 'client_id']) ?? clientId
          );
          const firstName = String(
            pickFirst(clientRow, ['Ime', 'ime', 'first_name', 'firstName', 'name']) ?? ''
          );
          const lastName = String(
            pickFirst(clientRow, ['Priimek', 'priimek', 'last_name', 'lastName', 'surname']) ?? ''
          );
          const emailValue = pickFirst(clientRow, ['email', 'Email', 'Email stranke', 'e-mail', 'E-mail']);
          const phoneValue = pickFirst(clientRow, ['Telefonska številka', 'Telefon', 'telefon', 'phone', 'Phone', 'tel']);
          const genderValue = pickFirst(clientRow, ['Spol', 'spol', 'gender', 'Gender']);
          const colorValue = pickFirst(clientRow, ['Barva', 'barva', 'color', 'Color']);
          const notesValue = pickFirst(clientRow, ['Opombe', 'opombe', 'notes', 'Notes', 'Opombe stranke', 'Opombe strank']);
          const tagsValue = pickFirst(clientRow, ['Tags', 'tags']);
          const statusValue = pickFirst(clientRow, ['Status', 'status']);
          const lastInteractionValue = pickFirst(clientRow, [
            'Zadnja interakcija',
            'zadnja_interakcija',
            'last_interaction',
            'Last Interaction',
          ]);

          clientDetails = {
            id: resolvedClientId,
            ime: firstName,
            priimek: lastName,
            email: emailValue ? String(emailValue) : null,
            telefon: phoneValue ? String(phoneValue) : null,
            spol: genderValue ? String(genderValue) : null,
            barva: colorValue ? String(colorValue) : null,
            notes: notesValue ? String(notesValue) : null,
            tags: Array.isArray(tagsValue)
              ? tagsValue.map(String)
              : tagsValue
              ? String(tagsValue)
              : null,
            status: statusValue ? String(statusValue) : null,
            last_interaction: lastInteractionValue ? String(lastInteractionValue) : null,
          };
        }
      }

      // Build enhanced payload with full service, employee, and client data
      const enhancedData = buildEnhancedAppointmentData({
        companyId,
        userEmail: actor,
        companyProfile: companyPayload,
        appointmentData: isNewAppointment ? { ...data, id: unique8DigitId } : data,
        serviceDetails: selectedService
          ? {
              id: selectedService.id,
              naziv: selectedService.naziv,
              trajanje: selectedService.trajanje,
              skupni_cas: selectedService.skupni_cas,
              cena: selectedService.cena,
              barva: selectedService.barva,
            }
          : null,
        serviceDetails2: selectedService2
          ? {
              id: selectedService2.id,
              naziv: selectedService2.naziv,
              trajanje: selectedService2.trajanje,
              skupni_cas: selectedService2.skupni_cas,
              cena: selectedService2.cena,
              barva: selectedService2.barva,
            }
          : null,
        serviceDetails3: selectedService3
          ? {
              id: selectedService3.id,
              naziv: selectedService3.naziv,
              trajanje: selectedService3.trajanje,
              skupni_cas: selectedService3.skupni_cas,
              cena: selectedService3.cena,
              barva: selectedService3.barva,
            }
          : null,
        employeeDetails: selectedEmployee
          ? {
              id: selectedEmployee.id,
              ime: selectedEmployee.ime,
              priimek: selectedEmployee.priimek,
              email: selectedEmployee.email,
              barva: selectedEmployee.barva,
            }
          : null,
        clientDetails,
        unique8DigitId,
      });

      const result = await callN8nAction(
        buildPayload(event, 'appointments', enhancedData)
      );

      if (!result.ok) {
        throw new Error('Napaka pri shranjevanju termina');
      }

      // Wait 1 second for system to process
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await loadData();
      handleCloseModal();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Napaka pri shranjevanju');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!companyId || !deleteTarget) return;

    setIsDeleting(true);
    setActionError(null);

    try {
      const result = await callN8nAction(
        buildPayload(
          'IZBRIS_TERMINA',
          'appointments',
          buildBookingDeleteData({
            companyId,
            userEmail: actor,
            companyProfile: companyPayload,
            appointmentId: deleteTarget.id,
          })
        )
      );

      if (!result.ok) {
        throw new Error('Napaka pri brisanju termina');
      }

      // Wait 1 second for system to process
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await loadData();
      setDeleteTarget(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Napaka pri brisanju');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleComplete = (appointment: AppointmentWithDetails) => {
    setCompleteTarget(appointment);
  };

  // No Show handler
  const handleNoShow = async (appointment: AppointmentWithDetails) => {
    if (!companyId) return;

    setIsDeleting(true);
    setActionError(null);

    try {
      const result = await callN8nAction(
        buildPayload(
          'NO_SHOW_TERMINA',
          'appointments',
          {
            appointment_id: appointment.id,
            booking_id: appointment.id,
            company_id: companyId,
            user_email: actor,
            company_profile: companyPayload,
            status: 'no_show',
            previous_status: appointment.status,
            stranka_ime: appointment.stranka_ime,
            stranka_id: appointment.stranka_id,
            datum: appointment.datum,
            cas_zacetek: appointment.cas_zacetek,
          }
        )
      );

      if (!result.ok) {
        throw new Error('Napaka pri označevanju kot No Show');
      }

      setSuccessMessage('Termin označen kot No Show');
      setTimeout(() => setSuccessMessage(null), 3000);

      await new Promise((resolve) => setTimeout(resolve, 700));
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Napaka pri No Show');
    } finally {
      setIsDeleting(false);
    }
  };

  // Cancel handler
  const handleCancel = async (appointment: AppointmentWithDetails) => {
    if (!companyId) return;

    setIsDeleting(true);
    setActionError(null);

    try {
      const result = await callN8nAction(
        buildPayload(
          'ODPOVED_TERMINA',
          'appointments',
          {
            appointment_id: appointment.id,
            booking_id: appointment.id,
            company_id: companyId,
            user_email: actor,
            company_profile: companyPayload,
            status: 'cancelled',
            previous_status: appointment.status,
            stranka_ime: appointment.stranka_ime,
            stranka_id: appointment.stranka_id,
            datum: appointment.datum,
            cas_zacetek: appointment.cas_zacetek,
          }
        )
      );

      if (!result.ok) {
        throw new Error('Napaka pri odpovedi termina');
      }

      setSuccessMessage('Termin uspešno odpovedan');
      setTimeout(() => setSuccessMessage(null), 3000);

      await new Promise((resolve) => setTimeout(resolve, 700));
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Napaka pri odpovedi');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmComplete = async () => {
    if (!companyId || !completeTarget) return;

    setIsCompleting(true);
    setActionError(null);

    try {
      const trimmedNotes = completionNotes.trim();
      const completionNotesValue = trimmedNotes.length > 0 ? trimmedNotes : null;
      // Get customer appointments count for webhook
      const customerAppointmentsCount = await getCustomerAppointmentsCount(
        companyId,
        completeTarget.stranka_id || completeTarget.stranka_ime
      );

      // Build the updated booking row with status changed to Zaključen and completion notes
      const bookingRowUpdated = {
        ...completeTarget,
        status: 'Zaključen',
        booking_id: completeTarget.id,
        appointment_id: completeTarget.id,
        opombe: completionNotesValue,
        completion_notes: completionNotesValue,
      };

      const result = await callN8nAction(
        buildPayload(
          'ZAKLJUCITEV_TERMINA',
          'appointments',
          buildBookingCompleteData({
            companyId,
            userEmail: actor,
            companyProfile: companyPayload,
            bookingRowUpdated,
            customerAppointmentsCount,
          })
        )
      );

      if (!result.ok) {
        throw new Error('Napaka pri zaključevanju termina');
      }

      setSuccessMessage('Termin uspešno zaključen');
      setTimeout(() => setSuccessMessage(null), 3000);

      // Wait 1.5 seconds for system to process completion
      await new Promise((resolve) => setTimeout(resolve, 1500));

      await loadData();
      setCompleteTarget(null);
      setCompletionNotes(''); // Reset notes after completion
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Napaka pri zaključevanju');
    } finally {
      setIsCompleting(false);
    }
  };

  const dismissError = () => {
    setError(null);
    setActionError(null);
  };

  if (!companyId) return null;

  // Stats for header
  const currentMonthCount = appointments.filter((apt) => {
    const today = new Date();
    const aptDate = new Date(apt.datum);
    return (
      aptDate.getFullYear() === today.getFullYear() &&
      aptDate.getMonth() === today.getMonth()
    );
  }).length;

  const todayCount = appointments.filter((apt) => {
    const today = new Date();
    const aptDate = new Date(apt.datum);
    return (
      aptDate.getFullYear() === today.getFullYear() &&
      aptDate.getMonth() === today.getMonth() &&
      aptDate.getDate() === today.getDate()
    );
  }).length;

  const upcomingCount = appointments.filter((apt) => {
    const now = new Date();
    const aptDate = new Date(apt.datum);
    return aptDate > now;
  }).length;

  return (
    <ProtectedLayout>
      <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex flex-wrap items-start justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl font-bold text-[#1A1F36]">Termini</h1>
              <p className="mt-1 text-sm text-gray-500">
                Upravljajte vse termine na enem mestu
              </p>
            </div>

            <motion.button
              type="button"
              onClick={handleCreate}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500
                         px-5 py-2.5 text-sm text-white shadow-lg shadow-cyan-500/25
                         transition-shadow hover:shadow-xl hover:shadow-cyan-500/30"
            >
              <Plus className="h-4 w-4" weight="bold" />
              <span>Nov termin</span>
            </motion.button>
          </motion.div>

          {/* Stats cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={<CalendarBlank className="h-6 w-6" weight="bold" />}
              value={currentMonthCount}
              label="Termini ta mesec"
              delay={0}
            />
            <StatCard
              icon={<Clock className="h-6 w-6" weight="bold" />}
              value={todayCount}
              label="Danes"
              delay={1}
            />
            <StatCard
              icon={<ArrowRight className="h-6 w-6" weight="bold" />}
              value={upcomingCount}
              label="Prihajajoči"
              delay={2}
            />
          </div>

          {/* Error message */}
          <AnimatePresence>
            {(error || actionError) && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="mb-6 overflow-hidden rounded-xl bg-gradient-to-r from-red-50 to-rose-50
                           ring-1 ring-red-100"
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100">
                      <Warning className="h-5 w-5 text-red-600" weight="regular" />
                    </div>
                    <p className="text-sm font-medium text-red-700">{error || actionError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={dismissError}
                    className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-100 hover:text-red-600"
                  >
                    <X className="h-4 w-4" weight="bold" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100"
          >
            <AppointmentFilters
              filters={filters}
              onFiltersChange={setFilters}
              employees={employees}
              services={services}
            />
          </motion.div>

          {/* Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <AppointmentTable
              appointments={filteredAppointments}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onComplete={handleComplete}
              onNoShow={handleNoShow}
              onCancel={handleCancel}
              isLoading={isLoading}
            />
          </motion.div>
        </div>
      </main>

      {/* Modals */}
      <AppointmentModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        appointment={selectedAppointment}
        mode={modalMode}
        services={services}
        employees={employees}
        onSave={handleSave}
        isSaving={isSaving}
      />

      <DeleteConfirmation
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Izbriši termin"
        message="Ali ste prepričani, da želite izbrisati ta termin?"
        appointment={deleteTarget}
        isDeleting={isDeleting}
      />

      {/* Complete Confirmation Modal */}
      <AnimatePresence>
        {completeTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => {
              if (!isCompleting) {
                setCompleteTarget(null);
                setCompletionNotes('');
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with icon outside circle */}
              <div className="relative flex flex-col items-center gap-2 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-green-50 px-6 py-5">
                <motion.button
                  type="button"
                  onClick={() => {
                    if (!isCompleting) {
                      setCompleteTarget(null);
                      setCompletionNotes('');
                    }
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-4 w-4" weight="bold" />
                </motion.button>
                <CheckCircle className="h-10 w-10 text-emerald-500" weight="fill" />
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-[#1A1F36]">Zaključi termin</h2>
                  <p className="text-sm text-gray-500">Potrdite zaključitev termina</p>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Client with initials */}
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold flex-shrink-0 bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                    {completeTarget.stranka_ime?.split(' ').map((n: string) => n.charAt(0)).join('').substring(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-xs text-gray-500">Stranka</p>
                    <p className="text-sm font-semibold text-[#1A1F36]">{completeTarget.stranka_ime}</p>
                  </div>
                </div>

                {/* Service with color circle */}
                {completeTarget.storitev && (
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ background: completeTarget.storitev.barva || '#6366F1' }}
                    />
                    <div>
                      <p className="text-xs text-gray-500">Storitev</p>
                      <p className="text-sm font-semibold text-[#1A1F36]">{completeTarget.storitev.naziv}</p>
                    </div>
                  </div>
                )}

                {/* Date */}
                <div className="flex items-center gap-3">
                  <CalendarBlank className="h-[18px] w-[18px] text-emerald-500 flex-shrink-0" weight="regular" />
                  <div>
                    <p className="text-xs text-gray-500">Datum</p>
                    <p className="text-sm font-semibold text-[#1A1F36]">
                      {new Date(completeTarget.datum).toLocaleDateString('sl-SI', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                {/* Time */}
                <div className="flex items-center gap-3">
                  <Clock className="h-[18px] w-[18px] text-emerald-500 flex-shrink-0" weight="regular" />
                  <div>
                    <p className="text-xs text-gray-500">Čas</p>
                    <p className="text-sm font-semibold text-[#1A1F36]">
                      {completeTarget.cas_zacetek?.substring(0, 5)} - {completeTarget.cas_konec?.substring(0, 5)}
                    </p>
                  </div>
                </div>

                {/* Notes field (optional) */}
                <div>
                  <label htmlFor="completion-notes" className="block text-sm font-semibold text-gray-700 mb-2">
                    Sporočilo stranki oz. navodila po terminu
                  </label>
                  <textarea
                    id="completion-notes"
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder="Vnesite sporočilo ali navodila po zaključenem terminu (opcijsko)..."
                    rows={4}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 resize-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setCompleteTarget(null);
                    setCompletionNotes('');
                  }}
                  disabled={isCompleting}
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  Prekliči
                </button>
                <motion.button
                  type="button"
                  onClick={handleConfirmComplete}
                  disabled={isCompleting}
                  whileHover={{ scale: isCompleting ? 1 : 1.02 }}
                  whileTap={{ scale: isCompleting ? 1 : 0.98 }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:from-emerald-600 hover:to-green-700 disabled:opacity-50"
                >
                  {isCompleting ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="h-4 w-4 rounded-full border-2 border-white border-t-transparent"
                      />
                      Zaključujem...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" weight="bold" />
                      Zaključi
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3 text-white shadow-lg"
          >
            <ListChecks className="h-5 w-5" weight="fill" />
            <span className="text-sm font-medium">{successMessage}</span>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="ml-2 rounded-full p-0.5 transition-colors hover:bg-white/20"
            >
              <X className="h-4 w-4" weight="bold" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </ProtectedLayout>
  );
}

export default function TerminiPage() {
  return (
    <Suspense>
      <TerminiPageInner />
    </Suspense>
  );
}
