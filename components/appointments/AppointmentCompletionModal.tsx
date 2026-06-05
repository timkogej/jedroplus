'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  CheckCircle,
  SpinnerGap,
  CalendarBlank,
  Clock,
  User,
  Scissors,
} from '@phosphor-icons/react';
import type { AppointmentWithDetails } from '@/types/appointments';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { callN8nAction } from '@/src/lib/n8nClient';
import { getPodatkiPodjetja } from '@/lib/webhookPayloadBuilders';
import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';
import { supabase } from '@/lib/supabaseClient';
import { getCompanyColumnForTable } from '@/lib/companyScope';
import { useRolePermissions } from '@/app/role-permission-context';
import { logZgodovina } from '@/lib/supabase/zgodovina';

interface AppointmentCompletionModalProps {
  appointment: AppointmentWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

// Format date for display
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('sl-SI', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
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

export default function AppointmentCompletionModal({
  appointment,
  isOpen,
  onClose,
  onComplete,
}: AppointmentCompletionModalProps) {
  const { companyId, companySettings } = useCompany();
  const { user } = useAuth();
  const { role } = useRolePermissions();
  const [completionNotes, setCompletionNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actor = user?.email ?? 'unknown';
  const companyPayload = getPodatkiPodjetja(companySettings ?? undefined);

  const handleComplete = useCallback(async () => {
    if (!appointment || !companyId) return;

    setSaving(true);
    setError(null);

    try {
      // Build the payload for the webhook
      const payload = {
        event: 'ZAKLJUCITEV_TERMINA',
        entity: 'appointments',
        company_id: companyId,
        actor,
        timestamp: new Date().toISOString(),
        meta: { app: 'Integrate' as const, version: '1.0' as const },
        data: {
          company_id: companyId,
          user_id: actor,
          podatkiPodjetja: companyPayload,
          termin: {
            id: appointment.id,
            unique_id: (appointment as unknown as Record<string, unknown>).unique_id || appointment.id,
            datum: appointment.datum,
            cas_zacetek: appointment.cas_zacetek,
            cas_konec: appointment.cas_konec,
            status: 'Zaključen',
            completion_notes: completionNotes || null,
            completed_at: new Date().toISOString(),
          },
          stranka: {
            id: appointment.stranka_id,
            ime: appointment.stranka_ime,
            email: appointment.stranka_email,
            telefon: appointment.stranka_telefon,
            spol: (appointment as unknown as Record<string, unknown>).stranka_spol,
          },
          storitev: {
            id: appointment.storitev?.id,
            naziv: appointment.storitev?.naziv,
            barva: appointment.storitev?.barva,
            cena: (appointment.storitev as unknown as Record<string, unknown>)?.cena,
          },
          zaposleni: appointment.zaposleni ? {
            id: appointment.zaposleni.id,
            ime: appointment.zaposleni.ime,
            priimek: appointment.zaposleni.priimek,
          } : null,
          opombe_po_zakljucku: completionNotes || null,
        },
      };

      const result = await callN8nAction(payload);

      if (!result.ok) {
        throw new Error('Prišlo je do napake pri zaključevanju termina.');
      }

      // Log zakljucen action for all completions
      if (companyId && appointment.id) {
        logZgodovina({
          idPodjetja: companyId,
          tipEntitete: 'termin',
          idEntitete: appointment.id,
          akcija: 'zakljucen',
          izvedel: actor,
          izvedel_tip: (role as 'owner' | 'admin' | 'staff') ?? 'staff',
          idTermina: appointment.id,
          idStranke: appointment.stranka_id,
        }).catch(() => {/* ignore logging errors */});
      }

      // Ghost termin: soft-delete after completion
      if (appointment.belezi_termin === false && companyId) {
        try {
          await supabase
            .from('Termini')
            .update({ deleted_at: new Date().toISOString() })
            .eq('ID termina', appointment.id)
            .eq('ID podjetja', companyId);

          logZgodovina({
            idPodjetja: companyId,
            tipEntitete: 'termin',
            idEntitete: appointment.id,
            akcija: 'izbrisan',
            izvedel: actor,
            izvedel_tip: (role as 'owner' | 'admin' | 'staff') ?? 'staff',
            idTermina: appointment.id,
            idStranke: appointment.stranka_id,
          }).catch(() => {/* ignore logging errors */});
        } catch {
          // Non-fatal: ghost deletion error should not block the completion flow
        }
      }

      // Wait for Supabase propagation
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Reset form and close
      setCompletionNotes('');
      onComplete();
      onClose();
    } catch (err) {
      setError('Prišlo je do napake pri zaključevanju termina.');
    } finally {
      setSaving(false);
    }
  }, [appointment, companyId, actor, companyPayload, completionNotes, role, onComplete, onClose]);

  const handleClose = useCallback(() => {
    if (!saving) {
      setCompletionNotes('');
      setError(null);
      onClose();
    }
  }, [saving, onClose]);

  if (!appointment) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <CheckCircle className="h-7 w-7 text-white" weight="fill" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Zaključi termin
                    </h2>
                    <p className="text-sm text-white/80">
                      {appointment.stranka_ime || 'Neznana stranka'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={saving}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="h-5 w-5" weight="bold" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Appointment details */}
              <div className="p-4 bg-gray-50 rounded-xl space-y-3 text-sm">
                {/* Datum */}
                <div className="flex items-center gap-3">
                  <CalendarBlank className="h-4 w-4 text-gray-400 flex-shrink-0" weight="regular" />
                  <span className="text-gray-500 w-20 flex-shrink-0">Datum</span>
                  <span className="font-medium text-gray-900">{formatDate(appointment.datum)}</span>
                </div>
                {/* Čas */}
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" weight="regular" />
                  <span className="text-gray-500 w-20 flex-shrink-0">Čas</span>
                  <span className="font-medium text-gray-900">
                    {formatTime(appointment.cas_zacetek)}
                    {appointment.cas_konec && ` – ${formatTime(appointment.cas_konec)}`}
                  </span>
                </div>
                {/* Storitev */}
                <div className="flex items-start gap-3">
                  <Scissors className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" weight="regular" />
                  <span className="text-gray-500 w-20 flex-shrink-0 mt-0.5">Storitev</span>
                  <div className="flex flex-col items-end space-y-1.5">
                    {appointment.storitev && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 leading-none">{appointment.storitev.naziv}</span>
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: appointment.storitev.barva || '#6366F1' }} />
                      </div>
                    )}
                    {appointment.storitev_2 && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 leading-none">{appointment.storitev_2.naziv}</span>
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: appointment.storitev_2.barva || '#6366F1' }} />
                      </div>
                    )}
                    {appointment.storitev_3 && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 leading-none">{appointment.storitev_3.naziv}</span>
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: appointment.storitev_3.barva || '#6366F1' }} />
                      </div>
                    )}
                    {!appointment.storitev && <span className="font-medium text-gray-900">-</span>}
                  </div>
                </div>
                {/* Zaposleni */}
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-gray-400 flex-shrink-0" weight="regular" />
                  <span className="text-gray-500 w-20 flex-shrink-0">Zaposleni</span>
                  <span className="font-medium text-gray-900">
                    {appointment.zaposleni
                      ? `${appointment.zaposleni.ime} ${appointment.zaposleni.priimek}`
                      : '-'}
                  </span>
                </div>
              </div>

              {/* Completion Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Opombe po zaključku
                </label>
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Dodajte opombe o zaključenem terminu (opcijsko)..."
                  rows={4}
                  disabled={saving}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm
                             text-gray-900 placeholder-gray-400 focus:outline-none
                             focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500
                             disabled:bg-gray-50 disabled:cursor-not-allowed resize-none"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Te opombe bodo shranjene in poslane v sistem za nadaljnjo obdelavo.
                </p>
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={saving}
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5
                           text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prekliči
              </button>
              <motion.button
                type="button"
                onClick={handleComplete}
                disabled={saving}
                whileHover={{ scale: saving ? 1 : 1.02 }}
                whileTap={{ scale: saving ? 1 : 0.98 }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl
                           bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2.5
                           text-sm font-medium text-white transition-all hover:shadow-lg
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                    Zaključujem...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" weight="bold" />
                    Označi kot zaključen
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
