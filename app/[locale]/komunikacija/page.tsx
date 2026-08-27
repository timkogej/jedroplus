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
  CaretRight,
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import AmbientBottomGlow from '@/components/shared/AmbientBottomGlow';
import CustomerList from '@/components/komunikacija/CustomerList';
import AIMessageGenerator from '@/components/komunikacija/AIMessageGenerator';
import MessageComposer from '@/components/komunikacija/MessageComposer';
import MessagePreview from '@/components/komunikacija/MessagePreview';
import SendSection from '@/components/komunikacija/SendSection';
import { useTranslations } from 'next-intl';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { fetchAllTableRows, fetchTableRows } from '@/lib/companyScope';
import { TABLES } from '@/lib/data';
import { detectBookingSchema, pickFirst, safeDate, combineDateAndTime } from '@/lib/dashboardHelpers';
import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';

// ============================================================================
// Types
// ============================================================================

interface KomunikacijaCustomer {
  id: string;         // String key used for Set<string> selection
  numericId: number | null; // Supabase 'id' column (numeric PK) — sent in client_ids
  name: string;
  email: string;
  phone: string;
  nextAppointment: string | null;
  lastVisit: string;
  tags: string[];
  /** Date-only strings (YYYY-MM-DD) of all appointments — used for Danes/Jutri/etc. filters */
  appointmentDates: string[];
}

interface SendTotals {
  requested: number;
  sent: number;
  skipped: number;
}

interface SendResult {
  totals: SendTotals;
  sent: unknown[];
  skipped: unknown[];
}

// ============================================================================
// Helpers
// ============================================================================

function detectClientSchema(row: Record<string, unknown>) {
  const keys = Object.keys(row);
  const pickField = (candidates: string[]) =>
    candidates.find((c) => keys.includes(c));

  return {
    firstNameField: pickField(['Ime', 'ime', 'first_name', 'firstName']),
    lastNameField: pickField(['Priimek', 'priimek', 'last_name', 'lastName']),
    emailField: pickField(['Email', 'email', 'e-mail', 'E-mail']),
    phoneField: pickField(['Telefon', 'telefon', 'phone', 'Phone', 'Telefonska številka']),
  };
}

/** Parse Supabase 'id' column to number, returns null if not parseable */
function parseNumericId(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return isNaN(raw) ? null : raw;
  const n = parseInt(String(raw), 10);
  return isNaN(n) ? null : n;
}

interface EmailQuota {
  used: number;
  total: number;
  resetDate: string;
}

// ============================================================================
// Toast
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
// Send result panel
// ============================================================================

function SendResultPanel({
  result,
  onReset,
}: {
  result: SendResult;
  onReset: () => void;
}) {
  const t = useTranslations('communication');
  const skippedItems = result.skipped ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-4"
    >
      <div className="flex items-center gap-2">
        <CheckCircle className="h-5 w-5 text-emerald-500" weight="fill" />
        <h3 className="font-semibold text-emerald-700">{t('result.title')}</h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-xl font-bold text-[#1A1F36]">{result.totals.requested}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t('result.requested')}</p>
          <p className="text-[10px] text-gray-300 mt-0.5 leading-tight">
            {t('result.requestedDetail', { clients: result.totals.requested, messages: result.totals.requested })}
          </p>
        </div>
        {[
          { labelKey: 'result.sent', value: result.totals.sent, color: 'text-emerald-600' },
          { labelKey: 'result.skipped', value: result.totals.skipped, color: result.totals.skipped > 0 ? 'text-amber-600' : 'text-gray-400' },
        ].map(({ labelKey, value, color }) => (
          <div key={labelKey} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t(labelKey)}</p>
          </div>
        ))}
      </div>

      {skippedItems.length > 0 && (
        <div>
          <p className="text-xs font-medium text-amber-600 mb-1.5">{t('result.skippedLabel')}</p>
          <ul className="space-y-1 max-h-32 overflow-y-auto">
            {skippedItems.map((item, i) => (
              <li key={i} className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 border border-amber-100">
                {typeof item === 'object' && item !== null
                  ? (item as Record<string, unknown>).reason
                    ? String((item as Record<string, unknown>).reason)
                    : JSON.stringify(item)
                  : String(item)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onReset}
        className="w-full py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        {t('result.newMessage')}
      </button>
    </motion.div>
  );
}

// ============================================================================
// Page
// ============================================================================

export default function KomunikacijaPage() {
  const t = useTranslations('communication');
  const { companyId, companySettings } = useCompany();
  const { user } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [availableVariables, setAvailableVariables] = useState<string[]>([]);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [customers, setCustomers] = useState<KomunikacijaCustomer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [emailQuota, setEmailQuota] = useState<EmailQuota>({ used: 0, total: 0, resetDate: '' });

  const companyName = (companySettings?.['Naziv Podjetja'] as string) || 'Moje Podjetje';
  const actor = user?.email || 'unknown';

  // Fetch email quota
  useEffect(() => {
    if (!companyId) return;

    const fetchEmailQuota = async () => {
      try {
        // Get company UUID from companies table
        const { data: companyData } = await supabaseReadOnly
          .from('companies')
          .select('id')
          .eq('company_id', companyId)
          .maybeSingle();

        if (!companyData?.id) return;

        const companyUuid = companyData.id;

        // Get email usage
        const { data: usageData } = await supabaseReadOnly
          .from('company_email_usage')
          .select('sent_count, period_end')
          .eq('company_id', companyUuid)
          .maybeSingle();

        // Get plan quota
        const { data: subData } = await supabaseReadOnly
          .from('company_subscriptions')
          .select('plan_id')
          .eq('company_id', companyUuid)
          .maybeSingle();

        let emailTotal = 0;
        if (subData?.plan_id) {
          const { data: planData } = await supabaseReadOnly
            .from('plans')
            .select('email_quota_monthly')
            .eq('id', subData.plan_id)
            .maybeSingle();
          emailTotal = planData?.email_quota_monthly ?? 0;
        }

        let resetDate = '';
        if (usageData?.period_end) {
          const periodEnd = new Date(usageData.period_end);
          resetDate = periodEnd.toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' });
        } else {
          const now = new Date();
          const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          resetDate = nextMonth.toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' });
        }

        setEmailQuota({
          used: usageData?.sent_count ?? 0,
          total: emailTotal,
          resetDate,
        });
      } catch (err) {
        console.error('Error fetching email quota:', err);
      }
    };

    fetchEmailQuota();
  }, [companyId]);

  // ── Fetch clients ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!companyId) return;

    const fetchData = async () => {
      setLoadingCustomers(true);
      try {
        const [bookingsRes, clientsRes] = await Promise.all([
          fetchAllTableRows<Record<string, unknown>>(TABLES.bookings, companyId),
          fetchTableRows<Record<string, unknown>>(TABLES.clients, companyId, 2000),
        ]);

        const bookings = bookingsRes.data ?? [];
        const clients = clientsRes.data ?? [];

        // Build map: "ID stranke" business key → Set of appointment date strings (YYYY-MM-DD)
        // Include ALL appointments (past and future) so date filters work correctly
        const strankaIdToDateSet = new Map<string, Set<string>>();

        for (const row of bookings) {
          const schema = detectBookingSchema(row);
          // Get "ID stranke" business key from the booking
          const strankaId = schema.clientIdField
            ? String(row[schema.clientIdField] ?? '')
            : String(pickFirst(row, ['ID stranke', 'stranka_id', 'client_id']) ?? '');

          if (!strankaId) continue;

          let bookingDate: Date | null = null;
          if (schema.startAtField && row[schema.startAtField]) {
            bookingDate = safeDate(row[schema.startAtField]);
          }
          if (!bookingDate && schema.dateField) {
            bookingDate = combineDateAndTime(
              row[schema.dateField],
              schema.startTimeField ? row[schema.startTimeField] : null
            );
          }
          if (!bookingDate) continue;

          const dateStr = bookingDate.toISOString().split('T')[0]; // YYYY-MM-DD
          if (!strankaIdToDateSet.has(strankaId)) {
            strankaIdToDateSet.set(strankaId, new Set());
          }
          strankaIdToDateSet.get(strankaId)!.add(dateStr);
        }

        // Build customer list from Stranke table
        const customerList: KomunikacijaCustomer[] = [];

        if (clients.length > 0) {
          const clientSchema = detectClientSchema(clients[0]);

          for (const row of clients) {
            // CRITICAL: Use Supabase 'id' column as the numeric primary key
            const numericId = parseNumericId(row['id']);

            // For the Set key we use the string form of the Supabase id,
            // falling back to 'ID stranke' only if 'id' is missing
            const id =
              row['id'] !== undefined && row['id'] !== null
                ? String(row['id'])
                : String(row['ID stranke'] ?? row['client_id'] ?? '');

            if (!id) continue;

            // Get "ID stranke" business key from the client row for appointment lookup
            const strankaId = String(row['ID stranke'] ?? row['stranka_id'] ?? row['client_id'] ?? id);

            const ime = clientSchema.firstNameField ? String(row[clientSchema.firstNameField] ?? '') : '';
            const priimek = clientSchema.lastNameField ? String(row[clientSchema.lastNameField] ?? '') : '';
            const name = `${ime} ${priimek}`.trim() || 'Neznana stranka';
            const email = clientSchema.emailField ? String(row[clientSchema.emailField] ?? '') : '';
            const phone = clientSchema.phoneField ? String(row[clientSchema.phoneField] ?? '') : '';

            const dateSet = strankaIdToDateSet.get(strankaId);
            const appointmentDates = dateSet ? Array.from(dateSet) : [];

            customerList.push({
              id,
              numericId,
              name,
              email,
              phone,
              nextAppointment: null,
              lastVisit: '',
              tags: [],
              appointmentDates,
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

  // ── AI generate handler ────────────────────────────────────────────────────
  const handleAIGenerate = useCallback(
    (genSubject: string, genMessage: string, variables: string[]) => {
      setSubject(genSubject);
      setMessage(genMessage);
      setAvailableVariables(variables);
    },
    []
  );

  // ── Send handler ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (isSending) return;

    // Validation
    if (selectedIds.size === 0) {
      setToast({ message: t('toasts.selectAtLeastOne'), type: 'error' });
      return;
    }
    if (!subject.trim()) {
      setToast({ message: t('toasts.enterSubject'), type: 'error' });
      return;
    }
    if (!message.trim()) {
      setToast({ message: t('toasts.enterMessage'), type: 'error' });
      return;
    }

    // Build numeric client_ids from Supabase 'id' column
    const clientIds: number[] = [];
    for (const c of customers) {
      if (!selectedIds.has(c.id)) continue;
      if (c.numericId === null) {
        setToast({
          message: t('toasts.invalidId', { name: c.name }),
          type: 'error',
        });
        return;
      }
      clientIds.push(c.numericId);
    }

    if (clientIds.length !== selectedIds.size) {
      setToast({ message: t('toasts.someInvalidIds'), type: 'error' });
      return;
    }

    setIsSending(true);

    try {
      const payload = {
        event: 'POSLJI_SPOROCILO',
        entity: 'communication',
        company_id: companyId || '',
        user_id: actor,
        actor,
        timestamp: new Date().toISOString(),
        data: {
          company_id: companyId || '',
          subject: subject.trim(),
          message: message.trim(),
          client_ids: clientIds,
        },
      };

      const response = await fetch('/api/communication/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.ok !== false) {
        const totals: SendTotals = result.totals ?? {
          requested: clientIds.length,
          sent: clientIds.length,
          skipped: 0,
        };
        setSendResult({
          totals,
          sent: Array.isArray(result.sent) ? result.sent : [],
          skipped: Array.isArray(result.skipped) ? result.skipped : [],
        });
        setToast({
          message: t('toasts.sent', { sent: totals.sent, requested: totals.requested }),
          type: 'success',
        });
      } else {
        setToast({
          message: t('toasts.sendError'),
          type: 'error',
        });
      }
    } catch (err) {
      console.error('Send error:', err);
      setToast({ message: t('toasts.sendError'), type: 'error' });
    } finally {
      setIsSending(false);
    }
  }, [selectedIds, subject, message, customers, companyId, actor, isSending]);

  const handleReset = useCallback(() => {
    setSendResult(null);
    setSelectedIds(new Set());
    setSubject('');
    setMessage('');
    setAvailableVariables([]);
    setStep(1);
  }, []);

  const remaining = emailQuota.total - emailQuota.used;

  return (
    <ProtectedLayout>
      <main className="relative isolate min-h-screen bg-white">
        <AmbientBottomGlow tone="turquoise" />
        <div className="relative z-10 mx-auto max-w-2xl px-4 sm:px-6 py-6 sm:py-8">

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-normal text-[#1A1F36]">{t('page.title')}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {t('page.subtitle')}
              </p>
            </div>
            {/* Email quota inline */}
            {emailQuota.total > 0 && (
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-400">{t('page.emailQuotaLabel')}</p>
                <p className="text-sm font-medium text-gray-700 mt-0.5">
                  <span className="text-gray-900">{emailQuota.used}</span>
                  <span className="text-gray-400"> / {emailQuota.total}</span>
                </p>
              </div>
            )}
          </div>

          {/* Stepped Flow */}
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {/* Customer selection card */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="h-4 w-4 text-gray-400" weight="regular" />
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {t('page.step1SectionTitle')}
                    </p>
                  </div>
                  <CustomerList
                    customers={customers}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                    loading={loadingCustomers}
                  />
                </div>

                {/* Continue button */}
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={selectedIds.size === 0}
                  className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors bg-[#0a0a0a] text-white hover:bg-[#1f1f1f] disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {selectedIds.size > 0 ? (
                    <>
                      {t('page.step1Continue', { count: selectedIds.size })}
                      <CaretRight className="h-3.5 w-3.5" weight="bold" />
                    </>
                  ) : (
                    t('page.step1ContinueDisabled')
                  )}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Step nav */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => { setStep(1); setSendResult(null); }}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
                    {t('page.step2BackButton')}
                  </button>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-[#6D5EF7]/10 text-[#6D5EF7]">
                    {t('page.step2SelectedBadge', { count: selectedIds.size })}
                  </span>
                </div>

                {/* Composer card */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="flex items-center gap-2 mb-5">
                    <PaperPlaneTilt className="h-4 w-4 text-gray-400" weight="regular" />
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {t('page.step2SectionTitle')}
                    </p>
                  </div>

                  <div className="mb-5">
                    <AIMessageGenerator
                      onGenerate={handleAIGenerate}
                      onError={(msg) => setToast({ message: msg, type: 'error' })}
                      companyId={companyId || undefined}
                      actor={actor}
                    />
                  </div>

                  <MessageComposer
                    subject={subject}
                    onSubjectChange={setSubject}
                    message={message}
                    onMessageChange={setMessage}
                    availableVariables={availableVariables}
                  />
                </div>

                {/* Preview */}
                <MessagePreview
                  subject={subject}
                  message={message}
                  senderName={companyName}
                />

                {/* Send result or send section */}
                <AnimatePresence mode="wait">
                  {sendResult ? (
                    <SendResultPanel
                      key="result"
                      result={sendResult}
                      onReset={handleReset}
                    />
                  ) : (
                    <motion.div key="send" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
