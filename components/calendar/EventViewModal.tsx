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
  Eye,
  EyeSlash,
  Note,
} from '@phosphor-icons/react';
import type { CalendarEvent } from '@/types/events';
import { extractFirstColorStop } from '@/lib/utils/eventColors';

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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative w-full max-w-md flex flex-col rounded-2xl shadow-2xl overflow-hidden"
            style={{ maxHeight: '90vh', padding: '2px', background: event.color || '#6D5EF7' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col rounded-[14px] overflow-hidden" style={{ background: '#fff', maxHeight: 'calc(90vh - 4px)' }}>
            {/* ── Header (white) ──────────────────────────────────────────────── */}
            <div
              className="px-6 py-5 flex-shrink-0"
              style={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.06)' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Star
                    weight="fill"
                    style={{ width: 22, height: 22, color: iconColor, flexShrink: 0 }}
                  />
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold truncate" style={{ color: '#1A1F36' }}>
                      {event.title}
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
                      {formatDateRange(event.event_date, event.end_date)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 flex-shrink-0"
                >
                  <X style={{ width: 20, height: 20 }} weight="bold" />
                </button>
              </div>
            </div>

            {/* ── Body (white) ────────────────────────────────────────────────── */}
            <div
              className="flex-1 overflow-y-auto px-6 py-5 space-y-4"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.1) transparent' }}
            >
              {/* Date/time row */}
              <div className="flex items-start gap-3">
                <CalendarBlank
                  weight="regular"
                  style={{ width: 18, height: 18, color: '#6B7280', flexShrink: 0, marginTop: 2 }}
                />
                <div>
                  <p className="text-sm font-medium text-[#1A1F36]">
                    {formatDateRange(event.event_date, event.end_date)}
                  </p>
                  {event.all_day ? (
                    <p className="text-xs text-gray-400 mt-0.5">Celodnevni dogodek</p>
                  ) : event.start_time ? (
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <Clock style={{ width: 12, height: 12 }} weight="regular" />
                      {formatTime(event.start_time)}{event.end_time ? ` – ${formatTime(event.end_time)}` : ''}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Location */}
              {event.location && (
                <div className="flex items-start gap-3">
                  <MapPin
                    weight="regular"
                    style={{ width: 18, height: 18, color: '#6B7280', flexShrink: 0, marginTop: 2 }}
                  />
                  <p className="text-sm text-[#1A1F36]">{event.location}</p>
                </div>
              )}

              {/* Description */}
              {event.description && (
                <div className="flex items-start gap-3">
                  <TextAlignLeft
                    weight="regular"
                    style={{ width: 18, height: 18, color: '#6B7280', flexShrink: 0, marginTop: 2 }}
                  />
                  <p className="text-sm text-[#1A1F36] whitespace-pre-wrap">{event.description}</p>
                </div>
              )}

              {/* Notes */}
              {event.notes && (
                <div className="flex items-start gap-3">
                  <Note
                    weight="regular"
                    style={{ width: 18, height: 18, color: '#6B7280', flexShrink: 0, marginTop: 2 }}
                  />
                  <p className="text-sm text-gray-500 whitespace-pre-wrap">{event.notes}</p>
                </div>
              )}

              {/* Visibility */}
              <div className="flex items-center gap-3">
                {event.is_visible ? (
                  <Eye
                    weight="regular"
                    style={{ width: 18, height: 18, color: '#6B7280', flexShrink: 0 }}
                  />
                ) : (
                  <EyeSlash
                    weight="regular"
                    style={{ width: 18, height: 18, color: '#9CA3AF', flexShrink: 0 }}
                  />
                )}
                <p className={`text-sm ${event.is_visible ? 'text-[#1A1F36]' : 'text-gray-400'}`}>
                  {event.is_visible ? 'Vidno v koledarju' : 'Skrito v koledarju'}
                </p>
              </div>
            </div>

            {/* ── Footer ──────────────────────────────────────────────────────── */}
            <div
              className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
              style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}
            >
              {/* Delete flow */}
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting}
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-red-500
                             transition-all hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash style={{ width: 16, height: 16 }} weight="bold" />
                  Izbriši
                </button>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm text-red-500 font-medium">Potrdi izbris?</span>
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
                    Da, izbriši
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="rounded-xl px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-[#1A1F36]"
                  >
                    Ne
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
                    className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-all"
                    style={{
                      background: event.color || '#6D5EF7',
                      boxShadow: `0 4px 15px ${iconColor}40`,
                    }}
                  >
                    <PencilSimple style={{ width: 16, height: 16 }} weight="bold" />
                    Uredi
                  </button>
                </>
              )}
            </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(EventViewModal);
