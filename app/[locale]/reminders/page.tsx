'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Bell,
  Gear,
  CheckCircle,
  Clock,
  EnvelopeSimple,
  Palette,
  ChatText,
  Warning,
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { useRolePermissions } from '@/app/role-permission-context';
import { loadCompanyRow } from '@/lib/settingsStore';
import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';
import { ReminderSettingsModal } from '@/components/reminders/ReminderSettingsModal';
import { SendingStatus } from '@/components/reminders/SendingStatus';
import { SmsLog } from '@/components/reminders/SmsLog';
import { MessagePreview } from '@/components/reminders/MessagePreview';
import {
  StatusPill,
  ValuePill,
  SettingRow,
  SectionPanel,
  DetailBlock,
  PlainMeta,
  FlowStep,
  ColorSwatches,
} from '@/components/ui/OverviewPrimitives';
import { TestSendButton } from '@/components/reminders/TestSendButton';
import { useBillingUsage } from '@/hooks/useBillingUsage';
import { GradientSpinner } from '@/components/ui/GradientSpinner';
import { useTranslations } from 'next-intl';
import { useMarkVisited } from '@/hooks/useMarkVisited';

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
  useMarkVisited('reminders');
  const t = useTranslations('reminders');
  const { companyId, companyUuid, companySettings } = useCompany();
  const previewCompanyName = (() => {
    const row = (companySettings ?? {}) as Record<string, unknown>;
    const name = row['Naziv Podjetja'] ?? row['Ime podjetja'] ?? row['ime_podjetja'] ?? row['Naziv'] ?? row['naziv'] ?? row['name'];
    return typeof name === 'string' ? name : undefined;
  })();
  const { role, permissions } = useRolePermissions();
  const canManageSettings = role !== 'staff' || (permissions?.can_manage_opomniki ?? true);
  const [companyRow, setCompanyRow] = useState<Record<string, unknown> | null>(
    companySettings ?? null
  );
  const [reminderRow, setReminderRow] = useState<ReminderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const { usage: billingUsage } = useBillingUsage();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [modalSection, setModalSection] = useState<'general' | 'before' | 'after' | 'reschedule'>('general');
  const openSettings = (section: 'general' | 'before' | 'after' | 'reschedule' = 'general') => {
    setModalSection(section);
    setShowSettingsModal(true);
  };

  // Settings values (read-only display)
  const [sendingLanguage, setSendingLanguage] = useState('sl');
  const [replyToEmail, setReplyToEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [tone, setTone] = useState('prijazen');
  const [nagovor, setNagovor] = useState<'vikanje' | 'tikanje'>('vikanje');
  const [samodejniOpomnik, setSamodejniOpomnik] = useState(false);
  const [smsOsebaPred, setSmsOsebaPred] = useState(false);
  const [dniPrej, setDniPrej] = useState(1);
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
  const [rescheduleEnabled, setRescheduleEnabled] = useState(false);
  const [rescheduleChannel, setRescheduleChannel] = useState('email');
  const [rescheduleTemplateSms, setRescheduleTemplateSms] = useState('');
  const [rescheduleTemplateEmail, setRescheduleTemplateEmail] = useState('');

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

    const nagovorVal = String(source['nagovor'] ?? 'vikanje').toLowerCase().trim();
    setNagovor(nagovorVal === 'tikanje' ? 'tikanje' : 'vikanje');
    setSamodejniOpomnik(isEnabledValue(source['samodejni_opomnik'], false));
    setSmsOsebaPred(isEnabledValue(source['sms_oseba_pred'], false));
    const dniPrejNum = Number(source['dni_prej'] ?? 1);
    setDniPrej(dniPrejNum >= 1 && dniPrejNum <= 7 ? dniPrejNum : 1);

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
    setRescheduleEnabled(parseBool(source['obvestilo_prestavitev_omogoceno']));
    const prestavitevChannel = String(source['obvestilo_prestavitev_channel'] ?? 'email').toLowerCase();
    setRescheduleChannel(prestavitevChannel === 'sms' ? 'sms' : 'email');
    setRescheduleTemplateSms(String(source['obvestilo_prestavitev_template_sms'] ?? ''));
    setRescheduleTemplateEmail(String(source['obvestilo_prestavitev_template_email'] ?? ''));
  }, [reminderRow, companyRow]);

  const getToneLabel = (toneValue: string) => {
    const map: Record<string, string> = {
      'profesionalen': t('tone.professional'),
      'prijazen': t('tone.friendly'),
      'prodajno_usmerjen': t('tone.salesOriented'),
      'formal': t('tone.formal'),
      'sproscen': t('tone.relaxed'),
    };
    return map[toneValue] ?? toneValue;
  };

  const getLanguageLabel = (lang: string) => {
    const map: Record<string, string> = {
      'sl': t('language.sl'),
      'en': t('language.en'),
      'it': t('language.it'),
      'de': t('language.de'),
    };
    return map[lang] ?? lang;
  };

  const getChannelLabel = (channel: string) => {
    return channel === 'sms' ? 'SMS' : 'Email';
  };

  if (!companyId) return null;

  const hasIncompleteSettings = !loading && (!fromName.trim() || !replyToEmail.trim());
  const beforeTimeValue = dniPrej === 1
    ? t('page.before.dayBefore')
    : t('page.before.daysBefore', { count: dniPrej });
  const beforeModeLabel = smsModePred === 'manual' ? t('page.before.manualMode') : t('page.before.aiMode');
  const afterModeLabel = smsModePo === 'manual' ? t('page.after.manualMode') : t('page.after.aiMode');
  const tipsLabel =
    nastvetiStoritev === 'yes'
      ? t('modal.general.tipsYes')
      : nastvetiStoritev === 'no'
      ? t('modal.general.tipsNo')
      : t('modal.general.tipsAuto');
  const beforeConsiderations = [
    smsStoritevPred ? t('page.before.includeService') : null,
    smsNavodilaPred ? t('page.before.instructions') : null,
  ].filter((item): item is string => Boolean(item));
  const afterConsiderations = [
    smsStoritevPo ? t('page.after.includeService') : null,
    smsNavodilaPo ? t('page.after.instructions') : null,
  ].filter((item): item is string => Boolean(item));
  const channelsInUse = (['sms', 'email'] as const).filter((channel) =>
    (enabledBefore && beforeChannel === channel) ||
    (enabledAfter && afterChannel === channel) ||
    (rescheduleEnabled && rescheduleChannel === channel)
  );
  const rescheduleTemplate = rescheduleChannel === 'sms' ? rescheduleTemplateSms : rescheduleTemplateEmail;
  const renderTextValue = (value: string) =>
    value.trim() ? (
      <span className="break-words">{value}</span>
    ) : (
      <span className="text-gray-400">{t('page.general.notSet')}</span>
    );

  return (
    <ProtectedLayout>
      <main className="min-h-screen bg-white">
        {/* En sam stolpec, kot v Applovih Nastavitvah — vsebina ostane
            berljivo široka, namesto da se stiska v ozek stranski stolpec. */}
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="mb-7 flex flex-wrap items-start justify-between gap-4"
          >
            <div className="max-w-2xl">
              <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">{t('page.title')}</h1>
              <p className="mt-0.5 text-base text-gray-500">{t('page.subtitle')}</p>
            </div>

            {canManageSettings && (
              <button
                type="button"
                onClick={() => openSettings()}
                className="relative inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100"
              >
                <Gear size={17} weight="regular" className="text-gray-500" />
                {t('page.settingsButton')}
                {hasIncompleteSettings && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-amber-500 text-[9px] font-bold leading-none text-white">
                    !
                  </span>
                )}
              </button>
            )}
          </motion.div>

          {!loading && billingUsage && (
            <>
              <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-gray-500">
                {t('page.sendingStatus.title')}
              </h2>
              <SendingStatus
              channels={[...channelsInUse]}
              sms={billingUsage.sms}
              email={billingUsage.email}
              periodEnd={billingUsage.periodEnd}
              canBuy={canManageSettings && !billingUsage.isFree}
                isFree={billingUsage.isFree}
              />
            </>
          )}

          {hasIncompleteSettings && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4"
            >
              <Warning size={18} weight="regular" className="flex-shrink-0 text-amber-600" />
              <p className="min-w-0 flex-1 text-sm leading-6 text-amber-900">
                <span className="font-semibold">{t('page.incompleteBannerTitle')}</span>{' '}
                {t('page.incompleteBannerDesc')}
              </p>
              {canManageSettings ? (
                <button
                  onClick={() => openSettings()}
                  className="text-xs font-semibold text-amber-900 underline underline-offset-4 transition hover:text-amber-700"
                >
                  {t('page.openSettings')}
                </button>
              ) : null}
            </motion.div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <GradientSpinner />
            </div>
          ) : (
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                className="min-w-0"
              >
                <SectionPanel title={t('page.flow.title')}>
                  <div>
                    <FlowStep
                      icon={<Bell size={20} weight="regular" />}
                      eyebrow={t('page.flow.beforeEyebrow')}
                      title={t('page.before.sectionTitle')}
                      editLabel={t('page.flow.edit')}
                      onEdit={canManageSettings ? () => openSettings('before') : undefined}
                      enabled={enabledBefore}
                      statusLabel={enabledBefore ? t('status.enabled') : t('status.disabled')}
                    >
                      {enabledBefore ? (
                        <>
                          <div className="space-y-1.5">
                            <PlainMeta label={t('page.before.channel')}>
                              {getChannelLabel(beforeChannel)}
                            </PlainMeta>
                            <PlainMeta label={t('page.before.timeLabel')}>
                              {beforeTimeValue}
                            </PlainMeta>
                            {beforeChannel === 'sms' ? (
                              <PlainMeta label={t('page.before.smsType')}>
                                {beforeModeLabel}
                              </PlainMeta>
                            ) : null}
                          </div>

                          {beforeChannel === 'sms' && smsModePred === 'ai' ? (
                            <DetailBlock label={t('page.flow.considers')}>
                              {beforeConsiderations.length > 0 ? (
                                <div className="space-y-1">
                                  {beforeConsiderations.map((item) => (
                                    <p key={item} className="text-sm text-gray-900">{item}</p>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400">{t('page.before.noSpecialInstructions')}</span>
                              )}
                            </DetailBlock>
                          ) : null}

                          {beforeChannel === 'sms' && smsModePred === 'manual' ? (
                            <DetailBlock label={t('page.before.manualMode')}>
                              {smsTemplatePred.trim() ? (
                                <>
                                  <MessagePreview template={smsTemplatePred} companyName={previewCompanyName} />
                                  <TestSendButton channel="sms" template={smsTemplatePred} />
                                </>
                              ) : (
                                renderTextValue(smsTemplatePred)
                              )}
                            </DetailBlock>
                          ) : null}

                          {beforeInstructions ? (
                            <DetailBlock label={t('page.before.instructions')}>
                              <p className="whitespace-pre-wrap break-words">{beforeInstructions}</p>
                            </DetailBlock>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">{t('page.flow.disabledReminder')}</p>
                      )}
                    </FlowStep>

                    <FlowStep
                      icon={<CheckCircle size={20} weight="regular" />}
                      eyebrow={t('page.flow.afterEyebrow')}
                      title={t('page.after.sectionTitle')}
                      editLabel={t('page.flow.edit')}
                      onEdit={canManageSettings ? () => openSettings('after') : undefined}
                      enabled={enabledAfter}
                      statusLabel={enabledAfter ? t('status.enabled') : t('status.disabled')}
                    >
                      {enabledAfter ? (
                        <>
                          <div className="space-y-1.5">
                            <PlainMeta label={t('page.after.channel')}>
                              {getChannelLabel(afterChannel)}
                            </PlainMeta>
                            <PlainMeta label={t('page.after.timeLabel')}>
                              {t('page.after.timeValue')}
                            </PlainMeta>
                            {afterChannel === 'sms' ? (
                              <PlainMeta label={t('page.after.smsType')}>
                                {afterModeLabel}
                              </PlainMeta>
                            ) : null}
                          </div>

                          {afterChannel === 'sms' && smsModePo === 'ai' ? (
                            <DetailBlock label={t('page.flow.considers')}>
                              {afterConsiderations.length > 0 ? (
                                <div className="space-y-1">
                                  {afterConsiderations.map((item) => (
                                    <p key={item} className="text-sm text-gray-900">{item}</p>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400">{t('page.after.noSpecialInstructions')}</span>
                              )}
                            </DetailBlock>
                          ) : null}

                          {afterChannel === 'sms' && smsModePo === 'manual' ? (
                            <DetailBlock label={t('page.after.manualMode')}>
                              {smsTemplatePo.trim() ? (
                                <>
                                  <MessagePreview template={smsTemplatePo} companyName={previewCompanyName} />
                                  <TestSendButton channel="sms" template={smsTemplatePo} />
                                </>
                              ) : (
                                renderTextValue(smsTemplatePo)
                              )}
                            </DetailBlock>
                          ) : null}

                          {afterHasDiscount && afterDiscountText ? (
                            <DetailBlock label={t('page.after.discount')}>
                              <p className="whitespace-pre-wrap break-words">{afterDiscountText}</p>
                            </DetailBlock>
                          ) : null}

                          {afterInstructions ? (
                            <DetailBlock label={t('page.after.instructions')}>
                              <p className="whitespace-pre-wrap break-words">{afterInstructions}</p>
                            </DetailBlock>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">{t('page.flow.disabledReminder')}</p>
                      )}
                    </FlowStep>

                    <FlowStep
                      icon={<Clock size={20} weight="regular" />}
                      eyebrow={t('page.flow.rescheduleEyebrow')}
                      title={t('page.reschedule.sectionTitle')}
                      editLabel={t('page.flow.edit')}
                      onEdit={canManageSettings ? () => openSettings('reschedule') : undefined}
                      enabled={rescheduleEnabled}
                      statusLabel={rescheduleEnabled ? t('status.enabled') : t('status.disabled')}
                    >
                      {rescheduleEnabled ? (
                        <>
                          <div className="space-y-1.5">
                            <PlainMeta label={t('page.reschedule.channel')}>
                              {getChannelLabel(rescheduleChannel)}
                            </PlainMeta>
                          </div>
                          <DetailBlock
                            label={
                              rescheduleChannel === 'sms'
                                ? t('page.reschedule.smsTemplate')
                                : t('page.reschedule.emailTemplate')
                            }
                          >
                            {rescheduleTemplate.trim() ? (
                              <>
                                <MessagePreview
                                  template={rescheduleTemplate}
                                  companyName={previewCompanyName}
                                  sms={rescheduleChannel === 'sms'}
                                />
                                <TestSendButton
                                  channel={rescheduleChannel === 'sms' ? 'sms' : 'email'}
                                  template={rescheduleTemplate}
                                />
                              </>
                            ) : (
                              <span className="text-gray-400">{t('page.general.notSetTemplate')}</span>
                            )}
                          </DetailBlock>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">{t('page.flow.disabledReschedule')}</p>
                      )}
                    </FlowStep>
                  </div>
                </SectionPanel>


                {canManageSettings && (
                  <div className="mt-6">
                    <SmsLog />
                  </div>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.04, ease: [0.32, 0.72, 0, 1] }}
                className="space-y-6"
              >
                {/* Nastavitve so razbite v štiri pomenske skupine namesto enega
                    dolgega seznama — tako je na prvi pogled jasno, kaj kam sodi. */}
                <SectionPanel title={t('page.general.groupVoice')}>
                  <SettingRow
                    icon={<ChatText size={16} weight="regular" />}
                    label={t('page.general.language')}
                    description={t('page.general.languageDesc')}
                    value={<ValuePill>{getLanguageLabel(sendingLanguage)}</ValuePill>}
                  />
                  <SettingRow
                    icon={<ChatText size={16} weight="regular" />}
                    label={t('page.general.tone')}
                    description={t('page.general.toneDesc')}
                    value={<ValuePill>{getToneLabel(tone)}</ValuePill>}
                  />
                  <SettingRow
                    icon={<ChatText size={16} weight="regular" />}
                    label={t('page.general.customerAddressing')}
                    description={t('page.general.customerAddressingDesc')}
                    value={
                      <ValuePill>
                        {nagovor === 'tikanje'
                          ? t('page.general.informalAddressing')
                          : t('page.general.formalAddressing')}
                      </ValuePill>
                    }
                  />
                </SectionPanel>

                <SectionPanel title={t('page.general.groupSender')}>
                  <SettingRow
                    icon={<EnvelopeSimple size={16} weight="regular" />}
                    label={t('page.general.replyTo')}
                    description={t('page.general.replyToDesc')}
                    value={renderTextValue(replyToEmail)}
                  />
                  <SettingRow
                    icon={<EnvelopeSimple size={16} weight="regular" />}
                    label={t('page.general.fromName')}
                    description={t('page.general.fromNameDesc')}
                    value={renderTextValue(fromName)}
                  />
                  <SettingRow
                    icon={<ChatText size={16} weight="regular" />}
                    label={t('page.general.senderId')}
                    description={t('page.general.senderIdDesc')}
                    value={renderTextValue(smsSenderId)}
                  />
                </SectionPanel>

                <SectionPanel title={t('page.general.groupContent')}>
                  <SettingRow
                    icon={<Bell size={16} weight="regular" />}
                    label={t('page.general.automaticTag')}
                    description={t('page.general.automaticTagDesc')}
                    value={
                      <StatusPill
                        enabled={samodejniOpomnik}
                        label={samodejniOpomnik ? t('status.enabled') : t('status.disabled')}
                      />
                    }
                  />
                  <SettingRow
                    icon={<CheckCircle size={16} weight="regular" />}
                    label={t('page.general.staffInReminder')}
                    description={t('page.general.staffInReminderDesc')}
                    value={
                      <StatusPill
                        enabled={smsOsebaPred}
                        label={smsOsebaPred ? t('status.enabled') : t('status.disabled')}
                      />
                    }
                  />
                  <SettingRow
                    icon={<ChatText size={16} weight="regular" />}
                    label={t('page.general.tips')}
                    description={t('page.general.tipsDesc')}
                    value={<ValuePill>{tipsLabel}</ValuePill>}
                  />
                </SectionPanel>

                <SectionPanel title={t('page.general.groupEmail')}>
                  <SettingRow
                    icon={<Palette size={16} weight="regular" />}
                    label={t('page.general.colors')}
                    description={t('page.general.colorsDesc')}
                    value={
                      <ColorSwatches
                        colors={[emailPrimary, emailSecondary]}
                        emptyLabel={t('page.general.notSet')}
                      />
                    }
                  />
                </SectionPanel>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.08, ease: [0.32, 0.72, 0, 1] }}
              >
                <SectionPanel title={t('page.info.title')}>
                  <div className="p-4">
                    <p className="whitespace-pre-wrap text-sm leading-7 text-gray-600">
                      {t.rich('page.info.body', {
                        highlight: (chunks) => (
                          <span className="font-semibold text-gray-900">{chunks}</span>
                        ),
                      })}
                    </p>
                  </div>
                </SectionPanel>
              </motion.div>
            </div>
          )}
        </div>
      </main>

      <ReminderSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        initialSection={modalSection}
      />
    </ProtectedLayout>
  );
}
