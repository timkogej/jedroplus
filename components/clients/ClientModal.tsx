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
} from '@phosphor-icons/react';
import type { Client, ClientFormData, Gender } from '@/types/clients';
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

// Normalize gender value from DB to form values
function normalizeGender(spol: string | undefined | null): string {
  const v = (spol || '').toLowerCase().trim();
  if (v === 'male' || v === 'moški' || v === 'moski') return 'moški';
  if (v === 'female' || v === 'ženska' || v === 'zenska') return 'ženska';
  if (v === 'other' || v === 'drugo') return 'drugo';
  return spol || '';
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
  // Form state
  const [formData, setFormData] = useState<ClientFormData>({
    ime: '',
    priimek: '',
    spol: '',
    email: '',
    telefon: '',
    opombe: '',
    interne_opombe: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ClientFormData, string>>>({});
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [showInternalNotes, setShowInternalNotes] = useState(false);

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

        setFormData({
          ime: client.ime || '',
          priimek: client.priimek || '',
          spol: normalizeGender(client.spol),
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
          email: '',
          telefon: '',
          opombe: '',
          interne_opombe: '',
        });
      }
      setErrors({});
      setEmailExists(false);
      setShowInternalNotes(mode === 'edit');
    }
  }, [isOpen, mode, client]);

  // Validate individual field
  const validateField = useCallback((name: keyof ClientFormData, value: string): string => {
    switch (name) {
      case 'ime':
        if (!value.trim()) return 'Ime je obvezno';
        if (value.trim().length < 2) return 'Ime mora imeti vsaj 2 znaka';
        return '';
      case 'priimek':
        if (!value.trim()) return 'Priimek je obvezen';
        if (value.trim().length < 2) return 'Priimek mora imeti vsaj 2 znaka';
        return '';
      case 'spol':
        if (!value) return 'Spol je obvezen';
        return '';
      case 'email':
        if (!value.trim()) return 'Email je obvezen';
        if (!validateEmail(value)) return 'Neveljaven email naslov';
        return '';
      case 'telefon':
        if (value && !validatePhone(value)) return 'Neveljavna telefonska številka';
        return '';
      case 'opombe':
        if (value.length > 500) return 'Opombe lahko vsebujejo največ 500 znakov';
        return '';
      case 'interne_opombe':
        if (value.length > 500) return 'Interne opombe lahko vsebujejo največ 500 znakov';
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
        setErrors((prev) => ({ ...prev, email: 'Ta email naslov je že v uporabi' }));
      } else {
        setEmailExists(false);
        if (errors.email === 'Ta email naslov je že v uporabi') {
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
      newErrors.email = 'Ta email naslov je že v uporabi';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  }, [formData, validateField, emailExists]);

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
            className="relative flex w-full max-w-xl max-h-[85vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gradient header */}
            <div className="bg-gradient-to-r from-violet-500 to-cyan-500 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {mode === 'create' ? 'Nova stranka' : 'Uredi stranko'}
                  </h2>
                  <p className="mt-1 text-sm text-white/80">
                    {mode === 'create' ? 'Dodajte novo stranko' : 'Uredite podatke stranke'}
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
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* First name */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Ime *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                    <input
                      type="text"
                      value={formData.ime}
                      onChange={(e) => handleChange('ime', e.target.value)}
                      placeholder="Jana"
                      className={`w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm text-[#1A1F36] placeholder-gray-400
                                 transition-all focus:outline-none focus:ring-2
                                 ${errors.ime
                                   ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                   : 'border-gray-200 focus:border-purple-400 focus:ring-purple-100'
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
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Priimek *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                    <input
                      type="text"
                      value={formData.priimek}
                      onChange={(e) => handleChange('priimek', e.target.value)}
                      placeholder="Novak"
                      className={`w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm text-[#1A1F36] placeholder-gray-400
                                 transition-all focus:outline-none focus:ring-2
                                 ${errors.priimek
                                   ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                   : 'border-gray-200 focus:border-purple-400 focus:ring-purple-100'
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
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Spol *
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <GenderIntersex className="h-4 w-4" weight="regular" />
                    </div>
                    <Select
                      value={formData.spol}
                      setValue={(value) => handleChange('spol', value)}
                      placeholder="Izberi spol"
                      className="[&>button]:pl-10"
                    >
                      <SelectOption value="moški">Moški</SelectOption>
                      <SelectOption value="ženska">Ženska</SelectOption>
                      <SelectOption value="drugo">Drugo</SelectOption>
                    </Select>
                  </div>
                  {errors.spol && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <Warning className="h-3 w-3" weight="fill" />
                      {errors.spol}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Email *
                  </label>
                  <div className="relative">
                    <Envelope className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      onBlur={handleEmailBlur}
                      placeholder="jana.novak@email.com"
                      className={`w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm text-[#1A1F36] placeholder-gray-400
                                 transition-all focus:outline-none focus:ring-2
                                 ${errors.email
                                   ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                   : 'border-gray-200 focus:border-purple-400 focus:ring-purple-100'
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
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Telefon
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" weight="regular" />
                    <input
                      type="tel"
                      value={formData.telefon}
                      onChange={(e) => handleChange('telefon', e.target.value)}
                      placeholder="+386 40 123 456"
                      className={`w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm text-[#1A1F36] placeholder-gray-400
                                 transition-all focus:outline-none focus:ring-2
                                 ${errors.telefon
                                   ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                   : 'border-gray-200 focus:border-purple-400 focus:ring-purple-100'
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
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Opombe
                  </label>
                  <textarea
                    value={formData.opombe}
                    onChange={(e) => handleChange('opombe', e.target.value)}
                    placeholder="Opombe o stranki..."
                    rows={3}
                    className={`w-full resize-none rounded-xl border py-2.5 px-4 text-sm text-[#1A1F36]
                               placeholder-gray-400 transition-all focus:outline-none focus:ring-2
                               ${errors.opombe
                                 ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                 : 'border-gray-200 focus:border-purple-400 focus:ring-purple-100'
                               }`}
                  />
                  <div className="mt-1 flex items-center justify-between">
                    {errors.opombe ? (
                      <p className="flex items-center gap-1 text-xs text-red-500">
                        <Warning className="h-3 w-3" weight="fill" />
                        {errors.opombe}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">Opombe se uporabljajo pri opomnikih in sporočanju</p>
                    )}
                    <span className="text-xs text-gray-400">
                      {formData.opombe.length}/500
                    </span>
                  </div>
                </div>

                {/* Internal Notes - Not sent to client */}
                {showInternalNotes ? (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Interne opombe
                    </label>
                    <div className="relative">
                      <textarea
                        value={formData.interne_opombe}
                        onChange={(e) => handleChange('interne_opombe', e.target.value)}
                        placeholder="Interne opombe (ne pošiljajo se stranki)..."
                        rows={3}
                        className={`w-full resize-none rounded-xl border-2 border-yellow-300 bg-white py-2.5 px-4 text-sm text-[#1A1F36]
                                   placeholder-gray-400 transition-all focus:outline-none focus:ring-2
                                   ${errors.interne_opombe
                                     ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                     : 'focus:border-yellow-400 focus:ring-yellow-200'
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
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-yellow-300 text-yellow-700 hover:bg-yellow-50 transition-colors"
                  >
                    <span className="text-sm font-medium">+ Interne opombe</span>
                  </motion.button>
                )}
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
                  Prekliči
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
                      Shranjujem...
                    </>
                  ) : (
                    <>
                      <FloppyDisk className="h-4 w-4" weight="bold" />
                      Shrani stranko
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
