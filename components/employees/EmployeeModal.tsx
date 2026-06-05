'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  User,
  Envelope,
  Phone,
  Briefcase,
  NotePencil,
  FloppyDisk,
  SpinnerGap,
  Warning,
} from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import type { Employee, EmployeeFormData } from '@/types/employees';
import { checkEmployeeEmailExists } from '@/lib/supabase/employees';
import { getDefaultGradient, isValidGradient } from '@/lib/constants/gradients';
import GradientSelector from './GradientSelector';
import EmployeeAvatar from './EmployeeAvatar';

type ModalMode = 'create' | 'edit';

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee?: Employee | null;
  mode: ModalMode;
  companyId: string;
  onSave: (data: EmployeeFormData) => Promise<void>;
  isSaving?: boolean;
}

// Validation helpers
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePhone(phone: string): boolean {
  if (!phone) return true;
  const phoneRegex = /^[+]?[\d\s()-]{6,20}$/;
  return phoneRegex.test(phone);
}

function EmployeeModal({
  isOpen,
  onClose,
  employee,
  mode,
  companyId,
  onSave,
  isSaving = false,
}: EmployeeModalProps) {
  const t = useTranslations('staff');
  const tCommon = useTranslations('common');

  // Default gradient CSS
  const defaultGradient = getDefaultGradient();

  // Form state
  const [formData, setFormData] = useState<EmployeeFormData>({
    ime: '',
    priimek: '',
    email: '',
    telefon: '',
    pozicija: '',
    barva: defaultGradient, // Full CSS gradient string
    opombe: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeFormData, string>>>({});
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailExists, setEmailExists] = useState(false);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && employee) {
        setFormData({
          ime: employee.ime || '',
          priimek: employee.priimek || '',
          email: employee.email || '',
          telefon: employee.telefon || '',
          pozicija: employee.pozicija || '',
          barva: isValidGradient(employee.barva) ? employee.barva : defaultGradient,
          opombe: employee.opombe || '',
        });
      } else {
        setFormData({
          ime: '',
          priimek: '',
          email: '',
          telefon: '',
          pozicija: '',
          barva: defaultGradient,
          opombe: '',
        });
      }
      setErrors({});
      setEmailExists(false);
    }
  }, [isOpen, mode, employee, defaultGradient]);

  // Validate individual field
  const validateField = useCallback((name: keyof EmployeeFormData, value: unknown): string => {
    // Skip validation for complex types (urnik, storitve)
    if (typeof value !== 'string' && typeof value !== 'number') {
      return '';
    }
    switch (name) {
      case 'ime':
        if (!String(value).trim()) return t('modal.validationFirstNameRequired');
        if (String(value).trim().length < 2) return t('modal.validationFirstNameMinLength');
        return '';
      case 'priimek':
        if (!String(value).trim()) return t('modal.validationLastNameRequired');
        if (String(value).trim().length < 2) return t('modal.validationLastNameMinLength');
        return '';
      case 'email':
        if (!String(value).trim()) return t('modal.validationEmailRequired');
        if (!validateEmail(String(value))) return t('modal.validationEmailInvalid');
        return '';
      case 'telefon':
        if (value && !validatePhone(String(value))) return t('modal.validationPhoneInvalid');
        return '';
      case 'barva':
        if (!isValidGradient(String(value))) return t('modal.validationAvatarColorRequired');
        return '';
      case 'opombe':
        if (String(value).length > 500) return t('modal.validationNotesMaxLength');
        return '';
      default:
        return '';
    }
  }, [t]);

  // Handle field change
  const handleChange = useCallback((name: keyof EmployeeFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Real-time validation
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));

    // Reset email exists check when email changes
    if (name === 'email') {
      setEmailExists(false);
    }
  }, [validateField]);

  // Check email uniqueness
  const handleEmailBlur = useCallback(async () => {
    if (!formData.email || errors.email) return;

    setEmailChecking(true);
    try {
      const result = await checkEmployeeEmailExists(
        companyId,
        formData.email,
        mode === 'edit' ? employee?.id : undefined
      );
      if (result.exists) {
        setEmailExists(true);
        setErrors((prev) => ({ ...prev, email: t('modal.validationEmailExists') }));
      } else {
        setEmailExists(false);
        if (errors.email === t('modal.validationEmailExists')) {
          setErrors((prev) => ({ ...prev, email: '' }));
        }
      }
    } catch {
      // Ignore errors
    } finally {
      setEmailChecking(false);
    }
  }, [formData.email, errors.email, companyId, mode, employee?.id, t]);

  // Validate all fields
  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof EmployeeFormData, string>> = {};
    let isValid = true;

    (Object.keys(formData) as Array<keyof EmployeeFormData>).forEach((key) => {
      const error = validateField(key, formData[key]);
      if (error) {
        newErrors[key] = error;
        isValid = false;
      }
    });

    if (emailExists) {
      newErrors.email = t('modal.validationEmailExists');
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  }, [formData, validateField, emailExists, t]);

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
            className="relative flex w-full max-w-xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-[#F7F8FA] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b border-gray-100 bg-white px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {/* Avatar preview */}
                  <EmployeeAvatar
                    firstName={formData.ime || '?'}
                    lastName={formData.priimek || '?'}
                    gradient={formData.barva}
                    size="md"
                  />
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {mode === 'create' ? t('modal.createTitle') : t('modal.editTitle')}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {mode === 'create' ? t('modal.createSubtitle') : t('modal.editSubtitle')}
                    </p>
                  </div>
                </div>
                <motion.button
                  type="button"
                  onClick={onClose}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="h-5 w-5" weight="bold" />
                </motion.button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <div className="space-y-5">
                  {/* Personal info */}
                  <div className="rounded-2xl border border-gray-100 bg-white p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* First name */}
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-900">
                          {t('modal.firstNameLabel')}
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                          <input
                            type="text"
                            value={formData.ime}
                            onChange={(e) => handleChange('ime', e.target.value)}
                            placeholder={t('modal.firstNamePlaceholder')}
                            className={`w-full rounded-lg border bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400
                                       transition-colors focus:outline-none focus:ring-2
                                       ${errors.ime
                                         ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10'
                                         : 'border-gray-200 focus:border-gray-900 focus:ring-gray-900/10'
                                       }`}
                          />
                        </div>
                        {errors.ime && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                            <Warning className="h-3 w-3" weight="fill" />
                            {errors.ime}
                          </p>
                        )}
                      </div>

                      {/* Last name */}
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-900">
                          {t('modal.lastNameLabel')}
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                          <input
                            type="text"
                            value={formData.priimek}
                            onChange={(e) => handleChange('priimek', e.target.value)}
                            placeholder={t('modal.lastNamePlaceholder')}
                            className={`w-full rounded-lg border bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400
                                       transition-colors focus:outline-none focus:ring-2
                                       ${errors.priimek
                                         ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10'
                                         : 'border-gray-200 focus:border-gray-900 focus:ring-gray-900/10'
                                       }`}
                          />
                        </div>
                        {errors.priimek && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                            <Warning className="h-3 w-3" weight="fill" />
                            {errors.priimek}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Email */}
                    <div className="mt-4">
                      <label className="mb-1.5 block text-sm font-medium text-gray-900">
                        {t('modal.emailLabel')}
                      </label>
                      <div className="relative">
                        <Envelope className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleChange('email', e.target.value)}
                          onBlur={handleEmailBlur}
                          placeholder={t('modal.emailPlaceholder')}
                          className={`w-full rounded-lg border bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder-gray-400
                                     transition-colors focus:outline-none focus:ring-2
                                     ${errors.email
                                       ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10'
                                       : 'border-gray-200 focus:border-gray-900 focus:ring-gray-900/10'
                                     }`}
                        />
                        {emailChecking && (
                          <SpinnerGap className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
                        )}
                      </div>
                      {errors.email && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                          <Warning className="h-3 w-3" weight="fill" />
                          {errors.email}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {/* Phone */}
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-900">
                          {t('modal.phoneLabel')}
                        </label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                          <input
                            type="tel"
                            value={formData.telefon}
                            onChange={(e) => handleChange('telefon', e.target.value)}
                            placeholder={t('modal.phonePlaceholder')}
                            className={`w-full rounded-lg border bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400
                                       transition-colors focus:outline-none focus:ring-2
                                       ${errors.telefon
                                         ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10'
                                         : 'border-gray-200 focus:border-gray-900 focus:ring-gray-900/10'
                                       }`}
                          />
                        </div>
                        {errors.telefon && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                            <Warning className="h-3 w-3" weight="fill" />
                            {errors.telefon}
                          </p>
                        )}
                      </div>

                      {/* Position */}
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-900">
                          {t('modal.positionLabel')}
                        </label>
                        <div className="relative">
                          <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                          <input
                            type="text"
                            value={formData.pozicija}
                            onChange={(e) => handleChange('pozicija', e.target.value)}
                            placeholder={t('modal.positionPlaceholder')}
                            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900
                                      placeholder-gray-400 transition-colors focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Gradient selector */}
                  <div className="rounded-2xl border border-gray-100 bg-white p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <EmployeeAvatar
                        firstName={formData.ime || '?'}
                        lastName={formData.priimek || '?'}
                        gradient={formData.barva}
                        size="md"
                      />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {t('modal.avatarColorLabel')}
                        </p>
                      </div>
                    </div>
                    <GradientSelector
                      value={formData.barva}
                      onChange={(gradient) => handleChange('barva', gradient)}
                    />
                    {errors.barva && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                        <Warning className="h-3 w-3" weight="fill" />
                        {errors.barva}
                      </p>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="rounded-2xl border border-gray-100 bg-white p-5">
                    <label className="mb-1.5 block text-sm font-medium text-gray-900">
                      {t('modal.notesLabel')}
                    </label>
                    <div className="relative">
                      <NotePencil className="absolute left-3 top-3 h-4 w-4 text-gray-400" weight="regular" />
                      <textarea
                        value={formData.opombe}
                        onChange={(e) => handleChange('opombe', e.target.value)}
                        placeholder={t('modal.notesPlaceholder')}
                        rows={3}
                        className={`w-full resize-none rounded-lg border bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900
                                   placeholder-gray-400 transition-colors focus:outline-none focus:ring-2
                                   ${errors.opombe
                                     ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10'
                                     : 'border-gray-200 focus:border-gray-900 focus:ring-gray-900/10'
                                   }`}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      {errors.opombe ? (
                        <p className="flex items-center gap-1 text-xs text-red-600">
                          <Warning className="h-3 w-3" weight="fill" />
                          {errors.opombe}
                        </p>
                      ) : (
                        <span />
                      )}
                      <span className="text-xs text-gray-400">
                        {formData.opombe.length}/500
                      </span>
                    </div>
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
                  {tCommon('buttons.cancel')}
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

export default memo(EmployeeModal);
