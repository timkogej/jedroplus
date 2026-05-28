'use client';

import { useState, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Star,
  FloppyDisk,
  SpinnerGap,
  Warning,
  Trash,
  CalendarBlank,
  Clock,
  MapPin,
  TextAlignLeft,
} from '@phosphor-icons/react';
import { Select, SelectOption } from '@/components/ui/animated-select';
import type { CalendarEvent } from '@/types/events';
import {
  EVENT_COLOR_PRESETS,
  extractFirstColorStop,
} from '@/lib/utils/eventColors';
import { useTranslations } from 'next-intl';

export interface EventFormData {
  title: string;
  description: string;
  notes: string;
  event_date: string;
  end_date: string;
  all_day: boolean;
  start_time: string;
  end_time: string;
  location: string;
  color: string;
  is_visible: boolean;
  enable_booking: boolean;
}

interface EventModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  event?: CalendarEvent | null;
  onClose: () => void;
  onSave: (data: EventFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  isSaving?: boolean;
  isDeleting?: boolean;
}

function generateTimeOptions(): string[] {
  const opts: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return opts;
}
const TIME_OPTIONS = generateTimeOptions();

const DEFAULT_COLOR = 'linear-gradient(135deg, #10B981 0%, #06B6D4 50%, #3B82F6 100%)';

function EventModal({
  isOpen,
  mode,
  event,
  onClose,
  onSave,
  onDelete,
  isSaving = false,
  isDeleting = false,
}: EventModalProps) {
  const t = useTranslations('appointments');
  const today = new Date().toISOString().split('T')[0];

  // ── Form state ──────────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [eventDate, setEventDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [location, setLocation] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [isVisible, setIsVisible] = useState(true);
  const [enableBooking, setEnableBooking] = useState(true);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Populate form when editing ───────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && event) {
        setTitle(event.title);
        setDescription(event.description ?? '');
        setNotes(event.notes ?? '');
        setEventDate(event.event_date);
        setEndDate(event.end_date ?? '');
        setAllDay(event.all_day);
        setStartTime(event.start_time ?? '09:00');
        setEndTime(event.end_time ?? '10:00');
        setLocation(event.location ?? '');
        setColor(event.color || DEFAULT_COLOR);
        setIsVisible(event.is_visible);
        const eb = event.enable_booking;
        setEnableBooking(eb === true || eb === 'true' || eb === 'TRUE');
      } else {
        setTitle('');
        setDescription('');
        setNotes('');
        setEventDate(today);
        setEndDate('');
        setAllDay(true);
        setStartTime('09:00');
        setEndTime('10:00');
        setLocation('');
        setColor(DEFAULT_COLOR);
        setIsVisible(true);
        setEnableBooking(true);
      }
      setErrors([]);
      setShowDeleteConfirm(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, event]);

  // ── Validation ───────────────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    const errs: string[] = [];
    if (!title.trim()) errs.push(t('calendarView.eventModal.validation.titleRequired'));
    if (!eventDate) errs.push(t('calendarView.eventModal.validation.startDateRequired'));
    if (endDate && endDate < eventDate) errs.push(t('calendarView.eventModal.validation.endDateBeforeStart'));
    if (!allDay && startTime && endTime && startTime >= endTime) {
      errs.push(t('calendarView.eventModal.validation.endTimeAfterStart'));
    }
    if (!color) errs.push(t('calendarView.eventModal.validation.colorRequired'));
    setErrors(errs);
    return errs.length === 0;
  }, [title, eventDate, endDate, allDay, startTime, endTime, color]);

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSave({
      title: title.trim(),
      description: description.trim(),
      notes: notes.trim(),
      event_date: eventDate,
      end_date: endDate,
      all_day: allDay,
      start_time: allDay ? '' : startTime,
      end_time: allDay ? '' : endTime,
      location: location.trim(),
      color,
      is_visible: isVisible,
      enable_booking: enableBooking,
    });
  }, [validate, onSave, title, description, notes, eventDate, endDate, allDay, startTime, endTime, location, color, isVisible]);

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDeleteConfirm = useCallback(async () => {
    if (onDelete) await onDelete();
  }, [onDelete]);

  // ── Animation variants ───────────────────────────────────────────────────────
  const backdropVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
    exit: { opacity: 0, scale: 0.95, y: 20 },
  };

  const iconColor = extractFirstColorStop(color);

  const inputClass =
    'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-[#1A1F36] placeholder-gray-400 ' +
    'focus:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-200 transition-all';

  const labelClass = 'text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative w-full max-w-lg flex flex-col rounded-2xl shadow-2xl overflow-hidden"
            style={{ maxHeight: '90vh', padding: '2px', background: color }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col rounded-[14px] overflow-hidden" style={{ background: '#fff', maxHeight: 'calc(90vh - 4px)' }}>
            {/* ── Header (white) ───────────────────────────────────────────── */}
            <div
              className="px-6 py-5 flex-shrink-0"
              style={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.06)' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Star
                    weight="fill"
                    style={{ width: 22, height: 22, color: iconColor, flexShrink: 0 }}
                  />
                  <div>
                    <h2 className="text-lg font-semibold" style={{ color: '#1A1F36' }}>
                      {mode === 'edit' ? t('calendarView.eventModal.titles.edit') : t('calendarView.eventModal.titles.create')}
                    </h2>
                    <p className="text-sm" style={{ color: '#6B7280' }}>
                      {mode === 'edit' ? t('calendarView.eventModal.subtitles.edit') : t('calendarView.eventModal.subtitles.create')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 flex-shrink-0"
                >
                  <X style={{ width: 20, height: 20 }} weight="bold" />
                </button>
              </div>
            </div>

            {/* ── Form (white) ─────────────────────────────────────────────── */}
            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 space-y-5"
              style={{ background: '#fff', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent' }}
            >
              {/* Errors */}
              {errors.length > 0 && (
                <div
                  className="rounded-xl p-4"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  <div className="flex items-start gap-3">
                    <Warning style={{ width: 16, height: 16 }} className="text-red-500 flex-shrink-0 mt-0.5" weight="fill" />
                    <div className="space-y-1">
                      {errors.map((err, i) => (
                        <p key={i} className="text-sm text-red-600">{err}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Title */}
              <div>
                <label className={labelClass}>{t('calendarView.eventModal.fields.title')}</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('calendarView.eventModal.fields.titlePlaceholder')}
                  className={inputClass}
                />
              </div>

              {/* Date row */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>
                    <CalendarBlank className="inline h-3 w-3 mr-1" weight="bold" />
                    {t('calendarView.eventModal.fields.startDate')}
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className={`${inputClass} max-w-full`}
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    <CalendarBlank className="inline h-3 w-3 mr-1" weight="bold" />
                    {t('calendarView.eventModal.fields.endDate')}
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={eventDate}
                    className={`${inputClass} max-w-full`}
                  />
                </div>
              </div>

              {/* All-day toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setAllDay((prev) => !prev)}
                  className="flex items-center gap-3 group"
                >
                  <div
                    className={`relative w-10 h-5 rounded-full transition-all flex-shrink-0 ${
                      allDay ? '' : 'bg-gray-200'
                    }`}
                    style={allDay ? { background: iconColor } : undefined}
                  >
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-white shadow transition-all ${
                        allDay ? 'left-5' : 'left-0.5'
                      }`}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-600 group-hover:text-[#1A1F36] transition-colors">
                    {t('calendarView.eventModal.fields.allDay')}
                  </span>
                </button>
              </div>

              {/* Time inputs */}
              {!allDay && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>
                      <Clock className="inline h-3 w-3 mr-1" weight="bold" />
                      {t('calendarView.eventModal.fields.startTime')}
                    </label>
                    <Select value={startTime} setValue={setStartTime} placeholder={t('calendarView.eventModal.fields.timePlaceholder')}>
                      {TIME_OPTIONS.map((opt) => (
                        <SelectOption key={opt} value={opt}>{opt}</SelectOption>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className={labelClass}>
                      <Clock className="inline h-3 w-3 mr-1" weight="bold" />
                      {t('calendarView.eventModal.fields.endTime')}
                    </label>
                    <Select value={endTime} setValue={setEndTime} placeholder={t('calendarView.eventModal.fields.timePlaceholder')}>
                      {TIME_OPTIONS.map((opt) => (
                        <SelectOption key={opt} value={opt}>{opt}</SelectOption>
                      ))}
                    </Select>
                  </div>
                </div>
              )}

              {/* Color picker */}
              <div>
                <label className={labelClass}>{t('calendarView.eventModal.fields.color')}</label>
                <div className="grid grid-cols-4 gap-2">
                  {EVENT_COLOR_PRESETS.map((preset) => {
                    const isSelected = color === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setColor(preset.value)}
                        title={preset.label}
                        className="relative rounded-lg overflow-hidden transition-all"
                        style={{
                          height: 36,
                          background: preset.value,
                          boxShadow: isSelected
                            ? `0 0 0 2.5px #fff, 0 0 0 4.5px ${extractFirstColorStop(preset.value)}`
                            : 'none',
                          transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                        }}
                      >
                        {isSelected && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="w-2 h-2 rounded-full bg-white shadow" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={labelClass}>
                  <TextAlignLeft className="inline h-3 w-3 mr-1" weight="bold" />
                  {t('calendarView.eventModal.fields.description')}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('calendarView.eventModal.fields.descriptionPlaceholder')}
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </div>

              {/* Notes */}
              <div>
                <label className={labelClass}>{t('calendarView.eventModal.fields.notes')}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('calendarView.eventModal.fields.notesPlaceholder')}
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </div>

              {/* Location */}
              <div>
                <label className={labelClass}>
                  <MapPin className="inline h-3 w-3 mr-1" weight="bold" />
                  {t('calendarView.eventModal.fields.location')}
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={t('calendarView.eventModal.fields.locationPlaceholder')}
                  className={inputClass}
                />
              </div>

              {/* Visibility toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setIsVisible((prev) => !prev)}
                  className="flex items-center gap-3 group"
                >
                  <div
                    className={`relative w-10 h-5 rounded-full transition-all flex-shrink-0 ${
                      isVisible ? '' : 'bg-gray-200'
                    }`}
                    style={isVisible ? { background: iconColor } : undefined}
                  >
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-white shadow transition-all ${
                        isVisible ? 'left-5' : 'left-0.5'
                      }`}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-600 group-hover:text-[#1A1F36] transition-colors">
                    {t('calendarView.eventModal.fields.visibleInCalendar')}
                  </span>
                </button>
              </div>

              {/* Enable booking toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setEnableBooking((prev) => !prev)}
                  className="flex items-center gap-3 group"
                >
                  <div
                    className={`relative w-10 h-5 rounded-full transition-all flex-shrink-0 ${
                      enableBooking ? '' : 'bg-gray-200'
                    }`}
                    style={enableBooking ? { background: iconColor } : undefined}
                  >
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-white shadow transition-all ${
                        enableBooking ? 'left-5' : 'left-0.5'
                      }`}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-600 group-hover:text-[#1A1F36] transition-colors">
                    {t('calendarView.eventModal.fields.allowBooking')}
                  </span>
                </button>
              </div>
            </form>

            {/* ── Footer (white) ───────────────────────────────────────────── */}
            <div
              className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
              style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}
            >
              {/* Delete button (edit mode only) */}
              {mode === 'edit' && onDelete && !showDeleteConfirm && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting || isSaving}
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-red-500
                             transition-all hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash style={{ width: 16, height: 16 }} weight="bold" />
                  {t('calendarView.eventModal.actions.delete')}
                </button>
              )}

              {/* Delete confirmation inline */}
              {showDeleteConfirm && (
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm text-red-500 font-medium">{t('calendarView.eventModal.actions.confirmDelete')}</span>
                  <button
                    type="button"
                    onClick={handleDeleteConfirm}
                    disabled={isDeleting}
                    className="flex items-center gap-1.5 rounded-xl bg-red-50 border border-red-200 px-3 py-2
                               text-sm font-medium text-red-600 transition-all hover:bg-red-100 disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <SpinnerGap style={{ width: 14, height: 14 }} className="animate-spin" />
                    ) : (
                      <Trash style={{ width: 14, height: 14 }} weight="bold" />
                    )}
                    {t('calendarView.eventModal.actions.confirmYes')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="rounded-xl px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-[#1A1F36]"
                  >
                    {t('calendarView.absenceDetailModal.actions.confirmNo')}
                  </button>
                </div>
              )}

              {!showDeleteConfirm && <div className="flex-1" />}

              {/* Cancel */}
              {!showDeleteConfirm && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="rounded-xl px-5 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-[#1A1F36] disabled:opacity-50"
                >
                  {t('calendarView.eventModal.actions.cancel')}
                </button>
              )}

              {/* Save */}
              {!showDeleteConfirm && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white
                             shadow-lg transition-all disabled:opacity-70"
                  style={{
                    background: color,
                    boxShadow: `0 4px 15px ${iconColor}40`,
                  }}
                >
                  {isSaving ? (
                    <>
                      <SpinnerGap style={{ width: 16, height: 16 }} className="animate-spin" />
                      {t('calendarView.eventModal.actions.saving')}
                    </>
                  ) : (
                    <>
                      <FloppyDisk style={{ width: 16, height: 16 }} weight="bold" />
                      {mode === 'edit' ? t('calendarView.eventModal.actions.update') : t('calendarView.eventModal.actions.save')}
                    </>
                  )}
                </button>
              )}
            </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(EventModal);
