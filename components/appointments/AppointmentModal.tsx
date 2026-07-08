'use client';

import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Clock, CalendarBlank, LockSimple, Plus, Minus, Envelope, Phone, Tag, Warning } from '@phosphor-icons/react';
import { Select, SelectOption } from '@/components/ui/animated-select';
import { ScrollTimePicker } from '@/components/ui/ScrollTimePicker';
import ClientSearch from './ClientSearch';
import ClientModal from '@/components/clients/ClientModal';
import StatusBadge from './StatusBadge';
import type { AppointmentWithDetails, Storitev, Zaposleni } from '@/types/appointments';
import type { Client } from '@/lib/supabase/clients';
import type { ClientFormData } from '@/types/clients';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { useRolePermissions } from '@/app/role-permission-context';
import { callN8nAction } from '@/src/lib/n8nClient';
import {
  buildClientCreateData,
  getPodatkiPodjetja,
} from '@/lib/webhookPayloadBuilders';
import { getNextClientId } from '@/src/lib/idGenerators';
import { getCompanyColumnForTable } from '@/lib/companyScope';
import { TABLES } from '@/lib/data';
import { addMinutesToTime } from '@/lib/promotions';
import {
  getCompanyCommunicationLanguage,
  getCommunicationLanguageOption,
  normalizeCommunicationLanguage,
  type CommunicationLanguageCode,
} from '@/lib/communicationLanguage';
import CommunicationLanguageControl from '@/components/shared/CommunicationLanguageControl';
import { useTranslations } from 'next-intl';
import { checkResourceConflicts, fetchResursIdsForTerminRow, type ResourceConflict } from '@/lib/supabase/resursi';

type ModalMode = 'view' | 'edit' | 'create';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment?: AppointmentWithDetails | null;
  mode: ModalMode;
  services: Storitev[];
  employees: Zaposleni[];
  onSave: (data: AppointmentFormData) => Promise<void>;
  isSaving?: boolean;
  initialDate?: string;
  initialStartTime?: string;
  initialEmployeeId?: string;
  lockEmployee?: boolean;
}

export interface AppointmentFormData {
  id?: string;
  datum: string;
  cas_zacetek: string;
  cas_konec: string;
  stranka_id?: string;
  stranka_ime: string;
  stranka_email?: string;
  stranka_telefon?: string;
  language?: CommunicationLanguageCode;
  storitev_id: string;
  storitev_id_2?: string; // Second service ID (optional)
  storitev_id_3?: string; // Third service ID (optional)
  add_on_storitev_id?: string | null;
  add_on_naziv?: string | null;
  add_on_trajanje?: number | null;
  stevilo_storitev?: number; // Number of services (1, 2, or 3)
  zaposleni_id: string;
  status: string;
  opombe?: string;
  internal_opombe?: string; // Internal notes - not sent to client
  cena?: number;
  popust?: number;
  popust_tip?: '€' | '%'; // Changed from 'eur' | 'percent' to match n8n requirements
  koncna_cena?: number;
  valuta?: string;
  // Promotion fields
  promocija_tip?: 'popust' | 'happy_hour' | 'add_on' | null;
  promocija_naziv?: string | null;
  popust_id?: string | null;
  happy_hour_id?: string | null;
  add_on_popust?: string | null;
  add_on_popust_tip?: string | null;
  add_on_final_cena?: string | null;
  // Ghost termin
  belezi_termin?: boolean;
}

// Generate time slots from 5:30 to 23:00 in 15-minute intervals
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  // Start from 5:00, 5-minute steps — covers 10/20/25/35/40/50/55-min services
  for (let minutes = 5 * 60; minutes <= 23 * 60 + 55; minutes += 5) {
    const hour = Math.floor(minutes / 60);
    const min = minutes % 60;
    slots.push(`${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();


// Map JS day index (0=Sunday) to Slovenian day names
const DAY_INDEX_TO_SLOVENIAN: Record<number, string> = {
  0: 'Nedelja',
  1: 'Ponedeljek',
  2: 'Torek',
  3: 'Sreda',
  4: 'Četrtek',
  5: 'Petek',
  6: 'Sobota',
};

interface ScheduleInterval { start: string; end: string; }
interface DaySchedule { enabled: boolean; intervals: ScheduleInterval[]; }

/** Returns true if timeStr (HH:MM) falls within any of the day's intervals */
function isTimeInSchedule(timeStr: string, daySchedule: DaySchedule | undefined): boolean {
  if (!daySchedule || !daySchedule.enabled) return false;
  const [h, m] = timeStr.split(':').map(Number);
  const timeMinutes = h * 60 + m;
  return daySchedule.intervals.some((interval) => {
    const [sh, sm] = interval.start.split(':').map(Number);
    const [eh, em] = interval.end.split(':').map(Number);
    return timeMinutes >= sh * 60 + sm && timeMinutes < eh * 60 + em;
  });
}

function formatDateForInput(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

function formatTimeForInput(timeStr: string): string {
  if (!timeStr) return '';
  if (timeStr.includes('T')) {
    const date = new Date(timeStr);
    return date.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
  }
  return timeStr.substring(0, 5);
}

function AppointmentModal({
  isOpen,
  onClose,
  appointment,
  mode,
  services,
  employees,
  onSave,
  isSaving = false,
  initialDate,
  initialStartTime,
  initialEmployeeId,
  lockEmployee = false,
}: AppointmentModalProps) {
  const t = useTranslations('appointments');
  const { companyId, companySettings } = useCompany();
  const defaultLanguage = getCompanyCommunicationLanguage(companySettings);
  const { user } = useAuth();
  const { personId, role, permissions } = useRolePermissions();

  // Detect mobile (< 768px) for time picker variant
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Inline client creation state
  const [showClientModal, setShowClientModal] = useState(false);
  const [isClientSaving, setIsClientSaving] = useState(false);

  const [formData, setFormData] = useState<AppointmentFormData>({
    datum: '',
    cas_zacetek: '',
    cas_konec: '',
    stranka_ime: '',
    stranka_email: '',
    stranka_telefon: '',
    language: defaultLanguage,
    storitev_id: '',
    storitev_id_2: '',
    storitev_id_3: '',
    stevilo_storitev: 1,
    zaposleni_id: '',
    status: 'scheduled',
    opombe: '',
    internal_opombe: '',
    cena: undefined,
    popust: undefined,
    popust_tip: '€',
    koncna_cena: undefined,
    valuta: 'EUR',
  });

  // Track how many service selectors to show (1-3)
  const [serviceCount, setServiceCount] = useState(1);

  // Discount toggle state
  const [hasDiscount, setHasDiscount] = useState(false);

  // Promotion state
  interface PromoResult {
    found: boolean;
    type: 'popust' | 'happy_hour' | null;
    id: string | null;
    naziv: string | null;
    tip_popusta: 'percentage' | 'fixed' | null;
    vrednost: number | null;
    original_cena: string;
    popust_vrednost: string;
    final_cena: string;
    popust_type_label: '%' | 'valuta' | null;
  }
  interface AvailableAddOn {
    id: string;
    storitev_id: string;
    naziv: string;
    original_cena: number;
    final_cena: number;
    tip_popusta: 'percentage' | 'fixed';
    vrednost_popusta: number;
    trajanje: number;
    valuta: string;
  }
  const [promotions, setPromotions] = useState<{
    slot1: PromoResult | null;
    slot2: PromoResult | null;
    slot3: PromoResult | null;
  }>({ slot1: null, slot2: null, slot3: null });
  const [availableAddOns, setAvailableAddOns] = useState<AvailableAddOn[]>([]);
  const [selectedAddOnId, setSelectedAddOnId] = useState<string | null>(null);

  // Internal notes toggle state (for create mode only)
  const [showInternalNotes, setShowInternalNotes] = useState(false);

  // Ghost termin toggle state
  const [isGhostTermin, setIsGhostTermin] = useState(false);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof AppointmentFormData, string>>>({});
  const [resourceConflicts, setResourceConflicts] = useState<ResourceConflict[]>([]);
  // Resource row-ids this appointment already occupies — suppressed from conflict warnings in edit mode
  const [ownResursIds, setOwnResursIds] = useState<Set<number>>(new Set());

  // Initialize form data when appointment changes
  useEffect(() => {
    if (appointment && (mode === 'edit' || mode === 'view')) {
      // Get internal notes from various possible column names
      const apt = appointment as unknown as Record<string, unknown>;
      const internalNotes = appointment.interne_opombe
        || (apt['Interne opombe'] as string)
        || (apt['Internal opombe'] as string)
        || (apt['internal_opombe'] as string)
        || (apt['notes_internal'] as string)
        || '';

      // Get discount from various possible column names
      const discount = (apt['Popust'] as number) ?? (apt['popust'] as number) ?? 0;

      // Get discount type from various possible column names - convert to new format
      let discountType: '€' | '%' = '€';
      const rawDiscountType = (apt['Popust type'] as string) || (apt['popust_tip'] as string) || (apt['Popust_type'] as string);
      if (rawDiscountType === '%' || rawDiscountType === 'percent') {
        discountType = '%';
      } else if (rawDiscountType === '€' || rawDiscountType === 'eur') {
        discountType = '€';
      }

      // Get final price from various possible column names
      const finalPrice = (apt['Final cena'] as number) ?? (apt['final_cena'] as number) ?? (apt['koncna_cena'] as number);

      // Get base price - try Final cena first if no discount, otherwise cena
      const basePrice = (apt['cena'] as number) ?? (apt['Cena'] as number) ?? finalPrice;

      // Get additional service IDs from typed fields
      const storitevId2 = appointment.storitev_id_2 || '';
      const storitevId3 = appointment.storitev_id_3 || '';

      // Count how many services are set
      let count = 1;
      if (storitevId2) count = 2;
      if (storitevId3) count = 3;

      setFormData({
        id: appointment.id,
        datum: formatDateForInput(appointment.datum),
        cas_zacetek: formatTimeForInput(appointment.cas_zacetek),
        cas_konec: formatTimeForInput(appointment.cas_konec || ''),
        stranka_id: appointment.stranka_id,
        stranka_ime: appointment.stranka_ime || '',
        stranka_email: appointment.stranka_email || '',
        stranka_telefon: appointment.stranka_telefon || '',
        language: normalizeCommunicationLanguage(appointment.language, defaultLanguage),
        storitev_id: appointment.storitev_id || appointment.storitev?.id || '',
        storitev_id_2: (storitevId2 && storitevId2 !== 'null') ? storitevId2 : '',
        storitev_id_3: (storitevId3 && storitevId3 !== 'null') ? storitevId3 : '',
        add_on_storitev_id: appointment.add_on_storitev_id ?? null,
        add_on_naziv: appointment.add_on_naziv ?? null,
        add_on_trajanje: appointment.add_on_trajanje ?? null,
        stevilo_storitev: count,
        zaposleni_id: appointment.zaposleni_id || appointment.zaposleni?.id || '',
        status: appointment.status || 'scheduled',
        opombe: appointment.opombe || '',
        internal_opombe: internalNotes,
        cena: basePrice ?? undefined,
        popust: discount > 0 ? discount : undefined,
        popust_tip: discountType,
        koncna_cena: finalPrice ?? undefined,
        valuta: (apt.valuta as string) || 'EUR',
        promocija_tip: appointment.promocija_tip ?? null,
        promocija_naziv: appointment.promocija_naziv ?? null,
        popust_id: appointment.popust_id ?? null,
        happy_hour_id: appointment.happy_hour_id ?? null,
        add_on_popust: appointment.add_on_popust ?? null,
        add_on_popust_tip: appointment.add_on_popust_tip ?? null,
        add_on_final_cena: appointment.add_on_final_cena ?? null,
      });
      setServiceCount(count);
      // Set client for display
      if (appointment.stranka_ime) {
        setSelectedClient({
          id: appointment.stranka_id ?? '',
          ime: appointment.stranka_ime.split(' ')[0] || '',
          priimek: appointment.stranka_ime.split(' ').slice(1).join(' ') || '',
          email: appointment.stranka_email || '',
          telefon: appointment.stranka_telefon || '',
          language: normalizeCommunicationLanguage(appointment.language, defaultLanguage),
        });
      }
    } else if (mode === 'create') {
      // Set defaults for new appointment
      const now = new Date();
      // Auto-select employee: prefer initialEmployeeId (staff pre-fill), then user's linked employee (personId), then auto-select when only one exists
      const personEmployee = personId ? (employees.find(e => e.id === personId)?.id ?? '') : '';
      const autoEmployee = initialEmployeeId || personEmployee || (employees.length === 1 ? employees[0].id : '');
      setFormData({
        datum: initialDate || now.toISOString().split('T')[0],
        cas_zacetek: initialStartTime || '09:00',
        cas_konec: (() => {
          if (!initialStartTime) return '10:00';
          // Default to start + 60 min as placeholder until service is selected
          const [h, m] = initialStartTime.split(':').map(Number);
          const endMin = h * 60 + m + 60;
          const eh = Math.floor(endMin / 60);
          const em = endMin % 60;
          return `${eh.toString().padStart(2, '0')}:${em.toString().padStart(2, '0')}`;
        })(),
        stranka_ime: '',
        stranka_email: '',
        stranka_telefon: '',
        language: defaultLanguage,
        storitev_id: '',
        storitev_id_2: '',
        storitev_id_3: '',
        stevilo_storitev: 1,
        zaposleni_id: autoEmployee,
        status: 'scheduled',
        opombe: '',
        internal_opombe: '',
        popust_tip: '€',
        valuta: 'EUR',
      });
      setSelectedClient(null);
      setServiceCount(1);
    }
    setErrors({});
    // Reset discount toggle based on existing data
    if (appointment && (mode === 'edit' || mode === 'view')) {
      const aptRecord = appointment as unknown as Record<string, unknown>;
      // Check both possible column names for discount
      const popust = (aptRecord['Popust'] as number) ?? (aptRecord['popust'] as number) ?? 0;
      setHasDiscount(popust > 0);
      // In edit/view mode, always show internal notes if they exist
      setShowInternalNotes(true);
    } else {
      setHasDiscount(false);
      // In create mode, hide internal notes by default
      setShowInternalNotes(false);
    }
    // Initialize ghost termin flag
    if (appointment && (mode === 'edit' || mode === 'view')) {
      setIsGhostTermin(appointment.belezi_termin === false);
    } else {
      setIsGhostTermin(false);
    }
  }, [appointment, mode, employees, initialDate, initialStartTime, initialEmployeeId, personId, defaultLanguage]);

  // Track if end time was manually set by user
  const [endTimeManuallySet, setEndTimeManuallySet] = useState(false);

  // Calculate total duration from all selected services
  const calculateTotalDuration = useCallback(() => {
    let totalDuration = 0;

    // Service 1
    if (formData.storitev_id) {
      const service1 = services.find((s) => s.id === formData.storitev_id);
      if (service1) {
        totalDuration += service1.skupni_cas || service1.trajanje || 0;
      }
    }

    // Service 2
    if (formData.storitev_id_2 && serviceCount >= 2) {
      const service2 = services.find((s) => s.id === formData.storitev_id_2);
      if (service2) {
        totalDuration += service2.skupni_cas || service2.trajanje || 0;
      }
    }

    // Service 3
    if (formData.storitev_id_3 && serviceCount >= 3) {
      const service3 = services.find((s) => s.id === formData.storitev_id_3);
      if (service3) {
        totalDuration += service3.skupni_cas || service3.trajanje || 0;
      }
    }

    if (formData.add_on_naziv && formData.add_on_trajanje) {
      totalDuration += formData.add_on_trajanje;
    }

    return totalDuration;
  }, [formData.storitev_id, formData.storitev_id_2, formData.storitev_id_3, formData.add_on_naziv, formData.add_on_trajanje, services, serviceCount]);

  // Calculate total price from all selected services (only fiksna prices)
  const calculateTotalServicePrice = useCallback(() => {
    let totalPrice = 0;

    // Service 1
    if (formData.storitev_id) {
      const service1 = services.find((s) => s.id === formData.storitev_id);
      // Check if service has tip_cene field and if it's 'fiksna'
      if (service1?.cena !== undefined && service1?.cena !== null) {
        const svc = service1 as unknown as Record<string, unknown>;
        const tipCene = (svc['tip_cene'] as string) ?? (svc['Tip cene'] as string) ?? 'fiksna';
        if (tipCene === 'fiksna') {
          totalPrice += service1.cena;
        }
      }
    }

    // Service 2
    if (formData.storitev_id_2 && serviceCount >= 2) {
      const service2 = services.find((s) => s.id === formData.storitev_id_2);
      if (service2?.cena !== undefined && service2?.cena !== null) {
        const svc = service2 as unknown as Record<string, unknown>;
        const tipCene = (svc['tip_cene'] as string) ?? (svc['Tip cene'] as string) ?? 'fiksna';
        if (tipCene === 'fiksna') {
          totalPrice += service2.cena;
        }
      }
    }

    // Service 3
    if (formData.storitev_id_3 && serviceCount >= 3) {
      const service3 = services.find((s) => s.id === formData.storitev_id_3);
      if (service3?.cena !== undefined && service3?.cena !== null) {
        const svc = service3 as unknown as Record<string, unknown>;
        const tipCene = (svc['tip_cene'] as string) ?? (svc['Tip cene'] as string) ?? 'fiksna';
        if (tipCene === 'fiksna') {
          totalPrice += service3.cena;
        }
      }
    }

    return totalPrice;
  }, [formData.storitev_id, formData.storitev_id_2, formData.storitev_id_3, services, serviceCount]);

  // Auto-calculate end time when service or start time changes (only if not manually set)
  // Uses skupni_cas (total time with buffers) if available, otherwise falls back to trajanje
  useEffect(() => {
    // Skip auto-calculation if end time was manually set by user
    if (endTimeManuallySet) return;

    if (formData.storitev_id && formData.cas_zacetek) {
      // Calculate total duration from all selected services
      const totalDuration = calculateTotalDuration();

      if (totalDuration > 0) {
        const [hours, minutes] = formData.cas_zacetek.split(':').map(Number);
        const startMinutes = hours * 60 + minutes;
        const endMinutes = startMinutes + totalDuration;
        const endHours = Math.floor(endMinutes / 60);
        const endMins = endMinutes % 60;
        const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
        setFormData((prev) => ({ ...prev, cas_konec: endTime }));
      }
    }
  }, [formData.storitev_id, formData.storitev_id_2, formData.storitev_id_3, formData.cas_zacetek, services, endTimeManuallySet, serviceCount, calculateTotalDuration]);

  // Reset manual flag when creating new appointment or opening existing one
  useEffect(() => {
    setEndTimeManuallySet(false);
    setPromotions({ slot1: null, slot2: null, slot3: null });
    setAvailableAddOns([]);
    setSelectedAddOnId(null);
  }, [isOpen, appointment]);

  // Debug: log raw appointment fields in view mode to confirm exact column names
  useEffect(() => {
    if (mode === 'view' && appointment) {
      console.warn('[AppointmentModal view] raw appointment object:', appointment);
    }
  }, [appointment, mode]);

  // Promotion check: independently check each service slot for promotions
  useEffect(() => {
    if (!formData.datum || !formData.cas_zacetek || !companyId || mode === 'view') return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const checkSlot = async (storitev_id: string): Promise<PromoResult | null> => {
        if (!storitev_id) return null;
        try {
          const res = await fetch('/api/promotions/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company_id: companyId, storitev_id, datum: formData.datum, cas: formData.cas_zacetek }),
            signal: controller.signal,
          });
          return await res.json() as PromoResult;
        } catch { return null; }
      };

      const [result1, result2, result3] = await Promise.all([
        checkSlot(formData.storitev_id),
        (serviceCount >= 2 && formData.storitev_id_2) ? checkSlot(formData.storitev_id_2) : Promise.resolve(null),
        (serviceCount >= 3 && formData.storitev_id_3) ? checkSlot(formData.storitev_id_3) : Promise.resolve(null),
      ]);

      setPromotions({ slot1: result1, slot2: result2, slot3: result3 });

      // Sum per-slot euro discount amounts (API returns computed popust_vrednost per service price)
      const discount1 = result1?.found ? parseFloat(result1.popust_vrednost) : 0;
      const discount2 = result2?.found ? parseFloat(result2.popust_vrednost) : 0;
      const discount3 = result3?.found ? parseFloat(result3.popust_vrednost) : 0;
      const totalDiscount = discount1 + discount2 + discount3;
      const anyFound = !!(result1?.found || result2?.found || result3?.found);

      if (anyFound) setHasDiscount(true);

      setFormData((prev) => ({
        ...prev,
        ...(anyFound && { popust: Number(totalDiscount.toFixed(2)), popust_tip: '€' }),
        promocija_tip: result1?.found ? result1.type : null,
        promocija_naziv: result1?.found ? result1.naziv : null,
        popust_id: (result1?.found && result1.type === 'popust') ? result1.id : null,
        happy_hour_id: (result1?.found && result1.type === 'happy_hour') ? result1.id : null,
      }));
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [formData.storitev_id, formData.storitev_id_2, formData.storitev_id_3, formData.datum, formData.cas_zacetek, companyId, mode, serviceCount]);

  // Add-on availability check
  useEffect(() => {
    if (!formData.storitev_id || !formData.zaposleni_id || !formData.datum || !formData.cas_konec || !companyId || mode === 'view' || serviceCount > 1) {
      setAvailableAddOns([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/promotions/add-ons/available', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_id: companyId, main_storitev_id: formData.storitev_id, zaposleni_id: formData.zaposleni_id, datum: formData.datum, cas_konec: formData.cas_konec }),
          signal: controller.signal,
        });
        const data = await res.json();
        setAvailableAddOns(data.data || []);
      } catch { /* aborted */ }
    }, 500);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [formData.storitev_id, formData.zaposleni_id, formData.datum, formData.cas_konec, companyId, mode, serviceCount]);

  // Auto-fill price from all selected services when any service changes
  useEffect(() => {
    if (formData.storitev_id) {
      const totalPrice = calculateTotalServicePrice();
      if (totalPrice > 0) {
        setFormData((prev) => ({
          ...prev,
          cena: totalPrice,
        }));
      }
    }
  }, [formData.storitev_id, formData.storitev_id_2, formData.storitev_id_3, services, serviceCount, calculateTotalServicePrice]);

  // Load the resources this appointment already occupies (edit mode only) so we
  // don't warn the user that "their own" resource is taken at the appointment's time.
  useEffect(() => {
    if (mode !== 'edit' || !companyId || !appointment?.id) {
      setOwnResursIds(new Set());
      return;
    }
    let cancelled = false;
    fetchResursIdsForTerminRow(companyId, Number(appointment.id)).then(({ data }) => {
      if (!cancelled) setOwnResursIds(data);
    });
    return () => { cancelled = true; };
  }, [mode, companyId, appointment]);

  // Resource conflict check — debounced, non-blocking
  useEffect(() => {
    const serviceIds = [
      formData.storitev_id,
      formData.storitev_id_2,
      formData.storitev_id_3,
    ].filter(Boolean) as string[];

    if (!companyId || !serviceIds.length || !formData.datum || !formData.cas_zacetek || !formData.cas_konec) {
      setResourceConflicts([]);
      return;
    }

    const timer = setTimeout(async () => {
      const excludeId = mode === 'edit' && appointment?.id
        ? Number(appointment.id)
        : undefined;

      const { conflicts } = await checkResourceConflicts(
        companyId,
        serviceIds,
        formData.datum,
        formData.cas_zacetek,
        formData.cas_konec,
        excludeId,
      );
      // Hide conflicts for resources this appointment already occupies (edit mode)
      setResourceConflicts(conflicts.filter((c) => !ownResursIds.has(c.resursId)));
    }, 400);

    return () => clearTimeout(timer);
  }, [
    formData.storitev_id,
    formData.storitev_id_2,
    formData.storitev_id_3,
    formData.datum,
    formData.cas_zacetek,
    formData.cas_konec,
    companyId,
    mode,
    appointment,
    ownResursIds,
  ]);

  // Calculate final price when price or discount changes
  const calculateFinalPrice = useCallback(() => {
    const basePrice = formData.cena ?? 0;
    const discountValue = formData.popust ?? 0;

    if (formData.popust_tip === '€') {
      return Math.max(0, basePrice - discountValue);
    } else {
      // Percentage discount
      return Math.max(0, basePrice - (basePrice * discountValue / 100));
    }
  }, [formData.cena, formData.popust, formData.popust_tip]);

  // Helper: Check if employee can perform a specific service
  const canPerformService = useCallback((employee: Zaposleni, serviceId: string) => {
    // If no storitve specified (null or empty), employee can do all services
    if (!employee.storitve || employee.storitve.length === 0) {
      return true;
    }
    return employee.storitve.includes(serviceId);
  }, []);

  // Get filtered employees based on selected service and active status (deduplicated by ID)
  const filteredEmployees = useMemo(() => {
    const activeEmployees = employees.filter(emp => {
      const status = (emp as unknown as Record<string, unknown>)['Status'] ?? (emp as unknown as Record<string, unknown>)['status'];
      // Show employee if status is 'active' or status field is not set (backwards compat)
      return !status || status === 'active';
    });
    const base = !formData.storitev_id
      ? activeEmployees
      : activeEmployees.filter(emp => canPerformService(emp, formData.storitev_id));
    const seen = new Set<string>();
    return base.filter(emp => {
      if (!emp.id) return false;
      if (seen.has(emp.id)) return false;
      seen.add(emp.id);
      return true;
    });
  }, [employees, formData.storitev_id, canPerformService]);

  // Get the selected employee's day schedule based on formData.datum
  const employeeDaySchedule = useMemo((): DaySchedule | undefined => {
    if (!formData.zaposleni_id || !formData.datum) return undefined;
    const emp = employees.find(e => e.id === formData.zaposleni_id) as unknown as Record<string, unknown>;
    if (!emp) return undefined;
    const urnik = emp['urnik'] as Record<string, DaySchedule> | null | undefined;
    if (!urnik) return undefined;
    const date = new Date(formData.datum);
    const dayName = DAY_INDEX_TO_SLOVENIAN[date.getDay()];
    if (!dayName) return undefined;
    const dayData = urnik[dayName];
    if (!dayData || typeof dayData !== 'object') return undefined;
    // Support intervals format
    if ('intervals' in dayData && Array.isArray((dayData as DaySchedule).intervals)) {
      return dayData as DaySchedule;
    }
    return undefined;
  }, [employees, formData.zaposleni_id, formData.datum]);

  // Get filtered services based on selected employee (deduplicated by ID, active only)
  const filteredServices = useMemo(() => {
    const activeServices = services.filter(s => !s.status || s.status === 'active');
    const base = (() => {
      if (!formData.zaposleni_id) return activeServices;
      const employee = employees.find(e => e.id === formData.zaposleni_id);
      if (!employee) return activeServices;
      if (!employee.storitve || employee.storitve.length === 0) return activeServices;
      return activeServices.filter(s => employee.storitve?.includes(s.id));
    })();
    // Always include the services already selected on this appointment, even if the
    // active/employee filters would otherwise drop them — otherwise the Select can't
    // resolve its current value and shows the placeholder instead of the chosen service.
    const selectedIds = [formData.storitev_id, formData.storitev_id_2, formData.storitev_id_3].filter(Boolean) as string[];
    const withSelected = [...base];
    for (const id of selectedIds) {
      if (!base.some(s => s.id === id)) {
        const svc = services.find(s => s.id === id);
        if (svc) withSelected.push(svc);
      }
    }
    const seen = new Set<string>();
    return withSelected.filter(s => {
      if (!s.id) return false;
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [services, employees, formData.zaposleni_id, formData.storitev_id, formData.storitev_id_2, formData.storitev_id_3]);

  // Handle service change - check if current employee can still do the new service
  const handleServiceChange = useCallback((serviceId: string, serviceIndex: 1 | 2 | 3 = 1) => {
    setFormData((prev) => {
      const newData = { ...prev };

      if (serviceIndex === 1) {
        newData.storitev_id = serviceId;
      } else if (serviceIndex === 2) {
        newData.storitev_id_2 = serviceId;
      } else if (serviceIndex === 3) {
        newData.storitev_id_3 = serviceId;
      }

      // Update service count
      let count = 1;
      if (newData.storitev_id_2) count = 2;
      if (newData.storitev_id_3) count = 3;
      newData.stevilo_storitev = count;

      // Check if current employee can perform the new service (only for primary service)
      if (serviceIndex === 1 && prev.zaposleni_id) {
        const currentEmployee = employees.find(e => e.id === prev.zaposleni_id);
        if (currentEmployee && !canPerformService(currentEmployee, serviceId)) {
          // Reset employee if they can't do the new service
          newData.zaposleni_id = '';
        }
      }

      return newData;
    });
    // Reset manual end time flag to allow auto-calculation
    setEndTimeManuallySet(false);
  }, [employees, canPerformService]);

  // Add another service selector (max 3)
  const handleAddService = useCallback(() => {
    if (serviceCount >= 3) return;
    setServiceCount((prev) => Math.min(prev + 1, 3));
  }, [serviceCount]);

  // Remove a service selector
  const handleRemoveService = useCallback((serviceIndex: 2 | 3) => {
    setFormData((prev) => {
      const newData = { ...prev };
      if (serviceIndex === 2) {
        // Move service 3 to position 2 if it exists
        newData.storitev_id_2 = prev.storitev_id_3 || '';
        newData.storitev_id_3 = '';
      } else if (serviceIndex === 3) {
        newData.storitev_id_3 = '';
      }

      // Update service count
      let count = 1;
      if (newData.storitev_id_2) count = 2;
      if (newData.storitev_id_3) count = 3;
      newData.stevilo_storitev = count;

      return newData;
    });
    setServiceCount((prev) => Math.max(prev - 1, 1));
    setEndTimeManuallySet(false);
  }, []);

  // Add-on selection handler
  const handleSelectAddOn = useCallback((addOn: { id: string; storitev_id: string; final_cena: number; tip_popusta: 'percentage' | 'fixed'; vrednost_popusta: number; trajanje: number; valuta: string } | null) => {
    if (!addOn) {
      setSelectedAddOnId(null);
      setFormData((prev) => ({
        ...prev,
        storitev_id_2: '',
        add_on_storitev_id: null,
        add_on_naziv: null,
        add_on_trajanje: null,
        add_on_popust: null,
        add_on_popust_tip: null,
        add_on_final_cena: null,
      }));
      setEndTimeManuallySet(false);
      return;
    }
    if (selectedAddOnId === addOn.id) {
      // Deselect
      handleSelectAddOn(null);
      return;
    }
    setSelectedAddOnId(addOn.id);
    setFormData((prev) => {
      const newKonec = addMinutesToTime(prev.cas_konec, addOn.trajanje);
      const addOnTip = addOn.tip_popusta === 'percentage' ? '%' : '€';
      return {
        ...prev,
        storitev_id_2: addOn.storitev_id,
        stevilo_storitev: 2,
        cas_konec: newKonec,
        add_on_popust: String(addOn.vrednost_popusta),
        add_on_popust_tip: addOnTip,
        add_on_final_cena: String(addOn.final_cena.toFixed(2)),
        promocija_tip: prev.promocija_tip ?? 'add_on',
        promocija_naziv: prev.promocija_tip ? prev.promocija_naziv : 'Add-on',
      };
    });
  }, [selectedAddOnId]);

  // Handle employee change - check if current service can still be done by the new employee
  const handleEmployeeChange = useCallback((employeeId: string) => {
    setFormData((prev) => {
      const newData = { ...prev, zaposleni_id: employeeId };

      // Check if new employee can perform the current service
      if (prev.storitev_id) {
        const newEmployee = employees.find(e => e.id === employeeId);
        if (newEmployee && !canPerformService(newEmployee, prev.storitev_id)) {
          // Reset service if new employee can't do it
          newData.storitev_id = '';
        }
      }

      return newData;
    });
  }, [employees, canPerformService]);

  const handleClientSelect = (client: Client | null) => {
    setSelectedClient(client);
    if (client) {
      setFormData((prev) => ({
        ...prev,
        stranka_id: client.id,
        stranka_ime: `${client.ime} ${client.priimek}`.trim(),
        stranka_email: client.email,
        stranka_telefon: client.telefon ?? '',
        language: normalizeCommunicationLanguage(client.language, defaultLanguage),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        stranka_id: undefined,
        stranka_ime: '',
        stranka_email: '',
        stranka_telefon: '',
        language: defaultLanguage,
      }));
    }
    if (errors.stranka_ime) {
      setErrors((prev) => ({ ...prev, stranka_ime: undefined }));
    }
  };

  // Open inline client creation modal (identical form as Stranke page)
  const handleOpenCreateClient = useCallback(() => {
    setShowClientModal(true);
  }, []);

  // Save new client - IDENTICAL logic to Stranke page (same endpoint, same payload)
  const handleSaveNewClient = useCallback(async (data: ClientFormData) => {
    if (!companyId) return;

    setIsClientSaving(true);
    try {
      const actor = user?.email ?? 'unknown';
      const companyPayload = getPodatkiPodjetja(companySettings ?? undefined);
      const companyColumn = await getCompanyColumnForTable(TABLES.clients, companyId);

      // Create new client with 7-digit unique ID (same as Stranke page)
      const clientId = await getNextClientId(companyId);
      const clientType = data.tip_stranke || null;
      const newRow: Record<string, unknown> = {
        'ID stranke': clientId,
        Ime: data.ime,
        Priimek: data.priimek,
        Spol: data.spol,
        'Tip stranke': clientType,
        language: data.language,
        Email: data.email,
        Telefon: data.telefon,
        Opombe: data.opombe,
        'Interne opombe': data.interne_opombe,
        [companyColumn]: companyId,
      };

      // Build payload - IDENTICAL to Stranke page
      const payload = {
        event: 'NOVA_STRANKA',
        entity: 'clients',
        data: buildClientCreateData({
          companyId,
          userEmail: actor,
          companyProfile: companyPayload,
          clientRow: newRow,
        }),
        company_id: companyId,
        actor,
        timestamp: new Date().toISOString(),
        meta: { app: 'Integrate' as const, version: '1.0' as const },
      };

      // Send to same n8n endpoint with retry logic for duplicate IDs
      const result = await callN8nAction(payload, async () => {
        const nextId = await getNextClientId(companyId);
        return {
          ...payload,
          data: buildClientCreateData({
            companyId,
            userEmail: actor,
            companyProfile: companyPayload,
            clientRow: { ...newRow, 'ID stranke': nextId },
          }),
        };
      });

      if (!result.ok) {
        throw new Error(t('errors.clientCreateError'));
      }

      // Close client modal
      setShowClientModal(false);

      // Wait 0.8 seconds for system to process
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Auto-select the newly created client in the appointment form
      const newClient: Client = {
        id: clientId,
        ime: data.ime,
        priimek: data.priimek,
        email: data.email,
        telefon: data.telefon,
        tip_stranke: clientType,
        language: data.language,
      };
      setSelectedClient(newClient);
      setFormData((prev) => ({
        ...prev,
        stranka_id: clientId,
        stranka_ime: `${data.ime} ${data.priimek}`.trim(),
        stranka_email: data.email,
        stranka_telefon: data.telefon,
        language: data.language,
      }));

      // Clear any client validation errors
      if (errors.stranka_ime) {
        setErrors((prev) => ({ ...prev, stranka_ime: undefined }));
      }
    } catch (err) {
      console.error('Error creating client inline:', err);
      throw err; // Re-throw so ClientModal can handle the error display
    } finally {
      setIsClientSaving(false);
    }
  }, [companyId, companySettings, user, errors.stranka_ime]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof AppointmentFormData, string>> = {};

    if (!formData.datum) {
      newErrors.datum = t('modal.validation.dateRequired');
    }
    if (!formData.cas_zacetek) {
      newErrors.cas_zacetek = t('modal.validation.startTimeRequired');
    }
    if (!formData.cas_konec) {
      newErrors.cas_konec = t('modal.validation.endTimeRequired');
    }
    // Validate end time is after start time
    if (formData.cas_zacetek && formData.cas_konec) {
      const [startH, startM] = formData.cas_zacetek.split(':').map(Number);
      const [endH, endM] = formData.cas_konec.split(':').map(Number);
      const startMins = startH * 60 + startM;
      const endMins = endH * 60 + endM;
      if (endMins <= startMins) {
        newErrors.cas_konec = t('modal.validation.endTimeAfterStart');
      }
    }
    if (!formData.stranka_ime.trim() && !selectedClient) {
      newErrors.stranka_ime = t('modal.validation.clientRequired');
    }
    if (!formData.storitev_id) {
      newErrors.storitev_id = t('modal.validation.serviceRequired');
    }
    if (!formData.zaposleni_id) {
      newErrors.zaposleni_id = t('modal.validation.employeeRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'view') return;

    if (!validate()) return;

    await onSave({ ...formData, belezi_termin: !isGhostTermin });
  };

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
    exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.15 } },
  };

  if (!isOpen) return null;

  // If in create/edit mode and no services or no employees — show navigation prompt
  if (mode !== 'view' && (services.length === 0 || employees.length === 0)) {
    return (
      <AnimatePresence>
        <div key="appointment-modal-empty" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl p-6 text-center space-y-4"
          >
            <p className="text-sm font-medium text-[#1A1F36]">
              {t('modal.emptyState.message')}
            </p>
            <div className="flex flex-col gap-2">
              {services.length === 0 && (
                <a
                  href="/services"
                  className="block w-full rounded-xl bg-[#1A1F36] px-4 py-2.5 text-sm font-medium text-white text-center hover:bg-[#2D3461] transition-colors"
                >
                  {t('modal.emptyState.addService')}
                </a>
              )}
              {employees.length === 0 && (
                <a
                  href="/staff"
                  className="block w-full rounded-xl bg-[#1A1F36] px-4 py-2.5 text-sm font-medium text-white text-center hover:bg-[#2D3461] transition-colors"
                >
                  {t('modal.emptyState.addEmployee')}
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                {t('modal.emptyState.close')}
              </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }

  const isViewMode = mode === 'view';
  const title =
    mode === 'create'
      ? t('modal.title.create')
      : mode === 'edit'
        ? t('modal.title.edit')
        : t('modal.title.view');

  const selectedService = services.find((s) => s.id === formData.storitev_id);
  const selectedService2 = services.find((s) => s.id === formData.storitev_id_2);
  const selectedService3 = services.find((s) => s.id === formData.storitev_id_3);
  const selectedEmployee = employees.find((e) => e.id === formData.zaposleni_id);

  // Get total duration for display
  const totalDuration = calculateTotalDuration();
  const promotionGradient = 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)';
  const gradientTextStyle = {
    backgroundImage: promotionGradient,
  };
  const clientGradientBorderStyle = {
    border: '1px solid transparent',
    background: `linear-gradient(#F9FAFB, #F9FAFB) padding-box, ${promotionGradient} border-box`,
  };
  const currentLanguageOption = getCommunicationLanguageOption(formData.language ?? defaultLanguage);
  const sectionClass = 'rounded-2xl border border-gray-100 bg-white p-4 shadow-sm shadow-gray-100/60 sm:p-5';
  const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500';
  const inputBaseClass = 'w-full max-w-full min-w-0 rounded-lg border bg-white px-3 py-2.5 text-sm text-[#1A1F36] placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900/10';

  return (
    <AnimatePresence>
      <div key="appointment-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-gray-100 bg-[#F7F8FA] shadow-2xl"
        >
          {/* Header */}
          <div className="border-b border-gray-100 bg-white px-5 py-4 sm:px-6">
            <div className="flex items-center justify-between">
              <h2
                className="bg-clip-text text-xl font-semibold text-transparent"
                style={gradientTextStyle}
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <X className="h-5 w-5" weight="bold" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="min-h-0 flex flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 custom-scrollbar sm:p-5">
              <div className="space-y-4">
            {/* Client search - First field */}
            <div className={sectionClass}>
              <label className={labelClass}>
                {t('modal.fields.client')}
              </label>
              {isViewMode ? (
                <div className="space-y-2">
                  {/* Client name */}
                  <div
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={clientGradientBorderStyle}
                  >
                    <span className="flex-shrink-0 bg-clip-text text-lg font-bold text-transparent" style={gradientTextStyle}>
                      {(() => { const p = (formData.stranka_ime || '').trim().split(/\s+/).filter(Boolean); return p.length >= 2 ? `${p[0][0]}${p[1][0]}`.toUpperCase() : (p[0] || '?').substring(0, 2).toUpperCase(); })()}
                    </span>
                    <p className="min-w-0 flex-1 truncate font-medium text-[#1A1F36]">{formData.stranka_ime || '-'}</p>
                    <span
                      className="flex-shrink-0 text-base leading-none"
                      title={currentLanguageOption.label}
                      aria-label={currentLanguageOption.label}
                    >
                      {currentLanguageOption.flag}
                    </span>
                    <div className="flex-shrink-0">
                      <StatusBadge status={formData.status} variant="gradient" weight="normal" />
                    </div>
                  </div>
                  {/* Email and phone boxes */}
                  {(formData.stranka_email || formData.stranka_telefon) && (
                    <div className="grid grid-cols-2 gap-2">
                      {formData.stranka_email && (
                        <a
                          href={`mailto:${formData.stranka_email}`}
                          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 transition-all hover:border-gray-300 hover:shadow-sm"
                        >
                          <Envelope className="h-4 w-4 text-gray-400 flex-shrink-0" weight="regular" />
                          <div className="min-w-0">
                            <div className="text-[10px] text-gray-500">Email</div>
                            <div className="text-xs font-medium text-[#1A1F36] truncate">{formData.stranka_email}</div>
                          </div>
                        </a>
                      )}
                      {formData.stranka_telefon && (
                        <a
                          href={`tel:${formData.stranka_telefon}`}
                          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 transition-all hover:border-gray-300 hover:shadow-sm"
                        >
                          <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" weight="regular" />
                          <div className="min-w-0">
                            <div className="text-[10px] text-gray-500">{t('modal.fields.phone')}</div>
                            <div className="text-xs font-medium text-[#1A1F36] truncate">{formData.stranka_telefon}</div>
                          </div>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <ClientSearch
                    selectedClient={selectedClient}
                    onSelect={handleClientSelect}
                    onCreateNew={handleOpenCreateClient}
                  />
                  {errors.stranka_ime && (
                    <p className="mt-1 text-xs text-red-500">{errors.stranka_ime}</p>
                  )}
                </>
              )}
            </div>

            {/* Communication language - minimal divider between client and service */}
            {!isViewMode && (
              <CommunicationLanguageControl
                value={formData.language ?? defaultLanguage}
                onChange={(value) => setFormData((prev) => ({ ...prev, language: value }))}
                label={t('modal.fields.communicationLanguage')}
                variant="divider"
              />
            )}

            {/* Service - Second field (supports up to 3 services) */}
            <div className={`${sectionClass} space-y-3`}>
              <label className={labelClass}>
                {t('modal.fields.service')}
              </label>
              {isViewMode ? (
                <div className="space-y-2">
                  {/* Primary service */}
                  <div className="flex items-center gap-2">
                    {selectedService?.barva && (
                      <div
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ background: selectedService.barva }}
                      />
                    )}
                    <p className="text-sm font-medium text-[#1A1F36]">
                      {selectedService?.naziv || '-'}
                    </p>
                    {selectedService?.trajanje && (
                      <span className="text-xs text-gray-400">
                        ({selectedService.trajanje} min)
                      </span>
                    )}
                  </div>
                  {/* Second service */}
                  {selectedService2 && (
                    <div className="flex items-center gap-2">
                      {selectedService2?.barva && (
                        <div
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{ background: selectedService2.barva }}
                        />
                      )}
                      <p className="text-sm font-medium text-[#1A1F36]">
                        {selectedService2?.naziv}
                      </p>
                      {selectedService2?.trajanje && (
                        <span className="text-xs text-gray-400">
                          ({selectedService2.trajanje} min)
                        </span>
                      )}
                    </div>
                  )}
                  {/* Third service */}
                  {selectedService3 && (
                    <div className="flex items-center gap-2">
                      {selectedService3?.barva && (
                        <div
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{ background: selectedService3.barva }}
                        />
                      )}
                      <p className="text-sm font-medium text-[#1A1F36]">
                        {selectedService3?.naziv}
                      </p>
                      {selectedService3?.trajanje && (
                        <span className="text-xs text-gray-400">
                          ({selectedService3.trajanje} min)
                        </span>
                      )}
                    </div>
                  )}
                  {/* Total duration if multiple services */}
                  {(selectedService2 || selectedService3) && (
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <span className="text-xs font-medium text-gray-500">{t('modal.totalDuration')}</span>
                      <span className="bg-clip-text text-sm font-bold text-transparent" style={gradientTextStyle}>
                        {totalDuration} min
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Primary service selector */}
                  <div>
                    <Select
                      value={formData.storitev_id}
                      setValue={(value) => handleServiceChange(value, 1)}
                      placeholder={t('modal.placeholders.service')}
                    >
                      {filteredServices.map((service, idx) => (
                        <SelectOption
                          key={`svc-${idx}-${service.id}`}
                          value={service.id}
                          colorDot={service.barva || '#6366F1'}
                          description={`${service.trajanje} min`}
                        >
                          {service.naziv}
                        </SelectOption>
                      ))}
                    </Select>
                    {errors.storitev_id && (
                      <p className="mt-1 text-xs text-red-500">{errors.storitev_id}</p>
                    )}
                    <AnimatePresence>
                      {promotions.slot1?.found && (
                        <motion.div
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -8 }}
                          className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                            promotions.slot1.type === 'happy_hour'
                              ? 'border border-amber-200 bg-amber-50 text-amber-800'
                              : 'border border-blue-100 bg-blue-50 text-blue-800'
                          }`}
                        >
                          <span>{promotions.slot1.type === 'happy_hour' ? '⏰' : '🏷️'}</span>
                          <span>{promotions.slot1.naziv || (promotions.slot1.type === 'happy_hour' ? 'Happy Hour' : t('modal.price.discount'))}</span>
                          <span className="ml-auto font-semibold">
                            {promotions.slot1.tip_popusta === 'percentage' ? `${promotions.slot1.vrednost}%` : `${promotions.slot1.vrednost} €`} {t('modal.promotions.discountSuffix')}
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Second service selector */}
                  {serviceCount >= 2 && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                          {t('modal.fields.service2')}
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveService(2)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                        >
                          <Minus className="h-3 w-3" weight="bold" />
                          {t('modal.remove')}
                        </button>
                      </div>
                      <Select
                        value={formData.storitev_id_2 || ''}
                        setValue={(value) => handleServiceChange(value, 2)}
                        placeholder={t('modal.placeholders.service2')}
                      >
                        {filteredServices
                          .filter((s) => s.id !== formData.storitev_id)
                          .map((service, idx) => (
                            <SelectOption
                              key={`svc2-${idx}-${service.id}`}
                              value={service.id}
                              colorDot={service.barva || '#6366F1'}
                              description={`${service.trajanje} min`}
                            >
                              {service.naziv}
                            </SelectOption>
                          ))}
                      </Select>
                      <AnimatePresence>
                        {promotions.slot2?.found && (
                          <motion.div
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                              promotions.slot2.type === 'happy_hour'
                                ? 'border border-amber-200 bg-amber-50 text-amber-800'
                                : 'border border-blue-100 bg-blue-50 text-blue-800'
                            }`}
                          >
                            <span>{promotions.slot2.type === 'happy_hour' ? '⏰' : '🏷️'}</span>
                            <span>{promotions.slot2.naziv || (promotions.slot2.type === 'happy_hour' ? 'Happy Hour' : t('modal.price.discount'))}</span>
                            <span className="ml-auto font-semibold">
                              {promotions.slot2.tip_popusta === 'percentage' ? `${promotions.slot2.vrednost}%` : `${promotions.slot2.vrednost} €`} {t('modal.promotions.discountSuffix')}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Third service selector */}
                  {serviceCount >= 3 && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                          {t('modal.fields.service3')}
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveService(3)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                        >
                          <Minus className="h-3 w-3" weight="bold" />
                          {t('modal.remove')}
                        </button>
                      </div>
                      <Select
                        value={formData.storitev_id_3 || ''}
                        setValue={(value) => handleServiceChange(value, 3)}
                        placeholder={t('modal.placeholders.service3')}
                      >
                        {filteredServices
                          .filter((s) => s.id !== formData.storitev_id && s.id !== formData.storitev_id_2)
                          .map((service, idx) => (
                            <SelectOption
                              key={`svc3-${idx}-${service.id}`}
                              value={service.id}
                              colorDot={service.barva || '#6366F1'}
                              description={`${service.trajanje} min`}
                            >
                              {service.naziv}
                            </SelectOption>
                          ))}
                      </Select>
                      <AnimatePresence>
                        {promotions.slot3?.found && (
                          <motion.div
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                              promotions.slot3.type === 'happy_hour'
                                ? 'border border-amber-200 bg-amber-50 text-amber-800'
                                : 'border border-blue-100 bg-blue-50 text-blue-800'
                            }`}
                          >
                            <span>{promotions.slot3.type === 'happy_hour' ? '⏰' : '🏷️'}</span>
                            <span>{promotions.slot3.naziv || (promotions.slot3.type === 'happy_hour' ? 'Happy Hour' : t('modal.price.discount'))}</span>
                            <span className="ml-auto font-semibold">
                              {promotions.slot3.tip_popusta === 'percentage' ? `${promotions.slot3.vrednost}%` : `${promotions.slot3.vrednost} €`} {t('modal.promotions.discountSuffix')}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Add service button (max 3) — hide when add-on is selected */}
                  {serviceCount < 3 && !selectedAddOnId && (
                    <motion.button
                      type="button"
                      onClick={handleAddService}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-2.5 text-gray-600 transition-colors hover:border-gray-900 hover:bg-gray-50 hover:text-gray-900"
                    >
                      <Plus className="h-4 w-4" weight="bold" />
                      <span className="text-sm font-medium">{t('modal.addService')}</span>
                    </motion.button>
                  )}

                  {/* Add-on suggestions — shown when serviceCount is 1 and add-ons are available */}
                  <AnimatePresence>
                    {serviceCount === 1 && availableAddOns.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50"
                      >
                        <div className="border-b border-gray-100 bg-white px-3 py-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Dodaj storitev</p>
                        </div>
                        <div className="p-2 space-y-1.5">
                          {availableAddOns.map((ao) => {
                            const isSelected = selectedAddOnId === ao.id;
                            const discount = ao.tip_popusta === 'percentage'
                              ? `${ao.vrednost_popusta}%`
                              : `${ao.vrednost_popusta} ${ao.valuta || '€'}`;
                            return (
                              <motion.button
                                key={ao.id}
                                type="button"
                                onClick={() => handleSelectAddOn(ao)}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all ${
                                  isSelected
                                    ? 'border border-gray-900 bg-white shadow-sm'
                                    : 'border border-gray-200 bg-white hover:border-gray-300'
                                }`}
                              >
                                <span className="text-sm font-medium text-gray-900">{ao.naziv}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-400 line-through">{ao.original_cena.toFixed(2)} €</span>
                                  <span className="text-sm font-semibold text-gray-900">{ao.final_cena.toFixed(2)} €</span>
                                  <span className="text-xs font-medium text-emerald-600">-{discount}</span>
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Total duration display when multiple services */}
                  {serviceCount > 1 && totalDuration > 0 && (
                    <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <span className="text-sm font-medium text-gray-700">{t('modal.totalDuration')}</span>
                      <span className="bg-clip-text text-lg font-bold text-transparent" style={gradientTextStyle}>
                        {totalDuration} min
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Employee - Third field */}
            <div className={sectionClass}>
              <label className={labelClass}>
                {t('modal.fields.employee')}
              </label>
              {isViewMode || lockEmployee ? (
                <div className="flex items-center gap-3">
                  <span
                    className="text-lg font-bold flex-shrink-0"
                    style={{
                      backgroundImage: selectedEmployee?.barva || 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {selectedEmployee?.ime?.charAt(0)}{selectedEmployee?.priimek?.charAt(0)}
                  </span>
                  <p className="text-sm font-medium text-[#1A1F36]">
                    {selectedEmployee
                      ? `${selectedEmployee.ime} ${selectedEmployee.priimek}`
                      : '-'}
                  </p>
                </div>
              ) : (
                <>
                  <Select
                    value={formData.zaposleni_id}
                    setValue={handleEmployeeChange}
                    placeholder={t('modal.placeholders.employee')}
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
                </>
              )}
            </div>

            {/* Date field */}
            <div className={sectionClass}>
              <label className={labelClass}>
                {t('modal.fields.date')}
              </label>
              {isViewMode ? (
                <p className="flex items-center gap-2 text-sm font-bold">
                  <CalendarBlank className="h-4 w-4 text-gray-400" weight="regular" />
                  <span className="bg-clip-text text-transparent" style={gradientTextStyle}>
                    {new Date(formData.datum).toLocaleDateString('sl-SI')}
                  </span>
                </p>
              ) : (
                <>
                  <input
                    type="date"
                    value={formData.datum}
                    onChange={(e) => setFormData((prev) => ({ ...prev, datum: e.target.value }))}
                    className={`${inputBaseClass}
                               ${errors.datum ? 'border-red-300' : 'border-gray-200'}`}
                  />
                  {errors.datum && (
                    <p className="mt-1 text-xs text-red-500">{errors.datum}</p>
                  )}
                </>
              )}
            </div>

            {/* Time fields - Both start and end time are manually selectable */}
            <div className={`${sectionClass} grid grid-cols-2 gap-3`}>
              <div className="min-w-0">
                <label className={labelClass}>
                  {t('modal.fields.startTime')}
                </label>
                {isViewMode ? (
                  <p className="flex items-center gap-2 text-sm font-bold">
                    <Clock className="h-4 w-4 text-gray-400" weight="regular" />
                    <span className="bg-clip-text text-transparent" style={gradientTextStyle}>
                      {formData.cas_zacetek}
                    </span>
                  </p>
                ) : (
                  <>
                    <input
                      type="time"
                      value={formData.cas_zacetek}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, cas_zacetek: e.target.value }));
                        setEndTimeManuallySet(false);
                      }}
                      className={`${inputBaseClass} ${errors.cas_zacetek ? 'border-red-300' : 'border-gray-200'}`}
                    />
                    {errors.cas_zacetek && (
                      <p className="mt-1 text-xs text-red-500">{errors.cas_zacetek}</p>
                    )}
                  </>
                )}
              </div>
              <div className="min-w-0">
                <label className={labelClass}>
                  {t('modal.fields.endTime')}
                </label>
                {isViewMode ? (
                  <p className="flex items-center gap-2 text-sm font-bold">
                    <Clock className="h-4 w-4 text-gray-400" weight="regular" />
                    <span className="bg-clip-text text-transparent" style={gradientTextStyle}>
                      {formData.cas_konec}
                    </span>
                  </p>
                ) : (
                  <>
                    <input
                      type="time"
                      value={formData.cas_konec}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, cas_konec: e.target.value }));
                        setEndTimeManuallySet(true);
                      }}
                      className={`${inputBaseClass} ${errors.cas_konec ? 'border-red-300' : 'border-gray-200'}`}
                    />
                    {errors.cas_konec && (
                      <p className="mt-1 text-xs text-red-500">{errors.cas_konec}</p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Duration info display */}
            {formData.cas_zacetek && formData.cas_konec && (
              <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm shadow-gray-100/60">
                <span className="text-sm font-medium text-gray-700">{t('modal.appointmentDuration')}</span>
                <span className="bg-clip-text text-lg font-bold text-transparent" style={gradientTextStyle}>
                  {(() => {
                    const [startH, startM] = formData.cas_zacetek.split(':').map(Number);
                    const [endH, endM] = formData.cas_konec.split(':').map(Number);
                    const durationMins = (endH * 60 + endM) - (startH * 60 + startM);
                    return durationMins > 0 ? t('modal.duration', { mins: durationMins }) : '-';
                  })()}
                </span>
              </div>
            )}

            {/* Price field - auto-filled from service */}
            <div className={sectionClass}>
              <label className={labelClass}>
                {t('modal.fields.price')}
              </label>
              {isViewMode ? (
                (() => {
                  const originalCena = appointment?.cena;
                  const popustVrednost = appointment?.popust;
                  const finalCena = appointment?.koncna_cena;
                  const popustTip = appointment?.popust_tip;
                  const promocijaTip = appointment?.promocija_tip;
                  const promocijaNaziv = appointment?.promocija_naziv;
                  const storitevDva = appointment?.storitev_2;

                  const orig = parseFloat(String(originalCena)) || 0;
                  const popust = parseFloat(String(popustVrednost)) || 0;
                  const final = parseFloat(String(finalCena)) || orig;
                  const imaPopust = popust > 0;

                  const getBadge = () => {
                    if (promocijaTip === 'happy_hour') return { label: 'Happy Hour', bg: '#F59E0B', Icon: Clock };
                    if (promocijaTip === 'add_on') return { label: 'Add-on', bg: '#3B82F6', Icon: Plus };
                    if (imaPopust) return { label: promocijaNaziv ?? 'Popust', bg: '#6D5EF7', Icon: Tag };
                    return null;
                  };
                  const badge = getBadge();

                  const fmt = (val: number) =>
                    new Intl.NumberFormat('sl-SI', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(val);

                  return (
                    <div className="space-y-3">
                      {imaPopust ? (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-3"
                        >
                          {badge && (
                            <div
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-xs font-semibold"
                              style={{ backgroundColor: badge.bg }}
                            >
                              <badge.Icon size={11} />
                              <span>{badge.label}</span>
                            </div>
                          )}
                          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-2.5">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Originalna cena</span>
                              <span className="text-gray-400 line-through">
                                {fmt(orig)} EUR
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Popust</span>
                              <span className="font-medium text-red-500">
                                − {popustTip === 'percent'
                                  ? `${popust}%`
                                  : `${fmt(popust)} EUR`}
                              </span>
                            </div>
                            <div className="border-t border-gray-200 pt-2.5 flex justify-between items-center">
                              <span className="font-semibold text-gray-900">Cena z popustom</span>
                              <span className="text-xl font-bold text-green-600">
                                {fmt(final)} EUR
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <p className="text-2xl font-bold text-gray-900">
                          {orig > 0 ? `${fmt(orig)} EUR` : '-'}
                        </p>
                      )}

                      {storitevDva && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                          className="space-y-2 rounded-lg border border-blue-100 bg-blue-50 p-4"
                        >
                          <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
                            <Plus size={14} weight="bold" />
                            <span>Dodatna storitev</span>
                          </div>
                          <p className="text-sm font-medium text-gray-800">
                            {storitevDva?.naziv ?? 'Add-on storitev'}
                          </p>
                        </motion.div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-center gap-3">
                  {/* Decrease button */}
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({
                      ...prev,
                      cena: Math.max(0, (prev.cena ?? 0) - 5)
                    }))}
                    className="flex h-12 w-12 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-all hover:border-gray-900 hover:bg-gray-50 hover:text-gray-900"
                  >
                    <span className="text-xl font-semibold">−</span>
                  </button>

                  {/* Price input */}
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.cena ?? ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        cena: e.target.value ? parseFloat(e.target.value) : undefined
                      }))}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-gray-200 py-3 pr-12 text-center text-2xl font-bold text-[#1A1F36] placeholder-gray-400 transition-colors focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-gray-500">€</span>
                  </div>

                  {/* Increase button */}
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({
                      ...prev,
                      cena: (prev.cena ?? 0) + 5
                    }))}
                    className="flex h-12 w-12 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-all hover:border-gray-900 hover:bg-gray-50 hover:text-gray-900"
                  >
                    <span className="text-xl font-semibold">+</span>
                  </button>
                </div>
              )}
            </div>

            {/* Discount Toggle First */}
            {!isViewMode && (
              <div className={`${sectionClass} space-y-4`}>
                {/* Toggle to enable discount */}
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                  <div>
                    <div className="font-semibold text-gray-900">{t('modal.discount.add')}</div>
                    <div className="text-sm text-gray-600">{t('modal.discount.lower')}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setHasDiscount(!hasDiscount);
                      if (hasDiscount) {
                        // Clear discount when toggling off
                        setFormData((prev) => ({ ...prev, popust: undefined }));
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      hasDiscount ? 'bg-gray-900' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        hasDiscount ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Show discount fields only if enabled */}
                {hasDiscount && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <label className={labelClass}>
                        {t('modal.discount.amount')}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.popust ?? ''}
                        onChange={(e) => setFormData((prev) => ({
                          ...prev,
                          popust: e.target.value ? parseFloat(e.target.value) : undefined
                        }))}
                        placeholder="10"
                        className="w-full rounded-lg border border-gray-200 py-2.5 pl-4 pr-10 text-sm text-[#1A1F36] placeholder-gray-400 transition-colors focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                      <span className="absolute right-4 top-[calc(50%+12px)] -translate-y-1/2 text-gray-500">
                        {formData.popust_tip === '€' ? '€' : '%'}
                      </span>
                    </div>
                    <div>
                      <label className={labelClass}>
                        {t('modal.discount.type')}
                      </label>
                      {/* Toggle buttons for discount type */}
                      <div className="flex h-[46px] items-center gap-1 rounded-lg bg-gray-100 p-1">
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, popust_tip: '€' }))}
                          className={`flex-1 h-full rounded-lg font-medium transition-all ${
                            formData.popust_tip === '€'
                              ? 'bg-white shadow-sm text-gray-900'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          <span className="text-lg">€</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, popust_tip: '%' }))}
                          className={`flex-1 h-full rounded-lg font-medium transition-all ${
                            formData.popust_tip === '%'
                              ? 'bg-white shadow-sm text-gray-900'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          <span className="text-lg">%</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Final price display */}
            {((formData.cena && formData.cena > 0) || (formData.popust && formData.popust > 0)) && (
              <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm shadow-gray-100/60">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">{t('modal.discount.final')}</span>
                  {formData.popust && formData.popust > 0 && (
                    <span className="text-xs text-gray-400 line-through">
                      {(formData.cena ?? 0).toFixed(2)} €
                    </span>
                  )}
                </div>
                <span className="bg-clip-text text-xl font-bold text-transparent" style={gradientTextStyle}>
                  {calculateFinalPrice().toFixed(2)} €
                </span>
              </div>
            )}

            {/* Notes */}
            <div className={sectionClass}>
              <label className={labelClass}>
                {t('modal.fields.notes')}
              </label>
              {isViewMode ? (
                formData.opombe ? (
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{formData.opombe}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">-</p>
                )
              ) : (
                <>
                  <textarea
                    value={formData.opombe}
                    onChange={(e) => setFormData((prev) => ({ ...prev, opombe: e.target.value }))}
                    placeholder={t('modal.notesPlaceholder')}
                    rows={3}
                    className={`${inputBaseClass} resize-none`}
                  />
                  <p className="mt-1 text-xs text-gray-400">{t('modal.notesHint')}</p>
                </>
              )}
            </div>

            {/* Internal Notes - Not sent to client */}
            {isViewMode ? (
              // View mode: always show if there are notes
              formData.internal_opombe ? (
                <div className={sectionClass}>
                  <label className={labelClass}>
                    {t('modal.fields.internalNotes')}
                  </label>
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50/40 p-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{formData.internal_opombe}</p>
                  </div>
                </div>
              ) : null
            ) : mode === 'edit' ? (
              // Edit mode: always show internal notes field
              <div className={sectionClass}>
                <label className={labelClass}>
                  {t('modal.fields.internalNotes')}
                </label>
                <textarea
                  value={formData.internal_opombe}
                  onChange={(e) => setFormData((prev) => ({ ...prev, internal_opombe: e.target.value }))}
                  placeholder={t('modal.internalNotesPlaceholder')}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-yellow-200 bg-white px-4 py-2.5 text-sm text-[#1A1F36] placeholder-gray-400 transition-colors focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-100"
                />
              </div>
            ) : (
              // Create mode: show button to toggle internal notes
              showInternalNotes ? (
                <div className={sectionClass}>
                  <label className={labelClass}>
                    {t('modal.fields.internalNotes')}
                  </label>
                  <textarea
                    value={formData.internal_opombe}
                    onChange={(e) => setFormData((prev) => ({ ...prev, internal_opombe: e.target.value }))}
                    placeholder={t('modal.internalNotesPlaceholder')}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-yellow-200 bg-white px-4 py-2.5 text-sm text-[#1A1F36] placeholder-gray-400 transition-colors focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-100"
                  />
                </div>
              ) : (
                <motion.button
                  type="button"
                  onClick={() => setShowInternalNotes(true)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-yellow-300 bg-white py-3 text-yellow-700 transition-colors hover:bg-yellow-50"
                >
                  <span className="text-sm font-medium">{t('modal.addInternalNotes')}</span>
                </motion.button>
              )
            )}

            {/* Ghost termin toggle — owner/admin always see it, staff only if permission granted */}
            {!isViewMode && (role === 'owner' || role === 'admin' || (role === 'staff' && (permissions?.can_create_ghost_termin ?? false))) && (
              <div className={`${sectionClass} space-y-2`}>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                  <div>
                    <div className="font-semibold text-gray-900">Ne beleži termina</div>
                    <div className="text-sm text-gray-600">Ghost termin — termin se ne beleži v analitiko</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsGhostTermin(!isGhostTermin)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isGhostTermin ? 'bg-gray-900' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isGhostTermin ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {isGhostTermin && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <Warning className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" weight="fill" />
                    <p className="text-xs text-amber-700">
                      Ta termin ne bo zabeležen v analitiki, zgodovini ali blagajni. Po zaključku bo avtomatsko izbrisan.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Resource conflict warning */}
            {!isViewMode && resourceConflicts.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <Warning weight="fill" className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-800">
                      Resurs zaseden
                    </p>
                    {resourceConflicts.map((c) => (
                      <p key={c.resursId} className="mt-0.5 text-xs text-amber-700">
                        {c.tip === 'urnik'
                          ? `${c.naziv}: ni na voljo ob tem času`
                          : `${c.naziv}: ${c.trenutnoZasedeno}/${c.maxKapaciteta} mest zasedenih`
                        }
                      </p>
                    ))}
                    <p className="mt-1 text-xs text-amber-600">
                      Termin lahko vseeno shranite.
                    </p>
                  </div>
                </div>
              </div>
            )}
              </div>
            </div>

            {/* Actions */}
            {!isViewMode && (
              <div className="flex justify-end gap-3 border-t border-gray-100 bg-white px-5 py-4 sm:px-6">
                <motion.button
                  type="button"
                  onClick={onClose}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-lg px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
                >
                  {t('modal.actions.cancel')}
                </motion.button>
                <motion.button
                  type="submit"
                  disabled={isSaving}
                  whileTap={{ scale: isSaving ? 1 : 0.98 }}
                  className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    backgroundImage: isSaving
                      ? 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)'
                      : gradientTextStyle.backgroundImage,
                  }}
                >
                  {isSaving && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white
                                    border-t-transparent" />
                  )}
                  {mode === 'create' ? t('modal.actions.create') : t('modal.actions.save')}
                </motion.button>
              </div>
            )}
          </form>
        </motion.div>
      </div>

      {/* Inline Client Creation Modal - IDENTICAL to Stranke page */}
      {companyId && (
        <ClientModal
          key="client-modal"
          isOpen={showClientModal}
          onClose={() => setShowClientModal(false)}
          mode="create"
          companyId={companyId}
          onSave={handleSaveNewClient}
          isSaving={isClientSaving}
        />
      )}
    </AnimatePresence>
  );
}

export default memo(AppointmentModal);
