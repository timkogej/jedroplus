'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  User,
  Envelope,
  Phone,
  FloppyDisk,
  SpinnerGap,
  Warning,
  GenderIntersex,
  Tag,
} from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import type { Client, ClientFormData, Gender, ClientType } from '@/types/clients';
import { Select, SelectOption } from '@/components/ui/animated-select';
import { checkEmailExists } from '@/lib/supabase/clients';

type ModalMode = 'create' | 'edit';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client?: Client | null;
  mode: ModalMode;
  companyId: string;
  onSave: (data: ClientFormData) => Promise<void>;
  isSaving?: boolean;
}

// Normalize client type value from DB to form values
function normalizeClientType(value: string | undefined | null): ClientType {
  const v = (value || '').toLowerCase().trim();
  if (v === 'redna') return 'redna';
  if (v === 'vip') return 'vip';
  return 'nova';
}

// Normalize gender value from DB to form values
function normalizeGender(spol: string | undefined | null): Gender | '' {
  const v = (spol || '').toLowerCase().trim();
  if (v === 'male' || v === 'moški' || v === 'moski') return 'moški';
  if (v === 'female' || v === 'ženska' || v === 'zenska') return 'ženska';
  if (v === 'other' || v === 'drugo') return 'drugo';
  return '';
}

// Validation helpers
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePhone(phone: string): boolean {
  if (!phone) return true; // Phone is optional
  // Allow various phone formats
  const phoneRegex = /^[+]?[\d\s()-]{6,20}$/;
  return phoneRegex.test(phone);
}

function ClientModal({
  isOpen,
  onClose,
  client,
  mode,
  companyId,
  onSave,
  isSaving = false,
}: ClientModalProps) {
  const t = useTranslations('clients');

  // Form state
  const [formData, setFormData] = useState<ClientFormData>({
    ime: '',
    priimek: '',
    spol: '',
    tip_stranke: 'nova',
    email: '',
    telefon: '',
    opombe: '',
    interne_opombe: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ClientFormData, string>>>({});
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [showInternalNotes, setShowInternalNotes] = useState(false);
  const [contactWarning, setContactWarning] = useState<{
    missingEmail: boolean;
    missingPhone: boolean;
  } | null>(null);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && client) {
        // Read notes from correct database column names
        const clientRecord = client as unknown as Record<string, unknown>;
        const opombe = (clientRecord['Opombe stranke'] as string)
          ?? (clientRecord['opombe'] as string)
          ?? (client.opombe as string)
          ?? '';
        const interneOpombe = (clientRecord['Interne opombe'] as string)
          ?? (clientRecord['interne_opombe'] as string)
          ?? (client.interne_opombe as string)
          ?? '';

        const tipStranke = (clientRecord['Tip stranke'] as string)
          ?? (client.tip_stranke as string)
          ?? '';

        setFormData({
          ime: client.ime || '',
          priimek: client.priimek || '',
          spol: normalizeGender(client.spol),
          tip_stranke: normalizeClientType(tipStranke),
          email: client.email || '',
          telefon: client.telefon || '',
          opombe: opombe,
          interne_opombe: interneOpombe,
        });
      } else {
        setFormData({
          ime: '',
          priimek: '',
          spol: '',
          tip_stranke: 'nova',
          email: '',
          telefon: '',
          opombe: '',
          interne_opombe: '',
        });
      }
      setErrors({});
      setEmailExists(false);
      setContactWarning(null);
      setShowInternalNotes(mode === 'edit');
    }
  }, [isOpen, mode, client]);

  // Validate individual field
  const validateField = useCallback((name: keyof ClientFormData, value: string): string => {
    switch (name) {
      case 'ime':
        if (!value.trim()) return t('modal.validation.firstNameRequired');
        if (value.trim().length < 2) return t('modal.validation.firstNameMinLength');
        return '';
      case 'priimek':
        if (!value.trim()) return t('modal.validation.lastNameRequired');
        if (value.trim().length < 2) return t('modal.validation.lastNameMinLength');
        return '';
      case 'spol':
        if (!value) return t('modal.validation.genderRequired');
        return '';
      case 'email':
        if (value.trim() && !validateEmail(value)) return t('modal.validation.emailInvalid');
        return '';
      case 'telefon':
        if (value && !validatePhone(value)) return t('modal.validation.phoneInvalid');
        return '';
      case 'opombe':
        if (value.length > 500) return t('modal.validation.notesMaxLength');
        return '';
      case 'interne_opombe':
        if (value.length > 500) return t('modal.validation.internalNotesMaxLength');
        return '';
      default:
        return '';
    }
  }, []);

  // Handle field change
  const handleChange = useCallback((name: keyof ClientFormData, value: string) => {
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
      const result = await checkEmailExists(
        companyId,
        formData.email,
        mode === 'edit' ? client?.id : undefined
      );
      if (result.exists) {
        setEmailExists(true);
        setErrors((prev) => ({ ...prev, email: t('modal.validation.emailExists') }));
      } else {
        setEmailExists(false);
        if (errors.email === t('modal.validation.emailExists')) {
          setErrors((prev) => ({ ...prev, email: '' }));
        }
      }
    } catch {
      // Ignore errors
    } finally {
      setEmailChecking(false);
    }
  }, [formData.email, errors.email, companyId, mode, client?.id]);

  // Validate all fields
  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof ClientFormData, string>> = {};
    let isValid = true;

    (Object.keys(formData) as Array<keyof ClientFormData>).forEach((key) => {
      const error = validateField(key, formData[key]);
      if (error) {
        newErrors[key] = error;
        isValid = false;
      }
    });

    if (emailExists) {
      newErrors.email = t('modal.validation.emailExists');
      isValid = false;
    }

    // Block if both email and phone are empty
    if (!formData.email.trim() && !formData.telefon.trim()) {
      newErrors.email = t('modal.validation.contactRequired');
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  }, [formData, validateField, emailExists]);

  // Handle submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setContactWarning(null);

    if (!validateForm()) return;

    const hasEmail = !!formData.email.trim();
    const hasPhone = !!formData.telefon.trim();

    // Warn if one of email/phone is missing (but not both — that's caught in validateForm)
    if (!hasEmail || !hasPhone) {
      setContactWarning({ missingEmail: !hasEmail, missingPhone: !hasPhone });
      return;
    }

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
                <div>
                  <h2
                    className="text-xl font-semibold text-transparent bg-clip-text"
                    style={{ backgroundImage: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)' }}
                  >
                    {mode === 'create' ? t('modal.title.create') : t('modal.title.edit')}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {mode === 'create' ? t('modal.subtitle.create') : t('modal.subtitle.edit')}
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
                <div className="space-y-4">
                  {/* First name */}
                  <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.fields.firstNameRequired')}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                    <input
                      type="text"
                      value={formData.ime}
                      onChange={(e) => handleChange('ime', e.target.value)}
                      placeholder="Jana"
                      className={`w-full rounded-lg border bg-white py-2.5 pl-10 pr-4 text-sm text-[#1A1F36] placeholder-gray-400
                                 transition-all focus:outline-none focus:ring-2
                                 ${errors.ime
                                   ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                   : 'border-gray-200 focus:border-gray-900 focus:ring-gray-900/10'
                                 }`}
                    />
                  </div>
                  {errors.ime && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <Warning className="h-3 w-3" weight="fill" />
                      {errors.ime}
                    </p>
                  )}
                </div>

                {/* Last name */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.fields.lastNameRequired')}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                    <input
                      type="text"
                      value={formData.priimek}
                      onChange={(e) => handleChange('priimek', e.target.value)}
                      placeholder="Novak"
                      className={`w-full rounded-lg border bg-white py-2.5 pl-10 pr-4 text-sm text-[#1A1F36] placeholder-gray-400
                                 transition-all focus:outline-none focus:ring-2
                                 ${errors.priimek
                                   ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                   : 'border-gray-200 focus:border-gray-900 focus:ring-gray-900/10'
                                 }`}
                    />
                  </div>
                  {errors.priimek && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <Warning className="h-3 w-3" weight="fill" />
                      {errors.priimek}
                    </p>
                  )}
                </div>

                {/* Gender */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.fields.genderRequired')}
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <GenderIntersex className="h-4 w-4" weight="regular" />
                    </div>
                    <Select
                      value={formData.spol}
                      setValue={(value) => handleChange('spol', value)}
                      placeholder={t('modal.gender.placeholder')}
                      className="[&>button]:rounded-lg [&>button]:pl-10 [&>button]:focus:ring-gray-900/10"
                    >
                      <SelectOption value="moški">{t('modal.gender.male')}</SelectOption>
                      <SelectOption value="ženska">{t('modal.gender.female')}</SelectOption>
                      <SelectOption value="drugo">{t('modal.gender.other')}</SelectOption>
                    </Select>
                  </div>
                  {errors.spol && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <Warning className="h-3 w-3" weight="fill" />
                      {errors.spol}
                    </p>
                  )}
                </div>

                {/* Client type */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.fields.clientType')}
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Tag className="h-4 w-4" weight="regular" />
                    </div>
                    <Select
                      value={formData.tip_stranke}
                      setValue={(value) => handleChange('tip_stranke', value)}
                      placeholder={t('modal.clientType.placeholder')}
                      className="[&>button]:rounded-lg [&>button]:pl-10 [&>button]:focus:ring-gray-900/10"
                    >
                      <SelectOption value="nova">{t('modal.clientType.nova')}</SelectOption>
                      <SelectOption value="redna">{t('modal.clientType.redna')}</SelectOption>
                      <SelectOption value="vip">{t('modal.clientType.vip')}</SelectOption>
                    </Select>
                  </div>
                </div>

                {/* Email */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Email <span className="text-gray-400 normal-case font-normal">{t('modal.fields.emailHint')}</span>
                  </label>
                  <div className="relative">
                    <Envelope className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      onBlur={handleEmailBlur}
                      placeholder="jana.novak@email.com"
                      className={`w-full rounded-lg border bg-white py-2.5 pl-10 pr-4 text-sm text-[#1A1F36] placeholder-gray-400
                                 transition-all focus:outline-none focus:ring-2
                                 ${errors.email
                                   ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                   : 'border-gray-200 focus:border-gray-900 focus:ring-gray-900/10'
                                 }`}
                    />
                    {emailChecking && (
                      <SpinnerGap className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
                    )}
                  </div>
                  {errors.email && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <Warning className="h-3 w-3" weight="fill" />
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Phone */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.fields.phone')}
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                    <input
                      type="tel"
                      value={formData.telefon}
                      onChange={(e) => handleChange('telefon', e.target.value)}
                      placeholder="+386 40 123 456"
                      className={`w-full rounded-lg border bg-white py-2.5 pl-10 pr-4 text-sm text-[#1A1F36] placeholder-gray-400
                                 transition-all focus:outline-none focus:ring-2
                                 ${errors.telefon
                                   ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                   : 'border-gray-200 focus:border-gray-900 focus:ring-gray-900/10'
                                 }`}
                    />
                  </div>
                  {errors.telefon && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <Warning className="h-3 w-3" weight="fill" />
                      {errors.telefon}
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.fields.notes')}
                  </label>
                  <textarea
                    value={formData.opombe}
                    onChange={(e) => handleChange('opombe', e.target.value)}
                    placeholder={t('modal.fields.notesPlaceholder')}
                    rows={3}
                    className={`w-full resize-none rounded-lg border bg-white py-2.5 px-4 text-sm text-[#1A1F36]
                               placeholder-gray-400 transition-all focus:outline-none focus:ring-2
                               ${errors.opombe
                                 ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                 : 'border-gray-200 focus:border-gray-900 focus:ring-gray-900/10'
                               }`}
                  />
                  <div className="mt-1 flex items-center justify-between">
                    {errors.opombe ? (
                      <p className="flex items-center gap-1 text-xs text-red-500">
                        <Warning className="h-3 w-3" weight="fill" />
                        {errors.opombe}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">{t('modal.fields.notesHint')}</p>
                    )}
                    <span className="text-xs text-gray-400">
                      {formData.opombe.length}/500
                    </span>
                  </div>
                </div>

                {/* Internal Notes - Not sent to client */}
                {showInternalNotes ? (
                  <div className="rounded-2xl border border-amber-100 bg-white p-5">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {t('modal.fields.internalNotes')}
                    </label>
                    <div className="relative">
                      <textarea
                        value={formData.interne_opombe}
                        onChange={(e) => handleChange('interne_opombe', e.target.value)}
                        placeholder={t('modal.fields.internalNotesPlaceholder')}
                        rows={3}
                        className={`w-full resize-none rounded-lg border bg-white py-2.5 px-4 text-sm text-[#1A1F36]
                                   placeholder-gray-400 transition-all focus:outline-none focus:ring-2
                                   ${errors.interne_opombe
                                     ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                     : 'border-amber-200 focus:border-amber-500 focus:ring-amber-500/10'
                                   }`}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      {errors.interne_opombe ? (
                        <p className="flex items-center gap-1 text-xs text-red-500">
                          <Warning className="h-3 w-3" weight="fill" />
                          {errors.interne_opombe}
                        </p>
                      ) : (
                        <span />
                      )}
                      <span className="text-xs text-gray-400">
                        {formData.interne_opombe.length}/500
                      </span>
                    </div>
                  </div>
                ) : (
                  <motion.button
                    type="button"
                    onClick={() => setShowInternalNotes(true)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-amber-200 bg-white py-3 text-amber-700 transition-colors hover:bg-amber-50"
                  >
                    <span className="text-sm font-medium">{t('modal.addInternalNotes')}</span>
                  </motion.button>
                )}
              </div>

              {/* Contact warning panel */}
              {contactWarning && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <Warning className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" weight="fill" />
                    <p className="text-sm font-semibold text-amber-800">
                      {contactWarning.missingEmail ? t('modal.warning.missingEmail') : t('modal.warning.missingPhone')}
                    </p>
                  </div>
                  <p className="text-xs text-amber-700 leading-relaxed mb-3">
                    {contactWarning.missingEmail
                      ? t('modal.warning.missingEmailDesc')
                      : t('modal.warning.missingPhoneDesc')}
                  </p>
                  <div className="flex gap-2">
                    <motion.button
                      type="button"
                      onClick={() => setContactWarning(null)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 rounded-lg border border-amber-400 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors"
                    >
                      {t('modal.actions.cancel')}
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => new Promise(resolve => setTimeout(resolve, 700)).then(() => onSave(formData))}
                      disabled={isSaving}
                      whileHover={{ scale: isSaving ? 1 : 1.02 }}
                      whileTap={{ scale: isSaving ? 1 : 0.98 }}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-70 transition-colors"
                    >
                      {isSaving ? (
                        <SpinnerGap className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FloppyDisk className="h-3.5 w-3.5" weight="bold" />
                      )}
                      {t('modal.actions.saveAnyway')}
                    </motion.button>
                  </div>
                </motion.div>
              )}
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
                  {t('modal.actions.cancel')}
                </motion.button>
                <motion.button
                  type="submit"
                  disabled={isSaving}
                  whileHover={{ scale: isSaving ? 1 : 1.02 }}
                  whileTap={{ scale: isSaving ? 1 : 0.98 }}
                  className="flex items-center gap-2 rounded-lg px-5 py-2.5
                             text-sm font-medium text-white shadow-sm transition-opacity
                             hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                  style={{ background: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)' }}
                >
                  {isSaving ? (
                    <>
                      <SpinnerGap className="h-4 w-4 animate-spin" />
                      {t('modal.actions.saving')}
                    </>
                  ) : (
                    <>
                      <FloppyDisk className="h-4 w-4" weight="bold" />
                      {t('modal.actions.save')}
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

export default memo(ClientModal);
