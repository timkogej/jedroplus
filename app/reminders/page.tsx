'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Bell,
  Gear,
  CheckCircle,
  CalendarBlank,
  Clock,
  Info,
  EnvelopeSimple,
  Palette,
  ChatText,
  XCircle,
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { getCompanyColumnForTable } from '@/lib/companyScope';
import { loadCompanyRow } from '@/lib/settingsStore';
import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';
import StatusBadge from '@/components/shared/StatusBadge';
import { ReminderSettingsModal } from '@/components/reminders/ReminderSettingsModal';

type ReminderRow = Record<string, unknown>;

const isEnabledValue = (value: unknown, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (normalized === 'true' || normalized === 'yes' || normalized === 'da') return true;
    if (normalized === 'false' || normalized === 'no' || normalized === 'ne') return false;
    if (normalized.includes('omogo')) return true;
    if (normalized.includes('onemogo')) return false;
  }
  return fallback;
};

export default function RemindersPage() {
  const { companyId, companySettings } = useCompany();
  const [companyRow, setCompanyRow] = useState<Record<string, unknown> | null>(
    companySettings ?? null
  );
  const [reminderRow, setReminderRow] = useState<ReminderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Settings values (read-only display)
  const [sendingLanguage, setSendingLanguage] = useState('sl');
  const [replyToEmail, setReplyToEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [tone, setTone] = useState('prijazen');
  const [enabledBefore, setEnabledBefore] = useState(true);
  const [beforeChannel, setBeforeChannel] = useState('email');
  const [beforeInstructions, setBeforeInstructions] = useState('');
  const [enabledAfter, setEnabledAfter] = useState(true);
  const [afterChannel, setAfterChannel] = useState('email');
  const [afterHasDiscount, setAfterHasDiscount] = useState(false);
  const [afterDiscountText, setAfterDiscountText] = useState('');
  const [afterInstructions, setAfterInstructions] = useState('');
  const [emailPrimary, setEmailPrimary] = useState('');
  const [emailSecondary, setEmailSecondary] = useState('');
  const [nastvetiStoritev, setNastvetiStoritev] = useState<'yes' | 'no' | 'auto'>('auto');

  // Stats
  const [stats, setStats] = useState({
    sentToday: 0,
    scheduledTomorrow: 0,
    afterVisitsToday: 0,
  });

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);

    try {
      const { data: companyData } = await loadCompanyRow(companyId);
      setCompanyRow(companyData ?? null);
      setReminderRow(companyData ?? null);

      // Fetch stats from appointments
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const companyColumn = await getCompanyColumnForTable('Termini', companyId);

      const { count: tomorrowCount } = await supabaseReadOnly
        .from('Termini')
        .select('*', { count: 'exact', head: true })
        .eq(companyColumn, companyId)
        .gte('Datum', tomorrow.toISOString().split('T')[0])
        .lt('Datum', new Date(tomorrow.getTime() + 86400000).toISOString().split('T')[0]);

      const { count: completedCount } = await supabaseReadOnly
        .from('Termini')
        .select('*', { count: 'exact', head: true })
        .eq(companyColumn, companyId)
        .gte('Datum', today.toISOString().split('T')[0])
        .lt('Datum', tomorrow.toISOString().split('T')[0])
        .or('Status.ilike.%zakljuc%,Status.ilike.%complet%,Status.eq.Zaključen');

      setStats({
        sentToday: tomorrowCount ?? 0,
        scheduledTomorrow: tomorrowCount ?? 0,
        afterVisitsToday: completedCount ?? 0,
      });

    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const source = reminderRow ?? companyRow;
    if (!source) return;

    setSendingLanguage(String(source['jezik posiljanja'] ?? source['jezik_posiljanja'] ?? 'sl'));
    setReplyToEmail(String(source.reply_to ?? source.reply_to_email ?? ''));
    setFromName(String(source.from_name ?? source.From_name ?? ''));
    setTone(String(source.reminder_tone ?? source['Ton komunikacije opomikov'] ?? 'prijazen'));

    setEnabledBefore(isEnabledValue(
      source['Pošiljanje PRED'] ?? source.enabled_before_booking ?? source.posiljanje_pred,
      true
    ));
    setBeforeChannel(String(source['chanel_pred'] ?? source['Chanel_pred'] ?? 'email'));
    setBeforeInstructions(String(
      source['Nastavitve PRED'] ?? source.before_booking_instructions ?? source.nastavitve_pred ?? ''
    ));

    setEnabledAfter(isEnabledValue(
      source['Pošiljanje PO'] ?? source.enabled_after_booking ?? source.posiljanje_po,
      true
    ));
    setAfterChannel(String(source['channel_po'] ?? source['Channel_po'] ?? 'email'));
    const popustPo = source['Popust PO'] ?? source.after_booking_discount_text ?? source.popust_po ?? '';
    const popustStr = String(popustPo).trim();
    setAfterHasDiscount(popustStr !== '' && popustStr.toLowerCase() !== 'ni popusta' && popustStr !== '0');
    setAfterDiscountText(popustStr === 'ni popusta' ? '' : popustStr);

    setAfterInstructions(String(
      source['Nastavitve PO'] ?? source.after_booking_instructions ?? source.nastavitve_po ?? ''
    ));

    setEmailPrimary(String(source.brand_primary ?? source['from_email_primary_color'] ?? source.email_primary_color ?? ''));
    setEmailSecondary(String(source.brand_second ?? source['from_email_secondary_color'] ?? source.email_secondary_color ?? ''));

    const nsVal = String(source['Nastveti_storitev'] ?? 'auto').toLowerCase().trim();
    setNastvetiStoritev(nsVal === 'yes' ? 'yes' : nsVal === 'no' ? 'no' : 'auto');
  }, [reminderRow, companyRow]);

  const getToneLabel = (toneValue: string) => {
    const toneMap: Record<string, string> = {
      'profesionalen': 'Profesionalen',
      'prijazen': 'Prijazen',
      'prodajno_usmerjen': 'Prodajno usmerjen',
      'formal': 'Formalen',
      'sproscen': 'Sproščen',
    };
    return toneMap[toneValue] || toneValue;
  };

  const getLanguageLabel = (lang: string) => {
    const langMap: Record<string, string> = {
      'sl': 'Slovenščina',
      'en': 'English',
      'it': 'Italiano',
      'de': 'Deutsch',
    };
    return langMap[lang] || lang;
  };

  const getChannelLabel = (channel: string) => {
    return channel === 'sms' ? 'SMS' : 'Email';
  };

  if (!companyId) return null;

  return (
    <ProtectedLayout>
      <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex flex-wrap items-start justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl font-bold text-[#1A1F36]">Opomniki</h1>
              <p className="mt-1 text-sm text-gray-500">
                Pregled nastavitev avtomatskih opomnikov
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Settings button */}
              <motion.button
                onClick={() => setShowSettingsModal(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
                title="Nastavitve"
              >
                <Gear size={20} weight="bold" className="text-gray-900" />
              </motion.button>
            </div>
          </motion.div>

          {/* Statistics Cards */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="relative rounded-2xl p-[3px] overflow-hidden bg-gradient-to-r from-violet-200 via-blue-200 to-cyan-200">
                    <div className="bg-white rounded-[13px] p-6">
                      <div className="flex items-center justify-between">
                        <div className="h-8 w-16 rounded-lg bg-gray-200 animate-pulse" />
                        <div className="h-6 w-6 rounded bg-gray-200 animate-pulse" />
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
                        <div className="h-3 w-20 rounded bg-gray-200 animate-pulse" />
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0 }}
                  className="relative rounded-2xl p-[3px] bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500"
                >
                  <div className="bg-white rounded-[13px] p-6">
                    <div className="flex items-center justify-between">
                      <div className="text-3xl font-bold text-gray-900 leading-none">{stats.sentToday}</div>
                      <Bell className="h-6 w-6 text-gray-900" weight="bold" />
                    </div>
                    <div className="mt-3 text-left">
                      <div className="text-sm font-medium text-gray-600">Poslano Danes</div>
                      <div className="text-xs text-gray-500 mt-1">Opomnikov pred terminom</div>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="relative rounded-2xl p-[3px] bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500"
                >
                  <div className="bg-white rounded-[13px] p-6">
                    <div className="flex items-center justify-between">
                      <div className="text-3xl font-bold text-gray-900 leading-none">{stats.scheduledTomorrow}</div>
                      <CalendarBlank className="h-6 w-6 text-gray-900" weight="bold" />
                    </div>
                    <div className="mt-3 text-left">
                      <div className="text-sm font-medium text-gray-600">Napovedano Jutri</div>
                      <div className="text-xs text-gray-500 mt-1">Terminov z opomniki</div>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="relative rounded-2xl p-[3px] bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500"
                >
                  <div className="bg-white rounded-[13px] p-6">
                    <div className="flex items-center justify-between">
                      <div className="text-3xl font-bold text-gray-900 leading-none">{stats.afterVisitsToday}</div>
                      <CheckCircle className="h-6 w-6 text-gray-900" weight="bold" />
                    </div>
                    <div className="mt-3 text-left">
                      <div className="text-sm font-medium text-gray-600">Po Obiskih Danes</div>
                      <div className="text-xs text-gray-500 mt-1">Zaključenih terminov</div>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </div>

          {/* Settings Sections */}
          {loading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100 animate-pulse">
                  <div className="h-6 w-48 bg-gray-200 rounded mb-6" />
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="h-24 bg-gray-100 rounded-xl" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Splošne nastavitve */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100"
              >
                <h2 className="text-xl font-semibold text-[#1A1F36] mb-6">Splošne nastavitve</h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-4">
                      <ChatText className="w-5 h-5 text-black" weight="regular" />
                      <h3 className="font-bold text-lg text-gray-900">Jezik pošiljanja</h3>
                    </div>
                    <p className="text-base text-gray-900">{getLanguageLabel(sendingLanguage)}</p>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-4">
                      <ChatText className="w-5 h-5 text-black" weight="regular" />
                      <h3 className="font-bold text-lg text-gray-900">Ton komunikacije</h3>
                    </div>
                    <p className="text-base text-gray-900">{getToneLabel(tone)}</p>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-4">
                      <EnvelopeSimple className="w-5 h-5 text-black" weight="regular" />
                      <h3 className="font-bold text-lg text-gray-900">Reply-to Email</h3>
                    </div>
                    <p className="text-base text-gray-900 truncate">
                      {replyToEmail || <span className="text-gray-400">Ni nastavljeno</span>}
                    </p>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-4">
                      <EnvelopeSimple className="w-5 h-5 text-black" weight="regular" />
                      <h3 className="font-bold text-lg text-gray-900">Ime pošiljatelja</h3>
                    </div>
                    <p className="text-base text-gray-900 truncate">
                      {fromName || <span className="text-gray-400">Ni nastavljeno</span>}
                    </p>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-4">
                      <Palette className="w-5 h-5 text-black" weight="regular" />
                      <h3 className="font-bold text-lg text-gray-900">Primarna barva</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      {emailPrimary ? (
                        <>
                          <div
                            className="w-8 h-8 rounded-lg border border-gray-200 shadow-inner"
                            style={{ backgroundColor: emailPrimary.startsWith('#') ? emailPrimary : `#${emailPrimary}` }}
                          />
                          <p className="text-base text-gray-900 font-mono">{emailPrimary}</p>
                        </>
                      ) : (
                        <span className="text-gray-400">Ni nastavljeno</span>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-4">
                      <Palette className="w-5 h-5 text-black" weight="regular" />
                      <h3 className="font-bold text-lg text-gray-900">Sekundarna barva</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      {emailSecondary ? (
                        <>
                          <div
                            className="w-8 h-8 rounded-lg border border-gray-200 shadow-inner"
                            style={{ backgroundColor: emailSecondary.startsWith('#') ? emailSecondary : `#${emailSecondary}` }}
                          />
                          <p className="text-base text-gray-900 font-mono">{emailSecondary}</p>
                        </>
                      ) : (
                        <span className="text-gray-400">Ni nastavljeno</span>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-4">
                      <ChatText className="w-5 h-5 text-black" weight="regular" />
                      <h3 className="font-bold text-lg text-gray-900">Nasveti glede na storitev</h3>
                    </div>
                    <p className="text-base text-gray-900">
                      {nastvetiStoritev === 'yes' ? 'Da' : nastvetiStoritev === 'no' ? 'Ne' : 'AI sam odloči'}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Opomniki pred terminom */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100"
              >
                <h2 className="text-xl font-semibold text-[#1A1F36] mb-6">Opomniki pred terminom</h2>
                {!enabledBefore ? (
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <XCircle className="w-6 h-6 text-gray-400" weight="regular" />
                    <span className="text-gray-600 font-medium">Onemogočeno</span>
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 mb-4">
                        <Bell className="w-5 h-5 text-black" weight="regular" />
                        <h3 className="font-bold text-lg text-gray-900">Status</h3>
                      </div>
                      <StatusBadge enabled={enabledBefore} />
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 mb-4">
                        <EnvelopeSimple className="w-5 h-5 text-black" weight="regular" />
                        <h3 className="font-bold text-lg text-gray-900">Način pošiljanja</h3>
                      </div>
                      <p className="text-base text-gray-900">{getChannelLabel(beforeChannel)}</p>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 mb-4">
                        <Clock className="w-5 h-5 text-black" weight="regular" />
                        <h3 className="font-bold text-lg text-gray-900">Čas pošiljanja</h3>
                      </div>
                      <p className="text-base text-gray-900">1 dan pred terminom</p>
                    </div>

                    {beforeInstructions && (
                      <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow md:col-span-2 lg:col-span-3">
                        <div className="flex items-center gap-2 mb-4">
                          <ChatText className="w-5 h-5 text-black" weight="regular" />
                          <h3 className="font-bold text-lg text-gray-900">Navodila</h3>
                        </div>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{beforeInstructions}</p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>

              {/* Opomniki po terminu */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100"
              >
                <h2 className="text-xl font-semibold text-[#1A1F36] mb-6">Opomniki po terminu</h2>
                {!enabledAfter ? (
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <XCircle className="w-6 h-6 text-gray-400" weight="regular" />
                    <span className="text-gray-600 font-medium">Onemogočeno</span>
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 mb-4">
                        <CheckCircle className="w-5 h-5 text-black" weight="regular" />
                        <h3 className="font-bold text-lg text-gray-900">Status</h3>
                      </div>
                      <StatusBadge enabled={enabledAfter} />
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 mb-4">
                        <EnvelopeSimple className="w-5 h-5 text-black" weight="regular" />
                        <h3 className="font-bold text-lg text-gray-900">Način pošiljanja</h3>
                      </div>
                      <p className="text-base text-gray-900">{getChannelLabel(afterChannel)}</p>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 mb-4">
                        <Clock className="w-5 h-5 text-black" weight="regular" />
                        <h3 className="font-bold text-lg text-gray-900">Čas pošiljanja</h3>
                      </div>
                      <p className="text-base text-gray-900">Takoj po zaključku</p>
                    </div>

                    {afterHasDiscount && afterDiscountText && (
                      <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow md:col-span-2 lg:col-span-3">
                        <div className="flex items-center gap-2 mb-4">
                          <ChatText className="w-5 h-5 text-black" weight="regular" />
                          <h3 className="font-bold text-lg text-gray-900">Popust</h3>
                        </div>
                        <p className="text-base text-gray-900">{afterDiscountText}</p>
                      </div>
                    )}

                    {afterInstructions && (
                      <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow md:col-span-2 lg:col-span-3">
                        <div className="flex items-center gap-2 mb-4">
                          <ChatText className="w-5 h-5 text-black" weight="regular" />
                          <h3 className="font-bold text-lg text-gray-900">Navodila</h3>
                        </div>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{afterInstructions}</p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </div>
          )}

          {/* Info Box */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white flex-shrink-0">
                <Info className="h-4 w-4" weight="bold" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-1">O Opomnikih</h4>
                <p className="text-sm text-gray-700">
                  Opomniki se pošiljajo avtomatsko na podlagi tukaj prikazanih nastavitev.
                  Stranke prejmejo opomnik pred terminom in/ali po zaključenem terminu,
                  odvisno od konfiguracije. Sistem samodejno prilagaja vsebino glede na
                  izbran ton komunikacije.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Settings Modal */}
      <ReminderSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </ProtectedLayout>
  );
}
