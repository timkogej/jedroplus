'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import {
  Gear,
  ClockCounterClockwise,
  Coins,
  Warning,
  Phone,
  CaretDown,
  CaretUp,
  CalendarCheck,
  ArrowLeft,
  ArrowRight,
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { GradientSpinner } from '@/components/ui/GradientSpinner';
import { useCompany } from '@/app/company-context';
import AmbientBottomGlow from '@/components/shared/AmbientBottomGlow';
import {
  SettingsSection,
  SettingRow,
  Switch,
  Select,
  Input,
  Textarea,
  SaveIndicator,
} from '@/components/settings';

// ─── Brand glow background ─────────────────────────────────────────────────
// Ambient bottom-anchored glow using the Jedro+ brand gradient
// (see app/globals.css .gradient-text / addoni's BRAND_GRADIENT for the same
// #6D5EF7 -> #2F80ED -> #2AD4C5 tokens), weighted toward purple since it
// "shines" from below. Subtle, low-opacity, non-interactive.
function BrandGlow() {
  return <AmbientBottomGlow tone="brand" className="h-[48vh]" />;
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

type TabKey = 'nastavitve' | 'dnevnik' | 'krediti';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'nastavitve', label: 'Nastavitve', icon: Gear },
  { key: 'dnevnik', label: 'Klicni dnevnik', icon: ClockCounterClockwise },
  { key: 'krediti', label: 'Krediti', icon: Coins },
];

// ─── Settings tab ───────────────────────────────────────────────────────────

interface ReceptionistSettings {
  enabled: boolean;
  low_balance_threshold: number;
  greeting_text: string | null;
  language: string;
}

const DEFAULT_GREETING = 'Pozdravljeni, dobrodošli! Kako vam lahko pomagam?';

const LANGUAGE_OPTIONS = [{ value: 'sl', label: 'Slovenščina' }];

function NastavitveTab({
  settings,
  onSave,
}: {
  settings: ReceptionistSettings;
  onSave: (patch: Partial<ReceptionistSettings>) => Promise<void>;
}) {
  const [local, setLocal] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const save = useCallback(async (patch: Partial<ReceptionistSettings>) => {
    setSaving(true);
    try {
      await onSave(patch);
      setLastSaved(new Date());
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  return (
    <div>
      <div className="flex items-center justify-end mb-3 h-5">
        <SaveIndicator saving={saving} lastSaved={lastSaved} />
      </div>

      <SettingsSection title="Splošno">
        <SettingRow
          label="Omogoči ReceptionistPlus"
          description="Ko je vklopljeno, AI recepcionistka odgovarja na klice v imenu vašega podjetja."
        >
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

        <SettingRow
          label="Jezik"
          description="Jezik, v katerem AI recepcionistka odgovarja na klice."
        >
          <Select
            value={local.language}
            onChange={(value) => {
              setLocal((s) => ({ ...s, language: value }));
              save({ language: value });
            }}
            options={LANGUAGE_OPTIONS}
            disabled={LANGUAGE_OPTIONS.length <= 1}
          />
        </SettingRow>

        <SettingRow
          label="Prag za nizko stanje kreditov"
          description="Ko stanje pade pod to vrednost, boste obveščeni o nizkem stanju kreditov."
        >
          <Input
            type="number"
            min={0}
            step={1}
            suffix="kreditov"
            value={local.low_balance_threshold}
            onChange={(e) => setLocal((s) => ({ ...s, low_balance_threshold: Number(e.target.value) }))}
            onBlur={(e) => save({ low_balance_threshold: Number(e.target.value) })}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection
        title="Pozdravno besedilo"
        description="Poljubno. Če pustite prazno, bo uporabljeno privzeto pozdravno besedilo."
      >
        <SettingRow label="Pozdrav ob klicu" fullWidth>
          <Textarea
            rows={3}
            placeholder={DEFAULT_GREETING}
            value={local.greeting_text ?? ''}
            onChange={(e) => setLocal((s) => ({ ...s, greeting_text: e.target.value }))}
            onBlur={(e) => save({ greeting_text: e.target.value })}
          />
        </SettingRow>
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

interface ReceptionistCall {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  billed_credits: number | null;
  outcome: string;
  transcript: TranscriptMessage[] | null;
  created_termin_id: string | null;
}

const OUTCOME_LABELS: Record<string, string> = {
  booked: 'Rezervirano',
  info_only: 'Samo informacije',
  message_taken: 'Sporočilo prevzeto',
  abandoned: 'Prekinjeno',
  no_credits: 'Ni kreditov',
};

const OUTCOME_COLORS: Record<string, string> = {
  booked: 'bg-emerald-50 text-emerald-700',
  info_only: 'bg-blue-50 text-blue-700',
  message_taken: 'bg-amber-50 text-amber-700',
  abandoned: 'bg-gray-100 text-gray-600',
  no_credits: 'bg-red-50 text-red-700',
};

function formatDuration(sec: number | null): string {
  if (!sec && sec !== 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function CallTranscript({ messages }: { messages: TranscriptMessage[] }) {
  if (messages.length === 0) {
    return <p className="text-xs text-gray-400 italic">Ni zapisa pogovora.</p>;
  }
  return (
    <div className="space-y-2">
      {messages.map((m, i) => (
        <div
          key={i}
          className={`flex ${m.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
        >
          <div
            className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
              m.role === 'assistant'
                ? 'bg-gray-100 text-gray-800'
                : 'bg-[#6D5EF7]/10 text-gray-900'
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
  const [expanded, setExpanded] = useState(false);
  const outcomeLabel = OUTCOME_LABELS[call.outcome] ?? call.outcome;
  const outcomeColor = OUTCOME_COLORS[call.outcome] ?? 'bg-gray-100 text-gray-600';
  const hasTranscript = (call.transcript?.length ?? 0) > 0;

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white">
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${outcomeColor}`}>
              {outcomeLabel}
            </span>
            {call.created_termin_id && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                <CalendarCheck className="w-3.5 h-3.5" weight="fill" />
                Termin #{call.created_termin_id.slice(0, 8)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{formatDateTime(call.started_at)}</span>
            <span>·</span>
            <span>{formatDuration(call.duration_sec)}</span>
            <span>·</span>
            <span>{(call.billed_credits ?? 0).toFixed(2)} kreditov</span>
          </div>
        </div>

        {hasTranscript && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:border-gray-300 hover:text-gray-900 transition-colors"
          >
            {expanded ? <CaretUp className="w-3.5 h-3.5" /> : <CaretDown className="w-3.5 h-3.5" />}
            {expanded ? 'Skrči' : 'Prepis'}
          </button>
        )}
      </div>

      {expanded && hasTranscript && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          <CallTranscript messages={call.transcript!} />
        </div>
      )}
    </div>
  );
}

function DnevnikTab() {
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
      if (!data.ok) throw new Error(data.error ?? 'Napaka');
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
    return (
      <div className="flex items-center justify-center py-16">
        <GradientSpinner size={32} />
      </div>
    );
  }

  if (error && calls.length === 0) {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center">
        <Warning className="w-7 h-7 text-red-500 mx-auto mb-2" weight="fill" />
        <p className="text-sm text-red-700">Napaka pri nalaganju klicnega dnevnika.</p>
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 px-6 py-14 text-center">
        <p className="text-sm font-medium text-gray-500">Ni še nobenega klica</p>
        <p className="text-xs text-gray-400 mt-1">Klici bodo prikazani tukaj, ko jih AI recepcionistka sprejme.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {calls.map((call) => (
        <CallRow key={call.id} call={call} />
      ))}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 pt-4">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:border-gray-300 hover:text-gray-900 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Prejšnja
          </button>
          <span className="text-xs text-gray-500">
            {page + 1} od {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:border-gray-300 hover:text-gray-900 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            Naslednja
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Credits tab ────────────────────────────────────────────────────────────

interface CreditTransaction {
  id: string;
  delta_credits: number;
  balance_after: number | null;
  type: string;
  note: string | null;
  created_at: string;
}

const PACKS: { key: 'zagon' | 'standard' | 'profi'; label: string; credits: number; price: string }[] = [
  { key: 'zagon', label: 'Zagon', credits: 100, price: '15 €' },
  { key: 'standard', label: 'Standard', credits: 300, price: '39 €' },
  { key: 'profi', label: 'Profi', credits: 750, price: '89 €' },
];

function transactionLabel(tx: CreditTransaction): string {
  const amount = Math.abs(tx.delta_credits).toFixed(2).replace(/\.00$/, '');
  const sign = tx.delta_credits >= 0 ? '+' : '-';
  switch (tx.type) {
    case 'purchase':
      return `Nakup ${sign}${amount} kreditov`;
    case 'deduction':
      return `Klic ${sign}${amount} kreditov`;
    case 'trial_grant':
      return `Brezplačna preizkusna doba ${sign}${amount} kreditov`;
    case 'adjustment':
      return `Prilagoditev ${sign}${amount} kreditov`;
    default:
      return `${tx.type} ${sign}${amount} kreditov`;
  }
}

function KreditiTab() {
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
      if (!data.ok) throw new Error(data.error ?? 'Napaka');
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
        body: JSON.stringify({ company_id: companyUuid, pack }),
      });
      const data = await res.json();
      if (!data.ok || !data.checkout_url) throw new Error(data.error ?? 'Napaka pri ustvarjanju Checkout seje');
      window.location.href = data.checkout_url;
    } catch (e) {
      console.error('[ReceptionistPlus] checkout error:', e);
      setBuyingPack(null);
    }
  }, [companyUuid]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <GradientSpinner size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center">
        <Warning className="w-7 h-7 text-red-500 mx-auto mb-2" weight="fill" />
        <p className="text-sm text-red-700">Napaka pri nalaganju kreditov.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Balance hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl mb-6 p-6"
        style={{
          background: 'linear-gradient(135deg, #6D5EF7 0%, #2F80ED 55%, #2AD4C5 100%)',
        }}
      >
        <p className="text-white/70 text-sm font-medium mb-1">Trenutno stanje</p>
        <p className="text-4xl font-bold text-white">{(balance ?? 0).toFixed(2)} kreditov</p>
      </motion.div>

      {/* Packs */}
      <SettingsSection title="Kupi kredite">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PACKS.map((pack) => (
            <button
              key={pack.key}
              type="button"
              onClick={() => buy(pack.key)}
              disabled={!companyUuid || buyingPack !== null}
              className="flex flex-col items-start gap-1 rounded-xl border border-gray-200 px-4 py-3.5 text-left hover:border-[#6D5EF7] hover:bg-[#6D5EF7]/5 transition-colors disabled:opacity-50"
            >
              <span className="font-semibold text-gray-900">{pack.label}</span>
              <span className="text-sm text-gray-500">{pack.credits} kreditov</span>
              <span className="text-sm font-medium text-gray-900 mt-1">
                {buyingPack === pack.key ? 'Nalaganje…' : pack.price}
              </span>
            </button>
          ))}
        </div>
      </SettingsSection>

      {/* Recent transactions */}
      <SettingsSection title="Nedavne transakcije">
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-400">Ni še transakcij.</p>
        ) : (
          <div className="space-y-1">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm text-gray-800">{transactionLabel(tx)}</p>
                  <p className="text-xs text-gray-400">{formatDateTime(tx.created_at)}</p>
                </div>
                <span className={`text-sm font-medium ${tx.delta_credits >= 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                  {tx.delta_credits >= 0 ? '+' : ''}
                  {tx.delta_credits.toFixed(2)}
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

function NotActivated({ onActivated }: { onActivated: () => void }) {
  const [activating, setActivating] = useState(false);

  const activate = useCallback(async () => {
    setActivating(true);
    try {
      const res = await fetch('/api/receptionistplus/activate', { method: 'POST' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'Napaka');
      onActivated();
    } catch (e) {
      console.error('[ReceptionistPlus] activate error:', e);
      toast.error('Aktivacija ni uspela. Poskusite znova.');
    } finally {
      setActivating(false);
    }
  }, [onActivated]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white border border-gray-100 p-10 text-center"
    >
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <Phone className="w-7 h-7 text-gray-400" weight="regular" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">ReceptionistPlus ni aktiviran</h2>
      <p className="text-sm text-gray-500 max-w-sm mx-auto mb-5">
        Omogočite AI recepcionistko za vaše podjetje in prejmite 30 brezplačnih preizkusnih kreditov.
      </p>
      <button
        type="button"
        onClick={activate}
        disabled={activating}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg, #6D5EF7 0%, #2F80ED 55%, #2AD4C5 100%)' }}
      >
        {activating ? 'Aktiviram…' : 'Aktiviraj ReceptionistPlus'}
      </button>
    </motion.div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ReceptionistPlusPage() {
  const [tab, setTab] = useState<TabKey>('nastavitve');
  const [provisioned, setProvisioned] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<ReceptionistSettings | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch('/api/receptionistplus/settings');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'Napaka');
      setProvisioned(Boolean(data.provisioned));
      setSettings(data.settings);
    } catch (e) {
      console.error('[ReceptionistPlus] load settings error:', e);
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'krediti') {
      setTab('krediti');
    }
  }, []);

  const saveSettings = useCallback(async (patch: Partial<ReceptionistSettings>) => {
    const res = await fetch('/api/receptionistplus/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error ?? 'Napaka');
    setSettings((s) => (s ? { ...s, ...patch } : s));
  }, []);

  return (
    <ProtectedLayout>
      <div className="relative min-h-screen">
        <BrandGlow />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1
              className="inline-block text-3xl font-bold text-transparent"
              style={{
                background: 'linear-gradient(135deg, #6D5EF7 0%, #2F80ED 52%, #2AD4C5 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              ReceptionistPlus
            </h1>
            <p className="mt-1 text-sm text-gray-500">Vaša AI telefonska asistentka</p>
          </motion.div>

          {provisioned === null && !error ? (
            <div className="flex items-center justify-center py-16">
              <GradientSpinner size={32} />
            </div>
          ) : error && provisioned === null ? (
            <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center">
              <Warning className="w-7 h-7 text-red-500 mx-auto mb-2" weight="fill" />
              <p className="text-sm text-red-700">Napaka pri nalaganju strani.</p>
            </div>
          ) : !provisioned ? (
            <NotActivated onActivated={load} />
          ) : (
            <>
              {/* Tabs */}
              <div className="flex items-center gap-1 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl p-1 mb-6 w-fit">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                      tab === key
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" weight={tab === key ? 'fill' : 'regular'} />
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'nastavitve' && settings && (
                <NastavitveTab settings={settings} onSave={saveSettings} />
              )}
              {tab === 'dnevnik' && <DnevnikTab />}
              {tab === 'krediti' && <KreditiTab />}
            </>
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}
