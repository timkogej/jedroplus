'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Tag,
  Folder,
  Clock,
  CurrencyEur,
  NotePencil,
  FloppyDisk,
  SpinnerGap,
  Warning,
  Palette,
  Check,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import type { Service, ServiceFormData } from '@/types/services';
import { DURATION_OPTIONS } from '@/types/services';
import { Select, SelectOption } from '@/components/ui/animated-select';
import { SERVICE_GRADIENTS, DEFAULT_SERVICE_GRADIENT, isGradient } from '@/lib/constants/serviceGradients';

type ModalMode = 'create' | 'edit';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  service?: Service | null;
  mode: ModalMode;
  onSave: (data: ServiceFormData) => Promise<void>;
  isSaving?: boolean;
  currency?: string; // from company settings
  existingCategories?: string[]; // existing categories from database for suggestions
}

function ServiceModal({
  isOpen,
  onClose,
  service,
  mode,
  onSave,
  isSaving = false,
  currency = 'EUR',
  existingCategories = [],
}: ServiceModalProps) {
  const t = useTranslations('services');
  const tCommon = useTranslations('common');

  // Form state
  const [formData, setFormData] = useState<ServiceFormData>({
    naziv: '',
    kategorija: '',
    barva: DEFAULT_SERVICE_GRADIENT,
    trajanje: 30,
    buffer_pred: 0,
    buffer_po: 0,
    tip_cene: 'fiksna',
    cena: '',
    opis: '',
  });

  const [customDuration, setCustomDuration] = useState(false);
  const [customCategory, setCustomCategory] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ServiceFormData, string>>>({});

  // Gradient pagination state - 4 colors per page
  const COLORS_PER_PAGE = 4;
  const [colorPage, setColorPage] = useState(0);
  const totalColorPages = Math.ceil(SERVICE_GRADIENTS.length / COLORS_PER_PAGE);
  const visibleGradients = SERVICE_GRADIENTS.slice(
    colorPage * COLORS_PER_PAGE,
    (colorPage + 1) * COLORS_PER_PAGE
  );

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && service) {
        const isCustomDuration = !DURATION_OPTIONS.some(opt => opt.value === service.trajanje);
        setCustomDuration(isCustomDuration);
        // Convert old hex colors to gradients if needed
        const existingColor = service.barva || DEFAULT_SERVICE_GRADIENT;
        const colorValue = isGradient(existingColor) ? existingColor : DEFAULT_SERVICE_GRADIENT;
        setFormData({
          naziv: service.naziv || '',
          kategorija: service.kategorija || '',
          barva: colorValue,
          trajanje: service.trajanje || 30,
          buffer_pred: service.buffer_pred || 0,
          buffer_po: service.buffer_po || 0,
          tip_cene: service.tip_cene || 'fiksna',
          cena: service.cena?.toString() || '',
          opis: service.opis || '',
        });
      } else {
        setCustomDuration(false);
        setFormData({
          naziv: '',
          kategorija: '',
          barva: DEFAULT_SERVICE_GRADIENT,
          trajanje: 30,
          buffer_pred: 0,
          buffer_po: 0,
          tip_cene: 'fiksna',
          cena: '',
          opis: '',
        });
      }
      setErrors({});
      // If editing and category is not in existing categories, show custom input
      if (mode === 'edit' && service?.kategorija) {
        setCustomCategory(!existingCategories.includes(service.kategorija));
      } else {
        setCustomCategory(false);
      }
    }
  }, [isOpen, mode, service, existingCategories]);

  // Validate individual field
  const validateField = useCallback((name: keyof ServiceFormData, value: string | number): string => {
    switch (name) {
      case 'naziv':
        if (!String(value).trim()) return t('modal.validationNameRequired');
        if (String(value).trim().length < 2) return t('modal.validationNameMinLength');
        if (String(value).length > 100) return t('modal.validationNameMaxLength');
        return '';
      case 'kategorija':
        if (!String(value).trim()) return t('modal.validationCategoryRequired');
        return '';
      case 'barva': {
        if (!String(value)) return t('modal.validationColorInvalid');
        const colorVal = String(value);
        if (!isGradient(colorVal) && !/^#([A-Fa-f0-9]{6})$/.test(colorVal)) {
          return t('modal.validationColorInvalid');
        }
        return '';
      }
      case 'trajanje':
        if (!value || Number(value) <= 0) return t('modal.validationDurationMin');
        if (Number(value) > 480) return t('modal.validationDurationMax');
        return '';
      case 'cena':
        if (value && (isNaN(Number(value)) || Number(value) < 0)) {
          return t('modal.validationPriceInvalid');
        }
        return '';
      case 'opis':
        if (String(value).length > 500) return t('modal.validationDescriptionMaxLength');
        return '';
      default:
        return '';
    }
  }, [t]);

  // Handle field change
  const handleChange = useCallback((name: keyof ServiceFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Real-time validation
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  }, [validateField]);

  // Handle duration selection
  const handleDurationSelect = useCallback((value: string) => {
    if (value === 'custom') {
      setCustomDuration(true);
    } else {
      setCustomDuration(false);
      handleChange('trajanje', parseInt(value, 10));
    }
  }, [handleChange]);

  // Validate all fields
  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof ServiceFormData, string>> = {};
    let isValid = true;

    (Object.keys(formData) as Array<keyof ServiceFormData>).forEach((key) => {
      const error = validateField(key, formData[key]);
      if (error) {
        newErrors[key] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [formData, validateField]);

  // Handle submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    await onSave(formData);
  }, [formData, validateForm, onSave]);

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
    exit: { opacity: 0, scale: 0.95, y: 20 },
  };

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
            className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gradient header */}
            <div className="bg-gradient-to-r from-violet-500 to-cyan-500 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {mode === 'create' ? t('modal.createTitle') : t('modal.editTitle')}
                  </h2>
                  <p className="mt-1 text-sm text-white/80">
                    {mode === 'create' ? t('modal.createSubtitle') : t('modal.editSubtitle')}
                  </p>
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
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="max-h-[calc(90vh-180px)] overflow-y-auto p-6">
              <div className="space-y-4">
                {/* Service name */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.nameLabel')}
                  </label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                    <input
                      type="text"
                      value={formData.naziv}
                      onChange={(e) => handleChange('naziv', e.target.value)}
                      placeholder={t('modal.namePlaceholder')}
                      maxLength={100}
                      className={`w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm text-[#1A1F36] placeholder-gray-400
                                 transition-all focus:outline-none focus:ring-2
                                 ${errors.naziv
                                   ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                   : 'border-gray-200 focus:border-violet-400 focus:ring-violet-100'
                                 }`}
                    />
                  </div>
                  {errors.naziv && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <Warning className="h-3 w-3" weight="fill" />
                      {errors.naziv}
                    </p>
                  )}
                </div>

                {/* Category - Select with existing categories + custom option */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.categoryLabel')}
                  </label>
                  {customCategory ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Folder className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                        <input
                          type="text"
                          value={formData.kategorija}
                          onChange={(e) => handleChange('kategorija', e.target.value)}
                          placeholder={t('modal.categoryInputPlaceholder')}
                          autoFocus
                          className={`w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm text-[#1A1F36] placeholder-gray-400
                                     transition-all focus:outline-none focus:ring-2
                                     ${errors.kategorija
                                       ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                       : 'border-gray-200 focus:border-violet-400 focus:ring-violet-100'
                                     }`}
                        />
                      </div>
                      {existingCategories.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomCategory(false);
                            handleChange('kategorija', '');
                          }}
                          className="text-xs font-medium text-violet-600 hover:text-violet-700"
                        >
                          {t('modal.categoryBackToExisting')}
                        </button>
                      )}
                    </div>
                  ) : existingCategories.length > 0 ? (
                    <div className="relative">
                      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <Folder className="h-4 w-4" weight="regular" />
                      </div>
                      <Select
                        value={formData.kategorija}
                        setValue={(value) => {
                          if (value === '__custom__') {
                            setCustomCategory(true);
                            handleChange('kategorija', '');
                          } else {
                            handleChange('kategorija', value);
                          }
                        }}
                        placeholder={t('modal.categorySelectPlaceholder')}
                        className="[&>button]:pl-10"
                      >
                        {existingCategories.map((cat) => (
                          <SelectOption key={cat} value={cat}>
                            {cat}
                          </SelectOption>
                        ))}
                        <SelectOption value="__custom__">
                          {t('modal.categoryNewOption')}
                        </SelectOption>
                      </Select>
                    </div>
                  ) : (
                    <div className="relative">
                      <Folder className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                      <input
                        type="text"
                        value={formData.kategorija}
                        onChange={(e) => handleChange('kategorija', e.target.value)}
                        placeholder={t('modal.categoryFirstPlaceholder')}
                        className={`w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm text-[#1A1F36] placeholder-gray-400
                                   transition-all focus:outline-none focus:ring-2
                                   ${errors.kategorija
                                     ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                     : 'border-gray-200 focus:border-violet-400 focus:ring-violet-100'
                                   }`}
                      />
                    </div>
                  )}
                  {errors.kategorija && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <Warning className="h-3 w-3" weight="fill" />
                      {errors.kategorija}
                    </p>
                  )}
                </div>

                {/* Gradient Color Selector with Pagination */}
                <div>
                  <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.colorLabel')}
                  </label>

                  {/* Gradient options grid with pagination */}
                  <div className="flex items-center gap-2">
                    {/* Left arrow */}
                    <motion.button
                      type="button"
                      onClick={() => setColorPage((p) => Math.max(0, p - 1))}
                      disabled={colorPage === 0}
                      whileHover={{ scale: colorPage === 0 ? 1 : 1.1 }}
                      whileTap={{ scale: colorPage === 0 ? 1 : 0.95 }}
                      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all
                                 ${colorPage === 0
                                   ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                   : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                 }`}
                    >
                      <CaretLeft className="w-5 h-5" weight="bold" />
                    </motion.button>

                    {/* Gradient options - 4 at a time */}
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
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className={`relative h-20 rounded-xl transition-all cursor-pointer shadow-sm
                                       ${formData.barva === g.gradient
                                         ? 'ring-4 ring-violet-500 ring-offset-2 scale-105'
                                         : 'hover:shadow-lg'
                                       }`}
                            style={{ background: g.gradient }}
                          >
                            {/* Checkmark when selected */}
                            {formData.barva === g.gradient && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute inset-0 flex items-center justify-center"
                              >
                                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                                  <Check className="w-5 h-5 text-violet-600" weight="bold" />
                                </div>
                              </motion.div>
                            )}

                            {/* Gradient name */}
                            <div className="absolute bottom-2 left-0 right-0 text-center">
                              <span className="text-xs font-semibold text-white drop-shadow-lg">
                                {g.name}
                              </span>
                            </div>
                          </motion.button>
                        ))}
                      </AnimatePresence>
                    </div>

                    {/* Right arrow */}
                    <motion.button
                      type="button"
                      onClick={() => setColorPage((p) => Math.min(totalColorPages - 1, p + 1))}
                      disabled={colorPage >= totalColorPages - 1}
                      whileHover={{ scale: colorPage >= totalColorPages - 1 ? 1 : 1.1 }}
                      whileTap={{ scale: colorPage >= totalColorPages - 1 ? 1 : 0.95 }}
                      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all
                                 ${colorPage >= totalColorPages - 1
                                   ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                   : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                 }`}
                    >
                      <CaretRight className="w-5 h-5" weight="bold" />
                    </motion.button>
                  </div>

                  {/* Page indicator dots */}
                  <div className="flex items-center justify-center gap-1.5 mt-3">
                    {Array.from({ length: totalColorPages }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setColorPage(i)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          colorPage === i
                            ? 'bg-violet-500 w-4'
                            : 'bg-gray-300 hover:bg-gray-400'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Selected gradient preview */}
                  <div className="mt-4 p-4 rounded-xl border-2 border-gray-200">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-16 h-16 rounded-xl shadow-lg flex-shrink-0"
                        style={{ background: formData.barva }}
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-700">
                          {t('modal.colorSelected')}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {SERVICE_GRADIENTS.find(g => g.gradient === formData.barva)?.name || t('modal.colorCustom')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                    <Palette className="h-3.5 w-3.5" weight="regular" />
                    {t('modal.colorHint')}
                  </p>

                  {errors.barva && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <Warning className="h-3 w-3" weight="fill" />
                      {errors.barva}
                    </p>
                  )}
                </div>

                {/* Duration */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.durationLabel')}
                  </label>
                  {!customDuration ? (
                    <div className="relative">
                      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <Clock className="h-4 w-4" weight="regular" />
                      </div>
                      <Select
                        value={formData.trajanje.toString()}
                        setValue={handleDurationSelect}
                        placeholder={t('modal.durationSelectPlaceholder')}
                        className="[&>button]:pl-10"
                      >
                        {DURATION_OPTIONS.map((opt) => (
                          <SelectOption key={opt.value} value={opt.value.toString()}>
                            {opt.label}
                          </SelectOption>
                        ))}
                        <SelectOption value="custom">{t('modal.durationCustomOption')}</SelectOption>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                        <input
                          type="number"
                          value={formData.trajanje}
                          onChange={(e) => handleChange('trajanje', parseInt(e.target.value, 10) || 0)}
                          placeholder="45"
                          min={1}
                          max={480}
                          className={`w-full rounded-xl border py-2.5 pl-10 pr-16 text-sm text-[#1A1F36] placeholder-gray-400
                                     transition-all focus:outline-none focus:ring-2
                                     ${errors.trajanje
                                       ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                       : 'border-gray-200 focus:border-violet-400 focus:ring-violet-100'
                                     }`}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                          {t('modal.durationUnit')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCustomDuration(false)}
                        className="text-xs font-medium text-violet-600 hover:text-violet-700"
                      >
                        {t('modal.durationBackToPreset')}
                      </button>
                    </div>
                  )}
                  {errors.trajanje && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <Warning className="h-3 w-3" weight="fill" />
                      {errors.trajanje}
                    </p>
                  )}
                </div>

                {/* Price (always fixed) */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.priceLabel')}
                  </label>
                  <div className="relative">
                    <CurrencyEur className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                    <input
                      type="number"
                      value={formData.cena}
                      onChange={(e) => handleChange('cena', e.target.value)}
                      placeholder="35.00"
                      step="0.01"
                      min={0}
                      className={`w-full rounded-xl border py-2.5 pl-10 pr-16 text-sm text-[#1A1F36] placeholder-gray-400
                                 transition-all focus:outline-none focus:ring-2
                                 ${errors.cena
                                   ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                   : 'border-gray-200 focus:border-violet-400 focus:ring-violet-100'
                                 }`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
                      {currency}
                    </span>
                  </div>
                  {errors.cena && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <Warning className="h-3 w-3" weight="fill" />
                      {errors.cena}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.descriptionLabel')}
                  </label>
                  <div className="relative">
                    <NotePencil className="absolute left-3 top-3 h-4 w-4 text-gray-400" weight="regular" />
                    <textarea
                      value={formData.opis}
                      onChange={(e) => handleChange('opis', e.target.value)}
                      placeholder={t('modal.descriptionPlaceholder')}
                      rows={3}
                      maxLength={500}
                      className={`w-full resize-none rounded-xl border py-2.5 pl-10 pr-4 text-sm text-[#1A1F36]
                                 placeholder-gray-400 transition-all focus:outline-none focus:ring-2
                                 ${errors.opis
                                   ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                   : 'border-gray-200 focus:border-violet-400 focus:ring-violet-100'
                                 }`}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    {errors.opis ? (
                      <p className="flex items-center gap-1 text-xs text-red-500">
                        <Warning className="h-3 w-3" weight="fill" />
                        {errors.opis}
                      </p>
                    ) : (
                      <span />
                    )}
                    <span className="text-xs text-gray-400">
                      {formData.opis.length}/500
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-6 flex items-center justify-end gap-3">
                <motion.button
                  type="button"
                  onClick={onClose}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-xl px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
                >
                  {tCommon('buttons.cancel')}
                </motion.button>
                <motion.button
                  type="submit"
                  disabled={isSaving}
                  whileHover={{ scale: isSaving ? 1 : 1.02 }}
                  whileTap={{ scale: isSaving ? 1 : 0.98 }}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-2.5
                             text-sm font-medium text-white shadow-lg shadow-cyan-500/25 transition-all
                             hover:shadow-xl hover:shadow-cyan-500/30 disabled:opacity-70"
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

export default memo(ServiceModal);
