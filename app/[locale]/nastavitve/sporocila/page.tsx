'use client';

import { useState, useEffect, useCallback } from 'react';
import { Link } from '@/i18n/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  CaretLeft,
  EnvelopeSimple,
  DeviceMobile,
  CaretDown,
  CaretUp,
  Clock,
    Warning,
  CheckCircle,
  Hourglass,
} from '@phosphor-icons/react';
import { useTranslations, useLocale } from 'next-intl';
import { intlLocale } from '@/lib/format';
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

const FILTER_VALUES = [
  'all',
  'appointment_reminder',
  'appointment_post',
  'appointment_confirmation',
  'lost_leads',
  'communication_message',
] as const;

const KNOWN_ENTITY_TYPES = new Set([
  'appointment_reminder',
  'appointment_post',
  'appointment_confirmation',
  'lost_leads',
  'communication_message',
]);

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('settings');

  if (status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700">
        <CheckCircle className="h-3 w-3" weight="regular" />
        {t('messages.status.sent')}
      </span>
    );
  }
  if (status === 'queued') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-700">
        <Hourglass className="h-3 w-3" weight="regular" />
        {t('messages.status.queued')}
      </span>
    );
  }
  if (status === 'failed' || status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-red-50 text-red-700">
        <Warning className="h-3 w-3" weight="regular" />
        {t('messages.status.failed')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-600">
      {status}
    </span>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  if (channel === 'email') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-blue-50 text-blue-700">
        <EnvelopeSimple className="h-3 w-3" weight="regular" />
        Email
      </span>
    );
  }
  if (channel === 'sms') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-violet-50 text-violet-700">
        <DeviceMobile className="h-3 w-3" weight="regular" />
        SMS
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-600">
      {channel}
    </span>
  );
}

function MessageRow({ msg }: { msg: MessageOutboxRow }) {
  const t = useTranslations('settings');
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);

  const formattedDate = new Date(msg.sent_at).toLocaleString(intlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const typeLabel = KNOWN_ENTITY_TYPES.has(msg.entity_type)
    ? t(`messages.entityLabels.${msg.entity_type}`)
    : msg.entity_type;

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Type label */}
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-gray-900">{typeLabel}</span>
            <ChannelBadge channel={msg.channel} />
            <StatusBadge status={msg.status} />
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-gray-500">
            <span className="max-w-[200px] truncate text-gray-700">{msg.to}</span>
            <span className="text-gray-300">·</span>
            <span className="tnum flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formattedDate}
            </span>
          </div>
        </div>

        {/* Expand button */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          {expanded ? (
            <>
              {t('messages.collapse')}
              <CaretUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              {t('messages.expand')}
              <CaretDown className="h-3.5 w-3.5" />
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
            <div className="space-y-3 px-4 pb-4 pt-1">
              {msg.channel === 'email' && msg.subject && (
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t('messages.subjectLabel')}</p>
                  <p className="rounded-[10px] bg-gray-50 px-3 py-2 text-sm text-gray-900">
                    {msg.subject}
                  </p>
                </div>
              )}
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{t('messages.bodyLabel')}</p>
                <div
                  className="overflow-y-auto rounded-[10px] bg-gray-50 px-3 py-2 text-sm text-gray-900"
                  style={{ maxHeight: '200px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {msg.body || <span className="text-gray-400 italic">{t('messages.noBody')}</span>}
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
  const t = useTranslations('settings');
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
      <Link
        href="/nastavitve"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-4"
      >
        <CaretLeft className="w-3.5 h-3.5" weight="regular" />
        {t('back')}
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{t('messages.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('messages.subtitle')}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_VALUES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveFilter(value)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                activeFilter === value
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t(`messages.filters.${value}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100 bg-white">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse px-4 py-3">
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
          <p className="text-sm font-medium text-gray-900">{t('messages.empty.title')}</p>
          <p className="mt-1 text-[13px] text-gray-500">
            {activeFilter === 'all'
              ? t('messages.empty.all')
              : t('messages.empty.filtered')}
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="mb-1.5 px-1 text-[13px] text-gray-500">
            {t('messages.messageCount', { count: filtered.length })}
          </p>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100 bg-white">
            {filtered.map((msg) => (
              <MessageRow key={msg.id} msg={msg} />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
