'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  PaperPlaneTilt,
  Users,
  CheckCircle,
  X,
  Warning,
  ArrowLeft,
  ArrowRight,
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import EmailQuotaCard from '@/components/komunikacija/EmailQuotaCard';
import CustomerList from '@/components/komunikacija/CustomerList';
import AIMessageGenerator from '@/components/komunikacija/AIMessageGenerator';
import MessageComposer from '@/components/komunikacija/MessageComposer';
import MessagePreview from '@/components/komunikacija/MessagePreview';
import SendSection from '@/components/komunikacija/SendSection';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { fetchTableRows } from '@/lib/companyScope';
import { TABLES } from '@/lib/data';
import { detectBookingSchema, pickFirst, safeDate, combineDateAndTime } from '@/lib/dashboardHelpers';
import { callN8nAction } from '@/src/lib/n8nClient';

// ============================================================================
// Customer type for this page
// ============================================================================

interface KomunikacijaCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  nextAppointment: string | null;
  lastVisit: string;
  tags: string[];
}

// ============================================================================
// Helpers for parsing Supabase data
// ============================================================================

function detectClientSchema(row: Record<string, unknown>) {
  const keys = Object.keys(row);
  const pickField = (candidates: string[]) =>
    candidates.find((c) => keys.includes(c));

  return {
    idField: pickField(['ID stranke', 'id', 'client_id', 'ID']),
    firstNameField: pickField(['Ime', 'ime', 'first_name', 'firstName']),
    lastNameField: pickField(['Priimek', 'priimek', 'last_name', 'lastName']),
    emailField: pickField(['Email', 'email', 'e-mail', 'E-mail']),
    phoneField: pickField(['Telefon', 'telefon', 'phone', 'Phone', 'Telefonska številka']),
  };
}

const mockQuota = {
  used: 847,
  total: 1000,
  resetDate: '1. mar 2025',
};

// ============================================================================
// Toast component
// ============================================================================

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg ${
        type === 'success'
          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
          : 'bg-gradient-to-r from-red-500 to-rose-500 text-white'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle className="h-5 w-5" weight="fill" />
      ) : (
        <Warning className="h-5 w-5" weight="fill" />
      )}
      <span className="text-sm font-medium">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="ml-2 rounded-full p-0.5 transition-colors hover:bg-white/20"
      >
        <X className="h-4 w-4" weight="bold" />
      </button>
    </motion.div>
  );
}

// ============================================================================
// Page
// ============================================================================

export default function KomunikacijaPage() {
  const { companyId, companySettings } = useCompany();
  const { user } = useAuth();

  // Step state
  const [step, setStep] = useState<1 | 2>(1);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Message state
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Customer data from Supabase
  const [customers, setCustomers] = useState<KomunikacijaCustomer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  // Sending state
  const [isSending, setIsSending] = useState(false);

  const companyName = (companySettings?.['Naziv Podjetja'] as string) || 'Moje Podjetje';
  const actor = user?.email || 'unknown';
  const companyPayload = companySettings ? { ...companySettings } : {};

  // Fetch customers and their appointments from Supabase
  useEffect(() => {
    if (!companyId) return;

    const fetchData = async () => {
      setLoadingCustomers(true);
      try {
        const [bookingsRes, clientsRes] = await Promise.all([
          fetchTableRows<Record<string, unknown>>(TABLES.bookings, companyId, 5000),
          fetchTableRows<Record<string, unknown>>(TABLES.clients, companyId, 2000),
        ]);

        const bookings = bookingsRes.data ?? [];
        const clients = clientsRes.data ?? [];

        // Build map of client ID -> nearest future appointment ISO string
        const now = new Date();
        const clientNextAppointment = new Map<string, string>();

        for (const row of bookings) {
          const schema = detectBookingSchema(row);
          const clientId = schema.clientIdField
            ? String(row[schema.clientIdField] ?? '')
            : String(pickFirst(row, ['ID stranke', 'stranka_id', 'client_id']) ?? '');

          if (!clientId) continue;

          // Parse the booking date
          let bookingDate: Date | null = null;

          // Try start_at first (ISO timestamp)
          if (schema.startAtField && row[schema.startAtField]) {
            bookingDate = safeDate(row[schema.startAtField]);
          }

          // Try date + time combination
          if (!bookingDate && schema.dateField) {
            bookingDate = combineDateAndTime(
              row[schema.dateField],
              schema.startTimeField ? row[schema.startTimeField] : null
            );
          }

          if (!bookingDate || bookingDate < now) continue;

          const isoDate = bookingDate.toISOString();
          const existing = clientNextAppointment.get(clientId);
          if (!existing || isoDate < existing) {
            clientNextAppointment.set(clientId, isoDate);
          }
        }

        // Build customer objects from Stranke table
        const customerList: KomunikacijaCustomer[] = [];

        if (clients.length > 0) {
          const clientSchema = detectClientSchema(clients[0]);

          for (const row of clients) {
            const id = clientSchema.idField ? String(row[clientSchema.idField] ?? '') : '';
            if (!id) continue;

            const ime = clientSchema.firstNameField ? String(row[clientSchema.firstNameField] ?? '') : '';
            const priimek = clientSchema.lastNameField ? String(row[clientSchema.lastNameField] ?? '') : '';
            const name = `${ime} ${priimek}`.trim() || 'Neznana stranka';
            const email = clientSchema.emailField ? String(row[clientSchema.emailField] ?? '') : '';
            const phone = clientSchema.phoneField ? String(row[clientSchema.phoneField] ?? '') : '';

            customerList.push({
              id,
              name,
              email,
              phone,
              nextAppointment: clientNextAppointment.get(id) || null,
              lastVisit: '',
              tags: [],
            });
          }
        }

        customerList.sort((a, b) => a.name.localeCompare(b.name));
        setCustomers(customerList);
      } catch (err) {
        console.error('Error fetching communication data:', err);
      } finally {
        setLoadingCustomers(false);
      }
    };

    fetchData();
  }, [companyId]);

  // Handlers
  const handleAIGenerate = useCallback((generatedMessage: string) => {
    setMessage(generatedMessage);
  }, []);

  const handleSend = useCallback(async () => {
    if (isSending) return;
    setIsSending(true);

    try {
      // Build selected clients payload
      const selectedClients = customers
        .filter((c) => selectedIds.has(c.id))
        .map((c) => ({ id: c.id, name: c.name, email: c.email }));

      const result = await callN8nAction({
        event: 'POSLJI_SPOROCILO',
        entity: 'communication',
        data: {
          subject,
          message,
          client_ids: Array.from(selectedIds),
          clients: selectedClients,
          company_id: companyId || '',
          company_profile: companyPayload,
        },
        company_id: companyId || '',
        actor,
        timestamp: new Date().toISOString(),
        meta: { app: 'Integrate' as const, version: '1.0' as const },
      });

      if (result.ok) {
        setToast({
          message: `Sporočilo uspešno poslano ${selectedIds.size} strankam!`,
          type: 'success',
        });

        // Reset form
        setTimeout(() => {
          setSelectedIds(new Set());
          setSubject('');
          setMessage('');
          setStep(1);
        }, 500);
      } else {
        setToast({
          message: result.error || 'Napaka pri pošiljanju sporočila',
          type: 'error',
        });
      }
    } catch (err) {
      console.error('Send error:', err);
      setToast({
        message: 'Napaka pri pošiljanju sporočila',
        type: 'error',
      });
    } finally {
      setIsSending(false);
    }
  }, [selectedIds, subject, message, customers, companyId, actor, companyPayload, isSending]);

  const remaining = mockQuota.total - mockQuota.used;

  return (
    <ProtectedLayout>
      {/* SVG gradient definition for button icons */}
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <linearGradient id="btn-icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="50%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
      </svg>

      <main className="min-h-screen bg-[#F7F8FA]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8">

          {/* Page Header */}
          <div className="mb-6">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h1 className="text-2xl font-bold text-[#1A1F36]">
                Komunikacija
              </h1>
              <p className="text-sm text-gray-500">
                Pošljite sporočila svojim strankam hitro in enostavno
              </p>
            </motion.div>
          </div>

          {/* Email Quota */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <EmailQuotaCard
              used={mockQuota.used}
              total={mockQuota.total}
              resetDate={mockQuota.resetDate}
            />
          </motion.div>

          {/* Stepped Flow */}
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                {/* Step 1: Customer Selection */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="h-5 w-5 text-[#1A1F36]" weight="bold" />
                    <h2 className="text-lg font-semibold text-[#1A1F36]">
                      Izbira strank
                    </h2>
                  </div>
                  <CustomerList
                    customers={customers}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                    loading={loadingCustomers}
                  />
                </div>

                {/* Continue button */}
                <div className="mt-4">
                  <motion.button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={selectedIds.size === 0}
                    whileHover={{ scale: selectedIds.size > 0 ? 1.01 : 1 }}
                    whileTap={{ scale: selectedIds.size > 0 ? 0.99 : 1 }}
                    className={`w-full py-3.5 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-all duration-200 ${
                      selectedIds.size > 0
                        ? 'bg-white border border-gray-200 shadow-sm hover:shadow-md'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-transparent'
                    }`}
                  >
                    <span
                      className="flex items-center gap-2"
                      style={
                        selectedIds.size > 0
                          ? {
                              backgroundImage:
                                'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                            }
                          : undefined
                      }
                    >
                      {selectedIds.size > 0
                        ? `Naprej z ${selectedIds.size} ${
                            selectedIds.size === 1
                              ? 'stranko'
                              : selectedIds.size < 5
                              ? 'strankami'
                              : 'strankami'
                          }`
                        : 'Izberite stranke za nadaljevanje'}
                      {selectedIds.size > 0 && (
                        <ArrowRight
                          className="h-4 w-4"
                          weight="bold"
                          style={{ fill: 'url(#btn-icon-grad)' }}
                        />
                      )}
                    </span>
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                {/* Summary bar: back button + selected count */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" weight="bold" />
                    Nazaj na izbiro strank
                  </button>
                  <span className="px-3 py-1 rounded-lg bg-violet-50 text-xs font-semibold text-violet-600 border border-violet-100">
                    {selectedIds.size}{' '}
                    {selectedIds.size === 1
                      ? 'stranka izbrana'
                      : selectedIds.size < 5
                      ? 'stranke izbrane'
                      : 'strank izbranih'}
                  </span>
                </div>

                {/* Composer card: AI generator + message */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-5">
                    <PaperPlaneTilt className="h-5 w-5 text-[#1A1F36]" weight="bold" />
                    <h2 className="text-lg font-semibold text-[#1A1F36]">
                      Sestavi sporočilo
                    </h2>
                  </div>

                  {/* AI Generator */}
                  <div className="mb-6">
                    <AIMessageGenerator
                      onGenerate={handleAIGenerate}
                      companyId={companyId || undefined}
                      actor={actor}
                      companyPayload={companyPayload}
                    />
                  </div>

                  {/* Message Composer */}
                  <MessageComposer
                    subject={subject}
                    onSubjectChange={setSubject}
                    message={message}
                    onMessageChange={setMessage}
                  />
                </div>

                {/* Preview */}
                <MessagePreview
                  subject={subject}
                  message={message}
                  senderName={companyName}
                />

                {/* Send Section */}
                <SendSection
                  selectedCount={selectedIds.size}
                  remainingQuota={remaining}
                  hasMessage={message.trim().length > 0}
                  hasSubject={subject.trim().length > 0}
                  onSend={handleSend}
                  sending={isSending}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </ProtectedLayout>
  );
}
