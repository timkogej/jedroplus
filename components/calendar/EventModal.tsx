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
  MapPin,
} from '@phosphor-icons/react';
import { Select, SelectOption } from '@/components/ui/animated-select';
import type { CalendarEvent } from '@/types/events';
import {
  EVENT_COLOR_PRESETS,
  extractFirstColorStop,
} from '@/lib/utils/eventColors';
import { useTranslations } from 'next-intl';
import { sheet } from '@/components/ui/sheetClasses';
import { BodyPortal } from '@/components/ui/BodyPortal';

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
  }, [validate, onSave, title, description, notes, eventDate, endDate, allDay, startTime, endTime, location, color, isVisible, enableBooking]);

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
    'w-full rounded-[10px] border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 ' +
    'focus:border-[#7C78FA] focus:outline-none focus:ring-[3px] focus:ring-[#7C78FA]/25 transition-all';

  const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500';

  /** iOS vrstica s stikalom v barvi dogodka. */
  const toggleRow = (checked: boolean, onToggle: () => void, label: string) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
    >
      <span className="text-sm text-gray-900">{label}</span>
      <span
        className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-all ${checked ? '' : 'bg-gray-300'}`}
        style={checked ? { background: iconColor } : undefined}
      >
        <span
          className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-all ${
            checked ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );

  return (
    <BodyPortal>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className={sheet.backdrop}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`${sheet.panel} sm:max-w-lg`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className={sheet.header}>
              <div className={sheet.grabber} aria-hidden="true" />
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <Star
                    weight="fill"
                    style={{ width: 18, height: 18, color: iconColor, flexShrink: 0 }}
                  />
                  <div>
                    <h2 className={sheet.title}>
                      {mode === 'edit' ? t('calendarView.eventModal.titles.edit') : t('calendarView.eventModal.titles.create')}
                    </h2>
                    <p className={sheet.subtitle}>
                      {mode === 'edit' ? t('calendarView.eventModal.subtitles.edit') : t('calendarView.eventModal.subtitles.create')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className={`${sheet.close} flex-shrink-0`}
                >
                  <X className="h-5 w-5" weight="regular" />
                </button>
              </div>
            </div>

            {/* ── Form ─────────────────────────────────────────────────────── */}
            <form
              onSubmit={handleSubmit}
              className={`${sheet.body} overflow-x-hidden`}
            >
              {/* Errors */}
              {errors.length > 0 && (
                <div className="rounded-xl bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <Warning className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" weight="regular" />
                    <div className="space-y-1">
                      {errors.map((err, i) => (
                        <p key={i} className="text-sm text-red-600">{err}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Title */}
              <div className={sheet.group}>
                <label className={labelClass}>{t('calendarView.eventModal.fields.title')}</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('calendarView.eventModal.fields.titlePlaceholder')}
                  className={inputClass}
                />
              </div>

              {/* Date + time */}
              <div className="overflow-hidden rounded-xl bg-white">
                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>
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
                <div className="border-t border-gray-100">
                  {toggleRow(allDay, () => setAllDay((prev) => !prev), t('calendarView.eventModal.fields.allDay'))}
                </div>

                {/* Time inputs */}
                {!allDay && (
                  <div className="grid grid-cols-1 gap-3 border-t border-gray-100 p-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>
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
              </div>

              {/* Color picker */}
              <div className={sheet.group}>
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

              {/* Description, notes, location */}
              <div className={`${sheet.group} space-y-4`}>
                <div>
                  <label className={labelClass}>
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

                <div>
                  <label className={labelClass}>
                    {t('calendarView.eventModal.fields.location')}
                  </label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder={t('calendarView.eventModal.fields.locationPlaceholder')}
                      className={`${inputClass} pl-9`}
                    />
                  </div>
                </div>
              </div>

              {/* Visibility + booking toggles */}
              <div className="divide-y divide-gray-100 overflow-hidden rounded-xl bg-white">
                {toggleRow(isVisible, () => setIsVisible((prev) => !prev), t('calendarView.eventModal.fields.visibleInCalendar'))}
                {toggleRow(enableBooking, () => setEnableBooking((prev) => !prev), t('calendarView.eventModal.fields.allowBooking'))}
              </div>
            </form>

            {/* ── Footer ───────────────────────────────────────────────────── */}
            <div className={`${sheet.footer} !justify-start`}>
              {/* Delete button (edit mode only) */}
              {mode === 'edit' && onDelete && !showDeleteConfirm && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting || isSaving}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-500
                             transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash className="h-4 w-4" weight="regular" />
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
                    className="flex items-center gap-1.5 rounded-xl bg-red-500 px-3 py-1.5
                               text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <SpinnerGap className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash className="h-3.5 w-3.5" weight="bold" />
                    )}
                    {t('calendarView.eventModal.actions.confirmYes')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
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
                  className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50"
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
                             shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-70"
                  style={{ background: color }}
                >
                  {isSaving ? (
                    <>
                      <SpinnerGap className="h-4 w-4 animate-spin" />
                      {t('calendarView.eventModal.actions.saving')}
                    </>
                  ) : (
                    <>
                      <FloppyDisk className="h-4 w-4" weight="bold" />
                      {mode === 'edit' ? t('calendarView.eventModal.actions.update') : t('calendarView.eventModal.actions.save')}
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </BodyPortal>
  );
}

export default memo(EventModal);
