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
  Warning,
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { useRolePermissions } from '@/app/role-permission-context';
import { getCompanyColumnForTable } from '@/lib/companyScope';
import { loadCompanyRow } from '@/lib/settingsStore';
import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';
import { ReminderSettingsModal } from '@/components/reminders/ReminderSettingsModal';
import { GradientSpinner } from '@/components/ui/GradientSpinner';

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
  const { companyId, companyUuid, companySettings } = useCompany();
  const { role, permissions } = useRolePermissions();
  const canManageSettings = role !== 'staff' || (permissions?.can_manage_opomniki ?? true);
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
  const [smsSenderId, setSmsSenderId] = useState('');
  const [smsModePred, setSmsModePred] = useState<'ai' | 'manual'>('ai');
  const [smsModePo, setSmsModePo] = useState<'ai' | 'manual'>('ai');
  const [smsTemplatePred, setSmsTemplatePred] = useState('');
  const [smsTemplatePo, setSmsTemplatePo] = useState('');
  const [smsStoritevPred, setSmsStoritevPred] = useState(false);
  const [smsNavodilaPred, setSmsNavodilaPred] = useState(false);
  const [smsStoritevPo, setSmsStoritevPo] = useState(false);
  const [smsNavodilaPo, setSmsNavodilaPo] = useState(false);

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

      // Fetch sms_sender_id from companies table
      if (companyUuid) {
        const { data: companiesData } = await supabaseReadOnly
          .from('companies')
          .select('sms_sender_id')
          .eq('id', companyUuid)
          .maybeSingle();
        if (companiesData?.sms_sender_id !== undefined) {
          setSmsSenderId(String(companiesData.sms_sender_id ?? ''));
        }
      }

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
  }, [companyId, companyUuid]);

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

    setSmsSenderId(String(source['sms_sender_id'] ?? ''));

    // SMS mode settings
    const parseBool = (v: unknown) => {
      if (typeof v === 'boolean') return v;
      if (typeof v === 'string') return v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
      return false;
    };
    const smsTypePred = String(source['sms_type_pred'] ?? 'AI').toUpperCase();
    setSmsModePred(smsTypePred === 'LP' ? 'manual' : 'ai');
    const smsTypePo = String(source['sms_type_po'] ?? 'AI').toUpperCase();
    setSmsModePo(smsTypePo === 'LP' ? 'manual' : 'ai');
    setSmsTemplatePred(String(source['lastna_predloga_pred'] ?? ''));
    setSmsTemplatePo(String(source['lastna_predloga_po'] ?? ''));
    setSmsStoritevPred(parseBool(source['sms_storitev_pred']));
    setSmsNavodilaPred(parseBool(source['sms_navodila_pred']));
    setSmsStoritevPo(parseBool(source['sms_storitev_po']));
    setSmsNavodilaPo(parseBool(source['sms_navodila_po']));
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

  const hasIncompleteSettings = !loading && (!fromName.trim() || !replyToEmail.trim());

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
              {canManageSettings && (
                <motion.button
                  onClick={() => setShowSettingsModal(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
                  title="Nastavitve"
                >
                  <Gear size={20} weight="bold" className="text-gray-900" />
                  {hasIncompleteSettings && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-white border border-white" style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>!</span>
                  )}
                </motion.button>
              )}
            </div>
          </motion.div>

          {/* Incomplete settings banner */}
          {hasIncompleteSettings && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex items-center gap-3 rounded-2xl px-5 py-3.5 bg-orange-50 border border-orange-200"
            >
              <Warning size={18} weight="fill" className="text-orange-500 flex-shrink-0" />
              <p className="text-sm text-orange-800 flex-1">
                <span className="font-semibold">Izpolnite nastavitve označene s !</span>{' '}
                za brezhibno delovanje in izkoriščanje celotnega potenciala opomnikov.
              </p>
              {canManageSettings && (
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="text-xs font-semibold text-orange-700 hover:text-orange-900 underline underline-offset-2 flex-shrink-0"
                >
                  Odpri nastavitve →
                </button>
              )}
            </motion.div>
          )}

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
                      <div className="text-3xl font-bold text-gray-900 leading-none">{enabledBefore ? stats.sentToday : 0}</div>
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
                      <div className="text-3xl font-bold text-gray-900 leading-none">{enabledAfter ? stats.afterVisitsToday : 0}</div>
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
            <div className="flex items-center justify-center py-20">
              <GradientSpinner />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Splošne nastavitve */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100"
              >
                <h2 className="text-base font-semibold text-[#1A1F36] mb-4">Splošne nastavitve</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <ChatText className="w-4 h-4 text-gray-400" weight="regular" />
                      <span className="text-sm font-medium text-gray-700">Jezik pošiljanja</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{getLanguageLabel(sendingLanguage)}</span>
                  </div>

                  <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <ChatText className="w-4 h-4 text-gray-400" weight="regular" />
                      <span className="text-sm font-medium text-gray-700">Ton komunikacije</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{getToneLabel(tone)}</span>
                  </div>

                  <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <EnvelopeSimple className="w-4 h-4 text-gray-400" weight="regular" />
                      <span className="text-sm font-medium text-gray-700">Reply-to Email</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 truncate max-w-xs">
                      {replyToEmail || <span className="font-normal text-gray-400">Ni nastavljeno</span>}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <EnvelopeSimple className="w-4 h-4 text-gray-400" weight="regular" />
                      <div>
                        <span className="text-sm font-medium text-gray-700">Ime pošiljatelja</span>
                        <p className="text-xs text-gray-400">Ime ki se prikaže pri email kot pošiljatelj</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {fromName || <span className="font-normal text-gray-400">Ni nastavljeno</span>}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <ChatText className="w-4 h-4 text-gray-400" weight="regular" />
                      <div>
                        <span className="text-sm font-medium text-gray-700">ID Pošiljatelja SMS</span>
                        <p className="text-xs text-gray-400">Uporablja se pri SMS pošiljanju</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{smsSenderId || <span className="font-normal text-gray-400">Ni nastavljeno</span>}</span>
                  </div>

                  <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <ChatText className="w-4 h-4 text-gray-400" weight="regular" />
                      <span className="text-sm font-medium text-gray-700">Nasveti glede na storitev</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {nastvetiStoritev === 'yes' ? 'Da' : nastvetiStoritev === 'no' ? 'Ne' : 'AI določi'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-gray-400" weight="regular" />
                      <span className="text-sm font-medium text-gray-700">Barve emaila</span>
                    </div>
                    <div className="flex gap-1.5">
                      {[emailPrimary, emailSecondary].filter(Boolean).map((color, i) => (
                        <div
                          key={i}
                          className="w-6 h-6 rounded-md border border-gray-200 shadow-inner"
                          style={{ backgroundColor: color.startsWith('#') ? color : `#${color}` }}
                        />
                      ))}
                      {!emailPrimary && !emailSecondary && (
                        <span className="text-sm text-gray-400">Ni nastavljeno</span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Opomniki pred terminom */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100"
              >
                <h2 className="text-base font-semibold text-[#1A1F36] mb-4">Opomniki pred terminom</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-gray-400" weight="regular" />
                      <span className="text-sm font-medium text-gray-700">Status</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${enabledBefore ? 'text-green-600' : 'text-red-500'}`}>
                        {enabledBefore ? 'Omogočeno' : 'Onemogočeno'}
                      </span>
                      <div className={`w-2.5 h-2.5 rounded-full ${enabledBefore ? 'bg-green-500' : 'bg-red-400'}`} />
                    </div>
                  </div>

                  {enabledBefore && (
                    <>
                      <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <EnvelopeSimple className="w-4 h-4 text-gray-400" weight="regular" />
                          <span className="text-sm font-medium text-gray-700">Način pošiljanja</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{getChannelLabel(beforeChannel)}</span>
                      </div>

                      {beforeChannel === 'sms' && (
                        <>
                          <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                              <ChatText className="w-4 h-4 text-gray-400" weight="regular" />
                              <span className="text-sm font-medium text-gray-700">Vrsta SMS sporočila</span>
                            </div>
                            <span className="text-sm font-semibold text-gray-900">{smsModePred === 'manual' ? 'Lastna predloga' : 'AI ustvari'}</span>
                          </div>
                          {smsModePred === 'ai' && (
                            <div className="py-2.5 border-b border-gray-100 space-y-1">
                              <div className="flex items-center gap-2 mb-1">
                                <ChatText className="w-4 h-4 text-gray-400" weight="regular" />
                                <span className="text-sm font-medium text-gray-700">AI upošteva</span>
                              </div>
                              <div className="pl-6 space-y-1">
                                {smsStoritevPred && <p className="text-xs text-gray-600">• Vključi storitev</p>}
                                {smsNavodilaPred && beforeInstructions && (
                                  <>
                                    <p className="text-xs text-gray-600">• Navodila</p>
                                    <p className="text-xs text-gray-500 pl-3 whitespace-pre-wrap text-left">{beforeInstructions}</p>
                                  </>
                                )}
                                {!smsStoritevPred && !smsNavodilaPred && <p className="text-xs text-gray-400">Ni posebnih navodil</p>}
                              </div>
                            </div>
                          )}
                          {smsModePred === 'manual' && smsTemplatePred && (
                            <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-100">
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <ChatText className="w-4 h-4 text-gray-400" weight="regular" />
                                <span className="text-sm font-medium text-gray-700">Lastna predloga</span>
                              </div>
                              <p className="text-sm text-gray-600 whitespace-pre-wrap text-left max-w-xs">{smsTemplatePred}</p>
                            </div>
                          )}
                        </>
                      )}

                      <div className={`flex items-center justify-between py-2.5 ${beforeInstructions ? 'border-b border-gray-100' : ''}`}>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" weight="regular" />
                          <span className="text-sm font-medium text-gray-700">Čas pošiljanja</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">1 dan pred terminom</span>
                      </div>

                      {beforeInstructions && (
                        <div className="flex items-start justify-between gap-4 py-2.5">
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <ChatText className="w-4 h-4 text-gray-400" weight="regular" />
                            <span className="text-sm font-medium text-gray-700">Navodila</span>
                          </div>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap text-left max-w-xs">{beforeInstructions}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </motion.div>

              {/* Opomniki po terminu */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100"
              >
                <h2 className="text-base font-semibold text-[#1A1F36] mb-4">Opomniki po terminu</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-gray-400" weight="regular" />
                      <span className="text-sm font-medium text-gray-700">Status</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${enabledAfter ? 'text-green-600' : 'text-red-500'}`}>
                        {enabledAfter ? 'Omogočeno' : 'Onemogočeno'}
                      </span>
                      <div className={`w-2.5 h-2.5 rounded-full ${enabledAfter ? 'bg-green-500' : 'bg-red-400'}`} />
                    </div>
                  </div>

                  {enabledAfter && (
                    <>
                      <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <EnvelopeSimple className="w-4 h-4 text-gray-400" weight="regular" />
                          <span className="text-sm font-medium text-gray-700">Način pošiljanja</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{getChannelLabel(afterChannel)}</span>
                      </div>

                      {afterChannel === 'sms' && (
                        <>
                          <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                              <ChatText className="w-4 h-4 text-gray-400" weight="regular" />
                              <span className="text-sm font-medium text-gray-700">Vrsta SMS sporočila</span>
                            </div>
                            <span className="text-sm font-semibold text-gray-900">{smsModePo === 'manual' ? 'Lastna predloga' : 'AI ustvari'}</span>
                          </div>
                          {smsModePo === 'ai' && (
                            <div className="py-2.5 border-b border-gray-100 space-y-1">
                              <div className="flex items-center gap-2 mb-1">
                                <ChatText className="w-4 h-4 text-gray-400" weight="regular" />
                                <span className="text-sm font-medium text-gray-700">AI upošteva</span>
                              </div>
                              <div className="pl-6 space-y-1">
                                {smsStoritevPo && <p className="text-xs text-gray-600">• Vključi storitev</p>}
                                {smsNavodilaPo && afterInstructions && (
                                  <>
                                    <p className="text-xs text-gray-600">• Navodila</p>
                                    <p className="text-xs text-gray-500 pl-3 whitespace-pre-wrap text-left">{afterInstructions}</p>
                                  </>
                                )}
                                {!smsStoritevPo && !smsNavodilaPo && <p className="text-xs text-gray-400">Ni posebnih navodil</p>}
                              </div>
                            </div>
                          )}
                          {smsModePo === 'manual' && smsTemplatePo && (
                            <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-100">
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <ChatText className="w-4 h-4 text-gray-400" weight="regular" />
                                <span className="text-sm font-medium text-gray-700">Lastna predloga</span>
                              </div>
                              <p className="text-sm text-gray-600 whitespace-pre-wrap text-left max-w-xs">{smsTemplatePo}</p>
                            </div>
                          )}
                        </>
                      )}

                      <div className={`flex items-center justify-between py-2.5 ${(afterHasDiscount && afterDiscountText) || afterInstructions ? 'border-b border-gray-100' : ''}`}>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" weight="regular" />
                          <span className="text-sm font-medium text-gray-700">Čas pošiljanja</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">Takoj po zaključku</span>
                      </div>

                      {afterHasDiscount && afterDiscountText && (
                        <div className={`flex items-center justify-between py-2.5 ${afterInstructions ? 'border-b border-gray-100' : ''}`}>
                          <div className="flex items-center gap-2">
                            <ChatText className="w-4 h-4 text-gray-400" weight="regular" />
                            <span className="text-sm font-medium text-gray-700">Popust</span>
                          </div>
                          <span className="text-sm font-semibold text-gray-900">{afterDiscountText}</span>
                        </div>
                      )}

                      {afterInstructions && (
                        <div className="flex items-start justify-between gap-4 py-2.5">
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <ChatText className="w-4 h-4 text-gray-400" weight="regular" />
                            <span className="text-sm font-medium text-gray-700">Navodila</span>
                          </div>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap text-left max-w-xs">{afterInstructions}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
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
                  Opomniki se pošiljajo avtomatsko na podlagi tukaj prikazanih nastavitev — brez ročnega dela. Vsaka stranka prejme sporočilo pred in/ali po terminu, odvisno od vaše konfiguracije.

Ko je aktiviran AI, sporočila niso nikoli enaka — AI si zapomni kontekst stranke, omeni pravo storitev in prilagodi vsebino, da zveni naravno in osebno. To pomeni večjo odprtost, bolj zapomnjena sporočila in stranke, ki se počutijo cenjene.

Za lažje upravljanje je na voljo tudi možnost lastne predloge sporočila, kadar želite popoln nadzor nad vsebino.

V kolikor imate kakršnakoli vprašanja, nas kontaktirajte na help@jedroplus.com.
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
