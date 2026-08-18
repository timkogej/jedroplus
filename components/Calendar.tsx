'use client';

import { memo, useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CaretLeft,
  CaretRight,
  X,
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
  Tag,
  Plus,
  ListChecks,
  Envelope,
  Phone,
} from '@phosphor-icons/react';
import type { AppointmentWithDetails, Storitev, Zaposleni } from '@/types/appointments';
import type { CalendarInitialData } from '@/lib/calendar/fetchCalendarData.server';
import type { Client } from '@/types/clients';
import type { ViewMode } from '@/lib/utils/calendar';
import ViewToggle from './calendar/ViewToggle';
import DateStrip from './calendar/DateStrip';
import CalendarSidebar from './calendar/CalendarSidebar';
import WeekView from './calendar/WeekView';
import DayView from './calendar/DayView';
import MonthView from './calendar/MonthView';
import TwoDayView from './calendar/TwoDayView';
import AppointmentModal, { type AppointmentFormData } from './appointments/AppointmentModal';
import { RescheduleNotificationModal } from './appointments/RescheduleNotificationModal';
import DeleteConfirmation from './appointments/DeleteConfirmation';
import AbsenceModal, { type AbsenceFormData } from './calendar/AbsenceModal';
import AbsenceDetailModal, { type AbsenceEditData } from './calendar/AbsenceDetailModal';
import EventModal, { type EventFormData } from './calendar/EventModal';
import EventViewModal from './calendar/EventViewModal';
import ClientDetailsPanel from './clients/ClientDetailsPanel';
import CommunicationLanguageFlag from '@/components/shared/CommunicationLanguageFlag';
import {
  fetchAppointmentsForMonth,
  fetchServices,
  fetchEmployees,
  fetchAbsences,
  type Absence,
} from '@/lib/supabase/appointments';
import { getClientById } from '@/lib/supabase/clients';
import { fetchEvents, sendEventWebhook } from '@/lib/supabase/events';
import { fetchTerminIdsWithResursi, fetchTerminResursiMap, fetchActiveResursi, fetchResursiForStoritve, syncTerminResursi, deleteTerminResursi } from '@/lib/supabase/resursi';
import type { Resurs } from '@/types/resursi';
import type { CalendarEvent } from '@/types/events';
import {
  getMonthsFull,
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
  parseCompanySchedule,
  type CompanySchedule,
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
import { logZgodovina } from '@/lib/supabase/zgodovina';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { loadCompanyRow } from '@/lib/settingsStore';
import { useRolePermissions } from '@/app/role-permission-context';
import { useTranslations, useLocale } from 'next-intl';

interface CalendarProps {
  companyId: string;
  initialEmployeeId?: string | null;
  /** Server-seeded data for the default (today/day-view) landing state. Used
   *  only when it matches this mount's companyId and the client's "today";
   *  otherwise discarded and the normal client fetches run unchanged. */
  initialData?: CalendarInitialData | null;
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
      className="rounded-lg p-2 border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
      title={label}
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-500" weight="bold" />
      ) : (
        <Copy className="h-4 w-4" weight="regular" />
      )}
    </motion.button>
  );
}


// Appointment detail modal component (view only)
function AppointmentDetailModal({
  appointment,
  services,
  terminResursiMap,
  activeResursi,
  onClose,
  onEdit,
  onComplete,
  onNoShow,
  onCancel,
  onDelete,
  onOpenClientDetails,
}: {
  appointment: AppointmentWithDetails;
  services: Storitev[];
  terminResursiMap: Map<number, Set<number>>;
  activeResursi: Resurs[];
  onClose: () => void;
  onEdit?: (appointment: AppointmentWithDetails) => void;
  onComplete?: (appointment: AppointmentWithDetails) => void;
  onNoShow?: (appointment: AppointmentWithDetails) => void;
  onCancel?: (appointment: AppointmentWithDetails) => void;
  onDelete?: (appointment: AppointmentWithDetails) => void;
  onOpenClientDetails?: (appointment: AppointmentWithDetails) => void | Promise<void>;
}) {
  const t = useTranslations('appointments');
  const locale = useLocale();
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);

  const aptResursi = useMemo(() => {
    const aptId = Number(appointment.id);
    return activeResursi.filter((r) =>
      terminResursiMap.get(r.row_id)?.has(aptId)
    );
  }, [appointment.id, activeResursi, terminResursiMap]);

  // Get gradient background - matches AppointmentCard color logic (supports multiple services)
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
    const addOnService = appointment.add_on_storitev_id
      ? services.find(s => s.id === appointment.add_on_storitev_id) || appointment.add_on_storitev || null
      : appointment.add_on_storitev || null;
    const allColors: string[] = [primaryColor];
    if (service2?.barva) allColors.push(service2.barva);
    if (service3?.barva) allColors.push(service3.barva);
    if (appointment.add_on_naziv && addOnService?.barva) allColors.push(addOnService.barva);

    if (allColors.length === 1) return singleGradient(primaryColor);
    if (allColors.length === 2) {
      return `linear-gradient(135deg, ${extractFirst(allColors[0])} 0%, ${extractLast(allColors[1])} 100%)`;
    }
    return `linear-gradient(135deg, ${extractFirst(allColors[0])} 0%, ${extractLast(allColors[1])} 50%, ${extractLast(allColors[2])} 100%)`;
  };

  const formatModalDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale === 'sl' ? 'sl-SI' : 'en-US', {
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
      case 'scheduled': return t('status.scheduled');
      case 'confirmed': return t('status.confirmed');
      case 'completed': return t('status.completed');
      case 'cancelled': return t('status.cancelled');
      case 'pending': return t('status.pending');
      case 'no_show': return t('status.noShow');
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
  const serviceGradient = getGradientBackground();
  const sectionClass = 'rounded-2xl border border-gray-100 bg-white p-4 shadow-sm shadow-gray-100/60';
  const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500';
  const promotionGradient = 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)';
  const gradientTextStyle = {
    backgroundImage: promotionGradient,
  };
  const gradientBorderStyle = {
    border: '1px solid transparent',
    background: `linear-gradient(#fff, #fff) padding-box, ${promotionGradient} border-box`,
  };
  const clientGradientBorderStyle = {
    border: '1px solid transparent',
    background: `linear-gradient(#F9FAFB, #F9FAFB) padding-box, ${promotionGradient} border-box`,
  };

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
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[#F7F8FA] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 w-full flex-shrink-0" style={{ background: serviceGradient }} />

        {/* Header */}
        <div className="border-x border-b border-gray-100 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="min-w-0 truncate text-lg font-semibold text-gray-900">
                  {appointment.stranka_ime || t('calendarView.detailModal.fields.unknownClient')}
                </h3>
                <CommunicationLanguageFlag value={appointment.language} />
                <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-normal ${getStatusColor(appointment.status || 'scheduled')}`}>
                  {getStatusLabel(appointment.status || 'scheduled')}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-gray-500">
                {formatModalDate(appointment.datum)}
              </p>
            </div>
          <motion.button
            type="button"
            onClick={onClose}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="flex-shrink-0 rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            aria-label={t('calendarView.appointmentModal.actions.close')}
          >
            <X className="h-5 w-5" weight="bold" />
          </motion.button>
          </div>
        </div>

        {/* Content - scrollable */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto border-x border-gray-100 p-4">
          {/* Client */}
          <div className={sectionClass}>
            <label className={labelClass}>{t('modal.fields.client')}</label>
            <div className="space-y-2">
              {appointment.stranka_id && onOpenClientDetails ? (
                <motion.button
                  type="button"
                  onClick={() => { void onOpenClientDetails(appointment); }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-all hover:shadow-sm"
                  style={clientGradientBorderStyle}
                >
                  <span className="flex-shrink-0 bg-clip-text text-lg font-bold text-transparent" style={gradientTextStyle}>
                    {(() => { const p = (appointment.stranka_ime || '').trim().split(/\s+/).filter(Boolean); return p.length >= 2 ? `${p[0][0]}${p[1][0]}`.toUpperCase() : (p[0] || '?').substring(0, 2).toUpperCase(); })()}
                  </span>
                  <p className="min-w-0 flex-1 truncate font-medium text-[#1A1F36]">{appointment.stranka_ime || '-'}</p>
                  <CaretRight className="h-4 w-4 flex-shrink-0 text-gray-400" weight="bold" />
                </motion.button>
              ) : (
                <div
                  className="flex items-center gap-3 rounded-lg px-4 py-3"
                  style={clientGradientBorderStyle}
                >
                  <span className="flex-shrink-0 bg-clip-text text-lg font-bold text-transparent" style={gradientTextStyle}>
                    {(() => { const p = (appointment.stranka_ime || '').trim().split(/\s+/).filter(Boolean); return p.length >= 2 ? `${p[0][0]}${p[1][0]}`.toUpperCase() : (p[0] || '?').substring(0, 2).toUpperCase(); })()}
                  </span>
                  <p className="font-medium text-[#1A1F36]">{appointment.stranka_ime || '-'}</p>
                </div>
              )}
              {(appointment.stranka_email || appointment.stranka_telefon) && (
                <div className="grid grid-cols-2 gap-2">
                  {appointment.stranka_email && (
                    <a
                      href={`mailto:${appointment.stranka_email}`}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 transition-all hover:border-gray-300 hover:shadow-sm"
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
                      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 transition-all hover:border-gray-300 hover:shadow-sm"
                    >
                      <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" weight="regular" />
                      <div className="min-w-0">
                        <div className="text-[10px] text-gray-500">{t('modal.fields.phone')}</div>
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
            const addOnService = appointment.add_on_storitev_id
              ? services.find(s => s.id === appointment.add_on_storitev_id) || appointment.add_on_storitev || null
              : appointment.add_on_storitev || null;
            const addOnName = appointment.add_on_naziv?.trim();
            const addOnDuration = appointment.add_on_trajanje ?? addOnService?.trajanje ?? 0;
            return (
              <div className={sectionClass}>
                <label className={labelClass}>{t('modal.fields.service')}</label>
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
                  {addOnName && (
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: addOnService?.barva || '#6366F1' }} />
                      <p className="text-sm font-medium text-[#1A1F36]">{addOnName}</p>
                      {addOnDuration > 0 && <span className="text-xs text-gray-400">({addOnDuration} min)</span>}
                      <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        <Plus className="h-2.5 w-2.5" weight="bold" />
                        {t('calendarView.detailModal.fields.additionalService')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Employee */}
          {appointment.zaposleni && (
            <div className={sectionClass}>
              <label className={labelClass}>{t('calendarView.rescheduleDialog.employee')}</label>
              <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3">
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

          <div className={`${sectionClass} grid grid-cols-2 gap-4`}>
            <div>
              <label className={labelClass}>{t('modal.fields.date')}</label>
              <p className="bg-clip-text text-sm font-bold text-transparent" style={gradientTextStyle}>
                {formatModalDate(appointment.datum)}
              </p>
            </div>
            <div>
              <label className={labelClass}>{t('calendarView.detailModal.fields.time')}</label>
              <p className="bg-clip-text text-sm font-bold text-transparent" style={gradientTextStyle}>
                {formatTimeStr(appointment.cas_zacetek)} – {formatTimeStr(appointment.cas_konec)}
              </p>
            </div>
          </div>

          {/* Duration */}
          {appointment.cas_zacetek && appointment.cas_konec && (
            <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm shadow-gray-100/60">
              <span className="text-sm font-medium text-gray-700">{t('calendarView.detailModal.fields.duration')}</span>
              <span className="bg-clip-text text-lg font-bold text-transparent" style={gradientTextStyle}>
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

          {/* PRICE SECTION */}
          {(() => {
            const apt = appointment;
            const originalCena = apt.cena ?? 0;
            const popustVrednost = apt.popust ?? 0;
            const finalCena = apt.koncna_cena ?? originalCena;
            const popustTip = apt.popust_tip ?? '€';
            const imaPopust = popustVrednost > 0;
            const hasAddOnPrice = !!(apt.add_on_naziv && apt.add_on_final_cena);

            const getBadge = () => {
              if (apt.promocija_tip === 'happy_hour') return { label: 'Happy Hour', Icon: Clock };
              if (apt.promocija_tip === 'add_on') return { label: 'Add-on', Icon: Plus };
              if (imaPopust) return { label: apt.promocija_naziv ?? 'Popust', Icon: Tag };
              return null;
            };
            const badge = getBadge();

            const fmt = (val: number) =>
              new Intl.NumberFormat(locale === 'sl' ? 'sl-SI' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

            if (originalCena === 0 && !imaPopust && !hasAddOnPrice) return null;

            return (
              <div className="space-y-3">
                {imaPopust ? (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                    {badge && (
                      <div
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-xs font-semibold"
                        style={{ background: promotionGradient }}
                      >
                        <badge.Icon size={11} />
                        <span>{badge.label}</span>
                      </div>
                    )}
                    <div className="space-y-2.5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm shadow-gray-100/60">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">{t('calendarView.detailModal.fields.originalPrice')}</span>
                        <span className="text-gray-400 line-through">{fmt(originalCena)} EUR</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">{t('calendarView.detailModal.fields.discount')}</span>
                        <span className="font-medium text-red-500">
                          − {popustTip === 'percent' ? `${popustVrednost}%` : `${fmt(popustVrednost)} EUR`}
                        </span>
                      </div>
                      <div className="border-t border-gray-200 pt-2.5 flex justify-between items-center">
                        <span className="font-semibold text-gray-900">{t('calendarView.detailModal.fields.priceWithDiscount')}</span>
                        <span className="bg-clip-text text-xl font-bold text-transparent" style={gradientTextStyle}>
                          {fmt(finalCena)} EUR
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ) : originalCena > 0 ? (
                  <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm shadow-gray-100/60">
                    <span className="text-sm font-medium text-gray-700">{t('calendarView.detailModal.fields.price')}</span>
                    <span className="bg-clip-text text-lg font-bold text-transparent" style={gradientTextStyle}>
                      {fmt(originalCena)} EUR
                    </span>
                  </div>
                ) : null}

                {/* ADD-ON section — only when there is actual add-on pricing or an explicit add_on promo */}
                {apt.add_on_naziv && (apt.add_on_final_cena || apt.promocija_tip === 'add_on') && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-2 rounded-lg border border-blue-100 bg-blue-50 p-4"
                  >
                    <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm mb-2">
                      <Plus size={14} />
                      <span>{t('calendarView.detailModal.fields.additionalService')}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-800">{apt.add_on_naziv}</p>
                    {apt.add_on_final_cena && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">{t('calendarView.detailModal.fields.discount')}</span>
                          <span className="text-red-500">
                            − {apt.add_on_popust_tip === '%'
                              ? `${apt.add_on_popust}%`
                              : `${fmt(parseFloat(apt.add_on_popust ?? '0'))} EUR`}
                          </span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span className="text-gray-700">{t('calendarView.detailModal.fields.priceWithDiscount')}</span>
                          <span className="text-green-600">{fmt(parseFloat(apt.add_on_final_cena))} EUR</span>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </div>
            );
          })()}

          {/* Resources */}
          {aptResursi.length > 0 && (
            <div className={sectionClass}>
              <label className={labelClass}>Resursi v uporabi</label>
              <div className="flex flex-wrap gap-1.5">
                {aptResursi.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-700"
                  >
                    <span
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ background: r.barva }}
                    />
                    {r.naziv}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {appointment.opombe && (
            <div className={sectionClass}>
              <label className={labelClass}>{t('modal.fields.notes')}</label>
              <div className="rounded-lg p-4" style={gradientBorderStyle}>
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
              <div className={sectionClass}>
                <label className={labelClass}>{t('modal.fields.internalNotes')}</label>
                <div className="rounded-lg p-4" style={gradientBorderStyle}>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes}</p>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Action buttons - right aligned, like Termini page */}
        <div className="border-x border-y border-gray-100 bg-white px-5 py-3">
          <div className="flex items-center justify-end gap-1">
            {/* Complete - only if not terminated */}
            {!isTerminated && onComplete && (
              <motion.button
                type="button"
                onClick={() => onComplete(appointment)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                title={t('calendarView.detailModal.actions.complete')}
              >
                <CheckCircle className="h-4.5 w-4.5" weight="regular" />
              </motion.button>
            )}

            {/* Edit */}
            {onEdit && (
              <motion.button
                type="button"
                onClick={() => onEdit(appointment)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                title={t('calendarView.eventModal.actions.edit')}
              >
                <NotePencil className="h-4.5 w-4.5" weight="regular" />
              </motion.button>
            )}

            {/* Three dots menu - No Show, Cancel, Delete - hidden when no actions available */}
            {(onNoShow || onCancel || onDelete) && <div className="relative">
              <motion.button
                type="button"
                onClick={() => setActionsMenuOpen(!actionsMenuOpen)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                title={t('calendarView.detailModal.actions.moreOptions')}
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
                        {t('calendarView.detailModal.actions.noShow')}
                      </button>
                    )}
                    {onCancel && (
                      <button
                        type="button"
                        onClick={() => { onCancel(appointment); setActionsMenuOpen(false); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-red-50 hover:text-red-700"
                      >
                        <XCircle className="h-4 w-4" weight="regular" />
                        {t('calendarView.detailModal.actions.cancel')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { onDelete?.(appointment); setActionsMenuOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash className="h-4 w-4" weight="regular" />
                      {t('calendarView.eventModal.actions.delete')}
                    </button>
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

function Calendar({ companyId, initialEmployeeId, initialData }: CalendarProps) {
  const t = useTranslations('appointments');
  const locale = useLocale();
  const { companySettings } = useCompany();
  const { user } = useAuth();
  const { role, personId: rolePersonId, permissions } = useRolePermissions();

  // RBAC: appointment permissions for staff
  const staffViewOwnOnly = role === 'staff' && (
    (permissions?.can_view_only_own_appointments === true) ||
    (permissions?.can_view_all_appointments === false)
  );
  const staffEditOwnOnly = role === 'staff' && (
    (permissions?.can_edit_only_own_appointments === true) ||
    (permissions?.can_edit_all_appointments === false)
  );
  const canCreateAppointment = role !== 'staff' || (permissions?.can_create_appointments ?? true);
  const canDeleteAppointment = role !== 'staff' || (permissions?.can_delete_appointments ?? true);

  // For a given appointment, can the current user edit it?
  const canEditAppointment = useCallback((apt: AppointmentWithDetails): boolean => {
    if (role !== 'staff') return true;
    if (staffEditOwnOnly) return apt.zaposleni_id === rolePersonId;
    return true;
  }, [role, staffEditOwnOnly, rolePersonId]);

  // View state - default to week, load from localStorage
  const [currentView, setCurrentView] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Server-seeded initial data (from the Koledar Server Component). Usable only
  // when it provably matches what this mount's first fetch would return anyway:
  // fetched for the same company the client resolved, and seeded for the client's
  // current "today". The default landing state is day view + today; if the
  // localStorage view preference switches views after mount, that changes
  // loadAppointments'/loadEvents' dependencies and triggers a normal client fetch
  // regardless of the seed. Evaluated exactly once (lazy initializer) so later
  // prop or clock changes can't retroactively re-seed.
  const [seed] = useState<CalendarInitialData | null>(() => {
    if (!initialData) return null;
    if (initialData.companyId !== companyId) return null;
    if (initialData.seededForDate !== new Date().toISOString().split('T')[0]) return null;
    return initialData;
  });

  // When seeded, skip exactly the FIRST run of each mount-time fetch effect.
  // Consume-on-first-run refs: any later dependency change (view switch from the
  // saved preference, date navigation, company change) re-runs the effect with
  // the flag already cleared and fetches as before. Post-mutation refreshes call
  // loadAppointments()/loadEvents() directly and never pass through these guards.
  const skipInitialStaticFetch = useRef(!!seed);
  const skipInitialAppointmentsFetch = useRef(!!seed);
  const skipInitialEventsFetch = useRef(!!seed);

  // Data state — seeded from the server payload when the guard above passed.
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>(seed?.appointments ?? []);
  const [services, setServices] = useState<Storitev[]>(seed?.services ?? []);
  const [employees, setEmployees] = useState<(Zaposleni & { initials: string })[]>(seed?.employees ?? []);
  const [absences, setAbsences] = useState<Absence[]>(seed?.absences ?? []);
  const [events, setEvents] = useState<CalendarEvent[]>(seed?.events ?? []);
  const [terminIdsWithResursi, setTerminIdsWithResursi] = useState<Set<number>>(
    () => new Set(seed?.terminIdsWithResursi ?? [])
  );
  const [terminResursiMap, setTerminResursiMap] = useState<Map<number, Set<number>>>(
    () => new Map((seed?.terminResursiMapEntries ?? []).map(([resursId, terminIds]) => [resursId, new Set(terminIds)]))
  );
  const [activeResursi, setActiveResursi] = useState<Resurs[]>(seed?.activeResursi ?? []);
  const [selectedResursId, setSelectedResursId] = useState<number | null>(null);
  const [loading, setLoading] = useState(!seed);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithDetails | null>(null);
  const [detailsClient, setDetailsClient] = useState<Client | null>(null);
  const [clientDetailsOpen, setClientDetailsOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-set employee filter when user is connected to a person
  useEffect(() => {
    if (initialEmployeeId) {
      setSelectedEmployeeId(initialEmployeeId);
    }
  }, [initialEmployeeId]);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('create');
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithDetails | null>(null);
  const [newAppointmentInitials, setNewAppointmentInitials] = useState<{ date?: string; startTime?: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [isAbsenceDetailOpen, setIsAbsenceDetailOpen] = useState(false);
  const [selectedAbsence, setSelectedAbsence] = useState<Absence | null>(null);
  const [isAbsenceDeleting, setIsAbsenceDeleting] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventModalMode, setEventModalMode] = useState<'create' | 'edit'>('create');
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isEventDeleting, setIsEventDeleting] = useState(false);
  const [isEventViewModalOpen, setIsEventViewModalOpen] = useState(false);
  const [viewingEvent, setViewingEvent] = useState<CalendarEvent | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Complete confirmation state (identical to Termini)
  const [completeTarget, setCompleteTarget] = useState<AppointmentWithDetails | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');

  // Delete confirmation state (identical to Termini)
  const [deleteTarget, setDeleteTarget] = useState<AppointmentWithDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reschedule (drag-and-drop) confirmation state
  const [rescheduleConfirm, setRescheduleConfirm] = useState<{
    appointment: AppointmentWithDetails;
    newDate: string;
    newStartTime: string;
    newEndTime: string;
  } | null>(null);

  const [rescheduleNotifyTarget, setRescheduleNotifyTarget] = useState<{
    appointment: AppointmentWithDetails;
    newDate: string;
    newTime: string;
    newEndTime?: string;
    channel: 'sms' | 'email' | 'both';
    source: 'edit' | 'drag_drop';
  } | null>(null);

  // Action feedback
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Show all days filter (true = all 7 days, false = only weekdays Mon-Fri)
  const [showAllDays, setShowAllDays] = useState(true);

  // Slide animation direction: 'forward' = slide left (next), 'backward' = slide right (prev)
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward');
  const [animKey, setAnimKey] = useState(0);

  // Detect mobile screen size and auto-switch views
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // On mobile, 'week' view isn't available — switch to 'day'
      if (mobile) {
        setCurrentView(prev => prev === 'week' ? 'day' : prev);
      }
      // On desktop, '2day' view isn't available — switch to 'day'
      if (!mobile) {
        setCurrentView(prev => prev === '2day' ? 'day' : prev);
      }
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

  // Parse company working hours schedule for calendar shading
  const companySchedule = useMemo((): CompanySchedule | null => {
    if (!companySettings) return null;
    const raw = (companySettings as Record<string, unknown>)['Urnik'] ?? (companySettings as Record<string, unknown>)['urnik'];
    return parseCompanySchedule(raw);
  }, [companySettings]);

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
          // Check "koledar_vsi_dnevi" column - if "true" show all days, if "false" show only weekdays
          const vsiDnevi = data['koledar_vsi_dnevi'];
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
        event: 'SPREMEMBA_PRIKAZ_DNI',
        entity: 'settings',
        data: {
          all_days: showAll, // true = vsi dnevi, false = samo tedenske dneve
          koledar_vsi_dnevi: showAll,
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

  // Load services, employees, absences, and resource-linked appointment IDs
  useEffect(() => {
    if (skipInitialStaticFetch.current) {
      skipInitialStaticFetch.current = false;
      return;
    }
    const loadStaticData = async () => {
      const [servicesResult, employeesResult, absencesResult, resursiIdsResult, resursiMapResult, activeResursiResult] = await Promise.all([
        fetchServices(companyId),
        fetchEmployees(companyId),
        fetchAbsences(companyId),
        fetchTerminIdsWithResursi(companyId),
        fetchTerminResursiMap(companyId),
        fetchActiveResursi(companyId),
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
      if (resursiIdsResult.data) {
        setTerminIdsWithResursi(resursiIdsResult.data);
      }
      if (resursiMapResult.data) {
        setTerminResursiMap(resursiMapResult.data);
      }
      if (activeResursiResult.data) {
        setActiveResursi(activeResursiResult.data);
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

    // For 2day (3-day) view, check if it spans two months
    if (currentView === '2day') {
      const lastDay = addDays(currentDate, 2);
      if (lastDay.getMonth() !== month || lastDay.getFullYear() !== year) {
        const [result1, result2] = await Promise.all([
          fetchAppointmentsForMonth(companyId, year, month),
          fetchAppointmentsForMonth(companyId, lastDay.getFullYear(), lastDay.getMonth()),
        ]);
        if (result1.error) {
          setError(result1.error.message);
        } else if (result2.error) {
          setError(result2.error.message);
        } else {
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
      setError(t('calendarView.errors.loadAppointments'));
    } else {
      setAppointments(result.data || []);
    }

    setLoading(false);
  }, [companyId, currentDate, currentView]);

  useEffect(() => {
    if (skipInitialAppointmentsFetch.current) {
      skipInitialAppointmentsFetch.current = false;
      return;
    }
    loadAppointments();
  }, [loadAppointments]);

  // Load events for the current visible date range
  const loadEvents = useCallback(async () => {
    // Determine visible date range based on current view
    let dateFrom: string;
    let dateTo: string;

    if (currentView === 'day') {
      dateFrom = currentDate.toISOString().split('T')[0];
      dateTo = dateFrom;
    } else if (currentView === '2day') {
      const end = addDays(currentDate, 2);
      dateFrom = currentDate.toISOString().split('T')[0];
      dateTo = end.toISOString().split('T')[0];
    } else if (currentView === 'week') {
      const ws = startOfWeek(currentDate);
      const we = endOfWeek(currentDate);
      dateFrom = ws.toISOString().split('T')[0];
      dateTo = we.toISOString().split('T')[0];
    } else {
      // month — use a wider range to include the full grid (prev/next month padding)
      const ms = startOfMonth(currentDate);
      const me = endOfMonth(currentDate);
      // Expand by 7 days on each side to cover partial weeks at grid edges
      const from = addDays(ms, -7);
      const to = addDays(me, 7);
      dateFrom = from.toISOString().split('T')[0];
      dateTo = to.toISOString().split('T')[0];
    }

    const result = await fetchEvents(companyId, dateFrom, dateTo);
    if (result.data) {
      setEvents(result.data);
    }
  }, [companyId, currentDate, currentView]);

  useEffect(() => {
    if (skipInitialEventsFetch.current) {
      skipInitialEventsFetch.current = false;
      return;
    }
    loadEvents();
  }, [loadEvents]);

  // ── Event modal handlers ──────────────────────────────────────────────────

  const handleOpenEventModal = useCallback(() => {
    setEventModalMode('create');
    setEditingEvent(null);
    setIsEventModalOpen(true);
    setIsSidebarOpen(false);
  }, []);

  const handleCloseEventModal = useCallback(() => {
    setIsEventModalOpen(false);
    setEditingEvent(null);
  }, []);

  const handleEventClick = useCallback((event: CalendarEvent) => {
    setViewingEvent(event);
    setIsEventViewModalOpen(true);
  }, []);

  const handleCloseEventViewModal = useCallback(() => {
    setIsEventViewModalOpen(false);
    setViewingEvent(null);
  }, []);

  const handleOpenEditFromView = useCallback((event: CalendarEvent) => {
    setIsEventViewModalOpen(false);
    setViewingEvent(null);
    setEditingEvent(event);
    setEventModalMode('edit');
    setIsEventModalOpen(true);
  }, []);

  const handleDeleteFromView = useCallback(async () => {
    if (!viewingEvent) return;
    setIsEventDeleting(true);
    try {
      const payload = {
        event: 'IZBRISI_DOGODEK',
        company_id: companyId,
        id: viewingEvent.id,
        title: viewingEvent.title,
        event_date: viewingEvent.event_date,
        updated_by: actor,
      };
      const result = await sendEventWebhook(payload);
      if (!result.ok) throw new Error(t('calendarView.errors.eventDelete'));
      await new Promise((r) => setTimeout(r, 800));
      await loadEvents();
      handleCloseEventViewModal();
      setSuccessMessage(t('calendarView.toast.eventDeleted'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setActionError(t('calendarView.errors.eventDelete'));
    } finally {
      setIsEventDeleting(false);
    }
  }, [viewingEvent, companyId, actor, loadEvents, handleCloseEventViewModal, t]);

  const handleSaveEvent = useCallback(async (data: EventFormData) => {
    setIsSaving(true);
    try {
      const isEdit = eventModalMode === 'edit' && editingEvent;
      const payload = {
        event: isEdit ? 'POSODOBI_DOGODEK' : 'USTVARI_DOGODEK',
        company_id: companyId,
        id: isEdit ? editingEvent!.id : null,
        title: data.title,
        description: data.description || null,
        notes: data.notes || null,
        event_date: data.event_date,
        end_date: data.end_date || null,
        start_time: data.all_day ? null : (data.start_time || null),
        end_time: data.all_day ? null : (data.end_time || null),
        all_day: data.all_day,
        color: data.color,
        location: data.location || null,
        status: isEdit ? (editingEvent!.status || 'active') : 'active',
        is_visible: data.is_visible,
        enable_booking: data.enable_booking,
        created_by: isEdit ? (editingEvent!.created_by ?? actor) : actor,
        updated_by: actor,
      };

      const result = await sendEventWebhook(payload);
      if (!result.ok) throw new Error(t('calendarView.errors.eventSave'));

      // Give n8n a moment to write to Supabase before re-fetching
      await new Promise((r) => setTimeout(r, 800));
      await loadEvents();
      handleCloseEventModal();
      setSuccessMessage(isEdit ? t('calendarView.toast.eventUpdated') : t('calendarView.toast.eventCreated'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setActionError(t('calendarView.errors.eventSave'));
    } finally {
      setIsSaving(false);
    }
  }, [eventModalMode, editingEvent, companyId, actor, loadEvents, handleCloseEventModal, t]);

  const handleDeleteEvent = useCallback(async () => {
    if (!editingEvent) return;
    setIsEventDeleting(true);
    try {
      const payload = {
        event: 'IZBRISI_DOGODEK',
        company_id: companyId,
        id: editingEvent.id,
        title: editingEvent.title,
        event_date: editingEvent.event_date,
        updated_by: actor,
      };

      const result = await sendEventWebhook(payload);
      if (!result.ok) throw new Error(t('calendarView.errors.eventDelete'));

      await new Promise((r) => setTimeout(r, 800));
      await loadEvents();
      handleCloseEventModal();
      setSuccessMessage(t('calendarView.toast.eventDeleted'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setActionError(t('calendarView.errors.eventDelete'));
    } finally {
      setIsEventDeleting(false);
    }
  }, [editingEvent, companyId, actor, loadEvents, handleCloseEventModal, t]);

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    // Always exclude cancelled appointments and soft-deleted ghost termini
    let filtered = appointments.filter(
      (a) => a.status !== 'cancelled' && a.status !== 'Odpovedan' && !a.deleted_at
    );

    // RBAC: staff with view-own-only restriction sees only their appointments
    if (staffViewOwnOnly && rolePersonId) {
      filtered = filtered.filter((a) => a.zaposleni_id === rolePersonId);
    } else if (selectedEmployeeId) {
      filtered = filtered.filter((a) => a.zaposleni?.id === selectedEmployeeId);
    }

    if (selectedServiceId) {
      filtered = filtered.filter((a) => a.storitev?.id === selectedServiceId);
    }

    if (selectedResursId) {
      const resursTerminIds = terminResursiMap.get(selectedResursId);
      filtered = filtered.filter((a) => resursTerminIds?.has(Number(a.id)));
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
  }, [appointments, selectedEmployeeId, selectedServiceId, selectedResursId, terminResursiMap, searchQuery, staffViewOwnOnly, rolePersonId]);

  // Filter absences by selected employee (same logic as appointments)
  const filteredAbsences = useMemo(() => {
    if (!selectedEmployeeId) return absences;
    return absences.filter((a) => a.employee_id === selectedEmployeeId);
  }, [absences, selectedEmployeeId]);

  // Set of future dates (YYYY-MM-DD) that have at least one appointment — for sidebar dots
  const appointmentDates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dates = new Set<string>();
    for (const apt of appointments) {
      const rawDatum = apt.datum;
      const aptDate = rawDatum.length === 10
        ? new Date(rawDatum + 'T12:00:00')
        : new Date(rawDatum);
      aptDate.setHours(0, 0, 0, 0);
      if (aptDate > today) {
        dates.add(getLocalDateKey(aptDate));
      }
    }
    return dates;
  }, [appointments]);

  // Navigation handlers
  const handlePrev = useCallback(() => {
    setSlideDirection('backward');
    setAnimKey(k => k + 1);
    setCurrentDate((prev) => {
      switch (currentView) {
        case 'day':
          return addDays(prev, -1);
        case '2day':
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
    setSlideDirection('forward');
    setAnimKey(k => k + 1);
    setCurrentDate((prev) => {
      switch (currentView) {
        case 'day':
          return addDays(prev, 1);
        case '2day':
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

  // ── Touch swipe for mobile navigation ──────────────────────────────────────
  const swipeStateRef = useRef<{
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    axis: 'pending' | 'horizontal' | 'vertical';
  } | null>(null);
  const lastSwipeNavigationAtRef = useRef(0);

  const handleSwipeTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile || e.touches.length !== 1) {
      swipeStateRef.current = null;
      return;
    }

    const touch = e.touches[0];
    swipeStateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
      axis: 'pending',
    };
  }, [isMobile]);

  const handleSwipeTouchMove = useCallback((e: React.TouchEvent) => {
    const state = swipeStateRef.current;
    if (!state || e.touches.length !== 1) return;

    const touch = e.touches[0];
    state.lastX = touch.clientX;
    state.lastY = touch.clientY;

    if (state.axis === 'pending') {
      const deltaX = state.lastX - state.startX;
      const deltaY = state.lastY - state.startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX < 12 && absY < 12) return;
      state.axis = absX > absY * 1.35 ? 'horizontal' : 'vertical';
    }

    if (state.axis === 'horizontal' && e.cancelable) {
      e.preventDefault();
    }
  }, []);

  const handleSwipeTouchEnd = useCallback((e: React.TouchEvent) => {
    const state = swipeStateRef.current;
    if (!state) return;

    const changedTouch = e.changedTouches[0];
    const endX = changedTouch?.clientX ?? state.lastX;
    const endY = changedTouch?.clientY ?? state.lastY;
    const deltaX = endX - state.startX;
    const deltaY = endY - state.startY;
    swipeStateRef.current = null;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const isHorizontalSwipe = state.axis === 'horizontal' && absX >= 56 && absX > absY * 1.45;
    if (!isHorizontalSwipe) return;

    const now = window.performance.now();
    if (now - lastSwipeNavigationAtRef.current < 320) return;
    lastSwipeNavigationAtRef.current = now;

    if (deltaX < 0) {
      handleNext(); // swipe left → forward
    } else {
      handlePrev(); // swipe right → backward
    }
  }, [handleNext, handlePrev]);

  const handleSwipeTouchCancel = useCallback(() => {
    swipeStateRef.current = null;
  }, []);
  // ────────────────────────────────────────────────────────────────────────────

  const handleAppointmentClick = useCallback((appointment: AppointmentWithDetails) => {
    setSelectedAppointment(appointment);
  }, []);

  const handleCloseDetailModal = useCallback(() => {
    setSelectedAppointment(null);
  }, []);

  const handleCloseClientDetails = useCallback(() => {
    setClientDetailsOpen(false);
    setDetailsClient(null);
  }, []);

  const handleOpenClientDetails = useCallback(async (appointment: AppointmentWithDetails) => {
    const clientId = String(appointment.stranka_id ?? '').trim();

    if (!clientId) {
      setActionError('Ta termin nima povezave na stranko.');
      return;
    }

    setActionError(null);

    const result = await getClientById(companyId, clientId);

    if (result.error) {
      setActionError('Podrobnosti stranke ni bilo mogoče naložiti.');
      return;
    }

    if (!result.data) {
      setActionError('Stranka za ta termin ni bila najdena v tem podjetju.');
      return;
    }

    setDetailsClient(result.data);
    setClientDetailsOpen(true);
  }, [companyId]);

  const handleEditFromDetail = useCallback((appointment: AppointmentWithDetails) => {
    setEditingAppointment(appointment);
    setModalMode('edit');
    setIsModalOpen(true);
    setSelectedAppointment(null);
  }, []);

  // Action handlers for appointment detail modal - accept appointment as parameter (like Termini)
  const handleCompleteAppointment = useCallback((appointment: AppointmentWithDetails) => {
    setCompleteTarget(appointment);
    setSelectedAppointment(null);
  }, []);

  // Confirm complete - identical to Termini page
  const handleConfirmComplete = useCallback(async () => {
    if (!completeTarget) return;

    console.log('[handleConfirmComplete] appointment:', {
      id: completeTarget.id,
      belezi_termin: completeTarget.belezi_termin,
      deleted_at: completeTarget.deleted_at,
      stranka_ime: completeTarget.stranka_ime,
    });

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
        throw new Error(t('errors.completeError'));
      }

      // Log zakljucen for all completions
      if (companyId && completeTarget.id) {
        const idTerminaForZakljucen = completeTarget.id_termina ?? completeTarget.id;
        console.log('[logZgodovina] zakljucen params:', {
          idPodjetja: companyId,
          tipEntitete: 'termin',
          idEntitete: idTerminaForZakljucen,
          akcija: 'zakljucen',
          izvedel: actor,
          izvedel_tip: role,
          idTermina: idTerminaForZakljucen,
          idStranke: completeTarget.stranka_id,
        });
        logZgodovina({
          idPodjetja: companyId,
          tipEntitete: 'termin',
          idEntitete: idTerminaForZakljucen,
          akcija: 'zakljucen',
          izvedel: actor,
          izvedel_tip: (role as 'owner' | 'admin' | 'staff') ?? 'staff',
          idTermina: idTerminaForZakljucen,
          idStranke: completeTarget.stranka_id,
        }).catch(() => {/* ignore logging errors */});
      }

      // Ghost termin: soft-delete after successful completion
      if (completeTarget.belezi_termin === false && companyId) {
        console.log('[handleConfirmComplete] ghost termin detected — id (bigint):', completeTarget.id, '| ID termina (text):', completeTarget.id_termina);
        try {
          const { error: deleteError } = await supabase
            .from('Termini')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', completeTarget.id)
            .eq('ID podjetja', companyId);

          if (deleteError) {
            console.error('[ghost delete] full error:', JSON.stringify(deleteError));
          }

          const idTerminaForLog = completeTarget.id_termina ?? completeTarget.id;
          console.log('[logZgodovina] izbrisan (ghost) params:', {
            idPodjetja: companyId,
            tipEntitete: 'termin',
            idEntitete: idTerminaForLog,
            akcija: 'izbrisan',
            izvedel: actor,
            izvedel_tip: role,
            idTermina: idTerminaForLog,
            idStranke: completeTarget.stranka_id,
          });
          logZgodovina({
            idPodjetja: companyId,
            tipEntitete: 'termin',
            idEntitete: idTerminaForLog,
            akcija: 'izbrisan',
            izvedel: actor,
            izvedel_tip: (role as 'owner' | 'admin' | 'staff') ?? 'staff',
            idTermina: idTerminaForLog,
            idStranke: completeTarget.stranka_id,
          }).catch(() => {/* ignore logging errors */});
        } catch (ghostErr) {
          console.error('[handleConfirmComplete] ghost deletion threw:', ghostErr);
        }
      }

      setSuccessMessage(t('toast.completed'));
      setTimeout(() => setSuccessMessage(null), 3000);

      // Wait 1.5 seconds for system to process completion
      await new Promise((resolve) => setTimeout(resolve, 1500));

      await loadAppointments();
      setCompleteTarget(null);
      setCompletionNotes('');
    } catch (err) {
      setActionError(t('errors.completeError'));
    } finally {
      setIsCompleting(false);
    }
  }, [completeTarget, completionNotes, companyId, actor, role, companyPayload, buildPayload, loadAppointments, t]);

  const handleNoShowAppointment = useCallback(async (appointment: AppointmentWithDetails) => {
    setSelectedAppointment(null); // Close detail modal first (like Termini)
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
      await loadAppointments();
    } catch (err) {
      setActionError(t('errors.noShowError'));
    } finally {
      setIsDeleting(false);
    }
  }, [companyId, actor, companyPayload, buildPayload, loadAppointments, t]);

  const handleCancelAppointment = useCallback(async (appointment: AppointmentWithDetails) => {
    setSelectedAppointment(null); // Close detail modal first (like Termini)
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
      await loadAppointments();
    } catch (err) {
      setActionError(t('errors.cancelError'));
    } finally {
      setIsDeleting(false);
    }
  }, [companyId, actor, companyPayload, buildPayload, loadAppointments, t]);

  // Delete handler - opens DeleteConfirmation dialog (identical to Termini)
  const handleDeleteAppointment = useCallback((appointment: AppointmentWithDetails) => {
    setDeleteTarget(appointment);
    setSelectedAppointment(null);
  }, []);

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
        throw new Error(t('errors.deleteError'));
      }

      await deleteTerminResursi(companyId, Number(deleteTarget.id));

      const [idsResult, mapResult] = await Promise.all([
        fetchTerminIdsWithResursi(companyId),
        fetchTerminResursiMap(companyId),
      ]);
      if (idsResult.data) setTerminIdsWithResursi(idsResult.data);
      if (mapResult.data) setTerminResursiMap(mapResult.data);

      // Wait 1 second for system to process
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await loadAppointments();
      setDeleteTarget(null);
    } catch (err) {
      setActionError(t('errors.deleteError'));
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, companyId, actor, companyPayload, buildPayload, loadAppointments, t]);

  // Modal handlers
  const handleNewAppointment = useCallback(() => {
    if (!canCreateAppointment) return;
    setNewAppointmentInitials({});
    setEditingAppointment(null);
    setModalMode('create');
    setIsModalOpen(true);
  }, [canCreateAppointment]);

  const handleGridSlotClick = useCallback((date: Date, time: string) => {
    if (!canCreateAppointment) return;
    setNewAppointmentInitials({ date: getLocalDateKey(date), startTime: time });
    setEditingAppointment(null);
    setModalMode('create');
    setIsModalOpen(true);
  }, [canCreateAppointment]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingAppointment(null);
  }, []);

  const handleSaveAppointment = useCallback(async (data: AppointmentFormData) => {
    if (!companyId) {
      setActionError(t('calendarView.errors.companyNotSelected'));
      return;
    }
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
        language?: string | null;
      } | null = null;

      if (data.stranka_id) {
        const clientId = String(data.stranka_id);
        const clientRow = await (async () => {
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

      const textTerminId = isNewAppointment ? unique8DigitId : data.id;

      if (textTerminId) {
        // Fetch Termini bigint id — use maybeSingle to avoid 400 errors
        const { data: terminRow } = await supabase
          .from('Termini')
          .select('id')
          .eq('ID termina', textTerminId)
          .eq('ID podjetja', companyId)
          .maybeSingle();

        const terminRowId = terminRow ? Number(terminRow.id) : null;

        if (terminRowId) {
          const serviceIds = [
            data.storitev_id,
            data.storitev_id_2,
            data.storitev_id_3,
          ].filter(Boolean) as string[];

          if (serviceIds.length > 0) {
            const { data: resursiData } = await fetchResursiForStoritve(
              companyId,
              serviceIds,
            );
            const resursiPairs = (resursiData ?? []).map((r) => ({
              rowId: r.resursRowId,
              textId: r.resursTextId,
            }));
            await syncTerminResursi(companyId, terminRowId, resursiPairs);
          } else {
            await deleteTerminResursi(companyId, terminRowId);
          }
        }

        const [idsResult, mapResult] = await Promise.all([
          fetchTerminIdsWithResursi(companyId),
          fetchTerminResursiMap(companyId),
        ]);
        if (idsResult.data) setTerminIdsWithResursi(idsResult.data);
        if (mapResult.data) setTerminResursiMap(mapResult.data);
      }

      await loadAppointments();

      if (!isNewAppointment && editingAppointment && companySettings?.obvestilo_prestavitev_omogoceno === true) {
        const normalizedEditingDatum = editingAppointment.datum?.substring(0, 10) ?? '';
        const normalizedEditingCas = editingAppointment.cas_zacetek?.substring(0, 5) ?? '';
        const dateChanged = data.datum !== normalizedEditingDatum;
        const timeChanged = data.cas_zacetek !== normalizedEditingCas;
        console.log('[reschedule check]', {
          formDatum: data.datum,
          editingDatum: editingAppointment.datum,
          formCas: data.cas_zacetek,
          editingCas: editingAppointment.cas_zacetek,
          dateChanged,
          timeChanged,
        });
        if (dateChanged || timeChanged) {
          const rawChannel = companySettings?.obvestilo_prestavitev_channel ?? companySettings?.channel ?? companySettings?.chanel_pred ?? 'email';
          const channel = rawChannel === 'sms' || rawChannel === 'both' ? rawChannel : 'email';
          setRescheduleNotifyTarget({
            appointment: editingAppointment,
            newDate: data.datum,
            newTime: data.cas_zacetek,
            newEndTime: data.cas_konec,
            channel,
            source: 'edit',
          });
        }
      }

      handleCloseModal();
    } catch (err) {
      setActionError(t('errors.saveError'));
    } finally {
      setIsSaving(false);
    }
  }, [companyId, actor, companyPayload, services, employees, buildPayload, loadAppointments, handleCloseModal, editingAppointment, companySettings, t]);

  // Drag-and-drop reschedule: callback from WeekView/DayView
  const handleAppointmentDropped = useCallback((
    apt: AppointmentWithDetails,
    newDate: string,
    newStartTime: string,
    newEndTime: string
  ) => {
    setRescheduleConfirm({ appointment: apt, newDate, newStartTime, newEndTime });
  }, []);

  // Send POSODOBITEV_TERMINA identical to handleSaveAppointment but using embedded appointment data
  const handleRescheduleAppointment = useCallback(async (
    appointment: AppointmentWithDetails,
    newDate: string,
    newStartTime: string,
    newEndTime: string
  ) => {
    if (!companyId) {
      setActionError(t('calendarView.errors.reschedule'));
      return;
    }
    setIsSaving(true);
    setActionError(null);

    try {
      const selectedService = appointment.storitev;
      const selectedService2 = appointment.storitev_2 || null;
      const selectedService3 = appointment.storitev_3 || null;
      const selectedEmployee = appointment.zaposleni;

      // Convert popust_tip from DB format to webhook format
      const popustTip = appointment.popust_tip === 'eur' ? '€' : appointment.popust_tip === 'percent' ? '%' : undefined;

      const appointmentData = {
        id: appointment.id,
        datum: newDate,
        cas_zacetek: newStartTime,
        cas_konec: newEndTime,
        stranka_id: appointment.stranka_id ? String(appointment.stranka_id) : undefined,
        stranka_ime: appointment.stranka_ime,
        stranka_email: appointment.stranka_email || undefined,
        stranka_telefon: appointment.stranka_telefon || undefined,
        language: appointment.language,
        storitev_id: appointment.storitev_id ? String(appointment.storitev_id) : (appointment.storitev?.id || ''),
        storitev_id_2: appointment.storitev_id_2 ? String(appointment.storitev_id_2) : undefined,
        storitev_id_3: appointment.storitev_id_3 ? String(appointment.storitev_id_3) : undefined,
        zaposleni_id: appointment.zaposleni_id ? String(appointment.zaposleni_id) : (appointment.zaposleni?.id || ''),
        status: appointment.status || 'scheduled',
        opombe: appointment.opombe || undefined,
        internal_opombe: appointment.interne_opombe || undefined,
        cena: appointment.cena ?? undefined,
        popust: appointment.popust ?? undefined,
        popust_tip: popustTip as '€' | '%' | undefined,
        valuta: undefined,
      };

      const enhancedData = buildEnhancedAppointmentData({
        companyId,
        userEmail: actor,
        companyProfile: companyPayload,
        appointmentData,
        serviceDetails: selectedService ? {
          id: selectedService.id,
          naziv: selectedService.naziv,
          trajanje: selectedService.trajanje,
          cena: selectedService.cena,
          barva: selectedService.barva,
        } : null,
        serviceDetails2: selectedService2 ? {
          id: selectedService2.id,
          naziv: selectedService2.naziv,
          trajanje: selectedService2.trajanje,
          cena: null,
          barva: selectedService2.barva,
        } : null,
        serviceDetails3: selectedService3 ? {
          id: selectedService3.id,
          naziv: selectedService3.naziv,
          trajanje: selectedService3.trajanje,
          cena: null,
          barva: selectedService3.barva,
        } : null,
        employeeDetails: selectedEmployee ? {
          id: selectedEmployee.id,
          ime: selectedEmployee.ime,
          priimek: selectedEmployee.priimek,
          email: selectedEmployee.email,
          barva: selectedEmployee.barva,
        } : null,
        clientDetails: null,
      });

      const result = await callN8nAction(
        buildPayload('POSODOBITEV_TERMINA', 'appointments', enhancedData)
      );

      if (!result.ok) {
        throw new Error(t('calendarView.errors.reschedule'));
      }

      setSuccessMessage(t('calendarView.toast.appointmentRescheduled'));
      setTimeout(() => setSuccessMessage(null), 3000);

      await new Promise((resolve) => setTimeout(resolve, 1000));
      await loadAppointments();

      if (companySettings?.obvestilo_prestavitev_omogoceno === true) {
        const rawChannel = companySettings?.obvestilo_prestavitev_channel ?? companySettings?.channel ?? companySettings?.chanel_pred ?? 'email';
        const channel = rawChannel === 'sms' || rawChannel === 'both' ? rawChannel : 'email';
        setRescheduleNotifyTarget({
          appointment,
          newDate,
          newTime: newStartTime,
          newEndTime,
          channel,
          source: 'drag_drop',
        });
      }
    } catch (err) {
      setActionError(t('calendarView.errors.reschedule'));
    } finally {
      setIsSaving(false);
    }
  }, [companyId, actor, companyPayload, buildPayload, loadAppointments, companySettings, t]);

  const handleConfirmReschedule = useCallback(async () => {
    if (!rescheduleConfirm) return;
    const { appointment, newDate, newStartTime, newEndTime } = rescheduleConfirm;
    setRescheduleConfirm(null);
    await handleRescheduleAppointment(appointment, newDate, newStartTime, newEndTime);
  }, [rescheduleConfirm, handleRescheduleAppointment]);

  const handleSendRescheduleNotification = useCallback(async () => {
    if (!rescheduleNotifyTarget) return;
    const { appointment, newDate, newTime, newEndTime, channel, source } = rescheduleNotifyTarget;

    const posalji_sms = channel === 'sms' || channel === 'both';
    const posalji_email = channel === 'email' || channel === 'both';
    const smsTemplate = companySettings?.obvestilo_prestavitev_template_sms ?? '';
    const emailTemplate = companySettings?.obvestilo_prestavitev_template_email ?? '';
    const apptManagementLink =
      typeof companySettings?.appt_management_link === 'string'
        ? companySettings.appt_management_link
        : '';

    const oldDate = appointment.datum?.substring(0, 10) ?? appointment.datum;
    const oldStartTime = appointment.cas_zacetek?.substring(0, 5) ?? appointment.cas_zacetek;
    const oldEndTime = appointment.cas_konec?.substring(0, 5) ?? appointment.cas_konec;
    const resolvedNewEndTime = newEndTime ?? oldEndTime;
    const appointmentTextId = appointment.id_termina ?? appointment.id;
    const popustTip = appointment.popust_tip === 'eur'
      ? '€'
      : appointment.popust_tip === 'percent'
        ? '%'
        : undefined;

    const clientDetails = {
      id: appointment.stranka_id ?? '',
      ime: appointment.stranka_ime ?? '',
      priimek: appointment.stranka_priimek ?? '',
      email: appointment.stranka_email ?? null,
      telefon: appointment.stranka_telefon ?? null,
      barva: appointment.stranka_barva ?? null,
      language: appointment.language ?? null,
      notes: null,
      tags: null,
      status: null,
      last_interaction: null,
    };

    const enhancedData = buildEnhancedAppointmentData({
      companyId,
      userEmail: actor,
      companyProfile: companyPayload,
      appointmentData: {
        id: appointmentTextId,
        datum: newDate,
        cas_zacetek: newTime,
        cas_konec: resolvedNewEndTime,
        stranka_id: appointment.stranka_id ? String(appointment.stranka_id) : undefined,
        stranka_ime: appointment.stranka_ime,
        stranka_email: appointment.stranka_email || undefined,
        stranka_telefon: appointment.stranka_telefon || undefined,
        language: appointment.language,
        storitev_id: appointment.storitev_id ? String(appointment.storitev_id) : (appointment.storitev?.id || ''),
        storitev_id_2: appointment.storitev_id_2 ? String(appointment.storitev_id_2) : undefined,
        storitev_id_3: appointment.storitev_id_3 ? String(appointment.storitev_id_3) : undefined,
        zaposleni_id: appointment.zaposleni_id ? String(appointment.zaposleni_id) : (appointment.zaposleni?.id || ''),
        status: appointment.status || 'scheduled',
        opombe: appointment.opombe || undefined,
        internal_opombe: appointment.interne_opombe || undefined,
        cena: appointment.cena ?? undefined,
        popust: appointment.popust ?? undefined,
        popust_tip: popustTip as '€' | '%' | undefined,
        valuta: appointment.valuta ?? undefined,
        belezi_termin: appointment.belezi_termin,
      },
      serviceDetails: appointment.storitev ? {
        id: appointment.storitev.id,
        naziv: appointment.storitev.naziv,
        trajanje: appointment.storitev.trajanje,
        cena: appointment.storitev.cena,
        barva: appointment.storitev.barva,
      } : null,
      serviceDetails2: appointment.storitev_2 ? {
        id: appointment.storitev_2.id,
        naziv: appointment.storitev_2.naziv,
        trajanje: appointment.storitev_2.trajanje,
        cena: null,
        barva: appointment.storitev_2.barva,
      } : null,
      serviceDetails3: appointment.storitev_3 ? {
        id: appointment.storitev_3.id,
        naziv: appointment.storitev_3.naziv,
        trajanje: appointment.storitev_3.trajanje,
        cena: null,
        barva: appointment.storitev_3.barva,
      } : null,
      employeeDetails: appointment.zaposleni ? {
        id: appointment.zaposleni.id,
        ime: appointment.zaposleni.ime,
        priimek: appointment.zaposleni.priimek,
        email: appointment.zaposleni.email,
        barva: appointment.zaposleni.barva,
      } : null,
      clientDetails,
    });

    const rescheduleDetails = {
      source,
      old_date: oldDate,
      old_start_time: oldStartTime,
      old_end_time: oldEndTime,
      new_date: newDate,
      new_start_time: newTime,
      new_end_time: resolvedNewEndTime,
      old_start_at: `${oldDate}T${oldStartTime}:00`,
      old_end_at: `${oldDate}T${oldEndTime}:00`,
      new_start_at: `${newDate}T${newTime}:00`,
      new_end_at: `${newDate}T${resolvedNewEndTime}:00`,
    };

    const notificationData = {
      ...enhancedData,
      appointment_id: appointmentTextId,
      booking_id: appointmentTextId,
      appointment_row_id: appointment.id,
      id_termina: appointmentTextId,
      stari_datum: oldDate,
      stari_cas: oldStartTime,
      stari_konec: oldEndTime,
      novi_datum: newDate,
      novi_cas: newTime,
      novi_konec: resolvedNewEndTime,
      prestavitev: rescheduleDetails,
      notification: {
        channel,
        posalji_sms,
        posalji_email,
        sms_template: smsTemplate,
        email_template: emailTemplate,
        appt_management_link: apptManagementLink,
        povezava_prenarocanje: apptManagementLink,
      },
      posalji_sms,
      posalji_email,
      sms_template: smsTemplate,
      email_template: emailTemplate,
      appt_management_link: apptManagementLink,
      povezava_prenarocanje: apptManagementLink,
      podatkiTermina: {
        ...enhancedData.podatkiTermina,
        row_id: appointment.id,
        id_vrstice: appointment.id,
        id_termina: appointmentTextId,
        stari_datum: oldDate,
        stari_cas: oldStartTime,
        stari_konec: oldEndTime,
        novi_datum: newDate,
        novi_cas: newTime,
        novi_konec: resolvedNewEndTime,
        prestavitev: rescheduleDetails,
      },
    };

    try {
      const result = await callN8nAction(
        buildPayload('PRESTAVITEV_TERMINA_OBVESTILO', 'appointments', notificationData)
      );

      if (!result.ok) {
        throw new Error(result.error || t('calendarView.errors.reschedule'));
      }

      if (companyId && appointment.id) {
        logZgodovina({
          idPodjetja: companyId,
          tipEntitete: 'termin',
          idEntitete: appointmentTextId,
          akcija: 'prestavljen',
          spremembe: {
            prej: { datum: oldDate, cas: oldStartTime, konec: oldEndTime },
            potem: { datum: newDate, cas: newTime, konec: resolvedNewEndTime },
          },
          izvedel: actor,
          izvedel_tip: (role as 'owner' | 'admin' | 'staff') ?? 'staff',
          idTermina: appointmentTextId,
          idStranke: appointment.stranka_id,
        }).catch(() => {/* ignore logging errors */});
      }

      setRescheduleNotifyTarget(null);
    } catch (err) {
      setActionError(t('calendarView.errors.reschedule'));
    }
  }, [rescheduleNotifyTarget, companyId, companySettings, actor, role, companyPayload, buildPayload, t]);

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
          employee_id: data.employeeId,
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
        throw new Error(t('calendarView.errors.absenceSave'));
      }

      handleCloseAbsenceModal();
      // 0.7s delay before refresh (n8n needs time to write)
      await new Promise((r) => setTimeout(r, 700));
      await refreshAbsences();
    } catch (err) {
      console.error('Error saving absence:', err);
    } finally {
      setIsSaving(false);
    }
  }, [companyId, actor, companyPayload, handleCloseAbsenceModal, refreshAbsences]);

  // Handle absence detail modal
  const handleAbsenceClick = useCallback((absence: Absence) => {
    setSelectedAbsence(absence);
    setIsAbsenceDetailOpen(true);
  }, []);

  const handleAbsenceDetailClose = useCallback(() => {
    setIsAbsenceDetailOpen(false);
    setSelectedAbsence(null);
  }, []);

  const handleAbsenceDelete = useCallback(async (absence: Absence) => {
    setIsAbsenceDeleting(true);
    try {
      const result = await callN8nAction({
        event: 'IZBRIS_ODSOTNOSTI',
        entity: 'absence',
        data: {
          id: absence.id,
          employee_id: absence.employee_id,
          employee_name: absence.employee_name,
          start_at: absence.start_at,
          end_at: absence.end_at,
          reason: absence.reason,
          company_id: companyId,
        },
        company_id: companyId,
        actor,
        timestamp: new Date().toISOString(),
        meta: { app: 'Integrate' as const, version: '1.0' as const },
      });
      if (!result.ok) throw new Error(t('calendarView.errors.absenceDelete'));
      handleAbsenceDetailClose();
      await new Promise((r) => setTimeout(r, 700));
      await refreshAbsences();
    } catch (err) {
      console.error('Error deleting absence:', err);
    } finally {
      setIsAbsenceDeleting(false);
    }
  }, [companyId, actor, refreshAbsences, handleAbsenceDetailClose]);

  const handleAbsenceEdit = useCallback(async (absence: Absence, data: AbsenceEditData) => {
    setIsSaving(true);
    try {
      const result = await callN8nAction({
        event: 'UREDI_ODSOTNOST',
        entity: 'absence',
        data: {
          id: absence.id,
          employee_ids: data.employee_ids,
          all_employees: data.all_employees,
          date_from: data.date_from,
          date_to: data.date_to,
          single_day: data.single_day,
          time_from: data.time_from,
          time_to: data.time_to,
          reason: data.reason,
          company_id: companyId,
        },
        company_id: companyId,
        actor,
        timestamp: new Date().toISOString(),
        meta: { app: 'Integrate' as const, version: '1.0' as const },
      });
      if (!result.ok) throw new Error(t('calendarView.errors.absenceEdit'));
      handleAbsenceDetailClose();
      await new Promise((r) => setTimeout(r, 700));
      await refreshAbsences();
    } catch (err) {
      console.error('Error editing absence:', err);
    } finally {
      setIsSaving(false);
    }
  }, [companyId, actor, refreshAbsences, handleAbsenceDetailClose]);

  // Header title: always "Month Year" (Apple Calendar style – date strip shows specific day)
  const headerTitle = useMemo(() => {
    return `${getMonthsFull(locale)[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }, [currentDate, locale]);

  // Calculate visible appointments count based on current view
  const visibleAppointmentsCount = useMemo(() => {
    const currentDateKey = getLocalDateKey(currentDate);

    if (currentView === 'day') {
      // Count appointments for current day only
      return filteredAppointments.filter(apt => {
        const aptDateKey = getLocalDateKey(new Date(apt.datum));
        return aptDateKey === currentDateKey;
      }).length;
    } else if (currentView === '2day') {
      // Count appointments for current day and next 2 days (3-day view)
      const day2Key = getLocalDateKey(addDays(currentDate, 1));
      const day3Key = getLocalDateKey(addDays(currentDate, 2));
      return filteredAppointments.filter(apt => {
        const aptDateKey = getLocalDateKey(new Date(apt.datum));
        return aptDateKey === currentDateKey || aptDateKey === day2Key || aptDateKey === day3Key;
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
    <div className="flex h-full bg-transparent">
      {/* Main calendar area - takes available space */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header – Apple Calendar style */}
        <header className="sticky top-0 z-30 flex flex-col border-b border-gray-100 bg-white/90 backdrop-blur-md flex-shrink-0">
          {/* Top row: month/year navigation + view toggle + filter */}
          <div className="flex items-center justify-between px-3 py-2.5 md:px-5 md:py-3">

            {/* Left: prev arrow · month-year title · next arrow */}
            <div className="flex items-center gap-0.5">
              <motion.button
                type="button"
                onClick={handlePrev}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#1A1F36]
                           transition-colors hover:bg-gray-100 active:bg-gray-200"
                aria-label={t('calendarView.navigation.prev')}
              >
                <CaretLeft className="h-[14px] w-[14px] md:h-4 md:w-4" weight="bold" />
              </motion.button>

              <h1 className="w-[140px] text-center text-[15px] font-normal text-[#1A1F36]
                             md:w-[170px] md:text-[17px]">
                {headerTitle}
              </h1>

              <motion.button
                type="button"
                onClick={handleNext}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#1A1F36]
                           transition-colors hover:bg-gray-100 active:bg-gray-200"
                aria-label={t('calendarView.navigation.next')}
              >
                <CaretRight className="h-[14px] w-[14px] md:h-4 md:w-4" weight="bold" />
              </motion.button>
            </div>

            {/* Right: view toggle + filter */}
            <div className="flex items-center gap-2 md:gap-3">
              <ViewToggle currentView={currentView} onViewChange={handleViewChange} isMobile={isMobile} />

              <motion.button
                type="button"
                onClick={handleToggleSidebar}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#6B7280]
                           transition-colors hover:bg-gray-100 hover:text-[#1A1F36] active:bg-gray-200"
                aria-label={t('calendarView.navigation.filters')}
              >
                <Faders className="h-[17px] w-[17px] md:h-[18px] md:w-[18px]" weight="bold" />
              </motion.button>
            </div>
          </div>

          {/* Date strip – hidden in month, week, day and 2day views */}
          {false && currentView !== 'month' && currentView !== 'week' && (
            <DateStrip
              currentDate={currentDate}
              currentView={currentView}
              onDateSelect={handleDateSelect}
            />
          )}
        </header>

        {/* Calendar content – swipe left/right to navigate */}
        <div
          className="flex-1 overflow-hidden p-2 md:p-4"
          onTouchStart={handleSwipeTouchStart}
          onTouchMove={handleSwipeTouchMove}
          onTouchEnd={handleSwipeTouchEnd}
          onTouchCancel={handleSwipeTouchCancel}
          style={isMobile ? { touchAction: 'pan-y', overscrollBehavior: 'contain' } as React.CSSProperties : undefined}
        >
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <svg className="h-8 w-8 animate-spin" viewBox="0 0 50 50" aria-hidden="true">
                  <defs>
                    <linearGradient id="calSpinner" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#8B5CF6" />
                      <stop offset="50%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#06B6D4" />
                    </linearGradient>
                  </defs>
                  <circle cx="25" cy="25" r="20" fill="none" stroke="url(#calSpinner)" strokeWidth="3" strokeLinecap="round" strokeDasharray="80 50" />
                </svg>
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
                  absences={filteredAbsences}
                  events={events}
                  services={services}
                  onAppointmentClick={handleAppointmentClick}
                  onEventClick={handleEventClick}
                  onAbsenceClick={handleAbsenceClick}
                  onDateClick={handleDateClick}
                  showAllDays={showAllDays}
                  onGridSlotClick={handleGridSlotClick}
                  companySchedule={companySchedule}
                  onAppointmentReschedule={handleAppointmentDropped}
                  appointmentsWithResursi={terminIdsWithResursi}
                />
              )}
              {currentView === 'day' && (
                <AnimatePresence mode="popLayout" initial={false} custom={slideDirection}>
                  <motion.div
                    key={animKey}
                    custom={slideDirection}
                    variants={{
                      enter: (dir: 'forward' | 'backward') => ({
                        x: dir === 'forward' ? '100%' : '-100%',
                        opacity: 0.6,
                      }),
                      center: { x: 0, opacity: 1 },
                      exit: (dir: 'forward' | 'backward') => ({
                        x: dir === 'forward' ? '-30%' : '30%',
                        opacity: 0.4,
                      }),
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.8 }}
                    className="h-full"
                  >
                    <DayView
                      currentDate={currentDate}
                      appointments={filteredAppointments}
                      absences={filteredAbsences}
                      events={events}
                      services={services}
                      onAppointmentClick={handleAppointmentClick}
                      onEventClick={handleEventClick}
                      onAbsenceClick={handleAbsenceClick}
                      employees={employees}
                      onGridSlotClick={handleGridSlotClick}
                      companySchedule={companySchedule}
                      showAllDays={showAllDays}
                      isMobile={isMobile}
                      onAppointmentReschedule={handleAppointmentDropped}
                      appointmentsWithResursi={terminIdsWithResursi}
                    />
                  </motion.div>
                </AnimatePresence>
              )}
              {currentView === 'month' && (
                <MonthView
                  currentDate={currentDate}
                  appointments={filteredAppointments}
                  absences={filteredAbsences}
                  events={events}
                  services={services}
                  onAppointmentClick={handleAppointmentClick}
                  onEventClick={handleEventClick}
                  onAbsenceClick={handleAbsenceClick}
                  onDateClick={handleDateClick}
                  isMobile={isMobile}
                  appointmentsWithResursi={terminIdsWithResursi}
                />
              )}
              {currentView === '2day' && (
                <div className="h-full">
                  <AnimatePresence mode="popLayout" initial={false} custom={slideDirection}>
                    <motion.div
                      key={animKey}
                      custom={slideDirection}
                      variants={{
                        enter: (dir: 'forward' | 'backward') => ({
                          x: dir === 'forward' ? '100%' : '-100%',
                          opacity: 0.6,
                        }),
                        center: { x: 0, opacity: 1 },
                        exit: (dir: 'forward' | 'backward') => ({
                          x: dir === 'forward' ? '-30%' : '30%',
                          opacity: 0.4,
                        }),
                      }}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.8 }}
                      className="h-full"
                    >
                      <TwoDayView
                        currentDate={currentDate}
                        appointments={filteredAppointments}
                        absences={filteredAbsences}
                        events={events}
                        services={services}
                        onAppointmentClick={handleAppointmentClick}
                        onEventClick={handleEventClick}
                        onAbsenceClick={handleAbsenceClick}
                        onDateClick={handleDateClick}
                        onGridSlotClick={handleGridSlotClick}
                        companySchedule={companySchedule}
                        showAllDays={showAllDays}
                        isMobile={isMobile}
                        appointmentsWithResursi={terminIdsWithResursi}
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
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
        onNewEvent={handleOpenEventModal}
        onAbsence={handleOpenAbsenceModal}
        services={services}
        employees={employees}
        selectedEmployeeId={selectedEmployeeId}
        onEmployeeFilterChange={setSelectedEmployeeId}
        restrictedToEmployeeId={staffViewOwnOnly && rolePersonId ? rolePersonId : undefined}
        selectedServiceId={selectedServiceId}
        onServiceFilterChange={setSelectedServiceId}
        availableResursi={activeResursi}
        selectedResursId={selectedResursId}
        onResursFilterChange={setSelectedResursId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        currentView={currentView}
        onViewChange={handleViewChange}
        isOpen={isSidebarOpen}
        onToggle={handleToggleSidebar}
        showAllDays={showAllDays}
        onShowAllDaysChange={handleShowAllDaysChange}
        appointmentDates={appointmentDates}
      />

      {/* Appointment detail modal (view) */}
      <AnimatePresence>
        {selectedAppointment && (() => {
          const aptEditable = canEditAppointment(selectedAppointment);
          return (
            <AppointmentDetailModal
              appointment={selectedAppointment}
              services={services}
              terminResursiMap={terminResursiMap}
              activeResursi={activeResursi}
              onClose={handleCloseDetailModal}
              onEdit={aptEditable ? handleEditFromDetail : undefined}
              onComplete={aptEditable ? handleCompleteAppointment : undefined}
              onNoShow={aptEditable ? handleNoShowAppointment : undefined}
              onCancel={aptEditable ? handleCancelAppointment : undefined}
              onDelete={aptEditable && canDeleteAppointment ? handleDeleteAppointment : undefined}
              onOpenClientDetails={handleOpenClientDetails}
            />
          );
        })()}
      </AnimatePresence>

      <ClientDetailsPanel
        isOpen={clientDetailsOpen}
        onClose={handleCloseClientDetails}
        client={detailsClient}
        companyId={companyId}
      />

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
        initialDate={newAppointmentInitials.date}
        initialStartTime={newAppointmentInitials.startTime}
        initialEmployeeId={role === 'staff' && rolePersonId ? rolePersonId : undefined}
        lockEmployee={role === 'staff' && Boolean(rolePersonId)}
      />

      {/* Absence modal */}
      <AbsenceModal
        isOpen={isAbsenceModalOpen}
        onClose={handleCloseAbsenceModal}
        employees={employees}
        onSave={handleSaveAbsence}
        isSaving={isSaving}
      />

      {/* Absence detail modal */}
      <AbsenceDetailModal
        isOpen={isAbsenceDetailOpen}
        absence={selectedAbsence}
        employees={employees}
        onClose={handleAbsenceDetailClose}
        onDelete={handleAbsenceDelete}
        onEdit={handleAbsenceEdit}
        isDeleting={isAbsenceDeleting}
        isSaving={isSaving}
      />

      {/* Event view modal */}
      <EventViewModal
        isOpen={isEventViewModalOpen}
        event={viewingEvent}
        onClose={handleCloseEventViewModal}
        onEdit={handleOpenEditFromView}
        onDelete={handleDeleteFromView}
        isDeleting={isEventDeleting}
      />

      {/* Event modal */}
      <EventModal
        isOpen={isEventModalOpen}
        mode={eventModalMode}
        event={editingEvent}
        onClose={handleCloseEventModal}
        onSave={handleSaveEvent}
        onDelete={eventModalMode === 'edit' ? handleDeleteEvent : undefined}
        isSaving={isSaving}
        isDeleting={isEventDeleting}
      />

      {/* Delete confirmation - identical to Termini */}
      <DeleteConfirmation
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={t('calendarView.detailModal.fields.deleteTitle')}
        message={t('calendarView.detailModal.fields.deleteMessage')}
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
                  <h2 className="text-lg font-semibold text-[#1A1F36]">{t('calendarView.completeDialog.title')}</h2>
                  <p className="text-sm text-gray-500">{t('calendarView.completeDialog.subtitle')}</p>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Client with initials */}
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold flex-shrink-0 bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                    {(() => { const p = (completeTarget.stranka_ime || '').trim().split(/\s+/).filter(Boolean); return p.length >= 2 ? `${p[0][0]}${p[1][0]}`.toUpperCase() : (p[0] || '?').substring(0, 2).toUpperCase(); })()}
                  </span>
                  <div>
                    <p className="text-xs text-gray-500">{t('modal.fields.client')}</p>
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
                      <p className="text-xs text-gray-500">{t('modal.fields.service')}</p>
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
                        {completeTarget.add_on_naziv && (
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: completeTarget.add_on_storitev?.barva || '#6366F1' }} />
                            <p className="text-sm font-semibold text-[#1A1F36]">{completeTarget.add_on_naziv}</p>
                            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                              <Plus className="h-2.5 w-2.5" weight="bold" />
                              {t('calendarView.detailModal.fields.additionalService')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Date */}
                <div className="flex items-center gap-3">
                  <CalendarBlank className="h-[18px] w-[18px] text-emerald-500 flex-shrink-0" weight="regular" />
                  <div>
                    <p className="text-xs text-gray-500">{t('modal.fields.date')}</p>
                    <p className="text-sm font-semibold text-[#1A1F36]">
                      {new Date(completeTarget.datum).toLocaleDateString(locale === 'sl' ? 'sl-SI' : 'en-US', {
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
                    <p className="text-xs text-gray-500">{t('calendarView.detailModal.fields.time')}</p>
                    <p className="text-sm font-semibold text-[#1A1F36]">
                      {completeTarget.cas_zacetek?.substring(0, 5)} - {completeTarget.cas_konec?.substring(0, 5)}
                    </p>
                  </div>
                </div>

                {/* Notes field (optional) */}
                <div>
                  <label htmlFor="calendar-completion-notes" className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('calendarView.completeDialog.notesLabel')}
                  </label>
                  <textarea
                    id="calendar-completion-notes"
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder={t('calendarView.completeDialog.notesPlaceholder')}
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
                  {t('calendarView.completeDialog.cancel')}
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
                      {t('calendarView.completeDialog.completing')}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" weight="bold" />
                      {t('calendarView.completeDialog.complete')}
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

      {/* Reschedule confirmation dialog */}
      <AnimatePresence>
        {rescheduleConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => { if (!isSaving) setRescheduleConfirm(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 400, damping: 36 }}
              className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-5 border-b border-gray-100">
                <h3 className="text-base font-semibold text-[#1A1F36]">{t('calendarView.rescheduleDialog.title')}</h3>
                <p className="text-sm font-medium text-[#1A1F36] mt-1">
                  {rescheduleConfirm.appointment.stranka_ime} {rescheduleConfirm.appointment.stranka_priimek || ''}
                </p>
              </div>
              <div className="px-6 py-4 space-y-3">
                {/* Service */}
                {rescheduleConfirm.appointment.storitev && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{t('calendarView.rescheduleDialog.service')}</div>
                    <div className="space-y-1.5">
                      {[
                        rescheduleConfirm.appointment.storitev,
                        rescheduleConfirm.appointment.storitev_2,
                        rescheduleConfirm.appointment.storitev_3,
                      ].filter(Boolean).map((s, i) => s && (
                        <div key={i} className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: s.barva || '#6366F1' }} />
                          <span className="text-sm font-medium text-[#1A1F36]">{s.naziv}</span>
                        </div>
                      ))}
                      {rescheduleConfirm.appointment.add_on_naziv && (
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: rescheduleConfirm.appointment.add_on_storitev?.barva || '#6366F1' }} />
                          <span className="text-sm font-medium text-[#1A1F36]">{rescheduleConfirm.appointment.add_on_naziv}</span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                            <Plus className="h-2.5 w-2.5" weight="bold" />
                            {t('calendarView.detailModal.fields.additionalService')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* Employee */}
                {rescheduleConfirm.appointment.zaposleni && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{t('calendarView.rescheduleDialog.employee')}</div>
                    <div className="flex items-center gap-2.5 rounded-xl bg-[#F7F8FA] px-3 py-2">
                      <span
                        className="text-base font-bold flex-shrink-0"
                        style={{
                          background: rescheduleConfirm.appointment.zaposleni.barva || 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                        }}
                      >
                        {rescheduleConfirm.appointment.zaposleni.initials}
                      </span>
                      <span className="text-sm font-medium text-[#1A1F36]">
                        {rescheduleConfirm.appointment.zaposleni.ime} {rescheduleConfirm.appointment.zaposleni.priimek}
                      </span>
                    </div>
                  </div>
                )}
                {/* New time */}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{t('calendarView.rescheduleDialog.newTime')}</div>
                  <div className="rounded-xl bg-[#F7F8FA] px-4 py-3 text-sm font-semibold text-[#1A1F36]">
                    {rescheduleConfirm.newDate.split('-').reverse().join('.')} · {rescheduleConfirm.newStartTime} – {rescheduleConfirm.newEndTime}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 px-6 pb-5">
                <button
                  type="button"
                  onClick={() => setRescheduleConfirm(null)}
                  disabled={isSaving}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  {t('calendarView.completeDialog.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReschedule}
                  disabled={isSaving}
                  className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)' }}
                >
                  {isSaving ? t('calendarView.rescheduleDialog.saving') : t('calendarView.rescheduleDialog.confirm')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reschedule notification modal */}
      {rescheduleNotifyTarget && (
        <RescheduleNotificationModal
          isOpen={true}
          onClose={() => setRescheduleNotifyTarget(null)}
          onConfirm={handleSendRescheduleNotification}
          appointment={rescheduleNotifyTarget.appointment}
          newDate={rescheduleNotifyTarget.newDate}
          newTime={rescheduleNotifyTarget.newTime}
          channel={rescheduleNotifyTarget.channel}
        />
      )}

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
