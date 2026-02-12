'use client';

import { memo, useMemo, useCallback, useState, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CaretLeft,
  CaretRight,
  X,
  Envelope,
  Phone,
  Copy,
  Check,
  XCircle,
  Trash,
  NotePencil,
  Warning,
  CheckCircle,
  WarningCircle,
  Faders,
  DotsThreeVertical,
  CalendarBlank,
  Clock,
  ListChecks,
} from '@phosphor-icons/react';
import type { AppointmentWithDetails, Storitev, Zaposleni } from '@/types/appointments';
import type { ViewMode } from '@/lib/utils/calendar';
import ViewToggle from './calendar/ViewToggle';
import CalendarSidebar from './calendar/CalendarSidebar';
import WeekView from './calendar/WeekView';
import DayView from './calendar/DayView';
import MonthView from './calendar/MonthView';
import AppointmentModal, { type AppointmentFormData } from './appointments/AppointmentModal';
import DeleteConfirmation from './appointments/DeleteConfirmation';
import AbsenceModal, { type AbsenceFormData } from './calendar/AbsenceModal';
import {
  fetchAppointmentsForMonth,
  fetchServices,
  fetchEmployees,
  fetchAbsences,
  type Absence,
} from '@/lib/supabase/appointments';
import {
  MONTHS_FULL,
  formatWeekRange,
  formatDate,
  formatDateResponsive,
  loadViewPreference,
  saveViewPreference,
  addDays,
  addWeeks,
  addMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  getLocalDateKey,
} from '@/lib/utils/calendar';
import { callN8nAction } from '@/src/lib/n8nClient';
import {
  getPodatkiPodjetja,
  buildEnhancedAppointmentData,
  buildBookingCompleteData,
  buildBookingDeleteData,
  getCustomerAppointmentsCount,
} from '@/lib/webhookPayloadBuilders';
import { generateUnique8DigitId } from '@/lib/utils/uniqueIdGenerator';
import { pickFirst } from '@/lib/dashboardHelpers';
import { supabase } from '@/lib/supabaseClient';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { loadCompanyRow } from '@/lib/settingsStore';

interface CalendarProps {
  companyId: string;
}

// Copy button component for contact info
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.button
      type="button"
      onClick={handleCopy}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#1A1F36]"
      title={`Kopiraj ${label}`}
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-500" weight="bold" />
      ) : (
        <Copy className="h-4 w-4" weight="regular" />
      )}
    </motion.button>
  );
}

const CALENDAR_ICON_PATH =
  'M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Z';
const CLOCK_ICON_PATH =
  'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z';

function GradientIcon({ path, size = 20 }: { path: string; size?: number }) {
  const gradientId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <path d={path} fill={`url(#${gradientId})`} />
    </svg>
  );
}

// Appointment detail modal component (view only)
function AppointmentDetailModal({
  appointment,
  services,
  onClose,
  onEdit,
  onComplete,
  onNoShow,
  onCancel,
  onDelete,
}: {
  appointment: AppointmentWithDetails;
  services: Storitev[];
  onClose: () => void;
  onEdit: () => void;
  onComplete?: () => void;
  onNoShow?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
}) {
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);

  // Get gradient background - handle both gradient CSS strings and hex colors
  const getGradientBackground = () => {
    const barva = appointment.storitev?.barva || '#6366F1';
    if (barva.includes('gradient')) return barva;
    const hex = barva.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 100;
    const g = parseInt(hex.substring(2, 4), 16) || 100;
    const b = parseInt(hex.substring(4, 6), 16) || 240;
    const lighterR = Math.min(255, r + 40);
    const lighterG = Math.min(255, g + 40);
    const lighterB = Math.min(255, b + 40);
    return `linear-gradient(135deg, rgb(${lighterR}, ${lighterG}, ${lighterB}) 0%, ${barva} 100%)`;
  };

  const formatModalDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('sl-SI', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTimeStr = (timeStr: string) => {
    if (!timeStr) return '';
    return timeStr.substring(0, 5);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Načrtovano';
      case 'confirmed': return 'Potrjeno';
      case 'completed': return 'Zaključeno';
      case 'cancelled': return 'Preklicano';
      case 'pending': return 'Čakajoč';
      case 'no_show': return 'Ni prišel/a';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-emerald-100 text-emerald-700';
      case 'confirmed': return 'bg-blue-100 text-blue-700';
      case 'completed': return 'bg-gray-100 text-gray-600';
      case 'cancelled': return 'bg-red-100 text-red-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'no_show': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Get the service color from the Storitve table
  const getServiceColor = (serviceId?: string | null) => {
    if (!serviceId) return '#6366F1';
    const service = services.find(s => s.id === serviceId);
    return service?.barva || '#6366F1';
  };

  const isTerminated = ['completed', 'zaključen', 'Zaključen', 'cancelled', 'Odpovedan'].includes(String(appointment.status));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Colored header with client name and close button */}
        <div
          className="relative flex items-center justify-between px-5 py-3.5"
          style={{ background: getGradientBackground() }}
        >
          <h3 className="text-base font-semibold text-white truncate pr-3">
            {appointment.stranka_ime || 'Neznana stranka'}
          </h3>
          <motion.button
            type="button"
            onClick={onClose}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-full bg-white/20 p-2 text-white transition-colors hover:bg-white/30 flex-shrink-0"
            aria-label="Zapri"
          >
            <X className="h-5 w-5" weight="bold" />
          </motion.button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Status</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(appointment.status || 'scheduled')}`}>
              {getStatusLabel(appointment.status || 'scheduled')}
            </span>
          </div>

          {/* Service with color circle */}
          {appointment.storitev && (() => {
            const service2 = appointment.storitev_id_2 ? services.find(s => s.id === appointment.storitev_id_2) : null;
            const service3 = appointment.storitev_id_3 ? services.find(s => s.id === appointment.storitev_id_3) : null;

            return (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ background: getServiceColor(appointment.storitev_id) }}
                  />
                  <div>
                    <p className="text-xs text-gray-500">Storitev</p>
                    <p className="text-sm font-semibold text-[#1A1F36]">{appointment.storitev.naziv}</p>
                  </div>
                </div>
                {service2 && (
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ background: getServiceColor(appointment.storitev_id_2) }}
                    />
                    <div>
                      <p className="text-xs text-gray-500">Storitev 2</p>
                      <p className="text-sm font-semibold text-[#1A1F36]">{service2.naziv}</p>
                    </div>
                  </div>
                )}
                {service3 && (
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ background: getServiceColor(appointment.storitev_id_3) }}
                    />
                    <div>
                      <p className="text-xs text-gray-500">Storitev 3</p>
                      <p className="text-sm font-semibold text-[#1A1F36]">{service3.naziv}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Employee - initials aligned with name */}
          {appointment.zaposleni && (
            <div className="flex items-center gap-3">
              <span
                className="text-lg font-bold flex-shrink-0"
                style={{
                  backgroundImage: appointment.zaposleni.barva || 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {appointment.zaposleni.initials}
              </span>
              <div>
                <p className="text-xs text-gray-500">Oseba</p>
                <p className="text-sm font-semibold text-[#1A1F36]">
                  {appointment.zaposleni.ime} {appointment.zaposleni.priimek}
                </p>
              </div>
            </div>
          )}

          {/* Client */}
          <div className="flex items-center gap-3">
            <span
              className="text-lg font-bold flex-shrink-0 bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent"
            >
              {appointment.stranka_ime?.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase()}
            </span>
            <div>
              <p className="text-xs text-gray-500">Stranka</p>
              <p className="text-sm font-semibold text-[#1A1F36]">{appointment.stranka_ime}</p>
            </div>
          </div>

          {/* Date & Time - no gradient border, plain */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <GradientIcon path={CALENDAR_ICON_PATH} size={18} />
              <div>
                <p className="text-xs text-gray-500">Datum</p>
                <p className="text-sm font-semibold text-[#1A1F36]">{formatModalDate(appointment.datum)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <GradientIcon path={CLOCK_ICON_PATH} size={18} />
              <div>
                <p className="text-xs text-gray-500">Čas</p>
                <p className="text-sm font-semibold text-[#1A1F36]">
                  {formatTimeStr(appointment.cas_zacetek)} - {formatTimeStr(appointment.cas_konec)}
                </p>
              </div>
            </div>
          </div>

          {/* Duration */}
          {appointment.cas_zacetek && appointment.cas_konec && (
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-violet-50 to-cyan-50 rounded-xl">
              <span className="text-sm font-medium text-gray-700">Trajanje</span>
              <span className="text-lg font-bold bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                {(() => {
                  try {
                    const [startHour, startMin] = appointment.cas_zacetek.split(':').map(Number);
                    const [endHour, endMin] = appointment.cas_konec.split(':').map(Number);
                    return Math.max(0, (endHour * 60 + endMin) - (startHour * 60 + startMin));
                  } catch { return appointment.storitev?.trajanje || 0; }
                })()} min
              </span>
            </div>
          )}

          {/* Price */}
          {(() => {
            const apt = appointment as unknown as Record<string, unknown>;
            const finalCena = (apt['Final cena'] as number) ?? (apt['final_cena'] as number) ?? (apt['koncna_cena'] as number) ?? appointment.storitev?.cena;
            if (finalCena && finalCena > 0) {
              return (
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-violet-50 to-cyan-50 rounded-xl">
                  <span className="text-sm font-medium text-gray-700">Cena</span>
                  <span className="text-xl font-bold bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">{finalCena.toFixed(2)} €</span>
                </div>
              );
            }
            return null;
          })()}

          {/* Client contact info */}
          {(appointment.stranka_email || appointment.stranka_telefon) && (
            <div className="space-y-2">
              {appointment.stranka_email && (
                <div className="flex items-center gap-3 p-2.5 bg-blue-50 rounded-lg">
                  <Envelope className="h-4 w-4 text-blue-500 flex-shrink-0" weight="fill" />
                  <span className="text-sm text-[#1A1F36] truncate flex-1">{appointment.stranka_email}</span>
                  <CopyButton text={appointment.stranka_email} label="email" />
                </div>
              )}
              {appointment.stranka_telefon && (
                <div className="flex items-center gap-3 p-2.5 bg-emerald-50 rounded-lg">
                  <Phone className="h-4 w-4 text-emerald-500 flex-shrink-0" weight="fill" />
                  <span className="text-sm text-[#1A1F36] truncate flex-1">{appointment.stranka_telefon}</span>
                  <CopyButton text={appointment.stranka_telefon} label="telefon" />
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {appointment.opombe && (
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-xs font-medium text-gray-500 mb-1">Opombe</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{appointment.opombe}</p>
            </div>
          )}

          {/* Internal Notes from Termini table */}
          {(() => {
            const apt = appointment as unknown as Record<string, unknown>;
            const interneOpombe = (apt['Interne opombe'] as string) ?? (apt['interne_opombe'] as string) ?? (apt['internal_opombe'] as string) ?? '';
            if (interneOpombe) {
              return (
                <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-200">
                  <p className="text-xs font-semibold text-yellow-700 mb-1">Interne opombe</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{interneOpombe}</p>
                </div>
              );
            }
            return null;
          })()}
        </div>

        {/* Action buttons - right aligned, like Termini page */}
        <div className="border-t border-gray-100 px-5 py-3">
          <div className="flex items-center justify-end gap-1">
            {/* Complete - only if not terminated */}
            {!isTerminated && onComplete && (
              <motion.button
                type="button"
                onClick={onComplete}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                title="Zaključi"
              >
                <CheckCircle className="h-4.5 w-4.5" weight="regular" />
              </motion.button>
            )}

            {/* Edit */}
            <motion.button
              type="button"
              onClick={onEdit}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
              title="Uredi"
            >
              <NotePencil className="h-4.5 w-4.5" weight="regular" />
            </motion.button>

            {/* Three dots menu - No Show, Cancel, Delete */}
            {!isTerminated && (
              <div className="relative">
                <motion.button
                  type="button"
                  onClick={() => setActionsMenuOpen(!actionsMenuOpen)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  title="Več možnosti"
                >
                  <DotsThreeVertical className="h-4.5 w-4.5" weight="bold" />
                </motion.button>

                <AnimatePresence>
                  {actionsMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 bottom-full z-50 mb-1 w-36 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-gray-200"
                    >
                      {onNoShow && (
                        <button
                          type="button"
                          onClick={() => { onNoShow(); setActionsMenuOpen(false); }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-amber-50 hover:text-amber-700"
                        >
                          <WarningCircle className="h-4 w-4" weight="regular" />
                          Ni prišel
                        </button>
                      )}
                      {onCancel && (
                        <button
                          type="button"
                          onClick={() => { onCancel(); setActionsMenuOpen(false); }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-red-50 hover:text-red-700"
                        >
                          <XCircle className="h-4 w-4" weight="regular" />
                          Odpoved
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { onDelete?.(); setActionsMenuOpen(false); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash className="h-4 w-4" weight="regular" />
                        Izbriši
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Calendar({ companyId }: CalendarProps) {
  const { companySettings } = useCompany();
  const { user } = useAuth();

  // View state - default to week, load from localStorage
  const [currentView, setCurrentView] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Data state
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [services, setServices] = useState<Storitev[]>([]);
  const [employees, setEmployees] = useState<(Zaposleni & { initials: string })[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithDetails | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('create');
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithDetails | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Complete confirmation state (identical to Termini)
  const [completeTarget, setCompleteTarget] = useState<AppointmentWithDetails | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');

  // Delete confirmation state (identical to Termini)
  const [deleteTarget, setDeleteTarget] = useState<AppointmentWithDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Action feedback
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Show all days filter (true = all 7 days, false = only weekdays Mon-Fri)
  const [showAllDays, setShowAllDays] = useState(true);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
      company_id: companyId,
      actor,
      timestamp: new Date().toISOString(),
      meta: { app: 'Integrate' as const, version: '1.0' as const },
    }),
    [companyId, actor]
  );

  // Load view preference from localStorage on mount
  useEffect(() => {
    const savedView = loadViewPreference();
    setCurrentView(savedView);
  }, []);

  // Load showAllDays preference from Supabase "Podatki podjetij" table
  useEffect(() => {
    const loadDaysPreference = async () => {
      try {
        const { data } = await loadCompanyRow(companyId);
        if (data) {
          // Check "Vsi dnevi koledar" column - if "true" show all days, if "false" show only weekdays
          const vsiDnevi = data['Vsi dnevi koledar'];
          // Handle different formats: boolean, string "true"/"false", etc.
          if (vsiDnevi === false || vsiDnevi === 'false' || vsiDnevi === 'False') {
            setShowAllDays(false);
          } else {
            setShowAllDays(true);
          }
        }
      } catch (err) {
        console.error('Error loading days preference:', err);
      }
    };

    loadDaysPreference();
  }, [companyId]);

  // Handle show all days change - send to n8n
  const handleShowAllDaysChange = useCallback(async (showAll: boolean) => {
    setShowAllDays(showAll);

    try {
      await callN8nAction({
        event: 'DNEVI_KOLEDAR',
        entity: 'settings',
        data: {
          all_days: showAll, // true = vsi dnevi, false = samo tedenske dneve
        },
        company_id: companyId,
        actor,
        timestamp: new Date().toISOString(),
        meta: { app: 'Integrate' as const, version: '1.0' as const },
      });
    } catch (err) {
      console.error('Error saving days preference:', err);
    }
  }, [companyId, actor]);

  // Save view preference when changed
  const handleViewChange = useCallback((view: ViewMode) => {
    setCurrentView(view);
    saveViewPreference(view);
  }, []);

  // Load services, employees, and absences
  useEffect(() => {
    const loadStaticData = async () => {
      const [servicesResult, employeesResult, absencesResult] = await Promise.all([
        fetchServices(companyId),
        fetchEmployees(companyId),
        fetchAbsences(companyId),
      ]);

      if (servicesResult.data) {
        setServices(servicesResult.data);
      }
      if (employeesResult.data) {
        setEmployees(employeesResult.data);
      }
      if (absencesResult.data) {
        console.log('[Calendar] Loaded absences:', absencesResult.data.length, absencesResult.data);
        setAbsences(absencesResult.data);
      }
    };

    loadStaticData();
  }, [companyId]);

  // Load appointments for current view
  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // For week view, check if the week spans two months
    // If so, we need to load appointments from both months
    if (currentView === 'week') {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);

      const startMonth = weekStart.getMonth();
      const startYear = weekStart.getFullYear();
      const endMonth = weekEnd.getMonth();
      const endYear = weekEnd.getFullYear();

      // If week spans two months, fetch both
      if (startMonth !== endMonth || startYear !== endYear) {
        const [result1, result2] = await Promise.all([
          fetchAppointmentsForMonth(companyId, startYear, startMonth),
          fetchAppointmentsForMonth(companyId, endYear, endMonth),
        ]);

        if (result1.error) {
          setError(result1.error.message);
        } else if (result2.error) {
          setError(result2.error.message);
        } else {
          // Combine and deduplicate appointments by ID
          const allAppointments = [...(result1.data || []), ...(result2.data || [])];
          const uniqueAppointments = allAppointments.filter(
            (apt, index, self) => index === self.findIndex((a) => a.id === apt.id)
          );
          setAppointments(uniqueAppointments);
        }
        setLoading(false);
        return;
      }
    }

    const result = await fetchAppointmentsForMonth(companyId, year, month);

    if (result.error) {
      setError(result.error.message);
    } else {
      setAppointments(result.data || []);
    }

    setLoading(false);
  }, [companyId, currentDate, currentView]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    let filtered = appointments;

    if (selectedEmployeeId) {
      filtered = filtered.filter((a) => a.zaposleni?.id === selectedEmployeeId);
    }

    if (selectedServiceId) {
      filtered = filtered.filter((a) => a.storitev?.id === selectedServiceId);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (a) =>
          a.stranka_ime.toLowerCase().includes(query) ||
          a.storitev?.naziv.toLowerCase().includes(query) ||
          a.zaposleni?.ime.toLowerCase().includes(query) ||
          a.zaposleni?.priimek.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [appointments, selectedEmployeeId, selectedServiceId, searchQuery]);

  // Navigation handlers
  const handlePrev = useCallback(() => {
    setCurrentDate((prev) => {
      switch (currentView) {
        case 'day':
          return addDays(prev, -1);
        case 'week':
          return addWeeks(prev, -1);
        case 'month':
          return addMonths(prev, -1);
        default:
          return prev;
      }
    });
  }, [currentView]);

  const handleNext = useCallback(() => {
    setCurrentDate((prev) => {
      switch (currentView) {
        case 'day':
          return addDays(prev, 1);
        case 'week':
          return addWeeks(prev, 1);
        case 'month':
          return addMonths(prev, 1);
        default:
          return prev;
      }
    });
  }, [currentView]);

  const handleTodayClick = useCallback(() => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  }, []);

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    setCurrentDate(date);
  }, []);

  const handleDateClick = useCallback((date: Date) => {
    setSelectedDate(date);
    setCurrentDate(date);
    // Switch to day view when clicking a date in month view
    if (currentView === 'month') {
      handleViewChange('day');
    }
  }, [currentView, handleViewChange]);

  const handleAppointmentClick = useCallback((appointment: AppointmentWithDetails) => {
    setSelectedAppointment(appointment);
  }, []);

  const handleCloseDetailModal = useCallback(() => {
    setSelectedAppointment(null);
  }, []);

  const handleEditFromDetail = useCallback(() => {
    if (selectedAppointment) {
      setEditingAppointment(selectedAppointment);
      setModalMode('edit');
      setIsModalOpen(true);
      setSelectedAppointment(null);
    }
  }, [selectedAppointment]);

  // Action handlers for appointment detail modal
  const handleCompleteAppointment = useCallback(() => {
    if (!selectedAppointment) return;
    setCompleteTarget(selectedAppointment);
    setSelectedAppointment(null);
  }, [selectedAppointment]);

  // Confirm complete - identical to Termini page
  const handleConfirmComplete = useCallback(async () => {
    if (!completeTarget) return;

    setIsCompleting(true);
    setActionError(null);

    try {
      const trimmedNotes = completionNotes.trim();
      const completionNotesValue = trimmedNotes.length > 0 ? trimmedNotes : null;

      const customerAppointmentsCount = await getCustomerAppointmentsCount(
        companyId,
        completeTarget.stranka_id || completeTarget.stranka_ime
      );

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

      await loadAppointments();
      setCompleteTarget(null);
      setCompletionNotes('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Napaka pri zaključevanju');
    } finally {
      setIsCompleting(false);
    }
  }, [completeTarget, completionNotes, companyId, actor, companyPayload, buildPayload, loadAppointments]);

  const handleNoShowAppointment = useCallback(async () => {
    if (!selectedAppointment) return;

    setIsDeleting(true);
    setActionError(null);

    try {
      const result = await callN8nAction(
        buildPayload(
          'NO_SHOW_TERMINA',
          'appointments',
          {
            appointment_id: selectedAppointment.id,
            booking_id: selectedAppointment.id,
            company_id: companyId,
            user_email: actor,
            company_profile: companyPayload,
            status: 'no_show',
            previous_status: selectedAppointment.status,
            stranka_ime: selectedAppointment.stranka_ime,
            stranka_id: selectedAppointment.stranka_id,
            datum: selectedAppointment.datum,
            cas_zacetek: selectedAppointment.cas_zacetek,
          }
        )
      );

      if (!result.ok) {
        throw new Error('Napaka pri označevanju kot No Show');
      }

      setSuccessMessage('Termin označen kot No Show');
      setTimeout(() => setSuccessMessage(null), 3000);

      await new Promise((resolve) => setTimeout(resolve, 500));
      await loadAppointments();
      setSelectedAppointment(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Napaka pri No Show');
    } finally {
      setIsDeleting(false);
    }
  }, [selectedAppointment, companyId, actor, companyPayload, buildPayload, loadAppointments]);

  const handleCancelAppointment = useCallback(async () => {
    if (!selectedAppointment) return;

    setIsDeleting(true);
    setActionError(null);

    try {
      const result = await callN8nAction(
        buildPayload(
          'ODPOVED_TERMINA',
          'appointments',
          {
            appointment_id: selectedAppointment.id,
            booking_id: selectedAppointment.id,
            company_id: companyId,
            user_email: actor,
            company_profile: companyPayload,
            status: 'cancelled',
            previous_status: selectedAppointment.status,
            stranka_ime: selectedAppointment.stranka_ime,
            stranka_id: selectedAppointment.stranka_id,
            datum: selectedAppointment.datum,
            cas_zacetek: selectedAppointment.cas_zacetek,
          }
        )
      );

      if (!result.ok) {
        throw new Error('Napaka pri odpovedi termina');
      }

      setSuccessMessage('Termin uspešno odpovedan');
      setTimeout(() => setSuccessMessage(null), 3000);

      await new Promise((resolve) => setTimeout(resolve, 500));
      await loadAppointments();
      setSelectedAppointment(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Napaka pri odpovedi');
    } finally {
      setIsDeleting(false);
    }
  }, [selectedAppointment, companyId, actor, companyPayload, buildPayload, loadAppointments]);

  // Delete handler - opens DeleteConfirmation dialog (identical to Termini)
  const handleDeleteAppointment = useCallback(() => {
    if (!selectedAppointment) return;
    setDeleteTarget(selectedAppointment);
    setSelectedAppointment(null);
  }, [selectedAppointment]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

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

      await loadAppointments();
      setDeleteTarget(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Napaka pri brisanju');
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, companyId, actor, companyPayload, buildPayload, loadAppointments]);

  // Modal handlers
  const handleNewAppointment = useCallback(() => {
    setEditingAppointment(null);
    setModalMode('create');
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingAppointment(null);
  }, []);

  const handleSaveAppointment = useCallback(async (data: AppointmentFormData) => {
    setIsSaving(true);
    setActionError(null);

    try {
      const isNewAppointment = !data.id;
      const event = isNewAppointment ? 'NOV_TERMIN' : 'POSODOBITEV_TERMINA';

      // Generate unique 8-digit ID for new appointments
      let unique8DigitId: string | undefined;
      if (isNewAppointment) {
        unique8DigitId = await generateUnique8DigitId('Termini', 'id');
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
          const columnsToTry = ['id', 'ID stranke', 'ID_stranke', 'client_id'];
          for (const column of columnsToTry) {
            const { data: row, error } = await supabase
              .from('Stranke')
              .select('*')
              .eq(column, clientId)
              .maybeSingle();

            if (error) {
              const message = error.message?.toLowerCase() ?? '';
              if (message.includes('column') && message.includes('does not exist')) {
                continue;
              }
              throw error;
            }

            if (row) return row as Record<string, unknown>;
          }
          return null;
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

      await loadAppointments();
      handleCloseModal();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Napaka pri shranjevanju');
    } finally {
      setIsSaving(false);
    }
  }, [companyId, actor, companyPayload, services, employees, buildPayload, loadAppointments, handleCloseModal]);

  // Handle absence modal
  const handleOpenAbsenceModal = useCallback(() => {
    setIsAbsenceModalOpen(true);
  }, []);

  const handleCloseAbsenceModal = useCallback(() => {
    setIsAbsenceModalOpen(false);
  }, []);

  // Sidebar toggle handler
  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  // Refresh absences from database
  const refreshAbsences = useCallback(async () => {
    const absencesResult = await fetchAbsences(companyId);
    if (absencesResult.data) {
      setAbsences(absencesResult.data);
    }
  }, [companyId]);

  const handleSaveAbsence = useCallback(async (data: AbsenceFormData) => {
    setIsSaving(true);

    try {
      const result = await callN8nAction({
        event: 'ODSOTNOST',
        entity: 'absence',
        data: {
          employee_ids: data.employeeIds,
          all_employees: data.allEmployees,
          date_from: data.dateFrom,
          date_to: data.dateTo,
          single_day: data.singleDay,
          time_from: data.timeFrom,
          time_to: data.timeTo,
          reason: data.reason,
          company_id: companyId,
          podjetje: companyPayload,
        },
        company_id: companyId,
        actor,
        timestamp: new Date().toISOString(),
        meta: { app: 'Integrate' as const, version: '1.0' as const },
      });

      if (!result.ok) {
        throw new Error('Napaka pri shranjevanju odsotnosti');
      }

      // Refresh absences after saving
      await refreshAbsences();
      handleCloseAbsenceModal();
    } catch (err) {
      console.error('Error saving absence:', err);
    } finally {
      setIsSaving(false);
    }
  }, [companyId, actor, companyPayload, handleCloseAbsenceModal, refreshAbsences]);

  // Get header title based on view - responsive for mobile
  const headerTitle = useMemo(() => {
    return formatDateResponsive(currentDate, currentView, isMobile);
  }, [currentView, currentDate, isMobile]);

  // Calculate visible appointments count based on current view
  const visibleAppointmentsCount = useMemo(() => {
    const currentDateKey = getLocalDateKey(currentDate);

    if (currentView === 'day') {
      // Count appointments for current day only
      return filteredAppointments.filter(apt => {
        const aptDateKey = getLocalDateKey(new Date(apt.datum));
        return aptDateKey === currentDateKey;
      }).length;
    } else if (currentView === 'week') {
      // Count appointments for current week
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);
      return filteredAppointments.filter(apt => {
        const aptDate = new Date(apt.datum);
        return aptDate >= weekStart && aptDate <= weekEnd;
      }).length;
    } else {
      // Count appointments for current month
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      return filteredAppointments.filter(apt => {
        const aptDate = new Date(apt.datum);
        return aptDate >= monthStart && aptDate <= monthEnd;
      }).length;
    }
  }, [currentView, currentDate, filteredAppointments]);

  return (
    <div className="flex h-full bg-gradient-to-br from-gray-50 via-white to-slate-50">
      {/* Main calendar area - takes available space */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-gray-100 bg-white/80 backdrop-blur-sm px-3 py-2 md:px-6 md:py-4 flex-shrink-0">
          {/* Left: Navigation and View Toggle */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Navigation buttons */}
            <div className="flex items-center gap-1">
              <motion.button
                type="button"
                onClick={handlePrev}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-lg bg-white text-[#1A1F36]
                           shadow-sm ring-1 ring-gray-100 transition-all hover:shadow-md"
                aria-label="Nazaj"
              >
                <CaretLeft className="h-4 w-4" weight="bold" />
              </motion.button>
              <motion.button
                type="button"
                onClick={handleNext}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-lg bg-white text-[#1A1F36]
                           shadow-sm ring-1 ring-gray-100 transition-all hover:shadow-md"
                aria-label="Naprej"
              >
                <CaretRight className="h-4 w-4" weight="bold" />
              </motion.button>
            </div>

            {/* View Toggle */}
            <ViewToggle currentView={currentView} onViewChange={handleViewChange} />

            {/* Title */}
            <h1 className="text-sm md:text-lg font-semibold text-[#1A1F36]">
              {headerTitle}
            </h1>
          </div>

          {/* Right side: Filter button */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Filter button - icon only */}
            <motion.button
              type="button"
              onClick={handleToggleSidebar}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-xl bg-white text-[#1A1F36]
                         shadow-sm ring-1 ring-gray-200 transition-all hover:shadow-md hover:ring-violet-300"
              aria-label="Filtri"
            >
              <Faders className="h-4 w-4 md:h-5 md:w-5" weight="bold" />
            </motion.button>
          </div>
        </header>

        {/* Calendar content */}
        <div className="flex-1 overflow-hidden p-2 md:p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                <p className="text-sm text-gray-500">Nalagam termine...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center">
              <div className="rounded-2xl bg-gradient-to-r from-red-50 to-rose-50 p-6 text-center ring-1 ring-red-100">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                  <X className="h-6 w-6 text-red-600" weight="bold" />
                </div>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          ) : (
            <>
              {currentView === 'week' && (
                <WeekView
                  currentDate={currentDate}
                  appointments={filteredAppointments}
                  absences={absences}
                  services={services}
                  onAppointmentClick={handleAppointmentClick}
                  onDateClick={handleDateClick}
                  showAllDays={showAllDays}
                />
              )}
              {currentView === 'day' && (
                <DayView
                  currentDate={currentDate}
                  appointments={filteredAppointments}
                  absences={absences}
                  services={services}
                  onAppointmentClick={handleAppointmentClick}
                  employees={employees}
                />
              )}
              {currentView === 'month' && (
                <MonthView
                  currentDate={currentDate}
                  appointments={filteredAppointments}
                  absences={absences}
                  services={services}
                  onAppointmentClick={handleAppointmentClick}
                  onDateClick={handleDateClick}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Right Sidebar - Collapsible panel */}
      <CalendarSidebar
        currentDate={currentDate}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
        onTodayClick={handleTodayClick}
        onNewAppointment={handleNewAppointment}
        onAbsence={handleOpenAbsenceModal}
        services={services}
        employees={employees}
        selectedEmployeeId={selectedEmployeeId}
        onEmployeeFilterChange={setSelectedEmployeeId}
        selectedServiceId={selectedServiceId}
        onServiceFilterChange={setSelectedServiceId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        currentView={currentView}
        onViewChange={handleViewChange}
        isOpen={isSidebarOpen}
        onToggle={handleToggleSidebar}
        showAllDays={showAllDays}
        onShowAllDaysChange={handleShowAllDaysChange}
      />

      {/* Appointment detail modal (view) */}
      <AnimatePresence>
        {selectedAppointment && (
          <AppointmentDetailModal
            appointment={selectedAppointment}
            services={services}
            onClose={handleCloseDetailModal}
            onEdit={handleEditFromDetail}
            onComplete={handleCompleteAppointment}
            onNoShow={handleNoShowAppointment}
            onCancel={handleCancelAppointment}
            onDelete={handleDeleteAppointment}
          />
        )}
      </AnimatePresence>

      {/* Create/Edit modal - Uses IDENTICAL modal as Termini page */}
      <AppointmentModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        appointment={editingAppointment}
        mode={modalMode}
        services={services}
        employees={employees}
        onSave={handleSaveAppointment}
        isSaving={isSaving}
      />

      {/* Absence modal */}
      <AbsenceModal
        isOpen={isAbsenceModalOpen}
        onClose={handleCloseAbsenceModal}
        employees={employees}
        onSave={handleSaveAbsence}
        isSaving={isSaving}
      />

      {/* Delete confirmation - identical to Termini */}
      <DeleteConfirmation
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Izbriši termin"
        message="Ali ste prepričani, da želite izbrisati ta termin?"
        appointment={deleteTarget}
        isDeleting={isDeleting}
      />

      {/* Complete Confirmation Modal - identical to Termini */}
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
                  <label htmlFor="calendar-completion-notes" className="block text-sm font-semibold text-gray-700 mb-2">
                    Sporočilo stranki oz. navodila po terminu
                  </label>
                  <textarea
                    id="calendar-completion-notes"
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

      {/* Error Toast */}
      <AnimatePresence>
        {actionError && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-4 py-3 text-white shadow-lg"
          >
            <Warning className="h-5 w-5" weight="fill" />
            <span className="text-sm font-medium">{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="ml-2 rounded-full p-0.5 transition-colors hover:bg-white/20"
            >
              <X className="h-4 w-4" weight="bold" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(Calendar);
