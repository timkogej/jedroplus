'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Envelope,
  Phone,
  CalendarBlank,
  Clock,
  User,
  PencilSimple,
  Trash,
  Copy,
  Check,
  Plus,
  ArrowRight,
  CheckCircle,
  XCircle,
  Warning,
  GenderIntersex,
  NotePencil,
  LockSimple,
  LockKey,
} from '@phosphor-icons/react';
import type { Client, ClientWithAppointments, ClientAppointment } from '@/types/clients';
import { getClientWithAppointments } from '@/lib/supabase/clients';
import ClientInitialsBadge from './ClientInitialsBadge';

interface ClientDetailsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  companyId: string;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  onNewAppointment?: (client: Client) => void;
}

// Format date for display
function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const trimmed = dateStr.trim();
    const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dotMatch) {
      const day = Number(dotMatch[1]);
      const month = Number(dotMatch[2]) - 1;
      const year = Number(dotMatch[3]);
      const date = new Date(year, month, day);
      return date.toLocaleDateString('sl-SI', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('sl-SI', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// Format time for display
function formatTime(timeStr: string): string {
  if (!timeStr) return '-';
  if (timeStr.includes('T')) {
    const date = new Date(timeStr);
    return date.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
  }
  return timeStr.substring(0, 5);
}

// Get status badge config - matching Termini page styling
function getStatusConfig(status: string): { label: string; bgClass: string; textClass: string; dotClass: string } {
  const normalized = status.toLowerCase();
  if (normalized.includes('confirm') || normalized.includes('potrj')) {
    return { label: 'Potrjen', bgClass: 'bg-gradient-to-r from-green-50 to-emerald-50', textClass: 'text-green-700', dotClass: 'bg-green-500' };
  }
  if (normalized.includes('complet') || normalized.includes('zakljuc') || normalized.includes('done')) {
    return { label: 'Zaključen', bgClass: 'bg-gray-100', textClass: 'text-gray-700', dotClass: 'bg-gray-500' };
  }
  if (normalized.includes('cancel') || normalized.includes('odpoved')) {
    return { label: 'Odpovedan', bgClass: 'bg-gradient-to-r from-red-50 to-rose-50', textClass: 'text-red-700', dotClass: 'bg-red-500' };
  }
  if (normalized.includes('no_show') || normalized.includes('ni_prisel')) {
    return { label: 'Ni prišel', bgClass: 'bg-gradient-to-r from-orange-50 to-amber-50', textClass: 'text-orange-700', dotClass: 'bg-orange-500' };
  }
  // Načrtovan = green (like on Termini page)
  return { label: 'Načrtovan', bgClass: 'bg-gradient-to-r from-green-50 to-emerald-50', textClass: 'text-green-700', dotClass: 'bg-green-500' };
}

// Copy button component
function CopyButton({ text }: { text: string }) {
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
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#1A1F36]"
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-500" weight="bold" />
      ) : (
        <Copy className="h-4 w-4" weight="regular" />
      )}
    </motion.button>
  );
}

// Gradient icon wrapper for action buttons
function GradientIconButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <motion.a
      href={href}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md"
    >
      {children}
    </motion.a>
  );
}

function ClientDetailsPanel({
  isOpen,
  onClose,
  client,
  companyId,
  onEdit,
  onDelete,
  onNewAppointment,
}: ClientDetailsPanelProps) {
  const [clientData, setClientData] = useState<ClientWithAppointments | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load client details with appointments
  useEffect(() => {
    if (isOpen && client) {
      setIsLoading(true);
      getClientWithAppointments(companyId, client.id)
        .then((result) => {
          if (result.data) {
            setClientData(result.data);
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      setClientData(null);
    }
  }, [isOpen, client, companyId]);

  // Calculate stats
  const stats = clientData ? {
    total: clientData.appointments.length,
    noShow: clientData.appointments.filter(a =>
      a.status.toLowerCase() === 'no_show' ||
      a.status.toLowerCase().includes('no_show') ||
      a.status.toLowerCase().includes('ni_prisel') ||
      a.status.toLowerCase() === 'ni prišel'
    ).length,
    cancelled: clientData.appointments.filter(a =>
      a.status.toLowerCase().includes('cancel') ||
      a.status.toLowerCase().includes('odpoved')
    ).length,
  } : { total: 0, noShow: 0, cancelled: 0 };

  // Animation variants
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const panelVariants = {
    hidden: { opacity: 0, x: '100%' },
    visible: {
      opacity: 1,
      x: 0,
      transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
    },
    exit: { opacity: 0, x: '100%' },
  };

  if (!client) return null;

  const detailsClient = clientData ?? client;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative h-full w-full max-w-lg overflow-y-auto bg-gray-50 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - NO INITIALS, JUST NAME */}
            <div className="sticky top-0 z-10 bg-gradient-to-r from-violet-500 to-cyan-500 p-8">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">
                    {client.ime} {client.priimek}
                  </h2>
                  {/* Date added - from created_at */}
                  <div className="text-white/90 text-sm">
                    Dodano: {formatDate(client.created_at || '')}
                  </div>
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

              {/* Quick actions */}
              <div className="mt-4 flex items-center gap-2">
                <motion.button
                  type="button"
                  onClick={() => onEdit(client)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-sm font-medium text-white
                             transition-colors hover:bg-white/30"
                >
                  <PencilSimple className="h-4 w-4" weight="bold" />
                  Uredi
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => onDelete(client)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-sm font-medium text-white
                             transition-colors hover:bg-white/30"
                >
                  <Trash className="h-4 w-4" weight="bold" />
                  Izbriši
                </motion.button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Contact info */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Kontaktni podatki
                </h3>

                {/* Email */}
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Envelope
                        className="h-5 w-5 text-[#1A1F36]"
                        weight="regular"
                      />
                      <div className="flex-1">
                        <div className="text-xs text-gray-500">Email</div>
                        <div className="text-sm font-medium text-gray-900">{client.email || '-'}</div>
                      </div>
                    </div>
                    {client.email && (
                      <div className="flex items-center gap-2">
                        <CopyButton text={client.email} />
                        <GradientIconButton href={`mailto:${client.email}`}>
                          <Envelope className="h-4 w-4 text-gray-600" weight="regular" />
                        </GradientIconButton>
                      </div>
                    )}
                  </div>
                </div>

                {/* Phone */}
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Phone
                        className="h-5 w-5 text-[#1A1F36]"
                        weight="regular"
                      />
                      <div className="flex-1">
                        <div className="text-xs text-gray-500">Telefon</div>
                        <div className="text-sm font-medium text-gray-900">{client.telefon || '-'}</div>
                      </div>
                    </div>
                    {client.telefon && (
                      <div className="flex items-center gap-2">
                        <CopyButton text={client.telefon} />
                        <GradientIconButton href={`tel:${client.telefon}`}>
                          <Phone className="h-4 w-4 text-gray-600" weight="regular" />
                        </GradientIconButton>
                      </div>
                    )}
                  </div>
                </div>

                {/* Gender */}
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <GenderIntersex
                      className="h-5 w-5 text-[#1A1F36]"
                      weight="regular"
                    />
                    <div>
                      <div className="text-xs text-gray-500">Spol</div>
                      <div className="text-sm font-medium text-gray-900">
                        {client.spol === 'ženska' ? 'Ženska' :
                         client.spol === 'drugo' ? 'Drugo' :
                         client.spol ? 'Moški' : 'Ni navedeno'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes - Check multiple column name variations */}
                {(() => {
                  const clientRecord = detailsClient as unknown as Record<string, unknown>;
                  const normalizeValue = (value: unknown) => {
                    if (typeof value === 'string') return value;
                    if (value === null || value === undefined) return '';
                    return String(value);
                  };
                  const opombe = normalizeValue(
                    clientRecord['Opombe stranke']
                    ?? clientRecord['opombe']
                    ?? detailsClient.opombe
                    ?? ''
                  );
                  const interneOpombe = normalizeValue(
                    clientRecord['Interne opombe']
                    ?? clientRecord['interne_opombe']
                    ?? detailsClient.interne_opombe
                    ?? ''
                  );
                  const opombeText = opombe.trim();
                  const interneOpombeText = interneOpombe.trim();

                  return (
                    <>
                      {/* Regular Notes - always show */}
                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="flex items-center gap-3">
                          <PencilSimple className="h-5 w-5 text-[#1A1F36] flex-shrink-0" weight="regular" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-gray-500">Opombe</div>
                            <p className="text-sm text-[#1A1F36] whitespace-pre-wrap mt-1">{opombeText || '-'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Internal Notes - always show */}
                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="flex items-center gap-3">
                          <LockKey className="h-5 w-5 text-[#1A1F36] flex-shrink-0" weight="regular" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-gray-500">Interne opombe</div>
                            <p className="text-sm text-[#1A1F36] whitespace-pre-wrap mt-1">{interneOpombeText || '-'}</p>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Statistics - white boxes with gradient text */}
              <div className="mt-8">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Statistika
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {/* Skupaj */}
                  <div className="rounded-xl bg-white border border-gray-100 p-4 text-center shadow-sm">
                    <p className="text-2xl text-[#1A1F36]">{stats.total}</p>
                    <p className="text-xs text-[#1A1F36]">Skupaj</p>
                  </div>
                  {/* Ni prišel */}
                  <div className="rounded-xl bg-white border border-gray-100 p-4 text-center shadow-sm">
                    <p className="text-2xl text-[#1A1F36]">{stats.noShow}</p>
                    <p className="text-xs text-[#1A1F36]">Ni prišel</p>
                  </div>
                  {/* Odpovedanih */}
                  <div className="rounded-xl bg-white border border-gray-100 p-4 text-center shadow-sm">
                    <p className="text-2xl text-[#1A1F36]">{stats.cancelled}</p>
                    <p className="text-xs text-[#1A1F36]">Odpovedanih</p>
                  </div>
                </div>
              </div>

              {/* Appointments history */}
              <div className="mt-8">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Zgodovina terminov
                  </h3>
                  {onNewAppointment && (
                    <motion.button
                      type="button"
                      onClick={() => onNewAppointment(client)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-3 py-1.5
                                 text-xs font-medium text-white shadow-sm transition-all hover:shadow-md"
                    >
                      <Plus className="h-3 w-3" weight="bold" />
                      Nov termin
                    </motion.button>
                  )}
                </div>

                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse rounded-xl bg-gray-100 p-4">
                        <div className="h-4 w-32 rounded bg-gray-200" />
                        <div className="mt-2 h-3 w-48 rounded bg-gray-200" />
                      </div>
                    ))}
                  </div>
                ) : clientData?.appointments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl bg-gray-50 py-8">
                    <CalendarBlank className="h-10 w-10 text-gray-300" weight="duotone" />
                    <p className="mt-2 text-sm text-gray-500">Ni terminov</p>
                    {onNewAppointment && (
                      <motion.button
                        type="button"
                        onClick={() => onNewAppointment(client)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="mt-3 flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700"
                      >
                        Dodaj prvi termin
                        <ArrowRight className="h-4 w-4" weight="bold" />
                      </motion.button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[...clientData?.appointments ?? []].sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime()).slice(0, 10).map((apt, index) => {
                      const statusConfig = getStatusConfig(apt.status);
                      const appointmentNotes = (apt.opombe ?? '').toString().trim();
                      const appointmentInternalNotes = (apt.interne_opombe ?? '').toString().trim();
                      const appointmentCompletionNotes = (apt.opombe_po_zakljucku ?? '').toString().trim();
                      const finalPriceValue = apt.koncna_cena;
                      const hasFinalPrice = finalPriceValue !== null && finalPriceValue !== undefined
                        && String(finalPriceValue).trim() !== '';
                      const finalPriceLabel = hasFinalPrice
                        ? String(finalPriceValue)
                        : '';
                      const valuta = apt.valuta || 'EUR';

                      return (
                        <motion.div
                          key={apt.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="rounded-xl border border-gray-100 bg-white p-4 transition-shadow hover:shadow-md"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              {/* Service color circle */}
                              <div
                                className="h-3 w-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: apt.storitev_barva }}
                              />
                              <div>
                                <p className="font-medium text-[#1A1F36]">
                                  {apt.storitev_naziv || 'Storitev'}
                                </p>
                                <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <CalendarBlank className="h-3.5 w-3.5" weight="regular" />
                                    {formatDate(apt.datum)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" weight="regular" />
                                    {formatTime(apt.cas_zacetek)}
                                  </span>
                                  {apt.zaposleni_ime && (
                                    <span className="flex items-center gap-1">
                                      <User className="h-3.5 w-3.5" weight="regular" />
                                      {apt.zaposleni_ime}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {/* Status badge - matching Termini page */}
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig.bgClass} ${statusConfig.textClass}`}
                            >
                              <span className={`h-2 w-2 rounded-full ${statusConfig.dotClass}`} />
                              {statusConfig.label}
                            </span>
                          </div>
                          {(appointmentNotes || appointmentInternalNotes || appointmentCompletionNotes || hasFinalPrice) && (
                            <div className="mt-3 space-y-2">
                              {appointmentNotes && (
                                <div className="rounded-lg bg-gray-50 p-3">
                                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                                    <NotePencil className="h-3 w-3" weight="fill" />
                                    Opombe
                                  </div>
                                  <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                                    {appointmentNotes}
                                  </p>
                                </div>
                              )}
                              {appointmentInternalNotes && (
                                <div className="rounded-lg bg-gray-50 p-3">
                                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
                                    <LockSimple className="h-3 w-3 text-yellow-600" weight="fill" />
                                    <span
                                      style={{
                                        background: 'linear-gradient(135deg, #EAB308, #F97316)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        backgroundClip: 'text',
                                      }}
                                    >
                                      Interne opombe
                                    </span>
                                  </div>
                                  <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                                    {appointmentInternalNotes}
                                  </p>
                                </div>
                              )}
                              {appointmentCompletionNotes && (
                                <div className="rounded-lg bg-blue-50 p-3">
                                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                                    <CheckCircle className="h-3 w-3" weight="fill" />
                                    Opombe po zaključku
                                  </div>
                                  <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                                    {appointmentCompletionNotes}
                                  </p>
                                </div>
                              )}
                              {hasFinalPrice && (
                                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                                  <span className="font-semibold uppercase tracking-wider">Končna cena</span>
                                  <span
                                    className="text-sm font-semibold"
                                    style={{
                                      background: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)',
                                      WebkitBackgroundClip: 'text',
                                      WebkitTextFillColor: 'transparent',
                                      backgroundClip: 'text',
                                    }}
                                  >
                                    {finalPriceLabel} {valuta}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                    {clientData && clientData.appointments.length > 10 && (
                      <p className="text-center text-xs text-gray-500">
                        Prikazanih je zadnjih 10 terminov od {clientData.appointments.length}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(ClientDetailsPanel);
