'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
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
import { GradientSpinner } from '@/components/ui/GradientSpinner';
import { useTranslations } from 'next-intl';

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

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

function StatusPill({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium',
        enabled
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-rose-200 bg-rose-50 text-rose-700'
      )}
    >
      <span
        className={cx(
          'h-1.5 w-1.5 rounded-full',
          enabled ? 'bg-emerald-500' : 'bg-rose-500'
        )}
      />
      {label}
    </span>
  );
}

function ValuePill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'blue' | 'green' | 'amber';
}) {
  const variants = {
    neutral: 'border-zinc-200 bg-white text-zinc-700',
    blue: 'border-sky-200 bg-sky-50 text-sky-800',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
  };

  return (
    <span
      className={cx(
        'inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-left text-xs font-medium leading-5',
        variants[tone]
      )}
    >
      {children}
    </span>
  );
}

function SettingRow({
  icon,
  label,
  description,
  value,
}: {
  icon: ReactNode;
  label: string;
  description?: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="grid gap-3 border-b border-zinc-100 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(160px,auto)] sm:items-start">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-900">{label}</p>
          {description ? (
            <div className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</div>
          ) : null}
        </div>
      </div>
      <div className="min-w-0 text-left text-sm text-zinc-900 sm:text-right">{value}</div>
    </div>
  );
}

function SectionPanel({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        'rounded-lg border border-zinc-200 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.04)]',
        className
      )}
    >
      {eyebrow ? (
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
      {children}
    </section>
  );
}

function DetailBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-l-2 border-zinc-200 pl-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{label}</p>
      <div className="mt-1 text-sm leading-relaxed text-zinc-900">{children}</div>
    </div>
  );
}

function PlainMeta({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <p className="text-sm leading-6 text-zinc-950">
      <span className="font-medium">{label}:</span> {children}
    </p>
  );
}

function FlowStep({
  icon,
  eyebrow,
  title,
  enabled,
  statusLabel,
  children,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  enabled: boolean;
  statusLabel: string;
  children: ReactNode;
}) {
  return (
    <article className="grid gap-4 border-b border-zinc-100 py-6 first:pt-0 last:border-b-0 last:pb-0 sm:grid-cols-[42px_minmax(0,1fr)]">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-800">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
              {eyebrow}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-zinc-950">{title}</h3>
          </div>
          <StatusPill enabled={enabled} label={statusLabel} />
        </div>
        <div className="mt-4 space-y-4">{children}</div>
      </div>
    </article>
  );
}

function ColorSwatches({ colors, emptyLabel }: { colors: string[]; emptyLabel: string }) {
  const normalizedColors = colors
    .map((color) => color.trim())
    .filter(Boolean)
    .map((color) => (color.startsWith('#') ? color : `#${color}`));

  if (normalizedColors.length === 0) {
    return <span className="text-zinc-400">{emptyLabel}</span>;
  }

  return (
    <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
      {normalizedColors.map((color, index) => (
        <span
          key={`${color}-${index}`}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700"
        >
          <span
            className="h-4 w-4 rounded-full border border-black/10 shadow-inner"
            style={{ backgroundColor: color }}
          />
          {color.toUpperCase()}
        </span>
      ))}
    </div>
  );
}

export default function RemindersPage() {
  const t = useTranslations('reminders');
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
  const rescheduleTemplate = rescheduleChannel === 'sms' ? rescheduleTemplateSms : rescheduleTemplateEmail;
  const renderTextValue = (value: string) =>
    value.trim() ? (
      <span className="break-words">{value}</span>
    ) : (
      <span className="text-zinc-400">{t('page.general.notSet')}</span>
    );

  return (
    <ProtectedLayout>
      <main className="min-h-screen bg-[#F5F6F8]">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-7 flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-6"
          >
            <div className="max-w-2xl">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {t('page.kicker')}
              </p>
              <h1 className="text-2xl font-normal text-[#1A1F36]">{t('page.title')}</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{t('page.subtitle')}</p>
            </div>

            {canManageSettings && (
              <motion.button
                onClick={() => setShowSettingsModal(true)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-950 shadow-sm transition hover:border-zinc-900"
                title={t('page.settingsButton')}
              >
                <Gear size={20} weight="bold" />
                {hasIncompleteSettings && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-amber-500 text-[9px] font-bold leading-none text-white">
                    !
                  </span>
                )}
              </motion.button>
            )}
          </motion.div>

          {hasIncompleteSettings && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
            >
              <Warning size={18} weight="fill" className="flex-shrink-0 text-amber-600" />
              <p className="min-w-0 flex-1 text-sm leading-6 text-amber-900">
                <span className="font-semibold">{t('page.incompleteBannerTitle')}</span>{' '}
                {t('page.incompleteBannerDesc')}
              </p>
              {canManageSettings ? (
                <button
                  onClick={() => setShowSettingsModal(true)}
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
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="min-w-0"
              >
                <SectionPanel eyebrow={t('page.flow.eyebrow')} title={t('page.flow.title')}>
                  <div className="mt-6">
                    <FlowStep
                      icon={<Bell size={20} weight="bold" />}
                      eyebrow={t('page.flow.beforeEyebrow')}
                      title={t('page.before.sectionTitle')}
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
                                    <p key={item} className="text-sm text-zinc-950">{item}</p>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-zinc-400">{t('page.before.noSpecialInstructions')}</span>
                              )}
                            </DetailBlock>
                          ) : null}

                          {beforeChannel === 'sms' && smsModePred === 'manual' ? (
                            <DetailBlock label={t('page.before.manualMode')}>
                              {renderTextValue(smsTemplatePred)}
                            </DetailBlock>
                          ) : null}

                          {beforeInstructions ? (
                            <DetailBlock label={t('page.before.instructions')}>
                              <p className="whitespace-pre-wrap break-words">{beforeInstructions}</p>
                            </DetailBlock>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-sm text-zinc-500">{t('page.flow.disabledReminder')}</p>
                      )}
                    </FlowStep>

                    <FlowStep
                      icon={<CheckCircle size={20} weight="bold" />}
                      eyebrow={t('page.flow.afterEyebrow')}
                      title={t('page.after.sectionTitle')}
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
                                    <p key={item} className="text-sm text-zinc-950">{item}</p>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-zinc-400">{t('page.after.noSpecialInstructions')}</span>
                              )}
                            </DetailBlock>
                          ) : null}

                          {afterChannel === 'sms' && smsModePo === 'manual' ? (
                            <DetailBlock label={t('page.after.manualMode')}>
                              {renderTextValue(smsTemplatePo)}
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
                        <p className="text-sm text-zinc-500">{t('page.flow.disabledReminder')}</p>
                      )}
                    </FlowStep>

                    <FlowStep
                      icon={<Clock size={20} weight="bold" />}
                      eyebrow={t('page.flow.rescheduleEyebrow')}
                      title={t('page.reschedule.sectionTitle')}
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
                            {renderTextValue(rescheduleTemplate)}
                          </DetailBlock>
                        </>
                      ) : (
                        <p className="text-sm text-zinc-500">{t('page.flow.disabledReschedule')}</p>
                      )}
                    </FlowStep>
                  </div>
                </SectionPanel>

                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mt-6"
                >
                  <SectionPanel eyebrow={t('page.flow.detailsEyebrow')} title={t('page.info.title')}>
                    <div className="mt-5 border-t border-zinc-100 pt-5">
                      <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-600">
                        {t.rich('page.info.body', {
                          highlight: (chunks) => (
                            <span className="bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text font-semibold text-transparent">
                              {chunks}
                            </span>
                          ),
                        })}
                      </p>
                    </div>
                  </SectionPanel>
                </motion.div>
              </motion.div>

              <motion.aside
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
                className="min-w-0"
              >
                <SectionPanel
                  eyebrow={t('page.flow.settingsEyebrow')}
                  title={t('page.general.sectionTitle')}
                  className="lg:sticky lg:top-6"
                >
                  <div className="mt-5">
                    <SettingRow
                      icon={<ChatText size={16} weight="bold" />}
                      label={t('page.general.language')}
                      value={<ValuePill>{getLanguageLabel(sendingLanguage)}</ValuePill>}
                    />
                    <SettingRow
                      icon={<ChatText size={16} weight="bold" />}
                      label={t('page.general.tone')}
                      value={<ValuePill>{getToneLabel(tone)}</ValuePill>}
                    />
                    <SettingRow
                      icon={<ChatText size={16} weight="bold" />}
                      label={t('page.general.customerAddressing')}
                      value={
                        <ValuePill>
                          {nagovor === 'tikanje'
                            ? t('page.general.informalAddressing')
                            : t('page.general.formalAddressing')}
                        </ValuePill>
                      }
                    />
                    <SettingRow
                      icon={<Bell size={16} weight="bold" />}
                      label={t('page.general.automaticTag')}
                      value={
                        <StatusPill
                          enabled={samodejniOpomnik}
                          label={samodejniOpomnik ? t('status.enabled') : t('status.disabled')}
                        />
                      }
                    />
                    <SettingRow
                      icon={<CheckCircle size={16} weight="bold" />}
                      label={t('page.general.staffInReminder')}
                      value={
                        <StatusPill
                          enabled={smsOsebaPred}
                          label={smsOsebaPred ? t('status.enabled') : t('status.disabled')}
                        />
                      }
                    />
                    <SettingRow
                      icon={<EnvelopeSimple size={16} weight="bold" />}
                      label={t('page.general.replyTo')}
                      value={renderTextValue(replyToEmail)}
                    />
                    <SettingRow
                      icon={<EnvelopeSimple size={16} weight="bold" />}
                      label={t('page.general.fromName')}
                      description={t('page.general.fromNameDesc')}
                      value={renderTextValue(fromName)}
                    />
                    <SettingRow
                      icon={<ChatText size={16} weight="bold" />}
                      label={t('page.general.senderId')}
                      description={t('page.general.senderIdDesc')}
                      value={renderTextValue(smsSenderId)}
                    />
                    <SettingRow
                      icon={<ChatText size={16} weight="bold" />}
                      label={t('page.general.tips')}
                      value={<ValuePill>{tipsLabel}</ValuePill>}
                    />
                    <SettingRow
                      icon={<Palette size={16} weight="bold" />}
                      label={t('page.general.colors')}
                      value={
                        <ColorSwatches
                          colors={[emailPrimary, emailSecondary]}
                          emptyLabel={t('page.general.notSet')}
                        />
                      }
                    />
                  </div>
                </SectionPanel>
              </motion.aside>
            </div>
          )}
        </div>
      </main>

      <ReminderSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </ProtectedLayout>
  );
}
