'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { useLocale, useTranslations } from 'next-intl';
import {
  Warning,
  Phone,
  CaretDown,
  CaretUp,
  CalendarCheck,
  ArrowLeft,
  ArrowRight,
} from '@phosphor-icons/react';
import { GradientSpinner } from '@/components/ui/GradientSpinner';
import { useCompany } from '@/app/company-context';
import {
  SettingsSection,
  SettingRow,
  Switch,
  Select,
  Input,
  Textarea,
  SaveIndicator,
} from '@/components/settings';
import { formatMoney, intlLocale } from '@/lib/format';
import { useCompanyRegion } from '@/lib/hooks/useCompanyRegion';
import type { IsoLanguageCode } from '@/lib/communicationLanguage';
import {
  DEFAULT_GREETING,
  DEFAULT_RECORDING_NOTICE,
  GREETING_MAX_LENGTH,
  RECEPTIONIST_LANGUAGES,
  isReceptionistLanguage,
} from '@/lib/receptionist';

// ─── Tabs ───────────────────────────────────────────────────────────────────

export type TabKey = 'nastavitve' | 'dnevnik' | 'krediti';

/** labelKey je ključ v imenskem prostoru `receptionist`. */
export const TABS: { key: TabKey; labelKey: string }[] = [
  { key: 'nastavitve', labelKey: 'tabs.settings' },
  { key: 'dnevnik', labelKey: 'tabs.calls' },
  { key: 'krediti', labelKey: 'tabs.credits' },
];

// ─── Shared states ──────────────────────────────────────────────────────────

export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <GradientSpinner size={32} />
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-6 py-10 text-center">
      <Warning className="mx-auto mb-2 h-6 w-6 text-red-500" weight="regular" />
      <p className="text-sm text-gray-900">{message}</p>
    </div>
  );
}

// ─── Settings tab ───────────────────────────────────────────────────────────

export interface ReceptionistSettings {
  enabled: boolean;
  low_balance_threshold: number;
  greeting_text: string | null;
  language: string;
  /** Switch to the caller's language when it differs. */
  detect_caller_language?: boolean;
  /** Say the recording notice before the greeting. */
  announce_recording?: boolean;
  recording_notice_text?: string | null;
}

function voiceLanguage(value: string): IsoLanguageCode {
  return isReceptionistLanguage(value) ? value : 'sl';
}

export function NastavitveTab({
  settings,
  onSave,
}: {
  settings: ReceptionistSettings;
  onSave: (patch: Partial<ReceptionistSettings>) => Promise<void>;
}) {
  const t = useTranslations('receptionist');
  const [local, setLocal] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const language = voiceLanguage(local.language);
  const announce = local.announce_recording ?? true;

  const save = useCallback(async (patch: Partial<ReceptionistSettings>) => {
    setSaving(true);
    try {
      await onSave(patch);
      setLastSaved(new Date());
    } catch {
      toast.error(t('settings.saveError'));
    } finally {
      setSaving(false);
    }
  }, [onSave, t]);

  const languageOptions = RECEPTIONIST_LANGUAGES.map((value) => ({ value, label: t(`languages.${value}`) }));

  return (
    <div>
      <div className="flex items-center justify-end mb-3 h-5">
        <SaveIndicator saving={saving} lastSaved={lastSaved} />
      </div>

      <SettingsSection title={t('settings.generalTitle')}>
        <SettingRow label={t('settings.enabledLabel')} description={t('settings.enabledDesc')}>
          <div className="flex justify-end sm:justify-start">
            <Switch
              checked={local.enabled}
              onChange={(checked) => {
                setLocal((s) => ({ ...s, enabled: checked }));
                save({ enabled: checked });
              }}
              variant="brand"
            />
          </div>
        </SettingRow>

        <SettingRow label={t('settings.languageLabel')} description={t('settings.languageDesc')}>
          <Select
            value={language}
            onChange={(value) => {
              setLocal((s) => ({ ...s, language: value }));
              save({ language: value });
            }}
            options={languageOptions}
          />
        </SettingRow>

        <SettingRow label={t('settings.detectLabel')} description={t('settings.detectDesc')}>
          <div className="flex justify-end sm:justify-start">
            <Switch
              checked={local.detect_caller_language ?? false}
              onChange={(checked) => {
                setLocal((s) => ({ ...s, detect_caller_language: checked }));
                save({ detect_caller_language: checked });
              }}
              variant="brand"
            />
          </div>
        </SettingRow>

        <SettingRow label={t('settings.thresholdLabel')} description={t('settings.thresholdDesc')}>
          <Input
            type="number"
            min={0}
            step={1}
            suffix={t('settings.creditsSuffix')}
            value={local.low_balance_threshold}
            onChange={(e) => setLocal((s) => ({ ...s, low_balance_threshold: Number(e.target.value) }))}
            onBlur={(e) => save({ low_balance_threshold: Number(e.target.value) })}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title={t('settings.greetingTitle')} description={t('settings.greetingDesc')}>
        <SettingRow label={t('settings.greetingLabel')} fullWidth>
          <Textarea
            rows={3}
            maxLength={GREETING_MAX_LENGTH}
            placeholder={DEFAULT_GREETING[language]}
            value={local.greeting_text ?? ''}
            onChange={(e) => setLocal((s) => ({ ...s, greeting_text: e.target.value }))}
            onBlur={(e) => save({ greeting_text: e.target.value })}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title={t('settings.recordingTitle')} description={t('settings.recordingDesc')}>
        <SettingRow label={t('settings.recordingLabel')}>
          <div className="flex justify-end sm:justify-start">
            <Switch
              checked={announce}
              onChange={(checked) => {
                setLocal((s) => ({ ...s, announce_recording: checked }));
                save({ announce_recording: checked });
              }}
              variant="brand"
            />
          </div>
        </SettingRow>
        {announce ? (
          <SettingRow label={t('settings.recordingTextLabel')} fullWidth>
            <Textarea
              rows={2}
              maxLength={GREETING_MAX_LENGTH}
              placeholder={DEFAULT_RECORDING_NOTICE[language]}
              value={local.recording_notice_text ?? ''}
              onChange={(e) => setLocal((s) => ({ ...s, recording_notice_text: e.target.value }))}
              onBlur={(e) => save({ recording_notice_text: e.target.value })}
            />
          </SettingRow>
        ) : (
          <p className="flex items-start gap-2 px-4 py-3 text-[13px] text-amber-700">
            <Warning className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" weight="regular" />
            {t('settings.recordingOffWarning')}
          </p>
        )}
      </SettingsSection>
    </div>
  );
}

// ─── Call log tab ───────────────────────────────────────────────────────────

interface TranscriptMessage {
  role: 'assistant' | 'user' | string;
  text: string;
  ts: string;
}

export interface ReceptionistCall {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  billed_credits: number | null;
  outcome: string;
  transcript: TranscriptMessage[] | null;
  created_termin_id: string | null;
}

const OUTCOMES = ['booked', 'info_only', 'message_taken', 'abandoned', 'no_credits'];

const OUTCOME_COLORS: Record<string, string> = {
  booked: 'bg-emerald-50 text-emerald-700',
  info_only: 'bg-blue-50 text-blue-700',
  message_taken: 'bg-amber-50 text-amber-700',
  abandoned: 'bg-gray-100 text-gray-600',
  no_credits: 'bg-red-50 text-red-700',
};

/** Date and time in the company's time zone, written the reader's way. */
function useFormatDateTime() {
  const locale = useLocale();
  const { timezone } = useCompanyRegion();
  return useCallback(
    (iso: string) =>
      new Date(iso).toLocaleString(intlLocale(locale), {
        timeZone: timezone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale, timezone]
  );
}

function formatCredits(value: number, locale: string): string {
  return value.toLocaleString(intlLocale(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Prepis kot v Sporočilih: asistentka levo v sivem, klicatelj desno. */
function CallTranscript({ messages }: { messages: TranscriptMessage[] }) {
  const t = useTranslations('receptionist.calls');
  if (messages.length === 0) {
    return <p className="text-xs text-gray-400 italic">{t('noTranscript')}</p>;
  }
  return (
    <div className="space-y-1.5">
      {messages.map((m, i) => (
        <div
          key={i}
          className={`flex ${m.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-snug ${
              m.role === 'assistant'
                ? 'rounded-bl-md bg-gray-100 text-gray-900'
                : 'rounded-br-md bg-[#6D5EF7]/10 text-gray-900'
            }`}
          >
            {m.text}
          </div>
        </div>
      ))}
    </div>
  );
}

function CallRow({ call }: { call: ReceptionistCall }) {
  const t = useTranslations('receptionist.calls');
  const locale = useLocale();
  const formatDateTime = useFormatDateTime();
  const [expanded, setExpanded] = useState(false);
  const outcomeLabel = OUTCOMES.includes(call.outcome) ? t(`outcome.${call.outcome}`) : call.outcome;
  const outcomeColor = OUTCOME_COLORS[call.outcome] ?? 'bg-gray-100 text-gray-600';
  const hasTranscript = (call.transcript?.length ?? 0) > 0;

  const duration = (() => {
    const sec = call.duration_sec;
    if (!sec && sec !== 0) return '—';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? t('durationMinSec', { m, s }) : t('durationSec', { s });
  })();

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tnum text-sm font-medium text-gray-900">{formatDateTime(call.started_at)}</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${outcomeColor}`}>
              {outcomeLabel}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-gray-500">
            <span className="tnum">{duration}</span>
            <span className="text-gray-300">·</span>
            <span className="tnum">{t('credits', { amount: formatCredits(call.billed_credits ?? 0, locale) })}</span>
            {call.created_termin_id && (
              <>
                <span className="text-gray-300">·</span>
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CalendarCheck className="h-3.5 w-3.5" weight="regular" />
                  {t('appointment', { id: call.created_termin_id.slice(0, 8) })}
                </span>
              </>
            )}
          </div>
        </div>

        {hasTranscript && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            {expanded ? t('collapse') : t('transcript')}
            {expanded ? <CaretUp className="h-3.5 w-3.5" /> : <CaretDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {expanded && hasTranscript && (
        <div className="px-4 pb-4 pt-1">
          <CallTranscript messages={call.transcript!} />
        </div>
      )}
    </div>
  );
}

const pagerButton =
  'inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:pointer-events-none disabled:opacity-40';

export function DnevnikTab() {
  const t = useTranslations('receptionist.calls');
  const [calls, setCalls] = useState<ReceptionistCall[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const pageSize = 20;

  const load = useCallback(async (p: number) => {
    setIsLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/receptionistplus/calls?page=${p}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'load_failed');
      setCalls(data.calls);
      setTotalCount(data.totalCount);
    } catch (e) {
      console.error('[ReceptionistPlus] load calls error:', e);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [load, page]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (isLoading && calls.length === 0) {
    return <LoadingState />;
  }

  if (error && calls.length === 0) {
    return <ErrorState message={t('loadError')} />;
  }

  if (calls.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white px-6 py-14 text-center">
        <Phone className="mx-auto mb-3 h-8 w-8 text-gray-300" weight="regular" />
        <p className="text-sm font-medium text-gray-900">{t('empty')}</p>
        <p className="mt-1 text-[13px] text-gray-500">{t('emptyHint')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100 bg-white">
        {calls.map((call) => (
          <CallRow key={call.id} call={call} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 pt-4">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className={pagerButton}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('prev')}
          </button>
          <span className="tnum text-[13px] text-gray-500">
            {t('pageOf', { page: page + 1, total: totalPages })}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className={pagerButton}
          >
            {t('next')}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Credits tab ────────────────────────────────────────────────────────────

export interface CreditTransaction {
  id: string;
  delta_credits: number;
  balance_after: number | null;
  type: string;
  note: string | null;
  created_at: string;
}

// Keep in sync with lib/receptionistPlusStripe.ts and the Stripe prices (EUR).
const PACKS: { key: 'zagon' | 'standard' | 'profi'; credits: number; priceEur: number }[] = [
  { key: 'zagon', credits: 100, priceEur: 15 },
  { key: 'standard', credits: 300, priceEur: 39 },
  { key: 'profi', credits: 750, priceEur: 89 },
];

const TX_TYPES = ['purchase', 'deduction', 'trial_grant', 'adjustment'];

export function KreditiTab() {
  const t = useTranslations('receptionist.credits');
  const tRoot = useTranslations('receptionist');
  const locale = useLocale();
  const formatDateTime = useFormatDateTime();
  const { companyUuid } = useCompany();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/receptionistplus/credits');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'load_failed');
      setBalance(data.balance);
      setTransactions(data.transactions);
    } catch (e) {
      console.error('[ReceptionistPlus] load credits error:', e);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const buy = useCallback(async (pack: string) => {
    if (!companyUuid) return;
    setBuyingPack(pack);
    try {
      const res = await fetch('/api/receptionistplus/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyUuid, pack, locale }),
      });
      const data = await res.json();
      if (!data.ok || !data.checkout_url) throw new Error(data.error ?? 'checkout_failed');
      window.location.href = data.checkout_url;
    } catch (e) {
      console.error('[ReceptionistPlus] checkout error:', e);
      toast.error(t('checkoutError'));
      setBuyingPack(null);
    }
  }, [companyUuid, locale, t]);

  const transactionLabel = (tx: CreditTransaction) => {
    const amount = Math.abs(tx.delta_credits).toFixed(2).replace(/\.00$/, '');
    const sign = tx.delta_credits >= 0 ? '+' : '-';
    return TX_TYPES.includes(tx.type)
      ? t(`tx.${tx.type}`, { sign, amount })
      : t('tx.other', { type: tx.type, sign, amount });
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={t('loadError')} />;
  }

  return (
    <div>
      {/* Stanje — velika številka kot v Applovi Denarnici, brez barvne podlage */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-7 rounded-xl border border-gray-100 bg-white px-5 py-5"
      >
        <p className="text-[13px] font-medium text-gray-500">{t('balance')}</p>
        <p className="tnum mt-1 text-4xl font-semibold tracking-tight text-gray-900">
          {formatCredits(balance ?? 0, locale)}
          <span className="ml-2 text-lg font-medium text-gray-400">{tRoot('settings.creditsSuffix')}</span>
        </p>
      </motion.div>

      {/* Packs */}
      <SettingsSection title={t('buyTitle')}>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {PACKS.map((pack) => (
            <button
              key={pack.key}
              type="button"
              onClick={() => buy(pack.key)}
              disabled={!companyUuid || buyingPack !== null}
              className="flex items-center justify-between gap-3 rounded-[10px] border border-gray-200 px-4 py-3 text-left transition-colors hover:border-[#6D5EF7] hover:bg-[#6D5EF7]/5 disabled:opacity-50 sm:flex-col sm:items-start sm:gap-0.5"
            >
              <span>
                <span className="block text-sm font-semibold text-gray-900">{t(`packs.${pack.key}`)}</span>
                <span className="tnum block text-[13px] text-gray-500">{t('amount', { amount: pack.credits })}</span>
              </span>
              <span className="tnum text-sm font-semibold text-gray-900 sm:mt-1.5">
                {buyingPack === pack.key ? t('loading') : formatMoney(pack.priceEur, locale, { whole: true })}
              </span>
            </button>
          ))}
        </div>
      </SettingsSection>

      {/* Recent transactions */}
      <SettingsSection title={t('transactionsTitle')}>
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-400">{t('noTransactions')}</p>
        ) : (
          <div className="-my-4 divide-y divide-gray-100">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-900">{transactionLabel(tx)}</p>
                  <p className="tnum text-[13px] text-gray-500">{formatDateTime(tx.created_at)}</p>
                </div>
                <span className={`tnum text-sm font-medium ${tx.delta_credits >= 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                  {tx.delta_credits >= 0 ? '+' : ''}
                  {formatCredits(tx.delta_credits, locale)}
                </span>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>
    </div>
  );
}

// ─── Not-activated state ────────────────────────────────────────────────────
// Self-serve activation: creates the receptionist_settings row (if this is
// the company's first-ever activation, also seeds a 30-credit free trial).

export function NotActivated({ onActivated }: { onActivated: () => void }) {
  const t = useTranslations('receptionist.notActivated');
  const [activating, setActivating] = useState(false);

  const activate = useCallback(async () => {
    setActivating(true);
    try {
      const res = await fetch('/api/receptionistplus/activate', { method: 'POST' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'activation_failed');
      onActivated();
    } catch (e) {
      console.error('[ReceptionistPlus] activate error:', e);
      toast.error(t('error'));
    } finally {
      setActivating(false);
    }
  }, [onActivated, t]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-gray-100 bg-white px-6 py-12 text-center"
    >
      <Phone className="mx-auto mb-3 h-9 w-9 text-gray-300" weight="regular" />
      <h2 className="mb-1 text-[17px] font-semibold text-gray-900">{t('title')}</h2>
      <p className="mx-auto mb-5 max-w-sm text-sm text-gray-500">{t('body')}</p>
      <button
        type="button"
        onClick={activate}
        disabled={activating}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
      >
        {activating ? t('activating') : t('button')}
      </button>
    </motion.div>
  );
}
