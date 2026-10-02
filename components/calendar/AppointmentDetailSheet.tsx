'use client';

/**
 * Podrobnosti termina — Applov list.
 *
 * Na telefonu prileti od spodaj, na namizju je sredinska plošča. Prej je ta
 * komponenta živela znotraj Calendar.tsx; izločena je zato, ker jo poleg
 * koledarja potrebujejo tudi drugi zasloni, datoteka koledarja pa je bila
 * predolga.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Copy,
  Check,
  CaretRight,
  CheckCircle,
  NotePencil,
  DotsThreeVertical,
  WarningCircle,
  XCircle,
  Trash,
  Clock,
  Plus,
  Tag,
  EyeSlash,
} from '@phosphor-icons/react';
import { useTranslations, useLocale } from 'next-intl';
import type { AppointmentWithDetails, Storitev } from '@/types/appointments';
import type { Resurs } from '@/types/resursi';
import CommunicationLanguageFlag from '@/components/shared/CommunicationLanguageFlag';
import { useFormat } from '@/hooks/useFormat';
import { initialsStyle } from '@/components/dashboard/initialsStyle';
import {
  Sheet,
  SheetHeader,
  SheetBody,
  SheetGroup,
  SheetRow,
  SheetFooter,
} from '@/components/ui/sheet';

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


// ─── Podrobnosti termina ─────────────────────────────────────────────────────
// Na telefonu list od spodaj, na namizju sredinska plošča. Skupine z vrsticami
// oznaka/vrednost — vzorec iz iOS in macOS Nastavitev.
//
// Vse akcije in polja prejšnje različice so ohranjeni: zaključi, uredi, ni
// prišel, odpovej, izbriši, odpiranje kartice stranke, kopiranje e-pošte in
// telefona, resursi, cene s popusti in dodatna storitev.

/** Iz barve storitve (lahko je preliv) potegne eno polno barvo za piko. */
function solidServiceColor(value?: string | null): string {
  if (!value) return '#6366F1';
  if (value.includes('gradient')) {
    const m = value.match(/#[0-9A-Fa-f]{6}/g);
    return m?.[0] ?? '#6366F1';
  }
  return value;
}

export function AppointmentDetailModal({
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
  /** Neobvezno: kjer resursi niso naloženi, se skupina preprosto ne pokaže. */
  terminResursiMap?: Map<number, Set<number>>;
  activeResursi?: Resurs[];
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
  const { money } = useFormat();
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);

  const aptResursi = useMemo(() => {
    if (!activeResursi || !terminResursiMap) return [];
    const aptId = Number(appointment.id);
    return activeResursi.filter((r) =>
      terminResursiMap.get(r.row_id)?.has(aptId)
    );
  }, [appointment.id, activeResursi, terminResursiMap]);

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

  // Ploskovni odtenki namesto nasičenih ploščic — barva je namig, ne poudarek.
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-emerald-50 text-emerald-700';
      case 'confirmed': return 'bg-blue-50 text-blue-700';
      case 'completed': return 'bg-gray-100 text-gray-600';
      case 'cancelled': return 'bg-red-50 text-red-600';
      case 'pending': return 'bg-amber-50 text-amber-700';
      case 'no_show': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const isTerminated = ['completed', 'zaključen', 'Zaključen', 'cancelled', 'Odpovedan', 'no_show', 'Ni prišel'].includes(String(appointment.status));

  // Če storitve ni v seznamu (npr. medtem izbrisana), uporabi podatke, ki jih
  // ima termin sam — sicer bi druga ali tretja storitev tiho izginila.
  const service2 = appointment.storitev_id_2
    ? services.find(s => s.id === appointment.storitev_id_2) ?? appointment.storitev_2 ?? null
    : null;
  const service3 = appointment.storitev_id_3
    ? services.find(s => s.id === appointment.storitev_id_3) ?? appointment.storitev_3 ?? null
    : null;
  const addOnService = appointment.add_on_storitev_id
    ? services.find(s => s.id === appointment.add_on_storitev_id) || appointment.add_on_storitev || null
    : appointment.add_on_storitev || null;
  const addOnName = appointment.add_on_naziv?.trim();
  const addOnDuration = appointment.add_on_trajanje ?? addOnService?.trajanje ?? 0;

  const duration = (() => {
    if (!appointment.cas_zacetek || !appointment.cas_konec) return null;
    try {
      const [sh, sm] = appointment.cas_zacetek.split(':').map(Number);
      const [eh, em] = appointment.cas_konec.split(':').map(Number);
      return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
    } catch { return appointment.storitev?.trajanje || 0; }
  })();

  const internalNotes = appointment.interne_opombe
    || ((appointment as unknown as Record<string, unknown>)['Interne opombe'] as string)
    || '';

  const clientInitials = (() => {
    const p = (appointment.stranka_ime || '').trim().split(/\s+/).filter(Boolean);
    return p.length >= 2 ? `${p[0][0]}${p[1][0]}`.toUpperCase() : (p[0] || '?').substring(0, 2).toUpperCase();
  })();

  // ── Cene ─────────────────────────────────────────────────────────────────
  const originalCena = appointment.cena ?? 0;
  const popustVrednost = appointment.popust ?? 0;
  const finalCena = appointment.koncna_cena ?? originalCena;
  const popustTip = appointment.popust_tip ?? '€';
  const isPercent = (tip?: string | null) => tip === 'percent' || tip === '%';
  // Cene v valuti termina (prej je bila povsod na trdo evro).
  const price = (val: number) => money(val, { currency: appointment.valuta });
  const imaPopust = popustVrednost > 0;
  const hasAddOnPrice = !!(appointment.add_on_naziv && appointment.add_on_final_cena);
  const showPrices = !(originalCena === 0 && !imaPopust && !hasAddOnPrice);

  const promotionGradient = 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)';
  const promoBadge = (() => {
    if (appointment.promocija_tip === 'happy_hour') return { label: appointment.promocija_naziv || 'Happy Hour', Icon: Clock };
    if (appointment.promocija_tip === 'add_on') return { label: appointment.promocija_naziv || 'Add-on', Icon: Plus };
    if (imaPopust) return { label: appointment.promocija_naziv ?? 'Popust', Icon: Tag };
    return null;
  })();


  const serviceRow = (name: string, color?: string | null, mins?: number, extraBadge?: boolean) => (
    <SheetRow key={`${name}-${color ?? ''}`} label={name}>
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: solidServiceColor(color) }} />
        <span className="truncate text-sm font-medium text-gray-900">{name}</span>
        {extraBadge && (
          <span className="flex-shrink-0 rounded-full bg-gray-100 px-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
            {t('calendarView.detailModal.fields.additionalService')}
          </span>
        )}
      </span>
      {mins && mins > 0 ? (
        <span className="tnum flex-shrink-0 text-sm text-gray-500">{mins} min</span>
      ) : null}
    </SheetRow>
  );

  return (
    <Sheet onClose={onClose}>
      <SheetHeader
        title={appointment.stranka_ime || t('calendarView.detailModal.fields.unknownClient')}
        subtitle={formatModalDate(appointment.datum)}
        accent={solidServiceColor(appointment.storitev?.barva)}
        onClose={onClose}
        closeLabel={t('calendarView.appointmentModal.actions.close')}
        badge={
          <>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(appointment.status || 'scheduled')}`}>
              {getStatusLabel(appointment.status || 'scheduled')}
            </span>
            <CommunicationLanguageFlag value={appointment.language} />
          </>
        }
      />

      <SheetBody>
        {/* Kdaj — datum stoji že v glavi, zato skupina nima oznake */}
        <SheetGroup>
          <SheetRow
            label={t('calendarView.detailModal.fields.time')}
            value={
              <span className="tnum">
                {formatTimeStr(appointment.cas_zacetek)} – {formatTimeStr(appointment.cas_konec)}
              </span>
            }
          />
          {duration !== null && (
            <SheetRow
              label={t('calendarView.detailModal.fields.duration')}
              value={<span className="tnum">{duration} min</span>}
            />
          )}
        </SheetGroup>

        {/* Storitve */}
        {appointment.storitev && (
          <SheetGroup label={t('modal.fields.service')}>
            {serviceRow(appointment.storitev.naziv, appointment.storitev.barva, appointment.storitev.trajanje)}
            {service2 && serviceRow(service2.naziv, service2.barva, service2.trajanje)}
            {service3 && serviceRow(service3.naziv, service3.barva, service3.trajanje)}
            {addOnName && serviceRow(addOnName, addOnService?.barva, addOnDuration, true)}
          </SheetGroup>
        )}

        {/* Zaposleni */}
        {appointment.zaposleni && (
          <SheetGroup label={t('calendarView.rescheduleDialog.employee')}>
            <SheetRow label={appointment.zaposleni.ime}>
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex-shrink-0 text-lg font-bold" style={initialsStyle(appointment.zaposleni.barva)}>
                  {appointment.zaposleni.initials}
                </span>
                <span className="truncate text-sm font-medium text-gray-900">
                  {appointment.zaposleni.ime} {appointment.zaposleni.priimek}
                </span>
              </span>
            </SheetRow>
          </SheetGroup>
        )}

        {/* Stranka — ime odpre kartico stranke, kontakta sta klicljiva */}
        <SheetGroup label={t('modal.fields.client')}>
          {appointment.stranka_id && onOpenClientDetails ? (
            <SheetRow
              label={appointment.stranka_ime || '-'}
              onClick={() => { void onOpenClientDetails(appointment); }}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex-shrink-0 text-lg font-bold" style={initialsStyle()}>
                  {clientInitials}
                </span>
                <span className="truncate text-sm font-medium text-gray-900">
                  {appointment.stranka_ime || '-'}
                </span>
              </span>
              <CaretRight className="h-3.5 w-3.5 flex-shrink-0 text-gray-300" weight="bold" />
            </SheetRow>
          ) : (
            <SheetRow label={appointment.stranka_ime || '-'}>
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex-shrink-0 text-lg font-bold" style={initialsStyle()}>
                  {clientInitials}
                </span>
                <span className="truncate text-sm font-medium text-gray-900">
                  {appointment.stranka_ime || '-'}
                </span>
              </span>
            </SheetRow>
          )}

          {appointment.stranka_email && (
            <SheetRow label="Email">
              <span className="flex-shrink-0 text-sm text-gray-500">Email</span>
              <span className="flex min-w-0 items-center gap-1">
                <a
                  href={`mailto:${appointment.stranka_email}`}
                  className="truncate text-sm font-medium text-[#6D5EF7] hover:opacity-70"
                >
                  {appointment.stranka_email}
                </a>
                <CopyButton text={appointment.stranka_email} label="email" />
              </span>
            </SheetRow>
          )}

          {appointment.stranka_telefon && (
            <SheetRow label={t('modal.fields.phone')}>
              <span className="flex-shrink-0 text-sm text-gray-500">{t('modal.fields.phone')}</span>
              <span className="flex min-w-0 items-center gap-1">
                <a
                  href={`tel:${appointment.stranka_telefon}`}
                  className="tnum truncate text-sm font-medium text-[#6D5EF7] hover:opacity-70"
                >
                  {appointment.stranka_telefon}
                </a>
                <CopyButton text={appointment.stranka_telefon} label="telefon" />
              </span>
            </SheetRow>
          )}
        </SheetGroup>

        {/* Cena */}
        {showPrices && (
          <>
            {promoBadge && (
              <div
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                style={{ background: promotionGradient }}
              >
                <promoBadge.Icon size={11} />
                <span>{promoBadge.label}</span>
              </div>
            )}

            <SheetGroup label={t('calendarView.detailModal.fields.price')}>
              {imaPopust ? (
                <>
                  <SheetRow
                    label={t('calendarView.detailModal.fields.originalPrice')}
                    value={<span className="tnum text-gray-400 line-through">{price(originalCena)}</span>}
                  />
                  <SheetRow
                    label={t('calendarView.detailModal.fields.discount')}
                    value={
                      <span className="tnum text-red-500">
                        − {isPercent(popustTip) ? `${popustVrednost}%` : price(popustVrednost)}
                      </span>
                    }
                  />
                  <SheetRow label={t('calendarView.detailModal.fields.priceWithDiscount')}>
                    <span className="flex-shrink-0 text-sm font-medium text-gray-900">
                      {t('calendarView.detailModal.fields.priceWithDiscount')}
                    </span>
                    <span className="tnum text-base font-semibold text-gray-900">{price(finalCena)}</span>
                  </SheetRow>
                </>
              ) : originalCena > 0 ? (
                <SheetRow
                  label={t('calendarView.detailModal.fields.price')}
                  value={<span className="tnum font-semibold">{price(originalCena)}</span>}
                />
              ) : null}
            </SheetGroup>

            {/* Dodatna storitev s svojo ceno */}
            {appointment.add_on_naziv && (appointment.add_on_final_cena || appointment.promocija_tip === 'add_on') && (
              <SheetGroup label={t('calendarView.detailModal.fields.additionalService')}>
                <SheetRow
                  label={t('modal.fields.service')}
                  value={<span className="font-medium">{appointment.add_on_naziv}</span>}
                />
                {appointment.add_on_final_cena && (
                  <>
                    <SheetRow
                      label={t('calendarView.detailModal.fields.discount')}
                      value={
                        <span className="tnum text-red-500">
                          − {isPercent(appointment.add_on_popust_tip)
                            ? `${appointment.add_on_popust}%`
                            : price(parseFloat(appointment.add_on_popust ?? '0'))}
                        </span>
                      }
                    />
                    <SheetRow
                      label={t('calendarView.detailModal.fields.priceWithDiscount')}
                      value={
                        <span className="tnum font-semibold text-emerald-600">
                          {price(parseFloat(appointment.add_on_final_cena))}
                        </span>
                      }
                    />
                  </>
                )}
              </SheetGroup>
            )}
          </>
        )}

        {/* Resursi */}
        {aptResursi.length > 0 && (
          <SheetGroup label={t('calendarView.detailModal.fields.resources')}>
            <SheetRow label={t('calendarView.detailModal.fields.resources')}>
              <div className="flex flex-wrap gap-1.5">
                {aptResursi.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-700"
                  >
                    <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: r.barva }} />
                    {r.naziv}
                  </span>
                ))}
              </div>
            </SheetRow>
          </SheetGroup>
        )}

        {/* Opombe */}
        {appointment.opombe && (
          <SheetGroup label={t('modal.fields.notes')}>
            <SheetRow label={t('modal.fields.notes')}>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{appointment.opombe}</p>
            </SheetRow>
          </SheetGroup>
        )}

        {internalNotes && (
          <SheetGroup label={t('modal.fields.internalNotes')}>
            <SheetRow label={t('modal.fields.internalNotes')}>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{internalNotes}</p>
            </SheetRow>
          </SheetGroup>
        )}

        {/* Podrobnosti — ID termina in ali se termin beleži */}
        {(appointment.id_termina || appointment.belezi_termin === false) && (
          <SheetGroup label={t('calendarView.detailModal.fields.details')}>
            {appointment.belezi_termin === false && (
              <SheetRow label={t('ghost.title')}>
                <span className="flex min-w-0 items-center gap-2.5">
                  <EyeSlash className="h-4 w-4 flex-shrink-0 text-gray-400" weight="regular" />
                  <span className="text-sm text-gray-700">{t('ghost.badge')}</span>
                </span>
              </SheetRow>
            )}
            {appointment.id_termina && (
              <SheetRow
                label={t('calendarView.detailModal.fields.appointmentId')}
                value={<span className="tnum font-mono text-[13px] text-gray-500">{appointment.id_termina}</span>}
              />
            )}
          </SheetGroup>
        )}
      </SheetBody>

      <SheetFooter>
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(appointment)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80"
          >
            <NotePencil className="h-4 w-4" weight="regular" />
            {t('calendarView.eventModal.actions.edit')}
          </button>
        )}

        {!isTerminated && onComplete && (
          <button
            type="button"
            onClick={() => onComplete(appointment)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100"
          >
            <CheckCircle className="h-4 w-4 text-gray-500" weight="regular" />
            {t('calendarView.detailModal.actions.complete')}
          </button>
        )}

        {(onNoShow || onCancel || onDelete) && (
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setActionsMenuOpen(!actionsMenuOpen)}
              aria-label={t('calendarView.detailModal.actions.moreOptions')}
              title={t('calendarView.detailModal.actions.moreOptions')}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 active:bg-gray-100"
            >
              <DotsThreeVertical className="h-5 w-5" weight="bold" />
            </button>

            <AnimatePresence>
              {actionsMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 4 }}
                  transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
                  style={{ transformOrigin: 'bottom right' }}
                  className="absolute bottom-full right-0 z-50 mb-1.5 w-44 overflow-hidden rounded-xl border border-gray-100 bg-white/90 py-1 shadow-lg backdrop-blur-xl backdrop-saturate-150"
                >
                  {onNoShow && (
                    <button
                      type="button"
                      onClick={() => { onNoShow(appointment); setActionsMenuOpen(false); }}
                      className="mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100"
                    >
                      <WarningCircle className="h-4 w-4 text-gray-500" weight="regular" />
                      {t('calendarView.detailModal.actions.noShow')}
                    </button>
                  )}
                  {onCancel && (
                    <button
                      type="button"
                      onClick={() => { onCancel(appointment); setActionsMenuOpen(false); }}
                      className="mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100"
                    >
                      <XCircle className="h-4 w-4 text-gray-500" weight="regular" />
                      {t('calendarView.detailModal.actions.cancel')}
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => { onDelete(appointment); setActionsMenuOpen(false); }}
                      className="mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50"
                    >
                      <Trash className="h-4 w-4" weight="regular" />
                      {t('calendarView.eventModal.actions.delete')}
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </SheetFooter>
    </Sheet>
  );
}
