'use client';

import { memo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Calendar,
  Clock,
  Tag,
  Plus,
  Briefcase,
  Envelope,
  Phone,
  Copy,
  Check,
  PencilSimple,
  Trash,
} from '@phosphor-icons/react';
import { format } from 'date-fns';
import { sl } from 'date-fns/locale';
import type { AppointmentWithDetails } from '@/types/appointments';
import StatusBadge from './StatusBadge';
import { formatCurrency, formatDiscount, computeAddOnOriginalPrice } from '@/lib/formatPromotion';

interface AppointmentViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: AppointmentWithDetails | null;
  onEdit?: () => void;
  onDelete?: () => void;
}

// Promotion badge shown in detail view
function PromotionBadge({ type, naziv }: { type: string; naziv?: string | null }) {
  const configs: Record<string, { label: string; bgColor: string; icon: ReactNode }> = {
    popust: { label: 'Popust', bgColor: '#6D5EF7', icon: <Tag className="w-3.5 h-3.5" weight="fill" /> },
    happy_hour: { label: 'Happy Hour', bgColor: '#F59E0B', icon: <Clock className="w-3.5 h-3.5" weight="fill" /> },
    add_on: { label: 'Add-on', bgColor: '#3B82F6', icon: <Plus className="w-3.5 h-3.5" weight="bold" /> },
  };
  const config = configs[type];
  if (!config) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-sm font-medium"
      style={{ backgroundColor: config.bgColor }}
    >
      {config.icon}
      {naziv || config.label}
    </span>
  );
}

// Copy button component
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

// Calculate duration in minutes
function calculateDuration(start: string, end: string): number {
  if (!start || !end) return 0;
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
}

function AppointmentViewModal({
  isOpen,
  onClose,
  appointment,
  onEdit,
  onDelete,
}: AppointmentViewModalProps) {
  if (!isOpen || !appointment) return null;

  const apt = appointment as unknown as Record<string, unknown>;

  const duration = calculateDuration(appointment.cas_zacetek, appointment.cas_konec || '');

  // Pricing — handle both typed fields and raw Supabase column names
  const valuta = appointment.valuta || (apt['Valuta'] as string) || 'EUR';
  const baseCena = appointment.cena ?? (apt['Cena'] != null ? Number(apt['Cena']) : null);
  const rawDiscountValue = appointment.popust ?? (apt['Popust'] != null ? Number(apt['Popust']) : null);
  const discountAmount = rawDiscountValue != null ? String(rawDiscountValue) : null;
  const rawDiscountType = (apt['Popust type'] as string) || appointment.popust_tip || '';
  const discountType = (rawDiscountType === '%' || rawDiscountType === 'percent') ? '%' : '€';
  const finalCena = appointment.koncna_cena ?? (apt['Final cena'] != null ? Number(apt['Final cena']) : null);

  const addOnHasDiscount = !!(appointment.add_on_popust && parseFloat(appointment.add_on_popust || '0') > 0);
  const addOnOriginalPrice = computeAddOnOriginalPrice(
    appointment.add_on_final_cena,
    appointment.add_on_popust,
    appointment.add_on_popust_tip
  );

  const hasAddOn = !!appointment.add_on_naziv?.trim();
  const hasMultipleServices = !!(appointment.storitev_id_2 || appointment.storitev_id_3 || hasAddOn);
  const hasDiscount = !!(appointment.promocija_tip || (rawDiscountValue != null && rawDiscountValue > 0));
  const promotionType = appointment.promocija_tip || (hasDiscount ? 'popust' : null);
  const showPriceSummary = hasMultipleServices;
  const serviceDurationTotal =
    (appointment.storitev?.trajanje ?? 0) +
    (appointment.storitev_2?.trajanje ?? 0) +
    (appointment.storitev_3?.trajanje ?? 0) +
    (hasAddOn ? (appointment.add_on_trajanje ?? appointment.add_on_storitev?.trajanje ?? 0) : 0);

  const totalOriginal =
    baseCena != null || addOnOriginalPrice != null
      ? (baseCena ?? 0) + (addOnOriginalPrice ?? 0)
      : null;
  const mainFinal = finalCena ?? baseCena;
  const addOnFinalNum = appointment.add_on_final_cena ? parseFloat(appointment.add_on_final_cena) : 0;
  const totalFinal = mainFinal != null ? mainFinal + addOnFinalNum : null;
  const totalSaving = totalOriginal != null && totalFinal != null ? Math.max(0, totalOriginal - totalFinal) : 0;

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

  // Get service color for header
  const headerColor = appointment.storitev?.barva || 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)';

  // Format date
  const formattedDate = appointment.datum
    ? format(new Date(appointment.datum), "d. MMMM yyyy", { locale: sl })
    : '-';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
          className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          {/* GRADIENT HEADER with service color */}
          <div
            className="px-8 py-8"
            style={{ background: headerColor }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-3 flex min-w-0 items-center gap-3">
                  {/* Client Name - Large */}
                  <h2 className="truncate text-3xl font-bold text-white">
                    {appointment.stranka_ime || '-'}
                  </h2>
                  <StatusBadge status={appointment.status || 'scheduled'} size="md" variant="gradient" weight="normal" />
                </div>

                {/* Service Name */}
                <div className="flex items-center gap-2 text-white/95 mb-2">
                  <Briefcase className="w-5 h-5" weight="fill" />
                  <span className="text-lg font-semibold">
                    {appointment.storitev?.naziv || '-'}
                  </span>
                </div>

                {/* Duration */}
                {duration > 0 && (
                  <div className="flex items-center gap-2 text-white/90 text-sm">
                    <Clock className="w-4 h-4" weight="fill" />
                    <span>Trajanje: {duration} minut</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Close button */}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                >
                  <X className="h-5 w-5" weight="bold" />
                </button>
              </div>
            </div>
          </div>

          {/* CONTENT */}
          <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {/* Date & Time - GRADIENT BORDER ONLY */}
            <div className="grid grid-cols-2 gap-4">
              {/* Datum */}
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 p-[3px]">
                  <div className="h-full bg-white rounded-xl" />
                </div>
                <div className="relative rounded-xl bg-white p-4">
                  <div className="flex items-center gap-3">
                    {/* Icon - BLACK, NO CIRCLE */}
                    <Calendar className="w-5 h-5 text-gray-900" weight="bold" />
                    <div>
                      <div className="text-sm text-gray-600">Datum</div>
                      <div className="bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text font-bold text-transparent">
                        {formattedDate}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Čas */}
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 p-[3px]">
                  <div className="h-full bg-white rounded-xl" />
                </div>
                <div className="relative rounded-xl bg-white p-4">
                  <div className="flex items-center gap-3">
                    {/* Icon - BLACK, NO CIRCLE */}
                    <Clock className="w-5 h-5 text-gray-900" weight="bold" />
                    <div>
                      <div className="text-sm text-gray-600">Čas</div>
                      <div className="bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text font-bold text-transparent">
                        {appointment.cas_zacetek} - {appointment.cas_konec || '-'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Trajanje & Cena */}
            <div className="space-y-3">
              {/* Trajanje termina */}
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-violet-50 to-cyan-50 rounded-xl">
                <span className="text-sm font-medium text-gray-700">Trajanje termina</span>
                <span className="text-lg font-bold bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                  {duration > 0 ? `${duration} min` : '-'}
                </span>
              </div>

              {/* Skupno trajanje - only show if multiple services */}
              {hasMultipleServices && (
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-violet-50 to-cyan-50 rounded-xl">
                  <span className="text-sm font-medium text-gray-700">Skupno trajanje</span>
                  <span className="text-lg font-bold bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                    {(serviceDurationTotal || duration) > 0 ? `${serviceDurationTotal || duration} min` : '-'}
                  </span>
                </div>
              )}

              {/* Price section */}
              {(() => {
                const rawCena = apt['Cena'] ?? appointment.cena ?? '';
                const rawPopust = apt['Popust'] ?? appointment.popust ?? '';
                const rawFinalCena = apt['Final cena'] ?? appointment.koncna_cena ?? '';
                const rawPopustType = (apt['Popust type'] as string) || appointment.popust_tip || '%';
                const currencyCode = (apt['Valuta'] as string) || appointment.valuta || 'EUR';
                const promocijaTip = appointment.promocija_tip ?? null;
                const promocijaNaziv = appointment.promocija_naziv ?? null;

                const originalCena = parseFloat(String(rawCena)) || 0;
                const popustVrednost = parseFloat(String(rawPopust)) || 0;
                const finalCenaVal = parseFloat(String(rawFinalCena)) || originalCena;
                const imaPopust = popustVrednost > 0;

                const formatPrice = (val: number) =>
                  new Intl.NumberFormat('sl-SI', { style: 'currency', currency: currencyCode }).format(val);

                const badgeBg = promocijaTip === 'happy_hour' ? '#F59E0B'
                  : promocijaTip === 'add_on' ? '#3B82F6' : '#6D5EF7';
                const badgeLabel = promocijaTip === 'happy_hour' ? 'Happy Hour'
                  : promocijaTip === 'add_on' ? 'Add-on'
                  : (promocijaNaziv || 'Popust');

                if (originalCena === 0 && !imaPopust) return null;

                return (
                  <div className="space-y-3">
                    {imaPopust ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-3"
                      >
                        {/* Promotion badge */}
                        <div
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-xs font-semibold"
                          style={{ backgroundColor: badgeBg }}
                        >
                          {promocijaTip === 'happy_hour' ? <Clock size={11} weight="fill" /> :
                           promocijaTip === 'add_on' ? <Plus size={11} weight="bold" /> :
                           <Tag size={11} weight="fill" />}
                          <span>{badgeLabel}</span>
                        </div>

                        {/* Price breakdown */}
                        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-2.5">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">Originalna cena</span>
                            <span className="text-gray-400 line-through">{formatPrice(originalCena)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">Popust</span>
                            <span className="font-medium text-red-500">
                              − {rawPopustType === '%'
                                ? `${popustVrednost}%`
                                : formatPrice(popustVrednost)}
                            </span>
                          </div>
                          <div className="border-t border-gray-200 pt-2.5 flex justify-between items-center">
                            <span className="font-semibold text-gray-900">Cena z popustom</span>
                            <span className="text-xl font-bold text-green-600">{formatPrice(finalCenaVal)}</span>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-violet-50 to-cyan-50 rounded-xl">
                        <span className="text-sm font-medium text-gray-700">Cena</span>
                        <span className="text-xl font-bold bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                          {formatPrice(originalCena)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Add-on service section */}
              {hasAddOn && appointment.add_on_final_cena && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 uppercase tracking-wider">
                      <Plus className="w-3.5 h-3.5" weight="bold" />
                      <span>Dodatna storitev</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900">{appointment.add_on_naziv}</p>
                    {addOnHasDiscount ? (
                      <div className="space-y-1">
                        {addOnOriginalPrice != null && (
                          <div className="flex justify-between text-sm text-gray-500">
                            <span>Originalna cena</span>
                            <span className="line-through">{formatCurrency(addOnOriginalPrice, valuta)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm text-red-500">
                          <span>Popust</span>
                          <span>-{formatDiscount(appointment.add_on_popust, appointment.add_on_popust_tip, valuta)}</span>
                        </div>
                        <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-blue-200">
                          <span>Cena z popustom</span>
                          <span className="text-green-600">{formatCurrency(appointment.add_on_final_cena, valuta)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Cena</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(appointment.add_on_final_cena, valuta)}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Price summary — shown for 2+ services or any promotion */}
              {showPriceSummary && totalFinal != null && (
                <div className="space-y-1 pt-2 border-t border-gray-200">
                  {totalOriginal != null && (
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Skupaj (originalno)</span>
                      <span>{formatCurrency(totalOriginal, valuta)}</span>
                    </div>
                  )}
                  {totalSaving > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Prihranek</span>
                      <span>-{formatCurrency(totalSaving, valuta)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gray-900 text-base pt-1">
                    <span>Skupaj za plačilo</span>
                    <span>{formatCurrency(totalFinal, valuta)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Service & Employee - Side by side */}
            <div className="grid grid-cols-2 gap-4">
              {/* Service Info */}
              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200">
                <div className="flex items-center gap-4">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ background: appointment.storitev?.barva || '#8B5CF6' }}
                  />
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Storitev
                    </div>
                    <div className="text-lg font-bold text-gray-900 mt-0.5">
                      {appointment.storitev?.naziv || '-'}
                    </div>
                    {appointment.storitev?.trajanje && appointment.storitev.trajanje > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        {appointment.storitev.trajanje} minut
                      </div>
                    )}
                    {hasAddOn && (
                      <div className="mt-3 flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{ background: appointment.add_on_storitev?.barva || '#6366F1' }}
                        />
                        <span className="text-sm font-medium text-gray-900">{appointment.add_on_naziv}</span>
                        {(appointment.add_on_trajanje ?? 0) > 0 && (
                          <span className="text-xs text-gray-500">{appointment.add_on_trajanje} minut</span>
                        )}
                        <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                          <Plus className="h-2.5 w-2.5" weight="bold" />
                          Dodatna storitev
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Employee Info */}
              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200">
                <div className="flex items-center gap-4">
                  <span
                    className="text-2xl font-bold flex-shrink-0"
                    style={{
                      backgroundImage: appointment.zaposleni?.barva || 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {appointment.zaposleni?.initials || '?'}
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Zaposleni
                    </div>
                    <div className="text-lg font-bold text-gray-900 mt-0.5">
                      {appointment.zaposleni
                        ? `${appointment.zaposleni.ime} ${appointment.zaposleni.priimek}`
                        : '-'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Client Contact Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                Kontakt stranke
              </h3>

              {/* Email */}
              {appointment.stranka_email && (
                <motion.a
                  href={`mailto:${appointment.stranka_email}`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 transition-transform cursor-pointer"
                >
                  <Envelope className="w-5 h-5 text-gray-400 flex-shrink-0" weight="regular" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</div>
                    <div className="text-base font-semibold text-gray-900 truncate mt-0.5">
                      {appointment.stranka_email}
                    </div>
                  </div>
                  <CopyButton text={appointment.stranka_email} label="email" />
                </motion.a>
              )}

              {/* Phone */}
              {appointment.stranka_telefon && (
                <motion.a
                  href={`tel:${appointment.stranka_telefon}`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 transition-transform cursor-pointer"
                >
                  <Phone className="w-5 h-5 text-gray-400 flex-shrink-0" weight="regular" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Telefon</div>
                    <div className="text-base font-semibold text-gray-900 truncate mt-0.5">
                      {appointment.stranka_telefon}
                    </div>
                  </div>
                  <CopyButton text={appointment.stranka_telefon} label="telefon" />
                </motion.a>
              )}

              {/* No contact info message */}
              {!appointment.stranka_email && !appointment.stranka_telefon && (
                <div className="p-4 bg-gray-50 rounded-xl text-center text-gray-500 text-sm">
                  Ni kontaktnih podatkov
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Opombe
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {appointment.opombe || '-'}
              </p>
            </div>

            {/* Internal Notes - always show */}
            <div className="p-5 bg-white rounded-2xl border-2 border-yellow-200">
              <div className="text-xs font-bold text-yellow-700 uppercase tracking-wide mb-2">
                Interne opombe
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {appointment.interne_opombe || '-'}
              </p>
            </div>
          </div>

          {/* FOOTER - No Zapri button, only action buttons */}
          <div className="flex gap-3 p-6 border-t border-gray-100 bg-gray-50">
            {onEdit && (
              <motion.button
                type="button"
                onClick={onEdit}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:shadow-lg"
              >
                <PencilSimple className="w-4 h-4" weight="bold" />
                Uredi
              </motion.button>
            )}
            {onDelete && (
              <motion.button
                type="button"
                onClick={onDelete}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-red-600"
              >
                <Trash className="w-4 h-4" weight="bold" />
                Izbriši
              </motion.button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default memo(AppointmentViewModal);
