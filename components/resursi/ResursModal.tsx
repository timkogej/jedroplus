'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Tag,
  NotePencil,
  FloppyDisk,
  SpinnerGap,
  Warning,
  Palette,
  Check,
  CaretLeft,
  CaretRight,
  Plus,
  Minus,
  Users,
  Cube,
  Globe,
  Clock,
  Eye,
} from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import type { Resurs, ResursFormData, UrnikData, UrnikInterval } from '@/types/resursi';
import { URNIK_DAYS, DEFAULT_URNIK } from '@/types/resursi';
import type { Service } from '@/types/services';
import { SERVICE_GRADIENTS, DEFAULT_SERVICE_GRADIENT, isGradient } from '@/lib/constants/serviceGradients';

interface ResursModalProps {
  isOpen: boolean;
  onClose: () => void;
  resurs?: Resurs | null;
  mode: 'create' | 'edit';
  services: Service[];
  onSave: (data: ResursFormData) => Promise<void>;
  isSaving?: boolean;
  linkedStoritevIds?: string[];
}

const COLORS_PER_PAGE = 4;

const backdropVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
  exit: { opacity: 0, scale: 0.95, y: 20 },
};

function ResursModal({
  isOpen,
  onClose,
  resurs,
  mode,
  services,
  onSave,
  isSaving = false,
  linkedStoritevIds = [],
}: ResursModalProps) {
  const t = useTranslations('resursi');

  const defaultForm: ResursFormData = {
    naziv: '',
    booking_naziv: '',
    opis: '',
    barva: DEFAULT_SERVICE_GRADIENT,
    kolicina: 1,
    kapaciteta: 1,
    prikazi_v_bookingu: false,
    urnik: null,
    status: 'active',
    storitve_ids: [],
  };

  const [form, setForm] = useState<ResursFormData>(defaultForm);
  const [errors, setErrors] = useState<Partial<Record<keyof ResursFormData, string>>>({});
  const [colorPage, setColorPage] = useState(0);
  const [useCustomSchedule, setUseCustomSchedule] = useState(false);

  const totalColorPages = Math.ceil(SERVICE_GRADIENTS.length / COLORS_PER_PAGE);
  const visibleGradients = SERVICE_GRADIENTS.slice(colorPage * COLORS_PER_PAGE, (colorPage + 1) * COLORS_PER_PAGE);

  // Init form on open
  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'edit' && resurs) {
      setForm({
        naziv: resurs.naziv,
        booking_naziv: resurs.booking_naziv ?? '',
        opis: resurs.opis ?? '',
        barva: isGradient(resurs.barva) ? resurs.barva : DEFAULT_SERVICE_GRADIENT,
        kolicina: resurs.kolicina,
        kapaciteta: resurs.kapaciteta,
        prikazi_v_bookingu: resurs.prikazi_v_bookingu,
        urnik: resurs.urnik,
        status: resurs.status,
        storitve_ids: linkedStoritevIds,
      });
      setUseCustomSchedule(resurs.urnik !== null);
    } else {
      setForm({ ...defaultForm, storitve_ids: linkedStoritevIds });
      setUseCustomSchedule(false);
    }
    setErrors({});
    setColorPage(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, resurs]);

  const handleChange = useCallback(<K extends keyof ResursFormData>(key: K, value: ResursFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof ResursFormData, string>> = {};
    if (!form.naziv.trim()) newErrors.naziv = t('modal.validationNameRequired');
    else if (form.naziv.trim().length < 2) newErrors.naziv = t('modal.validationNameMinLength');
    else if (form.naziv.length > 100) newErrors.naziv = t('modal.validationNameMaxLength');
    if (!form.barva) newErrors.barva = t('modal.validationColorInvalid');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form, t]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const data: ResursFormData = {
      ...form,
      urnik: useCustomSchedule ? (form.urnik ?? DEFAULT_URNIK) : null,
    };
    await onSave(data);
  }, [form, validate, onSave, useCustomSchedule]);

  // ── Schedule helpers ──────────────────────────────────────────────────────

  const getUrnik = (): UrnikData => form.urnik ?? DEFAULT_URNIK;

  const toggleDay = (day: keyof UrnikData) => {
    const u = { ...getUrnik() };
    u[day] = { ...u[day], enabled: !u[day].enabled };
    handleChange('urnik', u);
  };

  const updateInterval = (day: keyof UrnikData, idx: number, field: keyof UrnikInterval, value: string) => {
    const u = { ...getUrnik() };
    const intervals = [...u[day].intervals];
    intervals[idx] = { ...intervals[idx], [field]: value };
    u[day] = { ...u[day], intervals };
    handleChange('urnik', u);
  };

  const addInterval = (day: keyof UrnikData) => {
    const u = { ...getUrnik() };
    u[day] = { ...u[day], intervals: [...u[day].intervals, { start: '08:00', end: '17:00' }] };
    handleChange('urnik', u);
  };

  const removeInterval = (day: keyof UrnikData, idx: number) => {
    const u = { ...getUrnik() };
    const intervals = u[day].intervals.filter((_, i) => i !== idx);
    u[day] = { ...u[day], intervals: intervals.length ? intervals : [{ start: '08:00', end: '17:00' }] };
    handleChange('urnik', u);
  };

  const toggleService = (svcId: string) => {
    const next = form.storitve_ids.includes(svcId)
      ? form.storitve_ids.filter((id) => id !== svcId)
      : [...form.storitve_ids, svcId];
    handleChange('storitve_ids', next);
  };

  const skupnaKapaciteta = form.kolicina * form.kapaciteta;
  const urnik = getUrnik();

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
            className="relative flex w-full max-w-xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-[#F7F8FA] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b border-gray-100 bg-white px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {mode === 'create' ? t('modal.createTitle') : t('modal.editTitle')}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {mode === 'create' ? t('modal.createSubtitle') : t('modal.editSubtitle')}
                  </p>
                </div>
                <motion.button
                  type="button"
                  onClick={onClose}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                >
                  <X className="h-5 w-5" weight="bold" />
                </motion.button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="min-h-0 flex flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="space-y-5">

                {/* Naziv */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.nameLabel')}
                  </label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                    <input
                      type="text"
                      value={form.naziv}
                      onChange={(e) => handleChange('naziv', e.target.value)}
                      placeholder={t('modal.namePlaceholder')}
                      maxLength={100}
                      className={`w-full rounded-lg border bg-white py-2.5 pl-10 pr-4 text-sm text-[#1A1F36] placeholder-gray-400
                                 transition-all focus:outline-none focus:ring-2
                                 ${errors.naziv ? 'border-red-300 focus:ring-red-100' : 'border-gray-200 focus:border-gray-900 focus:ring-gray-900/10'}`}
                    />
                  </div>
                  {errors.naziv && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <Warning className="h-3 w-3" weight="fill" />{errors.naziv}
                    </p>
                  )}
                </div>

                {/* Booking naziv */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.bookingNameLabel')}
                  </label>
                  <div className="relative">
                    <Eye className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                    <input
                      type="text"
                      value={form.booking_naziv}
                      onChange={(e) => handleChange('booking_naziv', e.target.value)}
                      placeholder={form.naziv || t('modal.bookingNamePlaceholder', { naziv: '…' })}
                      maxLength={100}
                      className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-[#1A1F36]
                                 placeholder-gray-400 transition-all focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-400">{t('modal.bookingNameHint')}</p>
                </div>

                {/* Opis */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.descriptionLabel')}
                  </label>
                  <div className="relative">
                    <NotePencil className="absolute left-3 top-3 h-4 w-4 text-gray-400" weight="regular" />
                    <textarea
                      value={form.opis}
                      onChange={(e) => handleChange('opis', e.target.value)}
                      placeholder={t('modal.descriptionPlaceholder')}
                      rows={2}
                      maxLength={500}
                      className="w-full resize-none rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-[#1A1F36]
                                 placeholder-gray-400 transition-all focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </div>
                </div>

                {/* Color */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.colorLabel')}
                  </label>
                  <div className="flex items-center gap-2">
                    <motion.button
                      type="button"
                      onClick={() => setColorPage((p) => Math.max(0, p - 1))}
                      disabled={colorPage === 0}
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-all
                                 ${colorPage === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      <CaretLeft className="w-5 h-5" weight="bold" />
                    </motion.button>

                    <div className="flex-1 grid grid-cols-4 gap-3">
                      <AnimatePresence mode="wait">
                        {visibleGradients.map((g) => (
                          <motion.button
                            key={g.id}
                            type="button"
                            onClick={() => handleChange('barva', g.gradient)}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className={`relative h-20 cursor-pointer rounded-lg shadow-sm transition-all
                                       ${form.barva === g.gradient ? 'scale-105 ring-2 ring-gray-900 ring-offset-2' : 'hover:shadow-md'}`}
                            style={{ background: g.gradient }}
                          >
                            {form.barva === g.gradient && (
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute inset-0 flex items-center justify-center">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg">
                                  <Check className="h-5 w-5 text-gray-900" weight="bold" />
                                </div>
                              </motion.div>
                            )}
                            <div className="absolute bottom-2 left-0 right-0 text-center">
                              <span className="text-xs font-semibold text-white drop-shadow-lg">{g.name}</span>
                            </div>
                          </motion.button>
                        ))}
                      </AnimatePresence>
                    </div>

                    <motion.button
                      type="button"
                      onClick={() => setColorPage((p) => Math.min(totalColorPages - 1, p + 1))}
                      disabled={colorPage >= totalColorPages - 1}
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-all
                                 ${colorPage >= totalColorPages - 1 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      <CaretRight className="w-5 h-5" weight="bold" />
                    </motion.button>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 mt-3">
                    {Array.from({ length: totalColorPages }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setColorPage(i)}
                        className={`h-2 rounded-full transition-all ${colorPage === i ? 'w-4 bg-gray-900' : 'w-2 bg-gray-300 hover:bg-gray-400'}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Kolicina + Kapaciteta */}
                <div className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-100 bg-white p-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {t('modal.quantityLabel')}
                    </label>
                    <div className="relative">
                      <Cube className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                      <input
                        type="number"
                        value={form.kolicina}
                        onChange={(e) => handleChange('kolicina', Math.max(1, parseInt(e.target.value, 10) || 1))}
                        min={1}
                        className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-[#1A1F36]
                                   focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-400">{t('modal.quantityHelp')}</p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {t('modal.capacityLabel')}
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                      <input
                        type="number"
                        value={form.kapaciteta}
                        onChange={(e) => handleChange('kapaciteta', Math.max(1, parseInt(e.target.value, 10) || 1))}
                        min={1}
                        className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-[#1A1F36]
                                   focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-400">{t('modal.capacityHelp')}</p>
                  </div>
                </div>

                {/* Total capacity badge */}
                <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-4 py-2.5">
                  <Users className="h-4 w-4 text-gray-500" weight="fill" />
                  <span className="text-sm font-medium text-gray-700">
                    {t('modal.totalCapacityLabel')}: {t('modal.totalCapacityValue', { value: skupnaKapaciteta })}
                  </span>
                </div>

                {/* Show in booking toggle */}
                <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-gray-400" weight="regular" />
                    <span className="text-sm text-[#1A1F36]">{t('modal.showInBookingLabel')}</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.prikazi_v_bookingu}
                    onClick={() => handleChange('prikazi_v_bookingu', !form.prikazi_v_bookingu)}
                    className={`relative h-6 w-11 rounded-full transition-colors focus:outline-none
                               ${form.prikazi_v_bookingu ? 'bg-gray-900' : 'bg-gray-200'}`}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform
                                 ${form.prikazi_v_bookingu ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                  </button>
                </div>

                {/* Schedule section */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.scheduleLabel')}
                  </label>

                  {/* Toggle: always available vs custom schedule */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setUseCustomSchedule(false);
                        handleChange('urnik', null);
                      }}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors
                                 ${!useCustomSchedule
                                   ? 'border-gray-900 bg-gray-900 text-white'
                                   : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      <Globe className="h-4 w-4" weight="regular" />
                      {t('modal.alwaysAvailable')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUseCustomSchedule(true);
                        if (!form.urnik) handleChange('urnik', DEFAULT_URNIK);
                      }}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors
                                 ${useCustomSchedule
                                   ? 'border-gray-900 bg-gray-900 text-white'
                                   : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      <Clock className="h-4 w-4" weight="regular" />
                      {t('modal.customSchedule')}
                    </button>
                  </div>

                  {/* Schedule editor */}
                  {useCustomSchedule && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 space-y-2 overflow-hidden"
                    >
                      {URNIK_DAYS.map((day) => {
                        const dayData = urnik[day];
                        return (
                          <div key={day} className="rounded-lg border border-gray-100 bg-[#F7F8FA] p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={dayData.enabled}
                                  onClick={() => toggleDay(day)}
                                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                                             ${dayData.enabled ? 'bg-gray-900' : 'bg-gray-200'}`}
                                >
                                  <span
                                    className={`absolute left-[3px] top-[3px] inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform
                                               ${dayData.enabled ? 'translate-x-4' : 'translate-x-0'}`}
                                  />
                                </button>
                                <span className={`text-sm font-medium ${dayData.enabled ? 'text-[#1A1F36]' : 'text-gray-400'}`}>
                                  {t(`days.${day}`)} <span className="hidden sm:inline font-normal text-gray-400">({day})</span>
                                </span>
                              </div>

                              {dayData.enabled && (
                                <button
                                  type="button"
                                  onClick={() => addInterval(day)}
                                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
                                >
                                  <Plus className="h-3 w-3" weight="bold" />
                                  {t('modal.addInterval')}
                                </button>
                              )}
                            </div>

                            {dayData.enabled && (
                              <div className="mt-2 space-y-1.5">
                                {dayData.intervals.map((interval, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <input
                                      type="time"
                                      value={interval.start}
                                      onChange={(e) => updateInterval(day, idx, 'start', e.target.value)}
                                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-[#1A1F36] focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900/10"
                                    />
                                    <span className="text-xs text-gray-400">–</span>
                                    <input
                                      type="time"
                                      value={interval.end}
                                      onChange={(e) => updateInterval(day, idx, 'end', e.target.value)}
                                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-[#1A1F36] focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900/10"
                                    />
                                    {dayData.intervals.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => removeInterval(day, idx)}
                                        className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                      >
                                        <Minus className="h-3 w-3" weight="bold" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </div>

                {/* Connected services */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.servicesLabel')}
                  </label>
                  <p className="mb-2 text-xs text-gray-400">{t('modal.servicesHelp')}</p>

                  {services.length === 0 ? (
                    <p className="rounded-lg border border-gray-200 bg-[#F7F8FA] p-4 text-center text-sm text-gray-400">
                      {t('modal.noServicesAvailable')}
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                      {services.map((svc) => {
                        const isLinked = form.storitve_ids.includes(svc.id);
                        return (
                          <button
                            key={svc.id}
                            type="button"
                            onClick={() => toggleService(svc.id)}
                            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors border-b border-gray-100 last:border-0
                                       ${isLinked ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                          >
                            <div
                              className="h-4 w-4 flex-shrink-0 rounded-full shadow-sm"
                              style={{ background: svc.barva }}
                            />
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm font-medium ${isLinked ? 'text-gray-900' : 'text-[#1A1F36]'}`}>
                                {svc.naziv}
                              </span>
                              <span className="ml-2 text-xs text-gray-400">{svc.trajanje} min</span>
                            </div>
                            <div className={`h-5 w-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors
                                           ${isLinked ? 'border-gray-900 bg-gray-900' : 'border-gray-300'}`}>
                              {isLinked && <Check className="h-3 w-3 text-white" weight="bold" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              </div>

              {/* Footer */}
              <div className="flex flex-shrink-0 items-center justify-end gap-3 border-t border-gray-100 bg-white px-4 py-4 sm:px-5">
                <motion.button
                  type="button"
                  onClick={onClose}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-lg px-5 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
                >
                  Prekliči
                </motion.button>
                <motion.button
                  type="submit"
                  disabled={isSaving}
                  whileHover={{ scale: isSaving ? 1 : 1.02 }}
                  whileTap={{ scale: isSaving ? 1 : 0.98 }}
                  className="flex items-center gap-2 rounded-lg bg-[#0a0a0a] px-5 py-2.5
                             text-sm font-medium text-white shadow-sm transition-colors
                             hover:bg-[#1f1f1f] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSaving ? (
                    <>
                      <SpinnerGap className="h-4 w-4 animate-spin" />
                      {t('modal.saving')}
                    </>
                  ) : (
                    <>
                      <FloppyDisk className="h-4 w-4" weight="bold" />
                      {t('modal.save')}
                    </>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(ResursModal);
