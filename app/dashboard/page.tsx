"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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
  DotsThreeVertical,
  Envelope,
  Phone,
  ClockCountdown,
} from "@phosphor-icons/react";
import ProtectedLayout from "@/components/ProtectedLayout";
import { useCompany } from "@/app/company-context";
import { useAuth } from "@/app/auth-context";
import {
  MetricCard,
  AppointmentListCard,
  TopServicesCard,
  TopEmployeesCard,
  RecentActivityCard,
  WeeklyChart,
} from "@/components/dashboard";
import {
  fetchDashboardData,
  type DashboardData,
  type AppointmentItem,
} from "@/lib/dashboard/fetchDashboardData";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";
import { sl } from "date-fns/locale";
import AppointmentModal, { type AppointmentFormData } from "@/components/appointments/AppointmentModal";
import DeleteConfirmation from "@/components/appointments/DeleteConfirmation";
import ClientModal from "@/components/clients/ClientModal";
import { fetchServices, fetchEmployees } from "@/lib/supabase/appointments";
import type { AppointmentWithDetails, Storitev, Zaposleni } from "@/types/appointments";
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

// ─── Copy button (reused in detail modal) ────────────────────────────────────
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
      className="rounded-lg p-2 border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
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

// ─── Appointment Detail Modal (identical to Calendar) ────────────────────────
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
  onEdit?: (appointment: AppointmentWithDetails) => void;
  onComplete?: (appointment: AppointmentWithDetails) => void;
  onNoShow?: (appointment: AppointmentWithDetails) => void;
  onCancel?: (appointment: AppointmentWithDetails) => void;
  onDelete?: (appointment: AppointmentWithDetails) => void;
}) {
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);

  const getGradientBackground = () => {
    const extractFirst = (barva: string): string => {
      if (!barva) return '#6366F1';
      if (barva.includes('gradient')) {
        const m = barva.match(/#[0-9A-Fa-f]{6}/g);
        if (m && m.length > 0) return m[0];
      }
      return barva;
    };
    const extractLast = (barva: string): string => {
      if (!barva) return '#6366F1';
      if (barva.includes('gradient')) {
        const m = barva.match(/#[0-9A-Fa-f]{6}/g);
        if (m && m.length > 0) return m[m.length - 1];
      }
      return barva;
    };
    const singleGradient = (barva: string): string => {
      if (barva.includes('gradient')) return barva;
      const hex = barva.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 100;
      const g = parseInt(hex.substring(2, 4), 16) || 100;
      const b = parseInt(hex.substring(4, 6), 16) || 240;
      const lr = Math.min(255, r + 40);
      const lg = Math.min(255, g + 40);
      const lb = Math.min(255, b + 40);
      return `linear-gradient(135deg, rgb(${lr}, ${lg}, ${lb}) 0%, ${barva} 100%)`;
    };

    const primaryColor = appointment.storitev?.barva || '#6366F1';
    const service2 = appointment.storitev_id_2 ? services.find(s => s.id === appointment.storitev_id_2) : null;
    const service3 = appointment.storitev_id_3 ? services.find(s => s.id === appointment.storitev_id_3) : null;
    const allColors: string[] = [primaryColor];
    if (service2?.barva) allColors.push(service2.barva);
    if (service3?.barva) allColors.push(service3.barva);

    if (allColors.length === 1) return singleGradient(primaryColor);
    if (allColors.length === 2) return `linear-gradient(135deg, ${extractFirst(allColors[0])} 0%, ${extractLast(allColors[1])} 100%)`;
    return `linear-gradient(135deg, ${extractFirst(allColors[0])} 0%, ${extractLast(allColors[1])} 50%, ${extractLast(allColors[2])} 100%)`;
  };

  const formatModalDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
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

  const isTerminated = ['completed', 'zaključen', 'Zaključen', 'cancelled', 'Odpovedan', 'no_show', 'Ni prišel'].includes(String(appointment.status));

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
        className="relative w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Colored header */}
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

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-4">
          {/* Status */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Status</label>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(appointment.status || 'scheduled')}`}>
              {getStatusLabel(appointment.status || 'scheduled')}
            </span>
          </div>

          {/* Client */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Stranka</label>
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
                <span className="text-lg font-bold bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent flex-shrink-0">
                  {(() => { const p = (appointment.stranka_ime || '').trim().split(/\s+/).filter(Boolean); return p.length >= 2 ? `${p[0][0]}${p[1][0]}`.toUpperCase() : (p[0] || '?').substring(0, 2).toUpperCase(); })()}
                </span>
                <p className="font-medium text-[#1A1F36]">{appointment.stranka_ime || '-'}</p>
              </div>
              {(appointment.stranka_email || appointment.stranka_telefon) && (
                <div className="grid grid-cols-2 gap-2">
                  {appointment.stranka_email && (
                    <a
                      href={`mailto:${appointment.stranka_email}`}
                      className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 hover:border-violet-300 hover:shadow-sm transition-all"
                    >
                      <Envelope className="h-4 w-4 text-gray-400 flex-shrink-0" weight="regular" />
                      <div className="min-w-0">
                        <div className="text-[10px] text-gray-500">Email</div>
                        <div className="text-xs font-medium text-[#1A1F36] truncate">{appointment.stranka_email}</div>
                      </div>
                    </a>
                  )}
                  {appointment.stranka_telefon && (
                    <a
                      href={`tel:${appointment.stranka_telefon}`}
                      className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 hover:border-green-300 hover:shadow-sm transition-all"
                    >
                      <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" weight="regular" />
                      <div className="min-w-0">
                        <div className="text-[10px] text-gray-500">Telefon</div>
                        <div className="text-xs font-medium text-[#1A1F36] truncate">{appointment.stranka_telefon}</div>
                      </div>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Service(s) */}
          {appointment.storitev && (() => {
            const service2 = appointment.storitev_id_2 ? services.find(s => s.id === appointment.storitev_id_2) : null;
            const service3 = appointment.storitev_id_3 ? services.find(s => s.id === appointment.storitev_id_3) : null;
            return (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Storitev</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: appointment.storitev.barva || '#6366F1' }} />
                    <p className="text-sm font-medium text-[#1A1F36]">{appointment.storitev.naziv}</p>
                    {appointment.storitev.trajanje > 0 && (
                      <span className="text-xs text-gray-400">({appointment.storitev.trajanje} min)</span>
                    )}
                  </div>
                  {service2 && (
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: service2.barva || '#6366F1' }} />
                      <p className="text-sm font-medium text-[#1A1F36]">{service2.naziv}</p>
                      {service2.trajanje > 0 && <span className="text-xs text-gray-400">({service2.trajanje} min)</span>}
                    </div>
                  )}
                  {service3 && (
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: service3.barva || '#6366F1' }} />
                      <p className="text-sm font-medium text-[#1A1F36]">{service3.naziv}</p>
                      {service3.trajanje > 0 && <span className="text-xs text-gray-400">({service3.trajanje} min)</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Employee */}
          {appointment.zaposleni && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Oseba</label>
              <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
                <span
                  className="text-lg font-bold flex-shrink-0"
                  style={{
                    background: appointment.zaposleni.barva || 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {appointment.zaposleni.initials}
                </span>
                <p className="font-medium text-[#1A1F36]">
                  {appointment.zaposleni.ime} {appointment.zaposleni.priimek}
                </p>
              </div>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Datum</label>
            <p className="text-sm font-medium text-[#1A1F36]">{formatModalDate(appointment.datum)}</p>
          </div>

          {/* Time */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Čas</label>
            <p className="text-sm font-medium text-[#1A1F36]">
              {formatTimeStr(appointment.cas_zacetek)} – {formatTimeStr(appointment.cas_konec)}
            </p>
          </div>

          {/* Duration */}
          {appointment.cas_zacetek && appointment.cas_konec && (
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-violet-50 to-cyan-50 rounded-xl">
              <span className="text-sm font-medium text-gray-700">Trajanje</span>
              <span className="text-lg font-bold bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                {(() => {
                  try {
                    const [sh, sm] = appointment.cas_zacetek.split(':').map(Number);
                    const [eh, em] = appointment.cas_konec.split(':').map(Number);
                    return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
                  } catch { return appointment.storitev?.trajanje || 0; }
                })()} min
              </span>
            </div>
          )}

          {/* Price */}
          {(() => {
            const apt = appointment as unknown as Record<string, unknown>;
            const cena = (apt['Final cena'] as number) ?? (apt['final_cena'] as number) ?? (apt['koncna_cena'] as number) ?? appointment.koncna_cena ?? appointment.cena ?? appointment.storitev?.cena;
            if (cena && Number(cena) > 0) {
              return (
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-violet-50 to-cyan-50 rounded-xl">
                  <span className="text-sm font-medium text-gray-700">Cena</span>
                  <span className="text-xl font-bold bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                    {Number(cena).toFixed(2)} €
                  </span>
                </div>
              );
            }
            return null;
          })()}

          {/* Notes */}
          {appointment.opombe && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Opombe</label>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{appointment.opombe}</p>
              </div>
            </div>
          )}

          {/* Internal Notes */}
          {(() => {
            const notes = appointment.interne_opombe
              || (appointment as unknown as Record<string, unknown>)['Interne opombe'] as string
              || '';
            if (!notes) return null;
            return (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Interne opombe</label>
                <div className="p-4 bg-white rounded-xl border-2 border-yellow-300">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes}</p>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Action buttons */}
        <div className="border-t border-gray-100 px-5 py-3">
          <div className="flex items-center justify-end gap-1">
            {!isTerminated && onComplete && (
              <motion.button
                type="button"
                onClick={() => onComplete(appointment)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                title="Zaključi"
              >
                <CheckCircle className="h-4.5 w-4.5" weight="regular" />
              </motion.button>
            )}
            {onEdit && (
              <motion.button
                type="button"
                onClick={() => onEdit(appointment)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                title="Uredi"
              >
                <NotePencil className="h-4.5 w-4.5" weight="regular" />
              </motion.button>
            )}
            {(onNoShow || onCancel || onDelete) && <div className="relative">
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
                        onClick={() => { onNoShow(appointment); setActionsMenuOpen(false); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-amber-50 hover:text-amber-700"
                      >
                        <WarningCircle className="h-4 w-4" weight="regular" />
                        Ni prišel
                      </button>
                    )}
                    {onCancel && (
                      <button
                        type="button"
                        onClick={() => { onCancel(appointment); setActionsMenuOpen(false); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-red-50 hover:text-red-700"
                      >
                        <XCircle className="h-4 w-4" weight="regular" />
                        Odpoved
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => { onDelete(appointment); setActionsMenuOpen(false); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash className="h-4 w-4" weight="regular" />
                        Izbriši
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const { companyId, companySettings, loading: companyLoading, reloadSettings } = useCompany();
  const { user, loading: authLoading } = useAuth();
  const userPersonId = useUserPersonId(user?.id);
  const { role, personId: rolePersonId, permissions } = useRolePermissions();

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
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  // Services & employees for modals
  const [services, setServices] = useState<Storitev[]>([]);
  const [employees, setEmployees] = useState<(Zaposleni & { initials: string })[]>([]);

  // New appointment modal
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
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
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardData(companyId, userPersonId);
      setDashboardData(data);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
      setError("Napaka pri nalaganju podatkov");
    } finally {
      setLoading(false);
    }
  }, [companyId, userPersonId]);

  useEffect(() => {
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
      storitev_id: item.serviceId,
      storitev_id_2: item.serviceId2,
      storitev_id_3: item.serviceId3,
      zaposleni_id: item.employeeId,
      status: (item.status || 'scheduled') as AppointmentWithDetails['status'],
      opombe: item.opombe,
      interne_opombe: item.interneOpombe,
      cena: item.cena ?? null,
      koncna_cena: item.cena ?? null,
      storitev: primaryService
        ? { id: primaryService.id, naziv: primaryService.naziv, barva: primaryService.barva, trajanje: primaryService.trajanje, cena: primaryService.cena }
        : item.serviceId
          ? { id: item.serviceId, naziv: item.serviceName, barva: item.serviceColor, trajanje: 0, cena: item.cena ?? null }
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
            tags: null, status: null, last_interaction: null,
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
      if (!result.ok) throw new Error(result.error || 'Napaka pri shranjevanju termina');

      setSuccessMessage(isNew ? 'Termin uspešno dodan' : 'Termin uspešno posodobljen');
      setTimeout(() => setSuccessMessage(null), 3000);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await loadDashboard();

      if (isNew) setShowNewAppointmentModal(false);
      else setEditingAppointment(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Napaka pri shranjevanju');
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
      if (!result.ok) throw new Error('Napaka pri zaključevanju termina');
      setSuccessMessage('Termin uspešno zaključen');
      setTimeout(() => setSuccessMessage(null), 3000);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await loadDashboard();
      setCompleteTarget(null);
      setCompletionNotes('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Napaka pri zaključevanju');
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
        datum: appointment.datum, cas_zacetek: appointment.cas_zacetek,
      }));
      if (!result.ok) throw new Error('Napaka pri označevanju kot No Show');
      setSuccessMessage('Termin označen kot No Show');
      setTimeout(() => setSuccessMessage(null), 3000);
      await new Promise((resolve) => setTimeout(resolve, 500));
      await loadDashboard();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Napaka pri No Show');
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
        datum: appointment.datum, cas_zacetek: appointment.cas_zacetek,
      }));
      if (!result.ok) throw new Error('Napaka pri odpovedi termina');
      setSuccessMessage('Termin uspešno odpovedan');
      setTimeout(() => setSuccessMessage(null), 3000);
      await new Promise((resolve) => setTimeout(resolve, 500));
      await loadDashboard();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Napaka pri odpovedi');
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
      if (!result.ok) throw new Error('Napaka pri brisanju termina');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await loadDashboard();
      setDeleteTarget(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Napaka pri brisanju');
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
      const newRow = {
        'ID stranke': clientId,
        Ime: data.ime, Priimek: data.priimek, Spol: data.spol,
        Email: data.email, Telefon: data.telefon,
        Opombe: data.opombe, 'Interne opombe': data.interne_opombe,
        [companyColumn]: companyId,
      };
      const payload = buildPayload('NOVA_STRANKA', 'clients', buildClientCreateData({ companyId, userEmail: actor, companyProfile: companyPayload, clientRow: newRow }));
      const result = await callN8nAction(payload, async () => {
        const nextId = await getNextClientId(companyId);
        return { ...payload, data: buildClientCreateData({ companyId, userEmail: actor, companyProfile: companyPayload, clientRow: { ...newRow, 'ID stranke': nextId } }) };
      });
      if (!result.ok) throw new Error('Napaka pri ustvarjanju stranke');
      setSuccessMessage('Stranka uspešno dodana');
      setTimeout(() => setSuccessMessage(null), 3000);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setShowNewClientModal(false);
      await loadDashboard();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Napaka pri shranjevanju stranke');
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
    if (!user?.email) return "Uporabnik";
    const emailPrefix = user.email.split("@")[0];
    return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  }, [user]);

  const todayFormatted = format(new Date(), "EEEE, d. MMMM yyyy", { locale: sl });

  // ── Greeting based on time of day ────────────────────────────────────────
  const welcomeGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Dobro jutro,';
    if (hour >= 12 && hour < 18) return 'Dober dan,';
    return 'Dober večer,';
  }, []);

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
            <p className="text-gray-700 font-medium mb-2">Prišlo je do napake</p>
            <p className="text-gray-500 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors"
            >
              Poskusi znova
            </button>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {welcomeGreeting}{" "}
                  <span className="bg-gradient-to-r from-violet-600 to-cyan-500 bg-clip-text text-transparent">
                    {displayName}
                  </span>
                </h1>
                <p className="mt-1 text-gray-500 capitalize">{todayFormatted}</p>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-3">
                {canCreateAppointment && (
                  <button
                    type="button"
                    onClick={() => setShowNewAppointmentModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-cyan-500 text-white rounded-xl font-medium shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 transition-all"
                  >
                    <Plus size={18} weight="bold" />
                    <span className="hidden sm:inline">Nov Termin</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowNewClientModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  <UserPlus size={18} weight="bold" />
                  <span className="hidden sm:inline">Nova Stranka</span>
                </button>
              </div>
            </div>
          </motion.div>

          {/* Metrics Cards */}
          {role === 'staff' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <MetricCard
                title="Termini danes"
                value={dashboardData?.stats.todayAppointments ?? 0}
                subtitle="Načrtovanih terminov"
                icon={CalendarCheck}
                iconColor="black"
                gradientOutline
              />
              <MetricCard
                title="Aktivni termini"
                value={dashboardData?.stats.activeAppointments ?? 0}
                subtitle="Načrtovanih terminov"
                icon={Clock}
                iconColor="darkGray"
              />
              {/* Naslednji termin — spans 2 columns */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="sm:col-span-2 rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden"
              >
                <div className="h-full flex flex-col p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ClockCountdown className="w-5 h-5 text-black flex-shrink-0" weight="regular" />
                      <span className="text-sm font-semibold text-gray-700">Naslednji termin</span>
                    </div>
                    {nextAppointment && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-violet-50 text-violet-600">
                        {nextAppointment.isToday ? 'Danes' : 'Jutri'}
                      </span>
                    )}
                  </div>

                  {nextAppointment ? (
                    <motion.button
                      type="button"
                      onClick={() => handleAppointmentClick(nextAppointment)}
                      className="flex-1 flex items-center gap-3 hover:bg-gray-50 rounded-xl px-2 py-1 -mx-2 transition-colors text-left w-full"
                    >
                      {/* Service color bar */}
                      <div
                        className="w-1 self-stretch rounded-full flex-shrink-0"
                        style={{
                          background: (() => {
                            const c1 = nextAppointment.serviceColor || '#8B5CF6';
                            const c2 = nextAppointment.serviceColor2;
                            const c3 = nextAppointment.serviceColor3;
                            const extractFirst = (b: string) => { const m = b.includes('gradient') ? b.match(/#[0-9A-Fa-f]{6}/g) : null; return m ? m[0] : b; };
                            const extractLast = (b: string) => { const m = b.includes('gradient') ? b.match(/#[0-9A-Fa-f]{6}/g) : null; return m ? m[m.length - 1] : b; };
                            const singleGrad = (b: string) => {
                              if (b.includes('gradient')) return b.replace(/\d+deg/, '180deg');
                              const hex = b.replace('#', ''); const r = parseInt(hex.substring(0,2),16)||100; const g = parseInt(hex.substring(2,4),16)||100; const bv = parseInt(hex.substring(4,6),16)||240;
                              return `linear-gradient(180deg, rgb(${Math.min(255,r+40)},${Math.min(255,g+40)},${Math.min(255,bv+40)}) 0%, rgb(${Math.max(0,r-20)},${Math.max(0,g-20)},${Math.max(0,bv-20)}) 100%)`;
                            };
                            if (!c2) return singleGrad(c1);
                            if (!c3) return `linear-gradient(180deg, ${extractFirst(c1)} 0%, ${extractLast(c2)} 100%)`;
                            return `linear-gradient(180deg, ${extractFirst(c1)} 0%, ${extractLast(c2)} 50%, ${extractLast(c3)} 100%)`;
                          })(),
                          minHeight: 40,
                        }}
                      />
                      {/* Time */}
                      <div className="flex-shrink-0">
                        <div className="text-lg font-bold text-gray-900">{nextAppointment.time}</div>
                        {nextAppointment.endTime && (
                          <div className="text-xs text-gray-500">{nextAppointment.endTime}</div>
                        )}
                      </div>
                      {/* Client + service */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{nextAppointment.clientName}</div>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <span className="truncate">{nextAppointment.serviceName}</span>
                          {((nextAppointment.serviceId2 ? 1 : 0) + (nextAppointment.serviceId3 ? 1 : 0)) > 0 && (
                            <span
                              className="text-sm font-bold flex-shrink-0"
                              style={{
                                backgroundImage: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                              }}
                            >
                              +{(nextAppointment.serviceId2 ? 1 : 0) + (nextAppointment.serviceId3 ? 1 : 0)}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Employee initials */}
                      <div
                        className="flex h-10 w-10 items-center justify-center text-lg font-bold flex-shrink-0"
                        style={{
                          background: nextAppointment.employeeColor || 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          color: 'transparent',
                        }}
                      >
                        {nextAppointment.employeeInitials}
                      </div>
                    </motion.button>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-2 py-4">
                      <CalendarBlank className="w-5 h-5 text-gray-300" weight="regular" />
                      <p className="text-sm text-gray-400">Ni prihajajočih terminov</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <MetricCard
                title="Termini danes"
                value={dashboardData?.stats.todayAppointments ?? 0}
                subtitle="Načrtovanih terminov"
                icon={CalendarCheck}
                iconColor="black"
                gradientOutline
              />
              <MetricCard
                title="Aktivni termini"
                value={dashboardData?.stats.activeAppointments ?? 0}
                subtitle="Načrtovanih terminov"
                icon={Clock}
                iconColor="darkGray"
              />
              <MetricCard
                title="Nove stranke"
                value={dashboardData?.stats.newClientsThisMonth ?? 0}
                subtitle="Ta mesec"
                icon={UsersThree}
                iconColor="mediumGray"
              />
              <MetricCard
                title="Prihodki"
                value={`${(dashboardData?.stats.revenueThisMonth ?? 0).toFixed(2)} €`}
                subtitle="Ta mesec"
                icon={CurrencyCircleDollar}
                iconColor="slate"
              />
            </div>
          )}

          {/* Today and Tomorrow Appointments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <AppointmentListCard
              title="Termini Danes"
              subtitle={format(new Date(), "d. MMMM", { locale: sl })}
              appointments={dashboardData?.todayAppointments ?? []}
              emptyMessage="Danes ni terminov"
              gradientOutline
              viewAllHref={`/termini?dateFrom=${format(new Date(), "yyyy-MM-dd")}&dateTo=${format(new Date(), "yyyy-MM-dd")}`}
              onAppointmentClick={handleAppointmentClick}
            />
            <AppointmentListCard
              title="Termini Jutri"
              subtitle={format(new Date(Date.now() + 86400000), "d. MMMM", { locale: sl })}
              appointments={dashboardData?.tomorrowAppointments ?? []}
              emptyMessage="Jutri ni terminov"
              viewAllHref={`/termini?dateFrom=${format(new Date(Date.now() + 86400000), "yyyy-MM-dd")}&dateTo=${format(new Date(Date.now() + 86400000), "yyyy-MM-dd")}`}
              onAppointmentClick={handleAppointmentClick}
            />
          </div>

          {/* Weekly Chart */}
          <div className="mb-8">
            <WeeklyChart data={dashboardData?.weeklyChart ?? []} />
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <TopServicesCard services={dashboardData?.topServices ?? []} />
            <TopEmployeesCard employees={dashboardData?.topEmployees ?? []} />
            <RecentActivityCard activities={dashboardData?.recentActivity ?? []} />
          </div>

          {/* Quick Navigation Footer */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-violet-500/5 to-cyan-500/5 border border-violet-100"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-900">Potrebujete več podrobnosti?</h3>
                <p className="text-sm text-gray-500">
                  Preglejte celoten koledar ali analitiko za podrobnejši vpogled
                </p>
              </div>
              <div className="flex gap-3">
                <Link
                  href="/koledar"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-violet-600 hover:text-violet-700 transition-colors"
                >
                  Odpri Koledar
                  <ArrowRight size={16} weight="bold" />
                </Link>
                <Link
                  href="/analytics"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-cyan-600 hover:text-cyan-700 transition-colors"
                >
                  Odpri Analitiko
                  <ArrowRight size={16} weight="bold" />
                </Link>
              </div>
            </div>
          </motion.div>
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
        title="Izbriši termin"
        message="Ali ste prepričani, da želite izbrisati ta termin?"
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
                  <h2 className="text-lg font-semibold text-[#1A1F36]">Zaključi termin</h2>
                  <p className="text-sm text-gray-500">Potrdite zaključitev termina</p>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold flex-shrink-0 bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                    {completeTarget.stranka_ime?.split(' ').map((n: string) => n.charAt(0)).join('').substring(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-xs text-gray-500">Stranka</p>
                    <p className="text-sm font-semibold text-[#1A1F36]">{completeTarget.stranka_ime}</p>
                  </div>
                </div>
                {completeTarget.storitev && (
                  <div className="flex items-start gap-3">
                    <div className="h-3 w-3 rounded-full flex-shrink-0 mt-1" style={{ background: completeTarget.storitev.barva || '#6366F1' }} />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">Storitev</p>
                      <div className="space-y-1 mt-0.5">
                        <p className="text-sm font-semibold text-[#1A1F36]">{completeTarget.storitev.naziv}</p>
                        {completeTarget.storitev_2 && (
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: completeTarget.storitev_2.barva || '#6366F1' }} />
                            <p className="text-sm font-semibold text-[#1A1F36]">{completeTarget.storitev_2.naziv}</p>
                          </div>
                        )}
                        {completeTarget.storitev_3 && (
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: completeTarget.storitev_3.barva || '#6366F1' }} />
                            <p className="text-sm font-semibold text-[#1A1F36]">{completeTarget.storitev_3.naziv}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <CalendarBlank className="h-[18px] w-[18px] text-emerald-500 flex-shrink-0" weight="regular" />
                  <div>
                    <p className="text-xs text-gray-500">Datum</p>
                    <p className="text-sm font-semibold text-[#1A1F36]">
                      {new Date(completeTarget.datum).toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-[18px] w-[18px] text-emerald-500 flex-shrink-0" weight="regular" />
                  <div>
                    <p className="text-xs text-gray-500">Čas</p>
                    <p className="text-sm font-semibold text-[#1A1F36]">
                      {completeTarget.cas_zacetek?.substring(0, 5)} - {completeTarget.cas_konec?.substring(0, 5)}
                    </p>
                  </div>
                </div>
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
                  onClick={() => { setCompleteTarget(null); setCompletionNotes(''); }}
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
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="h-4 w-4 rounded-full border-2 border-white border-t-transparent" />
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
