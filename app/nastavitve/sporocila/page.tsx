'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  EnvelopeSimple,
  DeviceMobile,
  CaretDown,
  CaretUp,
  Clock,
  Funnel,
  Warning,
  CheckCircle,
  Hourglass,
} from '@phosphor-icons/react';
import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';
import { useCompany } from '@/app/company-context';

interface MessageOutboxRow {
  id: string;
  entity_type: string;
  channel: string;
  to: string;
  status: string;
  body: string;
  subject?: string;
  sent_at: string;
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  appointment_reminder: 'Opomnik pred terminom',
  appointment_post: 'Opomnik po terminu',
  appointment_confirmation: 'Potrdilo termina',
  lost_leads: 'Izgubljene stranke',
  communication_message: 'Komunikacija',
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'Vsa sporočila' },
  { value: 'appointment_reminder', label: 'Opomniki pred' },
  { value: 'appointment_post', label: 'Opomniki po' },
  { value: 'appointment_confirmation', label: 'Potrdila terminov' },
  { value: 'lost_leads', label: 'Izgubljene stranke' },
  { value: 'communication_message', label: 'Komunikacija' },
];

function StatusBadge({ status }: { status: string }) {
  if (status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
        <CheckCircle className="w-3.5 h-3.5" weight="fill" />
        Poslano
      </span>
    );
  }
  if (status === 'queued') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
        <Hourglass className="w-3.5 h-3.5" weight="fill" />
        V vrsti
      </span>
    );
  }
  if (status === 'failed' || status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
        <Warning className="w-3.5 h-3.5" weight="fill" />
        Napaka
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      {status}
    </span>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  if (channel === 'email') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
        <EnvelopeSimple className="w-3.5 h-3.5" weight="fill" />
        Email
      </span>
    );
  }
  if (channel === 'sms') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700">
        <DeviceMobile className="w-3.5 h-3.5" weight="fill" />
        SMS
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      {channel}
    </span>
  );
}

function MessageRow({ msg }: { msg: MessageOutboxRow }) {
  const [expanded, setExpanded] = useState(false);

  const formattedDate = new Date(msg.sent_at).toLocaleString('sl-SI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const typeLabel = ENTITY_TYPE_LABELS[msg.entity_type] ?? msg.entity_type;

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white transition-colors hover:border-gray-200">
      <div className="flex items-center gap-3 p-4">
        {/* Type label */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-sm font-medium text-gray-900">{typeLabel}</span>
            <ChannelBadge channel={msg.channel} />
            <StatusBadge status={msg.status} />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
            <span className="font-medium text-gray-700 truncate max-w-[200px]">{msg.to}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formattedDate}
            </span>
          </div>
        </div>

        {/* Expand button */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:border-gray-300 hover:text-gray-900 transition-colors"
        >
          {expanded ? (
            <>
              <CaretUp className="w-3.5 h-3.5" />
              Zapri
            </>
          ) : (
            <>
              <CaretDown className="w-3.5 h-3.5" />
              Prikaži
            </>
          )}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
              {msg.channel === 'email' && msg.subject && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 tracking-wide mb-1">Zadeva</p>
                  <p className="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2">
                    {msg.subject}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-gray-500 tracking-wide mb-1">Vsebina sporočila</p>
                <div
                  className="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2 overflow-y-auto"
                  style={{ maxHeight: '200px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {msg.body || <span className="text-gray-400 italic">Ni vsebine</span>}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SporocilaPage() {
  const { companyUuid } = useCompany();
  const [messages, setMessages] = useState<MessageOutboxRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const load = useCallback(async () => {
    if (!companyUuid) return;
    setIsLoading(true);
    try {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const hardCutoff = new Date('2026-04-20T00:00:00.000Z');
      const lowerBound = fourteenDaysAgo > hardCutoff ? fourteenDaysAgo : hardCutoff;

      const { data, error } = await supabaseReadOnly
        .from('message_outbox')
        .select('id, entity_type, channel, to, status, body, subject, sent_at')
        .eq('company_id', companyUuid)
        .gte('sent_at', lowerBound.toISOString())
        .order('sent_at', { ascending: false });

      if (!error && data) {
        setMessages(data as MessageOutboxRow[]);
      }
    } catch (err) {
      console.error('Error loading message history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [companyUuid]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered =
    activeFilter === 'all'
      ? messages
      : messages.filter((m) => m.entity_type === activeFilter);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Zgodovina sporočil</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Prikazana je samo zgodovina zadnjih 14 dni
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Funnel className="w-4 h-4 text-gray-400 flex-shrink-0" />
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setActiveFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                activeFilter === opt.value
                  ? 'border-transparent bg-[#0a0a0a] text-white'
                  : 'border-gray-200 text-gray-600 bg-white hover:border-gray-300 hover:text-gray-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="border border-gray-100 rounded-2xl p-4 animate-pulse bg-white">
              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-50 rounded w-1/4" />
                </div>
                <div className="h-8 w-20 bg-gray-100 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <EnvelopeSimple className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-600">Ni poslanih sporočil</p>
          <p className="text-xs text-gray-400 mt-1">
            {activeFilter === 'all'
              ? 'V zadnjih 14 dneh ni bilo poslanih sporočil.'
              : 'Za izbrani filter ni sporočil v zadnjih 14 dneh.'}
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-2"
        >
          <p className="text-xs text-gray-400 mb-3">
            {filtered.length} {filtered.length === 1 ? 'sporočilo' : filtered.length < 5 ? 'sporočila' : 'sporočil'}
          </p>
          {filtered.map((msg) => (
            <MessageRow key={msg.id} msg={msg} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
