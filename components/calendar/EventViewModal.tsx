'use client';

import { useState, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Star,
  SpinnerGap,
  Trash,
  PencilSimple,
  CalendarBlank,
  Clock,
  MapPin,
  TextAlignLeft,
  Note,
} from '@phosphor-icons/react';
import type { CalendarEvent } from '@/types/events';
import { extractFirstColorStop } from '@/lib/utils/eventColors';
import { useTranslations } from 'next-intl';
import { sheet } from '@/components/ui/sheetClasses';

interface EventViewModalProps {
  isOpen: boolean;
  event: CalendarEvent | null;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: () => Promise<void>;
  isDeleting?: boolean;
}

function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}. ${month}. ${year}`;
}

function formatDateRange(startDate: string, endDate?: string | null): string {
  if (!endDate || endDate === startDate) return formatDate(startDate);
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function EventViewModal({
  isOpen,
  event,
  onClose,
  onEdit,
  onDelete,
  isDeleting = false,
}: EventViewModalProps) {
  const t = useTranslations('appointments');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteConfirm = useCallback(async () => {
    await onDelete();
    setShowDeleteConfirm(false);
  }, [onDelete]);

  const handleClose = useCallback(() => {
    setShowDeleteConfirm(false);
    onClose();
  }, [onClose]);

  const backdropVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
    exit: { opacity: 0, scale: 0.95, y: 20 },
  };

  if (!event) return null;

  const iconColor = extractFirstColorStop(event.color || '#6D5EF7');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className={sheet.backdrop}
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={sheet.panel}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className={sheet.header}>
              <div className={sheet.grabber} aria-hidden="true" />
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Star
                    weight="fill"
                    style={{ width: 18, height: 18, color: iconColor, flexShrink: 0 }}
                  />
                  <div className="min-w-0">
                    <h2 className={`${sheet.title} truncate`}>
                      {event.title}
                    </h2>
                    <p className={sheet.subtitle}>
                      {formatDateRange(event.event_date, event.end_date)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className={`${sheet.close} flex-shrink-0`}
                >
                  <X className="h-5 w-5" weight="regular" />
                </button>
              </div>
            </div>

            {/* ── Body ────────────────────────────────────────────────────────── */}
            <div className={sheet.body}>
              <div className="divide-y divide-gray-100 overflow-hidden rounded-xl bg-white">
                {/* Date/time row */}
                <div className="flex items-start gap-3 px-4 py-3">
                  <CalendarBlank weight="regular" className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDateRange(event.event_date, event.end_date)}
                    </p>
                    {event.all_day ? (
                      <p className="text-[13px] text-gray-500 mt-0.5">{t('calendarView.eventModal.fields.allDay')}</p>
                    ) : event.start_time ? (
                      <p className="tnum text-[13px] text-gray-500 mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" weight="regular" />
                        {formatTime(event.start_time)}{event.end_time ? ` – ${formatTime(event.end_time)}` : ''}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Location */}
                {event.location && (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <MapPin weight="regular" className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                    <p className="text-sm text-gray-900">{event.location}</p>
                  </div>
                )}

                {/* Description */}
                {event.description && (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <TextAlignLeft weight="regular" className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{event.description}</p>
                  </div>
                )}

                {/* Notes */}
                {event.notes && (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <Note weight="regular" className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                    <p className="text-sm text-gray-500 whitespace-pre-wrap">{event.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Footer ──────────────────────────────────────────────────────── */}
            <div className={`${sheet.footer} !justify-start`}>
              {/* Delete flow */}
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-500
                             transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash className="h-4 w-4" weight="regular" />
                  {t('calendarView.eventModal.actions.delete')}
                </button>
              ) : (
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

              {!showDeleteConfirm && (
                <>
                  <div className="flex-1" />
                  {/* Edit button */}
                  <button
                    type="button"
                    onClick={() => onEdit(event)}
                    className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
                    style={{ background: event.color || '#6D5EF7' }}
                  >
                    <PencilSimple className="h-4 w-4" weight="bold" />
                    {t('calendarView.eventModal.actions.edit')}
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

export default memo(EventViewModal);
