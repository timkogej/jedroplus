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
import { useCompany } from '@/app/company-context';
import {
  getCompanyCommunicationLanguage,
  normalizeCommunicationLanguage,
} from '@/lib/communicationLanguage';
import CommunicationLanguageControl from '@/components/shared/CommunicationLanguageControl';

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
function normalizeClientType(value: string | undefined | null): ClientType | '' {
  const v = (value || '').toLowerCase().trim();
  if (v === 'redna') return 'redna';
  if (v === 'vip') return 'vip';
  if (v === 'nova') return 'nova';
  return '';
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
  const { companySettings } = useCompany();
  const defaultLanguage = getCompanyCommunicationLanguage(companySettings);

  // Form state
  const [formData, setFormData] = useState<ClientFormData>({
    ime: '',
    priimek: '',
    spol: '',
    tip_stranke: 'nova',
    language: defaultLanguage,
    email: '',
    telefon: '',
    opombe: '',
    interne_opombe: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ClientFormData, string>>>({});
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [showInternalNotes, setShowInternalNotes] = useState(false);
  const [showClientTypeSelect, setShowClientTypeSelect] = useState(false);
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
          language: normalizeCommunicationLanguage(client.language ?? clientRecord.language ?? clientRecord.Language, defaultLanguage),
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
          language: defaultLanguage,
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
      setShowClientTypeSelect(false);
    }
  }, [isOpen, mode, client, defaultLanguage]);

  const getClientTypeLabel = useCallback((type: ClientType | '') => {
    if (type === 'vip') return t('modal.clientType.vip');
    if (type === 'redna') return t('modal.clientType.redna');
    if (type === 'nova') return t('modal.clientType.nova');
    return t('modal.clientType.none');
  }, [t]);

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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-[#F2F2F7] shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="glass-bar border-b border-gray-200/70 px-5 py-3.5 sm:px-6">
              <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-gray-300 sm:hidden" aria-hidden="true" />
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-[17px] font-semibold text-gray-900">
                    {mode === 'create' ? t('modal.title.create') : t('modal.title.edit')}
                  </h2>
                  <p className="mt-0.5 text-[13px] text-gray-500">
                    {mode === 'create' ? t('modal.subtitle.create') : t('modal.subtitle.edit')}
                  </p>
                </div>
                <motion.button
                  type="button"
                  onClick={onClose}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
                >
                  <X className="h-5 w-5" weight="regular" />
                </motion.button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="min-h-0 flex flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <div className="space-y-4">
                  {/* First name */}
                  <div className="rounded-xl bg-white p-4">
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.fields.firstNameRequired')}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                    <input
                      type="text"
                      value={formData.ime}
                      onChange={(e) => handleChange('ime', e.target.value)}
                      placeholder="Jana"
                      className={`w-full rounded-[10px] border bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400
                                 transition-all focus:outline-none focus:ring-2
                                 ${errors.ime
                                   ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                   : 'border-gray-200 focus:border-[#7C78FA] focus:ring-[3px] focus:ring-[#7C78FA]/25'
                                 }`}
                    />
                  </div>
                  {errors.ime && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <Warning className="h-3 w-3" weight="regular" />
                      {errors.ime}
                    </p>
                  )}
                </div>

                {/* Last name */}
                <div className="rounded-xl bg-white p-4">
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.fields.lastNameRequired')}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                    <input
                      type="text"
                      value={formData.priimek}
                      onChange={(e) => handleChange('priimek', e.target.value)}
                      placeholder="Novak"
                      className={`w-full rounded-[10px] border bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400
                                 transition-all focus:outline-none focus:ring-2
                                 ${errors.priimek
                                   ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                   : 'border-gray-200 focus:border-[#7C78FA] focus:ring-[3px] focus:ring-[#7C78FA]/25'
                                 }`}
                    />
                  </div>
                  {errors.priimek && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <Warning className="h-3 w-3" weight="regular" />
                      {errors.priimek}
                    </p>
                  )}
                </div>

                {/* Gender */}
                <div className="rounded-xl bg-white p-4">
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.fields.genderRequired')}
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400">
                      <GenderIntersex className="h-4 w-4" weight="regular" />
                    </div>
                    <Select
                      value={formData.spol}
                      setValue={(value) => handleChange('spol', value)}
                      placeholder={t('modal.gender.placeholder')}
                      className="[&>button]:pl-10"
                    >
                      <SelectOption value="moški">{t('modal.gender.male')}</SelectOption>
                      <SelectOption value="ženska">{t('modal.gender.female')}</SelectOption>
                      <SelectOption value="drugo">{t('modal.gender.other')}</SelectOption>
                    </Select>
                  </div>
                  {errors.spol && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <Warning className="h-3 w-3" weight="regular" />
                      {errors.spol}
                    </p>
                  )}
                </div>

                {/* Client type */}
                <div className="rounded-xl bg-white p-4">
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.fields.clientType')}
                  </label>
                  {!showClientTypeSelect ? (
                    <div className="flex items-center justify-between gap-3 rounded-[10px] bg-gray-50 px-3 py-2.5">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Tag className="h-4 w-4 text-gray-400" weight="regular" />
                        <span>{getClientTypeLabel(formData.tip_stranke)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowClientTypeSelect(true)}
                        className="text-xs font-semibold text-[#7C78FA] transition-opacity hover:opacity-70"
                      >
                        {t('modal.clientType.change')}
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400">
                        <Tag className="h-4 w-4" weight="regular" />
                      </div>
                      <Select
                        value={formData.tip_stranke || '__none__'}
                        setValue={(value) => handleChange('tip_stranke', value === '__none__' ? '' : value)}
                        placeholder={t('modal.clientType.placeholder')}
                        className="[&>button]:pl-10"
                      >
                        <SelectOption value="__none__" dimmed>{t('modal.clientType.none')}</SelectOption>
                        <SelectOption value="nova">{t('modal.clientType.nova')}</SelectOption>
                        <SelectOption value="redna">{t('modal.clientType.redna')}</SelectOption>
                        <SelectOption value="vip">{t('modal.clientType.vip')}</SelectOption>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Email */}
                <div className="rounded-xl bg-white p-4">
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
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
                      className={`w-full rounded-[10px] border bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400
                                 transition-all focus:outline-none focus:ring-2
                                 ${errors.email
                                   ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                   : 'border-gray-200 focus:border-[#7C78FA] focus:ring-[3px] focus:ring-[#7C78FA]/25'
                                 }`}
                    />
                    {emailChecking && (
                      <SpinnerGap className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
                    )}
                  </div>
                  {errors.email && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <Warning className="h-3 w-3" weight="regular" />
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Phone */}
                <div className="rounded-xl bg-white p-4">
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.fields.phone')}
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                    <input
                      type="tel"
                      value={formData.telefon}
                      onChange={(e) => handleChange('telefon', e.target.value)}
                      placeholder="+386 40 123 456"
                      className={`w-full rounded-[10px] border bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400
                                 transition-all focus:outline-none focus:ring-2
                                 ${errors.telefon
                                   ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                   : 'border-gray-200 focus:border-[#7C78FA] focus:ring-[3px] focus:ring-[#7C78FA]/25'
                                 }`}
                    />
                  </div>
                  {errors.telefon && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <Warning className="h-3 w-3" weight="regular" />
                      {errors.telefon}
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div className="rounded-xl bg-white p-4">
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    {t('modal.fields.notes')}
                  </label>
                  <textarea
                    value={formData.opombe}
                    onChange={(e) => handleChange('opombe', e.target.value)}
                    placeholder={t('modal.fields.notesPlaceholder')}
                    rows={3}
                    className={`w-full resize-none rounded-[10px] border bg-white py-2.5 px-4 text-sm text-gray-900
                               placeholder-gray-400 transition-all focus:outline-none focus:ring-2
                               ${errors.opombe
                                 ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                 : 'border-gray-200 focus:border-[#7C78FA] focus:ring-[3px] focus:ring-[#7C78FA]/25'
                               }`}
                  />
                  <div className="mt-1 flex items-center justify-between">
                    {errors.opombe ? (
                      <p className="flex items-center gap-1 text-xs text-red-500">
                        <Warning className="h-3 w-3" weight="regular" />
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
                  <div className="rounded-xl bg-white p-4">
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      {t('modal.fields.internalNotes')}
                    </label>
                    <div className="relative">
                      <textarea
                        value={formData.interne_opombe}
                        onChange={(e) => handleChange('interne_opombe', e.target.value)}
                        placeholder={t('modal.fields.internalNotesPlaceholder')}
                        rows={3}
                        className={`w-full resize-none rounded-[10px] border bg-white py-2.5 px-4 text-sm text-gray-900
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
                          <Warning className="h-3 w-3" weight="regular" />
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
                    className="flex w-full items-center gap-2 rounded-xl bg-white px-4 py-3 text-amber-700 transition-colors hover:bg-amber-50"
                  >
                    <span className="text-sm font-medium">{t('modal.addInternalNotes')}</span>
                  </motion.button>
                )}

                <div className="rounded-xl bg-white p-4">
                  <CommunicationLanguageControl
                    value={formData.language}
                    onChange={(value) => handleChange('language', value)}
                    label={t('modal.fields.communicationLanguage')}
                    changeLabel={t('modal.language.change')}
                  />
                </div>
              </div>

              {/* Contact warning panel */}
              {contactWarning && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <Warning className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" weight="regular" />
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
              <div className="glass-bar flex flex-shrink-0 items-center justify-end gap-3 border-t border-gray-200/70 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:px-6">
                <motion.button
                  type="button"
                  onClick={onClose}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100 sm:flex-none"
                >
                  {t('modal.actions.cancel')}
                </motion.button>
                <motion.button
                  type="submit"
                  disabled={isSaving}
                  whileHover={{ scale: isSaving ? 1 : 1.02 }}
                  whileTap={{ scale: isSaving ? 1 : 0.98 }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-2.5
                             text-sm font-medium text-white shadow-sm transition-opacity
                             hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none"
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
