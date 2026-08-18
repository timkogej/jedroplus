'use client';

import { useEffect, useState, useMemo, useCallback, useRef, Suspense } from 'react';
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
  DownloadSimple,
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import AmbientBottomGlow from '@/components/shared/AmbientBottomGlow';
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
import type { AppointmentsInitialData } from '@/lib/appointments/fetchAppointmentsData.server';
import { loadAppointmentsFrom } from './actions';
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
import { useUserPersonId } from '@/hooks/useUserPersonId';
import { useRolePermissions } from '@/app/role-permission-context';
import DisabledActionModal from '@/components/DisabledActionModal';
import ExportAppointmentsModal from '@/components/appointments/ExportAppointmentsModal';
import { useTranslations } from 'next-intl';

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
            className="text-3xl text-gray-900 mb-1"
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

function TerminiPageInner({ initialData }: { initialData: AppointmentsInitialData | null }) {
  const t = useTranslations('appointments');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { companyId, companySettings, loading: companyLoading } = useCompany();
  const { user } = useAuth();
  const userPersonId = useUserPersonId(user?.id);
  const { role, personId: rolePersonId, permissions } = useRolePermissions();
  const [showDisabledCreateModal, setShowDisabledCreateModal] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Data states — seeded from server-fetched initialData when available.
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>(initialData?.appointments ?? []);
  const [services, setServices] = useState<Storitev[]>(initialData?.services ?? []);
  const [employees, setEmployees] = useState<(Zaposleni & { initials: string })[]>(initialData?.employees ?? []);
  const [isLoading, setIsLoading] = useState(!initialData);
  // When the server provided initialData, skip the on-mount client fetch (and its
  // re-runs as context resolves). Post-mutation refreshes still call loadData().
  const skipAutoFetch = useRef(!!initialData);
  const [error, setError] = useState<string | null>(null);

  // Date-range scoping. In server mode we load [windowFrom, ∞) up front; a date
  // filter earlier than windowFrom expands the loaded range via a server action.
  // In the client fallback (no initialData) the old path loads everything, so no
  // windowing applies.
  const serverMode = !!initialData;
  const [loadedFrom, setLoadedFrom] = useState<string>(initialData?.windowFrom ?? '');

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
      // Server mode: refresh only the currently-loaded window via the server
      // action (session-aware, own-only-filtered) so mutations don't re-pull the
      // whole table. Fallback mode: the original full client fetch.
      if (serverMode) {
        const result = await loadAppointmentsFrom(loadedFrom);
        if (result) {
          setAppointments(result.appointments);
          setServices(result.services);
          setEmployees(result.employees);
          return;
        }
        // result null (e.g. cookie/session gone) — fall through to client fetch.
      }

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
      setError(t('errors.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [companyId, serverMode, loadedFrom, t]);

  useEffect(() => {
    if (skipAutoFetch.current) return; // server already provided initialData
    loadData();
  }, [loadData]);

  // Range expansion: when the date filter reaches earlier than the loaded window,
  // load that older range from the server and replace the working set. Dates at
  // or after loadedFrom are already loaded and handled client-side (instant).
  useEffect(() => {
    if (!serverMode) return; // fallback mode already has everything
    const from = filters.dateFrom;
    if (!from || from >= loadedFrom) return;

    let cancelled = false;
    setIsLoading(true);
    loadAppointmentsFrom(from)
      .then((result) => {
        if (cancelled || !result) return;
        setAppointments(result.appointments);
        setServices(result.services);
        setEmployees(result.employees);
        setLoadedFrom(result.windowFrom);
      })
      .catch(() => {
        if (!cancelled) setError(t('errors.loadError'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters.dateFrom, loadedFrom, serverMode, t]);

  // Auto-set employee filter when user is connected to a person
  useEffect(() => {
    if (userPersonId === undefined) return;
    if (userPersonId) {
      setFilters((prev) => ({ ...prev, employeeId: userPersonId }));
    }
  }, [userPersonId]);

  // For staff: determine if appointments should be restricted to own only
  const staffViewOwnOnly =
    role === 'staff' &&
    (permissions?.can_view_only_own_appointments === true ||
      permissions?.can_view_all_appointments === false);

  // For staff: determine edit access per appointment
  const staffEditOwnOnly =
    role === 'staff' &&
    (permissions?.can_edit_only_own_appointments === true ||
      permissions?.can_edit_all_appointments === false);

  const canEditAppointment = (apt: AppointmentWithDetails) => {
    if (staffEditOwnOnly) return apt.zaposleni_id === rolePersonId;
    return true;
  };

  const canDeleteAppointment =
    role !== 'staff' || (permissions?.can_delete_appointments ?? true);

  const canCreateAppointment =
    role !== 'staff' || (permissions?.can_create_appointments ?? true);

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      // Staff view restriction: only show own appointments when required
      if (staffViewOwnOnly && apt.zaposleni_id !== rolePersonId) return false;
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
  }, [appointments, filters, staffViewOwnOnly, rolePersonId]);

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
        language?: string | null;
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
          const languageValue = pickFirst(clientRow, ['language', 'Language', 'Jezik komunikacije', 'jezik_komunikacije', 'Jezik', 'jezik', 'preferred_language']);
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
            language: languageValue ? String(languageValue) : null,
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
        throw new Error(t('errors.saveError'));
      }

      // Wait 1 second for system to process
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await loadData();
      handleCloseModal();
    } catch (err) {
      setActionError(t('errors.saveError'));
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
        throw new Error(t('errors.deleteError'));
      }

      // Wait 1 second for system to process
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await loadData();
      setDeleteTarget(null);
    } catch (err) {
      setActionError(t('errors.deleteError'));
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
            language: appointment.language,
            datum: appointment.datum,
            cas_zacetek: appointment.cas_zacetek,
          }
        )
      );

      if (!result.ok) {
        throw new Error(t('errors.noShowError'));
      }

      setSuccessMessage(t('toast.noShow'));
      setTimeout(() => setSuccessMessage(null), 3000);

      await new Promise((resolve) => setTimeout(resolve, 700));
      await loadData();
    } catch (err) {
      setActionError(t('errors.noShowError'));
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
            language: appointment.language,
            datum: appointment.datum,
            cas_zacetek: appointment.cas_zacetek,
          }
        )
      );

      if (!result.ok) {
        throw new Error(t('errors.cancelError'));
      }

      setSuccessMessage(t('toast.cancelled'));
      setTimeout(() => setSuccessMessage(null), 3000);

      await new Promise((resolve) => setTimeout(resolve, 700));
      await loadData();
    } catch (err) {
      setActionError(t('errors.cancelError'));
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
        throw new Error(t('errors.completeError'));
      }

      setSuccessMessage(t('toast.completed'));
      setTimeout(() => setSuccessMessage(null), 3000);

      // Wait 1.5 seconds for system to process completion
      await new Promise((resolve) => setTimeout(resolve, 1500));

      await loadData();
      setCompleteTarget(null);
      setCompletionNotes(''); // Reset notes after completion
    } catch (err) {
      setActionError(t('errors.completeError'));
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
      <main className="relative isolate min-h-screen bg-white">
        <AmbientBottomGlow tone="purple" />
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex flex-wrap items-start justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl font-normal text-[#1A1F36]">{t('page.title')}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('page.subtitle')}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <motion.button
                type="button"
                onClick={() => setExportModalOpen(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-4 py-2.5
                           text-sm font-medium text-gray-700 shadow-sm transition-all
                           hover:bg-gray-50 hover:shadow-md"
              >
                <DownloadSimple className="h-4 w-4" weight="regular" />
                <span className="hidden sm:inline">Izvozi</span>
              </motion.button>

              <motion.button
                type="button"
                onClick={canCreateAppointment ? handleCreate : () => setShowDisabledCreateModal(true)}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500
                           px-5 py-2.5 text-sm text-white shadow-lg shadow-cyan-500/25
                           transition-shadow hover:shadow-xl hover:shadow-cyan-500/30"
              >
                <Plus className="h-4 w-4" weight="bold" />
                <span>{t('page.newAppointment')}</span>
              </motion.button>
            </div>
          </motion.div>

          {/* Stats cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={<CalendarBlank className="h-6 w-6" weight="regular" />}
              value={currentMonthCount}
              label={t('page.stats.thisMonth')}
              delay={0}
            />
            <StatCard
              icon={<Clock className="h-6 w-6" weight="regular" />}
              value={todayCount}
              label={t('page.stats.today')}
              delay={1}
            />
            <StatCard
              icon={<ArrowRight className="h-6 w-6" weight="regular" />}
              value={upcomingCount}
              label={t('page.stats.upcoming')}
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
              employees={staffViewOwnOnly && rolePersonId ? employees.filter(e => e.id === rolePersonId) : employees}
              services={services}
              restrictedEmployeeId={staffViewOwnOnly && rolePersonId ? rolePersonId : undefined}
              staffViewOwnOnly={staffViewOwnOnly}
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
              canEditAppointment={canEditAppointment}
              canDeleteAppointment={canDeleteAppointment}
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
        initialEmployeeId={role === 'staff' && rolePersonId ? rolePersonId : undefined}
      />

      <DeleteConfirmation
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={t('deleteModal.title')}
        message={t('deleteModal.message')}
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
              {/* Header */}
              <div className="relative flex items-center gap-3 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-green-50 px-6 py-5">
                <CheckCircle className="h-8 w-8 text-emerald-500 flex-shrink-0" weight="regular" />
                <div>
                  <h2 className="text-lg font-semibold text-[#1A1F36]">{t('completeModal.title')}</h2>
                  <p className="text-sm text-gray-500">{t('completeModal.subtitle')}</p>
                </div>
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
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Client with initials */}
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold flex-shrink-0 bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                    {completeTarget.stranka_ime?.split(' ').map((n: string) => n.charAt(0)).join('').substring(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-xs text-gray-500">{t('completeModal.client')}</p>
                    <p className="text-sm font-semibold text-[#1A1F36]">{completeTarget.stranka_ime}</p>
                  </div>
                </div>

                {/* Service with color circle */}
                {completeTarget.storitev && (
                  <div className="flex items-start gap-3">
                    <div
                      className="h-3 w-3 rounded-full flex-shrink-0 mt-1"
                      style={{ background: completeTarget.storitev.barva || '#6366F1' }}
                    />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">{t('completeModal.service')}</p>
                      <div className="space-y-1 mt-0.5">
                        <p className="text-sm font-semibold text-[#1A1F36]">{completeTarget.storitev.naziv}</p>
                        {completeTarget.storitev_2 && (
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                              style={{ background: completeTarget.storitev_2.barva || '#6366F1' }}
                            />
                            <p className="text-sm font-semibold text-[#1A1F36]">{completeTarget.storitev_2.naziv}</p>
                          </div>
                        )}
                        {completeTarget.storitev_3 && (
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                              style={{ background: completeTarget.storitev_3.barva || '#6366F1' }}
                            />
                            <p className="text-sm font-semibold text-[#1A1F36]">{completeTarget.storitev_3.naziv}</p>
                          </div>
                        )}
                        {completeTarget.add_on_naziv && (
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                              style={{ background: completeTarget.add_on_storitev?.barva || '#6366F1' }}
                            />
                            <p className="text-sm font-semibold text-[#1A1F36]">{completeTarget.add_on_naziv}</p>
                            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                              <Plus className="h-2.5 w-2.5" weight="bold" />
                              Dodatna storitev
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Employee */}
                {completeTarget.zaposleni && (
                  <div className="flex items-center gap-3">
                    <span
                      className="text-base font-bold flex-shrink-0"
                      style={{
                        backgroundImage: completeTarget.zaposleni.barva || 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      {completeTarget.zaposleni.ime?.charAt(0)}{completeTarget.zaposleni.priimek?.charAt(0)}
                    </span>
                    <div>
                      <p className="text-xs text-gray-500">{t('completeModal.employee')}</p>
                      <p className="text-sm font-semibold text-[#1A1F36]">{completeTarget.zaposleni.ime} {completeTarget.zaposleni.priimek}</p>
                    </div>
                  </div>
                )}

                {/* Date */}
                <div className="flex items-center gap-3">
                  <CalendarBlank className="h-[18px] w-[18px] text-emerald-500 flex-shrink-0" weight="regular" />
                  <div>
                    <p className="text-xs text-gray-500">{t('completeModal.date')}</p>
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
                    <p className="text-xs text-gray-500">{t('completeModal.time')}</p>
                    <p className="text-sm font-semibold text-[#1A1F36]">
                      {completeTarget.cas_zacetek?.substring(0, 5)} - {completeTarget.cas_konec?.substring(0, 5)}
                    </p>
                  </div>
                </div>

                {/* Notes field (optional) */}
                <div>
                  <label htmlFor="completion-notes" className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('completeModal.notesLabel')}
                  </label>
                  <textarea
                    id="completion-notes"
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder={t('completeModal.notesPlaceholder')}
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
                  {t('completeModal.cancel')}
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
                      {t('completeModal.completing')}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" weight="bold" />
                      {t('completeModal.confirm')}
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

      <ExportAppointmentsModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        companyId={companyId}
        appointments={appointments}
      />

      <DisabledActionModal
        isOpen={showDisabledCreateModal}
        onClose={() => setShowDisabledCreateModal(false)}
        message={t('page.disabledCreateMessage')}
      />
    </ProtectedLayout>
  );
}

export default function AppointmentsClient({ initialData }: { initialData: AppointmentsInitialData | null }) {
  return (
    <Suspense>
      <TerminiPageInner initialData={initialData} />
    </Suspense>
  );
}
