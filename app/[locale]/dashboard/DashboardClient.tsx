"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useFormat } from '@/hooks/useFormat';
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import {
  CalendarCheck,
  UsersThree,
  CurrencyCircleDollar,
  Clock,
  Plus,
  UserPlus,
  ArrowRight,
  Warning,
  X,
  CheckCircle,
  ListChecks,
  CalendarBlank,
  Copy,
  Check,
  NotePencil,
  XCircle,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import ProtectedLayout from "@/components/ProtectedLayout";
import { useCompany } from "@/app/company-context";
import { useAuth } from "@/app/auth-context";
import {
  AppointmentListCard,
  TopServicesCard,
  TopEmployeesCard,
  RecentActivityCard,
  WeeklyChart,
  Section,
  MetricGroup,
} from "@/components/dashboard";
import { initialsStyle } from "@/components/dashboard/initialsStyle";
import {
  fetchDashboardData,
  type DashboardData,
  type AppointmentItem,
} from "@/lib/dashboard/fetchDashboardData";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";
import { intlLocale } from "@/lib/format";
import AppointmentModal, { type AppointmentFormData } from "@/components/appointments/AppointmentModal";
import DeleteConfirmation from "@/components/appointments/DeleteConfirmation";
import ClientModal from "@/components/clients/ClientModal";
import { fetchServices, fetchEmployees } from "@/lib/supabase/appointments";
import type { AppointmentWithDetails, Storitev, Zaposleni } from "@/types/appointments";
// Isto okence termina kot v Koledarju — z vsemi podatki in akcijami.
import { AppointmentDetailModal } from "@/components/calendar/AppointmentDetailSheet";
import type { ClientFormData } from "@/types/clients";
import { callN8nAction } from "@/src/lib/n8nClient";
import {
  buildBookingDeleteData,
  buildBookingCompleteData,
  buildEnhancedAppointmentData,
  getPodatkiPodjetja,
  getCustomerAppointmentsCount,
  buildClientCreateData,
} from "@/lib/webhookPayloadBuilders";
import { generateUnique8DigitId } from "@/lib/utils/uniqueIdGenerator";
import { pickFirst } from "@/lib/dashboardHelpers";
import { getNextClientId } from "@/src/lib/idGenerators";
import { getCompanyColumnForTable } from "@/lib/companyScope";
import { TABLES } from "@/lib/data";
import { useUserPersonId } from "@/hooks/useUserPersonId";
import { useRolePermissions } from "@/app/role-permission-context";
import { useTranslations } from "next-intl";
import FirstRunSetup from "@/components/onboarding/FirstRunSetup";
import GettingStarted from "@/components/guide/GettingStarted";
import StaffTourStarter from "@/components/guide/StaffTourStarter";
import NextLink from "next/link";

// ─── Podrobnosti termina ─────────────────────────────────────────────────────
// Na telefonu list od spodaj, na namizju sredinska plošča. Skupine z
// vrsticami oznaka/vrednost — vzorec iz iOS in macOS Nastavitev.


// ─── Main Dashboard (client shell) ────────────────────────────────────────────
// `initialData` is fetched server-side by page.tsx (RSC). When present, the shell
// renders immediately with it and skips the on-mount client fetch; it's null only
// on the fallback path (e.g. first load before the company cookie is set), where
// the shell fetches on mount exactly as before.
export default function DashboardClient({ initialData }: { initialData: DashboardData | null }) {
  const { money, locale } = useFormat();
  const t = useTranslations('dashboard');
  const router = useRouter();
  const { companyId, companySettings, loading: companyLoading, reloadSettings } = useCompany();
  const { user, loading: authLoading } = useAuth();
  const userPersonId = useUserPersonId(user?.id);
  const { role, personId: rolePersonId, permissions, loading: roleLoading } = useRolePermissions();
  // Staff only see colleagues' stats when allowed to see all appointments.
  const staffSeesAll = role !== 'staff' || permissions?.can_view_all_appointments === true;


  // RBAC: appointment permissions for staff
  const canCreateAppointment = role !== 'staff' || (permissions?.can_create_appointments ?? true);
  const canDeleteAppointment = role !== 'staff' || (permissions?.can_delete_appointments ?? true);
  const staffEditOwnOnly = role === 'staff' && (
    (permissions?.can_edit_only_own_appointments === true) ||
    (permissions?.can_edit_all_appointments === false)
  );
  const canEditAppointment = useCallback((apt: AppointmentWithDetails): boolean => {
    if (role !== 'staff') return true;
    if (staffEditOwnOnly) return apt.zaposleni_id === rolePersonId;
    return true;
  }, [role, staffEditOwnOnly, rolePersonId]);

  // Dashboard data
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  // When the server provided initialData, skip the on-mount client fetch entirely
  // (including its re-runs as company/role context resolves). Explicit refreshes
  // after a create/edit/delete still call loadDashboard() directly.
  const skipAutoFetch = useRef(!!initialData);
  const [error, setError] = useState<string | null>(null);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  // Services & employees for modals
  const [services, setServices] = useState<Storitev[]>([]);
  const [employees, setEmployees] = useState<(Zaposleni & { initials: string })[]>([]);

  // New appointment modal
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  // Re-counts the getting-started checklist after a booking is saved.
  const [checklistRefresh, setChecklistRefresh] = useState(0);
  const [isNewAppointmentSaving, setIsNewAppointmentSaving] = useState(false);

  // New client modal
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [isNewClientSaving, setIsNewClientSaving] = useState(false);

  // Appointment detail / edit
  const [viewingAppointment, setViewingAppointment] = useState<AppointmentWithDetails | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithDetails | null>(null);
  const [isEditSaving, setIsEditSaving] = useState(false);

  // Complete confirmation
  const [completeTarget, setCompleteTarget] = useState<AppointmentWithDetails | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<AppointmentWithDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Action feedback
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Next appointment for staff dashboard card - uses dedicated per-person query
  const nextAppointment = useMemo(() => {
    if (role !== 'staff' || !dashboardData) return null;
    const apt = dashboardData.nextPersonAppointment;
    if (!apt) return null;
    const today = new Date().toISOString().split('T')[0];
    return { ...apt, isToday: apt.datum === today };
  }, [role, dashboardData]);

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

  // ── Initial auth check ───────────────────────────────────────────────────
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) { window.location.href = '/login'; return; }
        const { data: profile } = await supabase
          .from('profiles')
          .select('default_company_id')
          .eq('id', currentUser.id)
          .maybeSingle();
        if (!profile?.default_company_id) { window.location.href = '/onboarding'; return; }

        // If localStorage has no company_id yet (fresh login), pre-populate it so
        // CompanyProvider can load without needing the onboarding redirect cycle.
        if (!localStorage.getItem('jedroplus_company_id')) {
          const { data: company } = await supabase
            .from('companies')
            .select('company_id')
            .eq('id', profile.default_company_id)
            .maybeSingle();
          if (company?.company_id) {
            localStorage.setItem('jedroplus_company_id', company.company_id);
            document.cookie = `company_id=${company.company_id}; path=/; max-age=31536000`;
          }
        }

        setInitialCheckDone(true);
      } catch (err) {
        console.error('Access check error:', err);
        window.location.href = '/login';
      }
    };
    checkAccess();
  }, []);

  // ── Company context check ────────────────────────────────────────────────
  useEffect(() => {
    if (!initialCheckDone) return;
    if (companyLoading || authLoading) return;
    if (!companyId) { window.location.href = "/onboarding"; return; }
    if (companyId && !companySettings) { reloadSettings(); }
  }, [companyId, companyLoading, authLoading, companySettings, reloadSettings, initialCheckDone]);

  // ── Load dashboard data ──────────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    if (!companyId) return;
    // Wait until personId is resolved (undefined = still loading)
    if (userPersonId === undefined) return;
    // Also wait for role/permissions to finish loading to avoid showing wrong appointments
    if (roleLoading) return;

    // For staff with view-own-only permission, use rolePersonId as the filter
    // so we never show other appointments even briefly
    const staffViewOwnOnly =
      role === 'staff' &&
      (permissions?.can_view_only_own_appointments === true ||
        permissions?.can_view_all_appointments === false);
    // Owners and admins see the whole company. They are often also on the
    // calendar (onboarding adds the owner as the first staff member), which
    // used to narrow their stats and revenue to their own appointments.
    const effectivePersonId =
      role === 'staff' ? (staffViewOwnOnly ? (rolePersonId ?? userPersonId) : userPersonId) : null;

    setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardData(companyId, effectivePersonId);
      setDashboardData(data);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
      setError(t('toast.loadError'));
    } finally {
      setLoading(false);
    }
  }, [companyId, userPersonId, roleLoading, role, permissions, rolePersonId]);

  useEffect(() => {
    if (skipAutoFetch.current) return; // server already provided initialData
    loadDashboard();
  }, [loadDashboard]);

  // ── Load services & employees for modals ─────────────────────────────────
  useEffect(() => {
    if (!companyId) return;
    const loadStaticData = async () => {
      const [servicesRes, employeesRes] = await Promise.all([
        fetchServices(companyId),
        fetchEmployees(companyId),
      ]);
      if (servicesRes.data) setServices(servicesRes.data);
      if (employeesRes.data) setEmployees(employeesRes.data);
    };
    loadStaticData();
  }, [companyId]);

  // ── Convert AppointmentItem → AppointmentWithDetails ─────────────────────
  const convertToAppointmentWithDetails = useCallback((item: AppointmentItem): AppointmentWithDetails => {
    const primaryService = item.serviceId ? services.find(s => s.id === item.serviceId) : null;
    const service2 = item.serviceId2 ? services.find(s => s.id === item.serviceId2) : null;
    const service3 = item.serviceId3 ? services.find(s => s.id === item.serviceId3) : null;
    const addOnService = item.addOnServiceId ? services.find(s => s.id === item.addOnServiceId) : null;
    const employee = item.employeeId ? employees.find(e => e.id === item.employeeId) : null;

    return {
      id: item.id,
      datum: item.datum || new Date().toISOString().split('T')[0],
      cas_zacetek: item.time || '',
      cas_konec: item.endTime || '',
      stranka_id: item.clientId,
      stranka_ime: item.clientName,
      stranka_email: item.clientEmail,
      stranka_telefon: item.clientPhone,
      stranka_barva: item.clientColor,
      language: item.language,
      storitev_id: item.serviceId,
      storitev_id_2: item.serviceId2,
      storitev_id_3: item.serviceId3,
      add_on_storitev_id: item.addOnServiceId ?? null,
      add_on_naziv: item.addOnName ?? null,
      add_on_trajanje: item.addOnDuration ?? null,
      zaposleni_id: item.employeeId,
      status: (item.status || 'scheduled') as AppointmentWithDetails['status'],
      opombe: item.opombe,
      interne_opombe: item.interneOpombe,
      // Osnovna in končna cena sta ločeni; prej je bila končna kar osnovna,
      // zato se popust na nadzorni plošči ni nikoli pokazal.
      cena: item.details?.osnovna_cena ?? item.cena ?? null,
      koncna_cena: item.details?.koncna_cena ?? item.cena ?? null,
      popust: item.details?.popust ?? null,
      popust_tip: (item.details?.popust_tip as AppointmentWithDetails['popust_tip']) ?? null,
      promocija_tip: item.details?.promocija_tip ?? null,
      promocija_naziv: item.details?.promocija_naziv ?? null,
      popust_id: item.details?.popust_id ?? null,
      happy_hour_id: item.details?.happy_hour_id ?? null,
      add_on_popust: item.details?.add_on_popust ?? null,
      add_on_popust_tip: item.details?.add_on_popust_tip ?? null,
      valuta: item.details?.valuta ?? null,
      id_termina: item.details?.id_termina,
      belezi_termin: item.details?.belezi_termin ?? true,
      add_on_final_cena: item.addOnFinalCena ?? null,
      storitev: primaryService
        ? { id: primaryService.id, naziv: primaryService.naziv, barva: primaryService.barva, trajanje: primaryService.trajanje, cena: primaryService.cena }
        : item.serviceId
          ? { id: item.serviceId, naziv: item.serviceName, barva: item.serviceColor, trajanje: 0, cena: item.cena ?? null }
          : null,
      storitev_2: service2
        ? { id: service2.id, naziv: service2.naziv, barva: service2.barva, trajanje: service2.trajanje }
        : null,
      storitev_3: service3
        ? { id: service3.id, naziv: service3.naziv, barva: service3.barva, trajanje: service3.trajanje }
        : null,
      add_on_storitev: addOnService
        ? { id: addOnService.id, naziv: addOnService.naziv, barva: addOnService.barva, trajanje: addOnService.trajanje }
        : item.addOnServiceId && item.addOnName
          ? { id: item.addOnServiceId, naziv: item.addOnName, barva: item.addOnServiceColor || '#6366F1', trajanje: item.addOnDuration ?? 0 }
          : null,
      zaposleni: employee
        ? { id: employee.id, ime: employee.ime, priimek: employee.priimek, email: employee.email, initials: employee.initials, barva: employee.barva }
        : item.employeeId
          ? { id: item.employeeId, ime: item.employeeName.split(' ')[0] || '', priimek: item.employeeName.split(' ').slice(1).join(' ') || '', email: '', initials: item.employeeInitials, barva: item.employeeColor }
          : null,
    };
  }, [services, employees]);

  // ── Handle appointment click from list ───────────────────────────────────
  const handleAppointmentClick = useCallback((item: AppointmentItem) => {
    setViewingAppointment(convertToAppointmentWithDetails(item));
  }, [convertToAppointmentWithDetails]);

  // ── Edit from detail modal ───────────────────────────────────────────────
  const handleEditFromDetail = useCallback((appointment: AppointmentWithDetails) => {
    setViewingAppointment(null);
    setEditingAppointment(appointment);
  }, []);

  // ── Save appointment (new or edit) ───────────────────────────────────────
  const handleSaveAppointment = useCallback(async (data: AppointmentFormData, isNew: boolean) => {
    if (!companyId) return;
    const setter = isNew ? setIsNewAppointmentSaving : setIsEditSaving;
    setter(true);
    setActionError(null);

    try {
      const event = isNew ? 'NOV_TERMIN' : 'POSODOBITEV_TERMINA';
      let unique8DigitId: string | undefined;
      if (isNew) {
        unique8DigitId = await generateUnique8DigitId('Termini', 'id');
      }

      const selectedService = services.find((s) => s.id === data.storitev_id) ?? null;
      const selectedService2 = data.storitev_id_2 ? services.find((s) => s.id === data.storitev_id_2) ?? null : null;
      const selectedService3 = data.storitev_id_3 ? services.find((s) => s.id === data.storitev_id_3) ?? null : null;
      const selectedEmployee = employees.find((e) => e.id === data.zaposleni_id) ?? null;

      let clientDetails: {
        id: string; ime: string; priimek: string;
        email?: string | null; telefon?: string | null; spol?: string | null;
        barva?: string | null; notes?: string | null;
        tags?: string[] | string | null; status?: string | null;
        last_interaction?: string | null;
        language?: string | null;
      } | null = null;

      if (data.stranka_id) {
        const clientId = String(data.stranka_id);
        const clientRow = await (async () => {
          const { detectColumnForTable } = await import('@/lib/tableIntrospection');
          const idColumn = await detectColumnForTable('Stranke', ['ID stranke', 'id', 'ID_stranke', 'client_id'], 'client-id');
          if (!idColumn) return null;
          const { data: row } = await supabase.from('Stranke').select('*').eq(idColumn, clientId).maybeSingle();
          return row as Record<string, unknown> | null;
        })();

        if (clientRow) {
          const resolvedClientId = String(pickFirst(clientRow, ['ID stranke', 'id', 'ID_stranke', 'client_id']) ?? clientId);
          clientDetails = {
            id: resolvedClientId,
            ime: String(pickFirst(clientRow, ['Ime', 'ime', 'first_name', 'firstName', 'name']) ?? ''),
            priimek: String(pickFirst(clientRow, ['Priimek', 'priimek', 'last_name', 'lastName', 'surname']) ?? ''),
            email: pickFirst(clientRow, ['email', 'Email', 'Email stranke']) ? String(pickFirst(clientRow, ['email', 'Email', 'Email stranke'])) : null,
            telefon: pickFirst(clientRow, ['Telefonska številka', 'Telefon', 'telefon', 'phone']) ? String(pickFirst(clientRow, ['Telefonska številka', 'Telefon', 'telefon', 'phone'])) : null,
            spol: pickFirst(clientRow, ['Spol', 'spol', 'gender']) ? String(pickFirst(clientRow, ['Spol', 'spol', 'gender'])) : null,
            barva: pickFirst(clientRow, ['Barva', 'barva', 'color']) ? String(pickFirst(clientRow, ['Barva', 'barva', 'color'])) : null,
            notes: pickFirst(clientRow, ['Opombe', 'opombe', 'notes']) ? String(pickFirst(clientRow, ['Opombe', 'opombe', 'notes'])) : null,
            tags: null,
            status: null,
            last_interaction: null,
            language: pickFirst(clientRow, ['language', 'Language', 'Jezik komunikacije', 'jezik_komunikacije', 'Jezik', 'jezik', 'preferred_language'])
              ? String(pickFirst(clientRow, ['language', 'Language', 'Jezik komunikacije', 'jezik_komunikacije', 'Jezik', 'jezik', 'preferred_language']))
              : null,
          };
        }
      }

      const enhancedData = buildEnhancedAppointmentData({
        companyId,
        userEmail: actor,
        companyProfile: companyPayload,
        appointmentData: isNew ? { ...data, id: unique8DigitId } : data,
        serviceDetails: selectedService ? { id: selectedService.id, naziv: selectedService.naziv, trajanje: selectedService.trajanje, skupni_cas: selectedService.skupni_cas, cena: selectedService.cena, barva: selectedService.barva } : null,
        serviceDetails2: selectedService2 ? { id: selectedService2.id, naziv: selectedService2.naziv, trajanje: selectedService2.trajanje, skupni_cas: selectedService2.skupni_cas, cena: selectedService2.cena, barva: selectedService2.barva } : null,
        serviceDetails3: selectedService3 ? { id: selectedService3.id, naziv: selectedService3.naziv, trajanje: selectedService3.trajanje, skupni_cas: selectedService3.skupni_cas, cena: selectedService3.cena, barva: selectedService3.barva } : null,
        employeeDetails: selectedEmployee ? { id: selectedEmployee.id, ime: selectedEmployee.ime, priimek: selectedEmployee.priimek, email: selectedEmployee.email, barva: selectedEmployee.barva } : null,
        clientDetails,
        unique8DigitId,
      });

      const result = await callN8nAction(buildPayload(event, 'appointments', enhancedData));
      if (!result.ok) throw new Error('Prišlo je do napake pri shranjevanju termina.');

      setSuccessMessage(isNew ? t('toast.appointmentAdded') : t('toast.appointmentUpdated'));
      setTimeout(() => setSuccessMessage(null), 3000);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await loadDashboard();

      if (isNew) {
        setShowNewAppointmentModal(false);
        setChecklistRefresh((n) => n + 1);
      }
      else setEditingAppointment(null);
    } catch (err) {
      setActionError(t('toast.saveError'));
    } finally {
      setter(false);
    }
  }, [companyId, actor, companyPayload, buildPayload, services, employees, loadDashboard]);

  // ── Complete appointment ─────────────────────────────────────────────────
  const handleCompleteAppointment = useCallback((appointment: AppointmentWithDetails) => {
    setViewingAppointment(null);
    setCompleteTarget(appointment);
  }, []);

  const handleConfirmComplete = useCallback(async () => {
    if (!companyId || !completeTarget) return;
    setIsCompleting(true);
    setActionError(null);
    try {
      const trimmedNotes = completionNotes.trim();
      const completionNotesValue = trimmedNotes.length > 0 ? trimmedNotes : null;
      const customerAppointmentsCount = await getCustomerAppointmentsCount(companyId, completeTarget.stranka_id || completeTarget.stranka_ime);
      const bookingRowUpdated = { ...completeTarget, status: 'Zaključen', booking_id: completeTarget.id, appointment_id: completeTarget.id, opombe: completionNotesValue, completion_notes: completionNotesValue };
      const result = await callN8nAction(buildPayload('ZAKLJUCITEV_TERMINA', 'appointments', buildBookingCompleteData({ companyId, userEmail: actor, companyProfile: companyPayload, bookingRowUpdated, customerAppointmentsCount })));
      if (!result.ok) throw new Error('Prišlo je do napake pri zaključevanju termina.');
      setSuccessMessage(t('toast.appointmentCompleted'));
      setTimeout(() => setSuccessMessage(null), 3000);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await loadDashboard();
      setCompleteTarget(null);
      setCompletionNotes('');
    } catch (err) {
      setActionError(t('toast.completeError'));
    } finally {
      setIsCompleting(false);
    }
  }, [completeTarget, completionNotes, companyId, actor, companyPayload, buildPayload, loadDashboard]);

  // ── No Show ──────────────────────────────────────────────────────────────
  const handleNoShowAppointment = useCallback(async (appointment: AppointmentWithDetails) => {
    setViewingAppointment(null);
    setIsDeleting(true);
    setActionError(null);
    try {
      const result = await callN8nAction(buildPayload('NO_SHOW_TERMINA', 'appointments', {
        appointment_id: appointment.id, booking_id: appointment.id,
        company_id: companyId, user_email: actor, company_profile: companyPayload,
        status: 'no_show', previous_status: appointment.status,
        stranka_ime: appointment.stranka_ime, stranka_id: appointment.stranka_id,
        language: appointment.language,
        datum: appointment.datum, cas_zacetek: appointment.cas_zacetek,
      }));
      if (!result.ok) throw new Error('Prišlo je do napake pri označevanju kot No Show.');
      setSuccessMessage(t('toast.appointmentNoShow'));
      setTimeout(() => setSuccessMessage(null), 3000);
      await new Promise((resolve) => setTimeout(resolve, 500));
      await loadDashboard();
    } catch (err) {
      setActionError(t('toast.noShowError'));
    } finally {
      setIsDeleting(false);
    }
  }, [companyId, actor, companyPayload, buildPayload, loadDashboard]);

  // ── Cancel appointment ───────────────────────────────────────────────────
  const handleCancelAppointment = useCallback(async (appointment: AppointmentWithDetails) => {
    setViewingAppointment(null);
    setIsDeleting(true);
    setActionError(null);
    try {
      const result = await callN8nAction(buildPayload('ODPOVED_TERMINA', 'appointments', {
        appointment_id: appointment.id, booking_id: appointment.id,
        company_id: companyId, user_email: actor, company_profile: companyPayload,
        status: 'cancelled', previous_status: appointment.status,
        stranka_ime: appointment.stranka_ime, stranka_id: appointment.stranka_id,
        language: appointment.language,
        datum: appointment.datum, cas_zacetek: appointment.cas_zacetek,
      }));
      if (!result.ok) throw new Error('Prišlo je do napake pri odpovedi termina.');
      setSuccessMessage(t('toast.appointmentCancelled'));
      setTimeout(() => setSuccessMessage(null), 3000);
      await new Promise((resolve) => setTimeout(resolve, 500));
      await loadDashboard();
    } catch (err) {
      setActionError(t('toast.cancelError'));
    } finally {
      setIsDeleting(false);
    }
  }, [companyId, actor, companyPayload, buildPayload, loadDashboard]);

  // ── Delete appointment ───────────────────────────────────────────────────
  const handleDeleteAppointment = useCallback((appointment: AppointmentWithDetails) => {
    setViewingAppointment(null);
    setDeleteTarget(appointment);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!companyId || !deleteTarget) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      const result = await callN8nAction(buildPayload('IZBRIS_TERMINA', 'appointments', buildBookingDeleteData({ companyId, userEmail: actor, companyProfile: companyPayload, appointmentId: deleteTarget.id })));
      if (!result.ok) throw new Error('Prišlo je do napake pri brisanju termina.');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await loadDashboard();
      setDeleteTarget(null);
    } catch (err) {
      setActionError(t('toast.deleteError'));
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, companyId, actor, companyPayload, buildPayload, loadDashboard]);

  // ── Save new client ──────────────────────────────────────────────────────
  const handleSaveNewClient = useCallback(async (data: ClientFormData) => {
    if (!companyId) return;
    setIsNewClientSaving(true);
    try {
      const companyColumn = await getCompanyColumnForTable(TABLES.clients, companyId);
      const clientId = await getNextClientId(companyId);
      const clientType = data.tip_stranke || null;
      const newRow = {
        'ID stranke': clientId,
        Ime: data.ime, Priimek: data.priimek, Spol: data.spol,
        'Tip stranke': clientType,
        language: data.language,
        Email: data.email, Telefon: data.telefon,
        Opombe: data.opombe, 'Interne opombe': data.interne_opombe,
        [companyColumn]: companyId,
      };
      const payload = buildPayload('NOVA_STRANKA', 'clients', buildClientCreateData({ companyId, userEmail: actor, companyProfile: companyPayload, clientRow: newRow }));
      const result = await callN8nAction(payload, async () => {
        const nextId = await getNextClientId(companyId);
        return { ...payload, data: buildClientCreateData({ companyId, userEmail: actor, companyProfile: companyPayload, clientRow: { ...newRow, 'ID stranke': nextId } }) };
      });
      if (!result.ok) throw new Error('Prišlo je do napake pri ustvarjanju stranke.');
      setSuccessMessage(t('toast.clientAdded'));
      setTimeout(() => setSuccessMessage(null), 3000);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setShowNewClientModal(false);
      await loadDashboard();
    } catch (err) {
      setActionError(t('toast.clientSaveError'));
    } finally {
      setIsNewClientSaving(false);
    }
  }, [companyId, actor, companyPayload, buildPayload, loadDashboard]);

  // ── User display name ────────────────────────────────────────────────────
  const displayName = useMemo(() => {
    if (user?.user_metadata) {
      const metadata = user.user_metadata;
      if (metadata.full_name && typeof metadata.full_name === 'string') return metadata.full_name;
      if (metadata.name && typeof metadata.name === 'string') return metadata.name;
      if (metadata.first_name || metadata.last_name) {
        const combined = `${metadata.first_name || ''} ${metadata.last_name || ''}`.trim();
        if (combined) return combined;
      }
      if (metadata.ime || metadata.priimek) {
        const combined = `${metadata.ime || ''} ${metadata.priimek || ''}`.trim();
        if (combined) return combined;
      }
    }
    if (!user?.email) return t('defaultUser');
    const emailPrefix = user.email.split("@")[0];
    return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  }, [user]);

  const todayFormatted = (() => {
    const text = new Date().toLocaleDateString(intlLocale(locale), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return text.charAt(0).toUpperCase() + text.slice(1);
  })();

  // ── Greeting based on time of day ────────────────────────────────────────
  const welcomeGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return t('greeting.morning');
    if (hour >= 11 && hour < 14) return t('greeting.day');
    if (hour >= 14 && hour < 18) return t('greeting.afternoon');
    return t('greeting.evening');
  }, [t]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (!initialCheckDone || companyLoading || loading) {
    return (
      <ProtectedLayout>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="w-10 h-10">
            <svg className="w-10 h-10 animate-spin" viewBox="0 0 50 50">
              <defs>
                <linearGradient id="dashboard-spinner" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="50%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#06B6D4" />
                </linearGradient>
              </defs>
              <circle cx="25" cy="25" r="20" fill="none" stroke="url(#dashboard-spinner)" strokeWidth="3" strokeLinecap="round" strokeDasharray="80 50" />
            </svg>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <ProtectedLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Warning size={48} className="text-red-500 mx-auto mb-4" />
            <p className="text-gray-700 font-medium mb-2">{t('errorState.title')}</p>
            <p className="text-gray-500 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors"
            >
              {t('errorState.retry')}
            </button>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="mb-7"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
                  {welcomeGreeting} {displayName}
                </h1>
                <p className="mt-0.5 text-base text-gray-500">{todayFormatted}</p>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {canCreateAppointment && (
                  <button
                    type="button"
                    data-tour="new-appointment"
                    onClick={() => setShowNewAppointmentModal(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
                  >
                    <Plus size={17} weight="bold" />
                    <span>{t('quickActions.newAppointment')}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowNewClientModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100"
                >
                  <UserPlus size={17} weight="regular" className="text-gray-500" />
                  <span>{t('quickActions.newClient')}</span>
                </button>
              </div>
            </div>
          </motion.div>

          {/* Finishes the setup chosen in onboarding, then invites the first appointment */}
          <FirstRunSetup
            onCreateAppointment={() => setShowNewAppointmentModal(true)}
            onSeeded={loadDashboard}
          />

          {/* Inside ProtectedLayout, so it can reach the tour provider */}
          <StaffTourStarter />

          <GettingStarted
            onCreateAppointment={() => setShowNewAppointmentModal(true)}
            refreshKey={checklistRefresh}
          />

          {role === 'staff' && !roleLoading && !rolePersonId && (
            <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="text-base font-semibold text-amber-900">{t('staffNotLinked.title')}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-amber-900/90">
                {permissions?.can_view_staff ? t('staffNotLinked.bodyCanLink') : t('staffNotLinked.bodyAskOwner')}
              </p>
              {permissions?.can_view_staff && (
                <NextLink
                  href="/staff"
                  className="mt-3 inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                >
                  {t('staffNotLinked.cta')}
                </NextLink>
              )}
            </section>
          )}

          {/* Metrics Cards */}
          {role === 'staff' ? (
            <div className="mb-10 space-y-6">
              <MetricGroup
                metrics={[
                  {
                    label: t('metrics.appointmentsToday'),
                    value: dashboardData?.stats.todayAppointments ?? 0,
                    caption: t('metrics.appointmentsTodaySubtitle'),
                    icon: CalendarCheck,
                  },
                  {
                    label: t('metrics.activeAppointments'),
                    value: dashboardData?.stats.activeAppointments ?? 0,
                    caption: t('metrics.activeSubtitle'),
                    icon: Clock,
                  },
                ]}
              />

              {/* Naslednji termin */}
              <Section className="mb-0" title={t('nextAppointment.title')}>
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                  className="overflow-hidden rounded-2xl border border-gray-100 bg-white"
                >
                  {nextAppointment ? (
                    <button
                      type="button"
                      onClick={() => handleAppointmentClick(nextAppointment)}
                      className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
                    >
                      <div className="w-12 flex-shrink-0">
                        <div className="tnum text-base font-semibold text-gray-900">
                          {nextAppointment.time}
                        </div>
                        {nextAppointment.endTime && (
                          <div className="tnum text-xs text-gray-400">{nextAppointment.endTime}</div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-medium text-gray-900">
                          {nextAppointment.clientName}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-gray-500">
                          <span className="truncate">{nextAppointment.serviceName}</span>
                          {((nextAppointment.serviceId2 ? 1 : 0) + (nextAppointment.serviceId3 ? 1 : 0) + (nextAppointment.addOnName ? 1 : 0)) > 0 && (
                            <span className="tnum flex-shrink-0 rounded-full bg-gray-100 px-1.5 text-xs font-medium text-gray-600">
                              +{(nextAppointment.serviceId2 ? 1 : 0) + (nextAppointment.serviceId3 ? 1 : 0) + (nextAppointment.addOnName ? 1 : 0)}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {nextAppointment.isToday ? t('nextAppointment.today') : t('nextAppointment.tomorrow')}
                      </span>

                      <div
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-lg font-bold"
                        style={initialsStyle(nextAppointment.employeeColor)}
                      >
                        {nextAppointment.employeeInitials}
                      </div>
                    </button>
                  ) : (
                    <div className="px-5 py-10 text-center">
                      <CalendarBlank className="mx-auto mb-2 h-6 w-6 text-gray-300" weight="regular" />
                      <p className="text-sm text-gray-400">{t('nextAppointment.empty')}</p>
                    </div>
                  )}
                </motion.div>
              </Section>
            </div>
          ) : (
            <div className="mb-10">
              <MetricGroup
                metrics={[
                  {
                    label: t('metrics.appointmentsToday'),
                    value: dashboardData?.stats.todayAppointments ?? 0,
                    caption: t('metrics.appointmentsTodaySubtitle'),
                    icon: CalendarCheck,
                  },
                  {
                    label: t('metrics.activeAppointments'),
                    value: dashboardData?.stats.activeAppointments ?? 0,
                    caption: t('metrics.activeSubtitle'),
                    icon: Clock,
                  },
                  {
                    label: t('metrics.newClients'),
                    value: dashboardData?.stats.newClientsThisMonth ?? 0,
                    caption: t('metrics.thisMonth'),
                    icon: UsersThree,
                  },
                  {
                    label: t('metrics.revenue'),
                    value: money(dashboardData?.stats.revenueThisMonth ?? 0),
                    caption: t('metrics.thisMonth'),
                    icon: CurrencyCircleDollar,
                  },
                ]}
              />
            </div>
          )}

          {(dashboardData?.stats.pastOpenAppointments ?? 0) > 0 && (
            <div className="-mt-4 mb-8 flex flex-col gap-2 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-amber-900">
                <span className="font-semibold">
                  {t('metrics.pastOpen', { count: dashboardData?.stats.pastOpenAppointments ?? 0 })}
                </span>{' '}
                {t('metrics.pastOpenBody')}
              </p>
              <Link
                href="/termini?view=past-open"
                className="flex-shrink-0 text-sm font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700"
              >
                {t('metrics.pastOpenCta')}
              </Link>
            </div>
          )}

          {/* Today and Tomorrow Appointments */}
          <div className="mb-10 grid grid-cols-1 items-start gap-x-6 gap-y-8 lg:grid-cols-2">
            <Section
              className="mb-0"
              title={t('appointmentList.todayTitle')}
              subtitle={new Date().toLocaleDateString(intlLocale(locale), { day: "numeric", month: "long" })}
              actionHref={`/termini?dateFrom=${format(new Date(), "yyyy-MM-dd")}&dateTo=${format(new Date(), "yyyy-MM-dd")}`}
              actionLabel={t('appointmentList.viewAll')}
            >
              <AppointmentListCard
                appointments={dashboardData?.todayAppointments ?? []}
                emptyMessage={t('appointmentList.todayEmpty')}
                onAppointmentClick={handleAppointmentClick}
              />
            </Section>

            <Section
              className="mb-0"
              title={t('appointmentList.tomorrowTitle')}
              subtitle={new Date(Date.now() + 86400000).toLocaleDateString(intlLocale(locale), { day: "numeric", month: "long" })}
              actionHref={`/termini?dateFrom=${format(new Date(Date.now() + 86400000), "yyyy-MM-dd")}&dateTo=${format(new Date(Date.now() + 86400000), "yyyy-MM-dd")}`}
              actionLabel={t('appointmentList.viewAll')}
            >
              <AppointmentListCard
                appointments={dashboardData?.tomorrowAppointments ?? []}
                emptyMessage={t('appointmentList.tomorrowEmpty')}
                onAppointmentClick={handleAppointmentClick}
              />
            </Section>
          </div>

          {/* Weekly Chart */}
          <Section
            title={t('weeklyChart.title')}
            subtitle={t('weeklyChart.subtitle')}
            actionHref="/analytics"
            actionLabel={t('footer.openAnalytics')}
          >
            <WeeklyChart data={dashboardData?.weeklyChart ?? []} />
          </Section>

          {/* Bottom Row */}
          <div className={`grid grid-cols-1 items-start gap-x-6 gap-y-8 ${staffSeesAll ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
            <Section className="mb-0" title={t('topServices.title')} subtitle={t('topServices.subtitle')}>
              <TopServicesCard services={dashboardData?.topServices ?? []} />
            </Section>
            {staffSeesAll && (
              <Section className="mb-0" title={t('topEmployees.title')} subtitle={t('topEmployees.subtitle')}>
                <TopEmployeesCard employees={dashboardData?.topEmployees ?? []} />
              </Section>
            )}
            {staffSeesAll && (
              <Section className="mb-0" title={t('recentActivity.title')} subtitle={t('recentActivity.subtitle')}>
                <RecentActivityCard activities={dashboardData?.recentActivity ?? []} />
              </Section>
            )}
          </div>

          {/* Quick Navigation Footer */}
          <div className="hairline-t mt-12 flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-medium text-gray-900">{t('footer.heading')}</h3>
              <p className="text-sm text-gray-500">{t('footer.body')}</p>
            </div>
            <div className="flex flex-shrink-0 gap-2">
              <Link
                href="/koledar"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
              >
                {t('footer.openCalendar')}
                <ArrowRight size={14} weight="bold" className="text-gray-400" />
              </Link>
              <Link
                href="/analytics"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
              >
                {t('footer.openAnalytics')}
                <ArrowRight size={14} weight="bold" className="text-gray-400" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── New Appointment Modal ─────────────────────────────────────────── */}
      <AppointmentModal
        isOpen={showNewAppointmentModal}
        onClose={() => setShowNewAppointmentModal(false)}
        appointment={null}
        mode="create"
        services={services}
        employees={employees}
        onSave={(data) => handleSaveAppointment(data, true)}
        isSaving={isNewAppointmentSaving}
        initialEmployeeId={role === 'staff' && rolePersonId ? rolePersonId : undefined}
        lockEmployee={role === 'staff' && Boolean(rolePersonId)}
      />

      {/* ── Edit Appointment Modal ────────────────────────────────────────── */}
      <AppointmentModal
        isOpen={Boolean(editingAppointment)}
        onClose={() => setEditingAppointment(null)}
        appointment={editingAppointment}
        mode="edit"
        services={services}
        employees={employees}
        onSave={(data) => handleSaveAppointment(data, false)}
        isSaving={isEditSaving}
      />

      {/* ── New Client Modal ──────────────────────────────────────────────── */}
      {companyId && (
        <ClientModal
          isOpen={showNewClientModal}
          onClose={() => setShowNewClientModal(false)}
          client={null}
          mode="create"
          companyId={companyId}
          onSave={handleSaveNewClient}
          isSaving={isNewClientSaving}
        />
      )}

      {/* ── Appointment Detail Modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {viewingAppointment && (() => {
          const aptEditable = canEditAppointment(viewingAppointment);
          return (
            <AppointmentDetailModal
              appointment={viewingAppointment}
              services={services}
              onClose={() => setViewingAppointment(null)}
              onEdit={aptEditable ? handleEditFromDetail : undefined}
              onComplete={aptEditable ? handleCompleteAppointment : undefined}
              onNoShow={aptEditable ? handleNoShowAppointment : undefined}
              onCancel={aptEditable ? handleCancelAppointment : undefined}
              onDelete={aptEditable && canDeleteAppointment ? handleDeleteAppointment : undefined}
            />
          );
        })()}
      </AnimatePresence>

      {/* ── Delete Confirmation ───────────────────────────────────────────── */}
      <DeleteConfirmation
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={t('deleteModal.title')}
        message={t('deleteModal.message')}
        appointment={deleteTarget}
        isDeleting={isDeleting}
      />

      {/* ── Complete Confirmation Modal ───────────────────────────────────── */}
      <AnimatePresence>
        {completeTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => { if (!isCompleting) { setCompleteTarget(null); setCompletionNotes(''); } }}
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
              <div className="relative flex flex-col items-center gap-2 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-green-50 px-6 py-5">
                <motion.button
                  type="button"
                  onClick={() => { if (!isCompleting) { setCompleteTarget(null); setCompletionNotes(''); } }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-4 w-4" weight="bold" />
                </motion.button>
                <CheckCircle className="h-10 w-10 text-emerald-500" weight="fill" />
                <div className="text-center">
                  <h2 className="text-lg font-normal text-[#1A1F36]">{t('completeModal.title')}</h2>
                  <p className="text-sm text-gray-500">{t('completeModal.subtitle')}</p>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-normal flex-shrink-0 bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                    {completeTarget.stranka_ime?.split(' ').map((n: string) => n.charAt(0)).join('').substring(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-xs text-gray-500">{t('completeModal.client')}</p>
                    <p className="text-sm font-normal text-[#1A1F36]">{completeTarget.stranka_ime}</p>
                  </div>
                </div>
                {completeTarget.storitev && (
                  <div className="flex items-start gap-3">
                    <div className="h-3 w-3 rounded-full flex-shrink-0 mt-1" style={{ background: completeTarget.storitev.barva || '#6366F1' }} />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">{t('completeModal.service')}</p>
                      <div className="space-y-1 mt-0.5">
                        <p className="text-sm font-normal text-[#1A1F36]">{completeTarget.storitev.naziv}</p>
                        {completeTarget.storitev_2 && (
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: completeTarget.storitev_2.barva || '#6366F1' }} />
                            <p className="text-sm font-normal text-[#1A1F36]">{completeTarget.storitev_2.naziv}</p>
                          </div>
                        )}
                        {completeTarget.storitev_3 && (
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: completeTarget.storitev_3.barva || '#6366F1' }} />
                            <p className="text-sm font-normal text-[#1A1F36]">{completeTarget.storitev_3.naziv}</p>
                          </div>
                        )}
                        {completeTarget.add_on_naziv && (
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: completeTarget.add_on_storitev?.barva || '#6366F1' }} />
                            <p className="text-sm font-normal text-[#1A1F36]">{completeTarget.add_on_naziv}</p>
                            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                              <Plus className="h-2.5 w-2.5" weight="bold" />
                              {t('detailModal.fields.additionalService')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <CalendarBlank className="h-[18px] w-[18px] text-emerald-500 flex-shrink-0" weight="regular" />
                  <div>
                    <p className="text-xs text-gray-500">{t('completeModal.date')}</p>
                    <p className="text-sm font-normal text-[#1A1F36]">
                      {new Date(completeTarget.datum).toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-[18px] w-[18px] text-emerald-500 flex-shrink-0" weight="regular" />
                  <div>
                    <p className="text-xs text-gray-500">{t('completeModal.time')}</p>
                    <p className="text-sm font-normal text-[#1A1F36]">
                      {completeTarget.cas_zacetek?.substring(0, 5)} - {completeTarget.cas_konec?.substring(0, 5)}
                    </p>
                  </div>
                </div>
                <div>
                  <label htmlFor="completion-notes" className="block text-sm font-normal text-gray-700 mb-2">
                    {t('completeModal.messageLabel')}
                  </label>
                  <textarea
                    id="completion-notes"
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder={t('completeModal.messagePlaceholder')}
                    rows={4}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 resize-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => { setCompleteTarget(null); setCompletionNotes(''); }}
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
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="h-4 w-4 rounded-full border-2 border-white border-t-transparent" />
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

      {/* ── Action error toast ────────────────────────────────────────────── */}
      <AnimatePresence>
        {actionError && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 px-4 py-3 text-white shadow-lg"
          >
            <Warning className="h-5 w-5" weight="fill" />
            <span className="text-sm font-medium">{actionError}</span>
            <button type="button" onClick={() => setActionError(null)} className="ml-2 rounded-full p-0.5 transition-colors hover:bg-white/20">
              <X className="h-4 w-4" weight="bold" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Success toast ─────────────────────────────────────────────────── */}
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
            <button type="button" onClick={() => setSuccessMessage(null)} className="ml-2 rounded-full p-0.5 transition-colors hover:bg-white/20">
              <X className="h-4 w-4" weight="bold" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </ProtectedLayout>
  );
}
