'use client';

import { useState, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Trash,
  PencilSimple,
  SpinnerGap,
  CalendarBlank,
  Clock,
  TextAlignLeft,
  FloppyDisk,
  Warning,
} from '@phosphor-icons/react';
import { Select, SelectOption } from '@/components/ui/animated-select';
import type { Absence } from '@/lib/supabase/appointments';
import type { Zaposleni } from '@/types/appointments';
import { useTranslations } from 'next-intl';

interface AbsenceDetailModalProps {
  isOpen: boolean;
  absence: Absence | null;
  employees: (Zaposleni & { initials: string })[];
  onClose: () => void;
  onDelete: (absence: Absence) => Promise<void>;
  onEdit: (absence: Absence, data: AbsenceEditData) => Promise<void>;
  isDeleting?: boolean;
  isSaving?: boolean;
}

export interface AbsenceEditData {
  employee_ids: string[];
  all_employees: boolean;
  date_from: string;
  date_to: string;
  single_day: boolean;
  time_from?: string;
  time_to?: string;
  reason?: string;
}

function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let hour = 6; hour <= 22; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      options.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

function formatAbsenceDate(isoStr: string): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatAbsenceTime(isoStr: string): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function isAllDay(absence: Absence): boolean {
  const start = new Date(absence.start_at);
  const end = new Date(absence.end_at);
  // All-day if starts at midnight and ends at 23:59 (or next-day midnight)
  return (start.getHours() === 0 && start.getMinutes() === 0 && end.getHours() >= 23);
}

function AbsenceDetailModal({
  isOpen,
  absence,
  employees,
  onClose,
  onDelete,
  onEdit,
  isDeleting = false,
  isSaving = false,
}: AbsenceDetailModalProps) {
  const t = useTranslations('appointments');

  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Edit form state
  const [editReason, setEditReason] = useState('');
  const [editDateFrom, setEditDateFrom] = useState('');
  const [editDateTo, setEditDateTo] = useState('');
  const [editTimeFrom, setEditTimeFrom] = useState('08:00');
  const [editTimeTo, setEditTimeTo] = useState('17:00');
  const [editSingleDay, setEditSingleDay] = useState(true);
  const [editErrors, setEditErrors] = useState<string[]>([]);

  // Reset when absence changes or modal opens
  useEffect(() => {
    if (isOpen && absence) {
      setMode('view');
      setShowDeleteConfirm(false);
      setEditReason(absence.reason || '');
      const start = new Date(absence.start_at);
      const end = new Date(absence.end_at);
      const startDate = start.toISOString().split('T')[0];
      const endDate = end.toISOString().split('T')[0];
      setEditDateFrom(startDate);
      setEditDateTo(endDate);
      setEditSingleDay(startDate === endDate);
      setEditTimeFrom(
        `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
      );
      setEditTimeTo(
        `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
      );
      setEditErrors([]);
    }
  }, [isOpen, absence]);

  const handleDelete = useCallback(async () => {
    if (!absence) return;
    await onDelete(absence);
    setShowDeleteConfirm(false);
  }, [absence, onDelete]);

  const handleSaveEdit = useCallback(async () => {
    if (!absence) return;
    const errs: string[] = [];
    if (!editDateFrom) errs.push(t('calendarView.absenceModal.validation.startDateRequired'));
    if (!editSingleDay && editDateTo < editDateFrom) errs.push(t('calendarView.absenceModal.validation.endDateAfterStart'));
    if (editSingleDay && editTimeFrom >= editTimeTo) errs.push(t('calendarView.absenceModal.validation.endTimeAfterStart'));
    if (errs.length > 0) { setEditErrors(errs); return; }

    await onEdit(absence, {
      employee_ids: absence.employee_id ? [absence.employee_id] : [],
      all_employees: !absence.employee_id,
      date_from: editDateFrom,
      date_to: editSingleDay ? editDateFrom : editDateTo,
      single_day: editSingleDay,
      time_from: editSingleDay ? editTimeFrom : undefined,
      time_to: editSingleDay ? editTimeTo : undefined,
      reason: editReason.trim() || undefined,
    });
  }, [absence, editDateFrom, editDateTo, editSingleDay, editTimeFrom, editTimeTo, editReason, onEdit]);

  const backdropVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
    exit: { opacity: 0, scale: 0.95, y: 20 },
  };

  if (!absence) return null;

  const employeeColor = absence.employee_color || 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative w-full max-w-sm flex flex-col rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: '#FFFBEB', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="px-5 py-4 flex-shrink-0 flex items-start justify-between"
              style={{ borderBottom: '1px solid rgba(245, 158, 11, 0.2)' }}
            >
              <div>
                <h2
                  className="text-lg font-bold"
                  style={{
                    background: employeeColor,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {absence.employee_name || t('calendarView.allEmployees')}
                </h2>
                <p className="text-xs text-amber-700 mt-0.5">{t('calendarView.absenceDetailModal.subtitle')}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-amber-600/60 transition-colors hover:bg-amber-100 hover:text-amber-800"
              >
                <X className="h-4 w-4" weight="bold" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {mode === 'view' ? (
                <>
                  {/* Date/time */}
                  <div className="flex items-start gap-3">
                    <CalendarBlank className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" weight="regular" />
                    <div>
                      <p className="text-sm font-medium text-amber-900">
                        {formatAbsenceDate(absence.start_at)}
                        {absence.start_at.split('T')[0] !== absence.end_at.split('T')[0] &&
                          ` – ${formatAbsenceDate(absence.end_at)}`}
                      </p>
                      {!isAllDay(absence) && (
                        <p className="text-xs text-amber-700 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" weight="regular" />
                          {formatAbsenceTime(absence.start_at)} – {formatAbsenceTime(absence.end_at)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Reason */}
                  {absence.reason && (
                    <div className="flex items-start gap-3">
                      <TextAlignLeft className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" weight="regular" />
                      <p className="text-sm text-amber-800">{absence.reason}</p>
                    </div>
                  )}
                </>
              ) : (
                /* Edit form */
                <div className="space-y-3">
                  {editErrors.length > 0 && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                      <div className="flex items-start gap-2">
                        <Warning className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" weight="fill" />
                        <div className="space-y-0.5">
                          {editErrors.map((err, i) => (
                            <p key={i} className="text-xs text-red-600">{err}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Single day vs range */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditSingleDay(true)}
                      className={`flex-1 py-2 rounded-xl border text-xs font-medium transition-all ${editSingleDay ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-amber-200'}`}
                    >
                      {t('calendarView.absenceModal.fields.hoursOnly')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditSingleDay(false)}
                      className={`flex-1 py-2 rounded-xl border text-xs font-medium transition-all ${!editSingleDay ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-amber-200'}`}
                    >
                      {t('calendarView.absenceModal.fields.multipleDays')}
                    </button>
                  </div>

                  {/* Date */}
                  <div className={editSingleDay ? '' : 'grid grid-cols-2 gap-2'}>
                    <div>
                      <label className="text-xs font-medium text-amber-800 mb-1 block">{editSingleDay ? t('calendarView.absenceModal.fields.date') : t('calendarView.absenceModal.fields.dateFrom')}</label>
                      <input
                        type="date"
                        value={editDateFrom}
                        onChange={(e) => setEditDateFrom(e.target.value)}
                        className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-300"
                      />
                    </div>
                    {!editSingleDay && (
                      <div>
                        <label className="text-xs font-medium text-amber-800 mb-1 block">{t('calendarView.absenceModal.fields.dateTo')}</label>
                        <input
                          type="date"
                          value={editDateTo}
                          min={editDateFrom}
                          onChange={(e) => setEditDateTo(e.target.value)}
                          className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-300"
                        />
                      </div>
                    )}
                  </div>

                  {/* Time (single day only) */}
                  {editSingleDay && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium text-amber-800 mb-1 block">{t('calendarView.absenceModal.fields.timeFrom')}</label>
                        <Select value={editTimeFrom} setValue={setEditTimeFrom} placeholder={t('calendarView.absenceModal.fields.timePlaceholder')}>
                          {TIME_OPTIONS.map((time) => <SelectOption key={time} value={time}>{time}</SelectOption>)}
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-amber-800 mb-1 block">{t('calendarView.absenceModal.fields.timeTo')}</label>
                        <Select value={editTimeTo} setValue={setEditTimeTo} placeholder={t('calendarView.absenceModal.fields.timePlaceholder')}>
                          {TIME_OPTIONS.map((time) => <SelectOption key={time} value={time}>{time}</SelectOption>)}
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* Reason */}
                  <div>
                    <label className="text-xs font-medium text-amber-800 mb-1 block">{t('calendarView.absenceModal.fields.reason')}</label>
                    <textarea
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      rows={2}
                      placeholder="npr. Bolniška, dopust..."
                      className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-amber-900 placeholder-amber-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="flex items-center gap-2 px-5 py-3 flex-shrink-0"
              style={{ borderTop: '1px solid rgba(245, 158, 11, 0.2)' }}
            >
              {mode === 'view' ? (
                <>
                  {/* Delete flow */}
                  {!showDeleteConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={isDeleting}
                      className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
                    >
                      <Trash className="h-4 w-4" weight="bold" />
                      {t('calendarView.absenceDetailModal.actions.deleteAbsence')}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-sm text-red-500 font-medium">{t('calendarView.eventModal.actions.confirmDelete')}</span>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="flex items-center gap-1.5 rounded-xl bg-red-50 border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                      >
                        {isDeleting ? <SpinnerGap className="h-3.5 w-3.5 animate-spin" /> : <Trash className="h-3.5 w-3.5" weight="bold" />}
                        {t('calendarView.absenceDetailModal.actions.confirmYes')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="rounded-xl px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100"
                      >
                        {t('calendarView.absenceDetailModal.actions.confirmNo')}
                      </button>
                    </div>
                  )}
                  {!showDeleteConfirm && <div className="flex-1" />}
                  {!showDeleteConfirm && (
                    <button
                      type="button"
                      onClick={() => setMode('edit')}
                      className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-amber-600 transition-all"
                    >
                      <PencilSimple className="h-4 w-4" weight="bold" />
                      {t('calendarView.absenceDetailModal.actions.editAbsence')}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => { setMode('view'); setEditErrors([]); }}
                    disabled={isSaving}
                    className="rounded-xl px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                  >
                    {t('calendarView.absenceModal.actions.cancel')}
                  </button>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-amber-600 transition-all disabled:opacity-70"
                  >
                    {isSaving ? (
                      <SpinnerGap className="h-4 w-4 animate-spin" />
                    ) : (
                      <FloppyDisk className="h-4 w-4" weight="bold" />
                    )}
                    {t('calendarView.absenceDetailModal.actions.saveChanges')}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(AbsenceDetailModal);
