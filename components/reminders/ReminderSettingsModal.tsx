'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, SpinnerGap, FloppyDisk, Lock, EnvelopeSimple, DeviceMobile, ArrowRight } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import {
  SettingsSection,
  SettingRow,
  Switch,
  SegmentedControl,
  Input,
  Textarea,
  SaveIndicator,
} from '@/components/settings';
import { Select, SelectOption } from '@/components/ui/animated-select';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { loadCompanyRow } from '@/lib/settingsStore';
import { callN8nAction } from '@/src/lib/n8nClient';
import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';
import { TemplateEditor, migrateTemplate } from '@/components/reminders/TemplateEditor';
import { useTranslations } from 'next-intl';

const SENDING_LANGUAGES = [
  { value: 'sl', label: 'Slovenščina' },
  { value: 'en', label: 'English' },
  { value: 'it', label: 'Italiano' },
  { value: 'de', label: 'Deutsch' },
];

interface ReminderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReminderSettingsModal({ isOpen, onClose }: ReminderSettingsModalProps) {
  const t = useTranslations('reminders');
  const { companyId, companyUuid, planCode } = useCompany();
  const { user } = useAuth();
  const router = useRouter();
  const smsLockedForPlan = planCode === 'JEDRO_PLUS';

  // Settings from "Podatki podjetij" table
  const [sendingLanguage, setSendingLanguage] = useState('sl');
  const [tonKomunikacije, setTonKomunikacije] = useState('prijazen');
  const [nagovor, setNagovor] = useState<'vikanje' | 'tikanje'>('vikanje');
  const [samodejniOpomnik, setSamodejniOpomnik] = useState(false);
  const [smsOsebaPred, setSmsOsebaPred] = useState(false);
  const [dniPrej, setDniPrej] = useState('1');
  const [replyTo, setReplyTo] = useState('');
  const [fromName, setFromName] = useState('');
  const fromEmail = 'booking@jedroplus.com'; // FIXED
  const [chanelPred, setChanelPred] = useState('email');
  const [chanelPo, setChanelPo] = useState('email');
  const [posiljanjePred, setPosiljanjePred] = useState(false);
  const [nastavitvePred, setNastavitvePred] = useState('');
  const [posiljanjePo, setPosiljanjePo] = useState(false);
  const [nastavitvePo, setNastavitvePo] = useState('');
  const [showDiscountField, setShowDiscountField] = useState(false);
  const [popustPo, setPopustPo] = useState('');

  // SMS config - before appointment
  const [smsModePred, setSmsModePred] = useState<'ai' | 'manual'>('ai');
  const [smsIncludeServicePred, setSmsIncludeServicePred] = useState(true);
  const [smsIncludeNotesPred, setSmsIncludeNotesPred] = useState(false);
  const [smsTipPred, setSmsTipPred] = useState(false);
  const [smsTemplatePred, setSmsTemplatePred] = useState('');

  // SMS config - after appointment
  const [smsModePo, setSmsModePo] = useState<'ai' | 'manual'>('ai');
  const [smsIncludeServicePo, setSmsIncludeServicePo] = useState(true);
  const [smsIncludeNotesPo, setSmsIncludeNotesPo] = useState(false);
  const [smsTipPo, setSmsTipPo] = useState(false);
  const [smsTemplatePo, setSmsTemplatePo] = useState('');

  // SMS sender ID (read-only from Supabase)
  const [smsSenderId, setSmsSenderId] = useState('');

  // Last custom templates from Supabase (read-only display, editable)
  const [lastnaPrelogaPred, setLastnaPrelogaPred] = useState('');
  const [lastnaPredlogaPo, setLastnaPredlogaPo] = useState('');

  // Company data for variable length estimation
  const [kompanyEmail, setKompanyEmail] = useState('');
  const [nazivPodjetja, setNazivPodjetja] = useState('');
  const [naslovPodjetja, setNaslovPodjetja] = useState('');
  const [apptManagementLink, setApptManagementLink] = useState('');

  // SMS Supabase column values for before/after
  const [smsStoritevPred, setSmsStoritevPred] = useState(false);
  const [smsOpombePred, setSmsOpombePred] = useState(false);
  const [smsNavodilaPred, setSmsNavodilaPred] = useState(false);
  const [smsStoritevPo, setSmsStoritevPo] = useState(false);
  const [smsOpombePo, setSmsOpombePo] = useState(false);
  const [smsNavodilaPo, setSmsNavodilaPo] = useState(false);

  // Nasveti glede na storitev: 'yes' | 'no' | 'auto'
  const [nastvetiStoritev, setNastvetiStoritev] = useState<'yes' | 'no' | 'auto'>('auto');

  // Reschedule notification
  const [obvestiloPrestavitevOmogoceno, setObvestiloPrestavitevOmogoceno] = useState(false);
  const [obvestiloPrestavitevChannel, setObvestiloPrestavitevChannel] = useState<'sms' | 'email'>('email');
  const [obvestiloPrestavitevTemplateSms, setObvestiloPrestavitevTemplateSms] = useState('');
  const [obvestiloPrestavitevTemplateEmail, setObvestiloPrestavitevTemplateEmail] = useState('');

  // Brand colors for email templates
  const [brandPrimaryColor, setBrandPrimaryColor] = useState('#7C75FC');
  const [brandSecondaryColor, setBrandSecondaryColor] = useState('#50C3D2');

  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const actor = user?.email ?? 'unknown';

  // Variable estimated lengths for SMS character counting
  const smsVarLengths: Record<string, number> = {
    '{{cas}}': 5,
    '{{datum}}': 6,
    '{{telefon_podjetja}}': 9,
    '{{email_podjetja}}': kompanyEmail.length || 20,
    '{{ime}}': 10,
    '{{priimek}}': 10,
    '{{ime_izvajalca}}': 20,
    '{{ime_podjetja}}': nazivPodjetja.length || 15,
    '{{naslov}}': naslovPodjetja.length || 20,
    '{{leto}}': 4,
    '{{povezava_prenarocanje}}': apptManagementLink.length || 30,
  };

  // Load settings
  useEffect(() => {
    async function loadSettings() {
      if (!companyId || !isOpen) return;
      setIsLoading(true);

      try {
        const { data } = await loadCompanyRow(companyId);

        if (data) {
          setSendingLanguage(String(data['jezik posiljanja'] ?? data['jezik_posiljanja'] ?? 'sl'));
          setTonKomunikacije(String(data['Ton komunikacije opomikov'] ?? data['ton_komunikacije_opomikov'] ?? 'prijazen'));

          const nagovorVal = String(data['nagovor'] ?? 'vikanje').toLowerCase().trim();
          setNagovor(nagovorVal === 'tikanje' ? 'tikanje' : 'vikanje');

          const parseBoolLoad = (v: unknown) => {
            if (typeof v === 'boolean') return v;
            if (typeof v === 'string') return v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
            return false;
          };
          setSamodejniOpomnik(parseBoolLoad(data['samodejni_opomnik']));
          setSmsOsebaPred(parseBoolLoad(data['sms_oseba_pred']));

          const dniPrejNum = Number(data['dni_prej'] ?? 1);
          setDniPrej(String(dniPrejNum >= 1 && dniPrejNum <= 7 ? dniPrejNum : 1));
          setReplyTo(String(data['reply_to'] ?? data['Reply_to'] ?? ''));
          setFromName(String(data['from_name'] ?? data['From_name'] ?? ''));
          setChanelPred(String(data['chanel_pred'] ?? data['Chanel_pred'] ?? 'email'));
          setChanelPo(String(data['channel_po'] ?? data['Channel_po'] ?? 'email'));

          const posiljanjePredValue = data['Pošiljanje PRED'] ?? data['posiljanje_pred'];
          setPosiljanjePred(posiljanjePredValue === true || posiljanjePredValue === 'true' || posiljanjePredValue === 'yes' || posiljanjePredValue === 'da');

          setNastavitvePred(String(data['Nastavitve PRED'] ?? data['nastavitve_pred'] ?? ''));

          const posiljanjePoValue = data['Pošiljanje PO'] ?? data['posiljanje_po'];
          setPosiljanjePo(posiljanjePoValue === true || posiljanjePoValue === 'true' || posiljanjePoValue === 'yes' || posiljanjePoValue === 'da');

          setNastavitvePo(String(data['Nastavitve PO'] ?? data['nastavitve_po'] ?? ''));

          const popust = data['Popust PO'] ?? data['popust_po'] ?? '';
          const popustStr = String(popust).trim();
          setShowDiscountField(popustStr !== '' && popustStr !== '0');
          setPopustPo(popustStr);

          setBrandPrimaryColor(String(data['brand_primary'] ?? data['from_email_primary_color'] ?? data['brand_primary_color'] ?? '#7C75FC'));
          setBrandSecondaryColor(String(data['brand_second'] ?? data['from_email_secondary_color'] ?? data['brand_secondary_color'] ?? '#50C3D2'));

          const nsVal = String(data['Nastveti_storitev'] ?? 'auto').toLowerCase().trim();
          setNastvetiStoritev(nsVal === 'yes' ? 'yes' : nsVal === 'no' ? 'no' : 'auto');

          // SMS config - before
          const smsTypePred = String(data['sms_type_pred'] ?? data['sms_mode_pred'] ?? 'AI').toUpperCase();
          setSmsModePred(smsTypePred === 'LP' ? 'manual' : 'ai');
          setSmsIncludeServicePred(data['sms_include_service_pred'] !== false && data['sms_include_service_pred'] !== 'false');
          setSmsIncludeNotesPred(data['sms_include_notes_pred'] === true || data['sms_include_notes_pred'] === 'true');
          setSmsTipPred(data['sms_tip_pred'] === true || data['sms_tip_pred'] === 'true');
          setSmsTemplatePred(migrateTemplate(String(data['lastna_predloga_pred'] ?? data['sms_template_pred'] ?? '')));

          // SMS config - after
          const smsTypePo = String(data['sms_type_po'] ?? data['sms_mode_po'] ?? 'AI').toUpperCase();
          setSmsModePo(smsTypePo === 'LP' ? 'manual' : 'ai');
          setSmsIncludeServicePo(data['sms_include_service_po'] !== false && data['sms_include_service_po'] !== 'false');
          setSmsIncludeNotesPo(data['sms_include_notes_po'] === true || data['sms_include_notes_po'] === 'true');
          setSmsTipPo(data['sms_tip_po'] === true || data['sms_tip_po'] === 'true');
          setSmsTemplatePo(migrateTemplate(String(data['lastna_predloga_po'] ?? data['sms_template_po'] ?? '')));

          // SMS sender ID — read from companies table
          if (companyUuid) {
            const { data: companiesData } = await supabaseReadOnly
              .from('companies')
              .select('sms_sender_id')
              .eq('id', companyUuid)
              .maybeSingle();
            setSmsSenderId(String(companiesData?.sms_sender_id ?? data['sms_sender_id'] ?? ''));
          } else {
            setSmsSenderId(String(data['sms_sender_id'] ?? ''));
          }

          // Load company data for variable length estimation
          setKompanyEmail(String(data['Kontaktni email'] ?? data['kontaktni_email'] ?? data['from_email'] ?? ''));
          setNazivPodjetja(String(data['Naziv podjetja'] ?? data['Naziv Podjetja'] ?? data['naziv_podjetja'] ?? ''));
          setNaslovPodjetja(String(data['Naslov podjetja'] ?? data['naslov_podjetja'] ?? data['Naslov'] ?? ''));
          setApptManagementLink(String(data['appt_management_link'] ?? ''));

          // SMS Supabase columns - use true/yes for enabled
          const parseBool = (v: unknown) => {
            if (typeof v === 'boolean') return v;
            if (typeof v === 'string') return v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
            return false;
          };
          setSmsStoritevPred(parseBool(data['sms_storitev_pred']));
          setSmsOpombePred(parseBool(data['sms_opombe_pred']));
          setSmsNavodilaPred(parseBool(data['sms_navodila_pred']));
          setSmsStoritevPo(parseBool(data['sms_storitev_po']));
          setSmsOpombePo(parseBool(data['sms_opombe_po']));
          setSmsNavodilaPo(parseBool(data['sms_navodila_po']));

          setObvestiloPrestavitevOmogoceno(parseBool(data['obvestilo_prestavitev_omogoceno']));
          const rescheduleChannel = String(data['obvestilo_prestavitev_channel'] ?? 'email').toLowerCase();
          setObvestiloPrestavitevChannel(rescheduleChannel === 'sms' ? 'sms' : 'email');
          setObvestiloPrestavitevTemplateSms(String(data['obvestilo_prestavitev_template_sms'] ?? ''));
          setObvestiloPrestavitevTemplateEmail(String(data['obvestilo_prestavitev_template_email'] ?? ''));
        }
      } catch (error) {
        console.error('Error loading reminder settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [companyId, isOpen]);

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);

    try {
      const webhookPayload = {
        event: 'REMINDER_SETTINGS_UPDATED',
        entity: 'settings',
        company_id: companyId,
        actor,
        timestamp: new Date().toISOString(),
        data: {
          'jezik posiljanja': sendingLanguage,
          'Ton komunikacije opomikov': tonKomunikacije,
          'nagovor': nagovor,
          'samodejni_opomnik': samodejniOpomnik,
          'sms_oseba_pred': smsOsebaPred,
          'dni_prej': Number(dniPrej),
          'reply_to': replyTo,
          'from_name': fromName,
          'chanel_pred': chanelPred,
          'channel_po': chanelPo,
          'Pošiljanje PRED': posiljanjePred,
          'Nastavitve PRED': nastavitvePred,
          'Pošiljanje PO': posiljanjePo,
          'Nastavitve PO': nastavitvePo,
          'Poslji popust po': showDiscountField,
          'Popust PO': showDiscountField ? popustPo : '',
          'from_email_primary_color': brandPrimaryColor,
          'from_email_secondary_color': brandSecondaryColor,
          'Nastveti_storitev': nastvetiStoritev,
          sending_language: sendingLanguage,
          jezik_kratko: sendingLanguage,
          communication_tone: tonKomunikacije,
          reply_to_email: replyTo,
          sender_name: fromName,
          sender_email: fromEmail,
          brand_primary_color: brandPrimaryColor,
          brand_secondary_color: brandSecondaryColor,
          before_appointment: {
            enabled: posiljanjePred,
            channel: chanelPred,
            timing: '1 dan prej',
            instructions: nastavitvePred,
            sms_config: chanelPred === 'sms' ? {
              mode: smsModePred,
              include_service: smsIncludeServicePred,
              include_notes: smsIncludeNotesPred,
              include_tip: smsTipPred,
              template: smsModePred === 'manual' ? smsTemplatePred : null,
            } : null,
          },
          after_appointment: {
            enabled: posiljanjePo,
            channel: chanelPo,
            timing: 'takoj po terminu',
            instructions: nastavitvePo,
            send_discount: showDiscountField,
            discount_amount: showDiscountField ? popustPo : null,
            sms_config: chanelPo === 'sms' ? {
              mode: smsModePo,
              include_service: smsIncludeServicePo,
              include_notes: smsIncludeNotesPo,
              include_tip: smsTipPo,
              template: smsModePo === 'manual' ? smsTemplatePo : null,
            } : null,
          },
          'sms_sender_id': smsSenderId,
          'sms_type_pred': smsModePred === 'manual' ? 'LP' : 'AI',
          'sms_type_po': smsModePo === 'manual' ? 'LP' : 'AI',
          'lastna_predloga_pred': smsModePred === 'manual' ? smsTemplatePred : lastnaPrelogaPred,
          'lastna_predloga_po': smsModePo === 'manual' ? smsTemplatePo : lastnaPredlogaPo,
          'sms_storitev_pred': smsStoritevPred,
          'sms_opombe_pred': smsOpombePred,
          'sms_navodila_pred': smsNavodilaPred,
          'sms_storitev_po': smsStoritevPo,
          'sms_opombe_po': smsOpombePo,
          'sms_navodila_po': smsNavodilaPo,
          sms_pred: {
            mode: smsModePred,
            include_service: smsStoritevPred,
            include_notes: smsOpombePred,
            include_navodila: smsNavodilaPred,
            template: smsTemplatePred,
            lastna_predloga: smsModePred === 'manual' ? smsTemplatePred : lastnaPrelogaPred,
          },
          sms_po: {
            mode: smsModePo,
            include_service: smsStoritevPo,
            include_notes: smsOpombePo,
            include_navodila: smsNavodilaPo,
            template: smsTemplatePo,
            lastna_predloga: smsModePo === 'manual' ? smsTemplatePo : lastnaPredlogaPo,
          },
          obvestilo_prestavitev_omogoceno: obvestiloPrestavitevOmogoceno,
          obvestilo_prestavitev_channel: obvestiloPrestavitevChannel,
          obvestilo_prestavitev_template_sms: obvestiloPrestavitevTemplateSms,
          obvestilo_prestavitev_template_email: obvestiloPrestavitevTemplateEmail,
        },
      };

      const result = await callN8nAction(webhookPayload);

      if (!result.ok) {
        throw new Error(t('modal.saveError'));
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      setLastSaved(new Date());

      // Close modal after 0.8s delay and refresh page
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 800);
    } catch (error) {
      console.error('Error saving reminder settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const lockedFieldClass = 'flex-1 rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-sm text-gray-700';
  const innerPanelClass = 'space-y-4 rounded-2xl border border-gray-100 bg-gray-50 p-4';
  const infoPanelClass = 'rounded-2xl border border-gray-100 bg-white p-4 shadow-sm shadow-gray-100/60';
  const textareaClass = 'w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10';

  const renderChannelSelector = (
    value: string,
    onChange: (next: string) => void,
    context: 'before' | 'after'
  ) => {
    const smsUnavailable = t(`modal.${context}.smsNotAvailable`);

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => onChange('email')}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              value === 'email'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <EnvelopeSimple className="h-4 w-4" weight={value === 'email' ? 'fill' : 'regular'} />
            Email
          </button>
          <button
            type="button"
            disabled={smsLockedForPlan}
            onClick={() => !smsLockedForPlan && onChange('sms')}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              value === 'sms' && !smsLockedForPlan
                ? 'bg-white text-gray-900 shadow-sm'
                : smsLockedForPlan
                  ? 'cursor-not-allowed text-gray-400'
                  : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <DeviceMobile className="h-4 w-4" weight={value === 'sms' && !smsLockedForPlan ? 'fill' : 'regular'} />
            SMS
          </button>
        </div>
        {smsLockedForPlan && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{smsUnavailable}</span>
            <span>{t(`modal.${context}.smsUpgradeHint`)}</span>
            <button
              type="button"
              onClick={() => { onClose(); router.push('/billing'); }}
              className="inline-flex items-center gap-1 font-semibold text-gray-900 underline underline-offset-2"
            >
              {t(`modal.${context}.upgradeButton`)} <ArrowRight className="h-3 w-3" weight="bold" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-gray-100 bg-[#F7F8FA] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-5 py-4 sm:px-6">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-semibold text-gray-900">
                  {t('modal.title')}
                </h2>
                <p className="mt-0.5 truncate text-sm text-gray-500">{t('modal.subtitle')}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <SaveIndicator saving={saving} lastSaved={lastSaved} />
                <button
                  onClick={onClose}
                  className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                >
                  <X className="h-5 w-5" weight="bold" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {isLoading ? (
                <div className="space-y-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-6 animate-pulse">
                      <div className="h-6 bg-gray-200 rounded w-1/4 mb-4" />
                      <div className="space-y-3">
                        <div className="h-10 bg-gray-100 rounded" />
                        <div className="h-10 bg-gray-100 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {/* General Reminder Settings */}
                  <SettingsSection
                    title={t('modal.general.sectionTitle')}
                    description={t('modal.general.sectionDesc')}
                  >
                    <SettingRow
                      label={t('modal.general.languageLabel')}
                      description={t('modal.general.languageDesc')}
                    >
                      <Select
                        value={sendingLanguage}
                        setValue={setSendingLanguage}
                        placeholder={t('modal.general.languagePlaceholder')}
                      >
                        {SENDING_LANGUAGES.map((lang) => (
                          <SelectOption key={lang.value} value={lang.value}>{lang.label}</SelectOption>
                        ))}
                      </Select>
                    </SettingRow>

                    <SettingRow
                      label={t('modal.general.toneLabel')}
                      description={t('modal.general.toneDesc')}
                    >
                      <Select
                        value={tonKomunikacije}
                        setValue={setTonKomunikacije}
                        placeholder={t('modal.general.tonePlaceholder')}
                      >
                        <SelectOption value="formal">{t('modal.general.toneOptions.formal')}</SelectOption>
                        <SelectOption value="prijazen">{t('modal.general.toneOptions.friendly')}</SelectOption>
                        <SelectOption value="sproscen">{t('modal.general.toneOptions.relaxed')}</SelectOption>
                        <SelectOption value="profesionalen">{t('modal.general.toneOptions.professional')}</SelectOption>
                      </Select>
                    </SettingRow>

                    {/* Nagovor strank */}
                    <SettingRow
                      label="Nagovor strank"
                      description="Ali naj se stranke v opomnikih vika ali tika."
                    >
                      <SegmentedControl
                        value={nagovor}
                        onChange={(v) => setNagovor(v === 'tikanje' ? 'tikanje' : 'vikanje')}
                        options={[
                          { value: 'vikanje', label: 'Vikanje' },
                          { value: 'tikanje', label: 'Tikanje' },
                        ]}
                      />
                    </SettingRow>

                    {/* Samodejni opomnik oznaka */}
                    <SettingRow
                      label="Označi sporočila kot samodejni opomnik"
                      description="Na začetku sporočila se doda oznaka, da gre za samodejni opomnik."
                    >
                      <Switch
                        checked={samodejniOpomnik}
                        onChange={setSamodejniOpomnik}
                      />
                    </SettingRow>

                    {/* Vključi izvajalca */}
                    <SettingRow
                      label="Vključi izvajalca v opomnik"
                      description="Če je vklopljeno, lahko opomnik omeni zaposlenega, ki bo izvedel storitev."
                    >
                      <Switch
                        checked={smsOsebaPred}
                        onChange={setSmsOsebaPred}
                      />
                    </SettingRow>

                    {/* Dni pred terminom */}
                    <SettingRow
                      label="Pošlji opomnik (dni pred terminom)"
                      description="Koliko dni pred terminom naj se pošlje opomnik."
                    >
                      <Select
                        value={dniPrej}
                        setValue={setDniPrej}
                        placeholder="Izberi"
                      >
                        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                          <SelectOption key={d} value={String(d)}>{d}</SelectOption>
                        ))}
                      </Select>
                    </SettingRow>

                    <SettingRow
                      label={t('modal.general.replyToLabel')}
                      description={t('modal.general.replyToDesc')}
                    >
                      <Input
                        type="email"
                        value={replyTo}
                        onChange={(e) => setReplyTo(e.target.value)}
                        placeholder={t('modal.general.replyToPlaceholder')}
                      />
                    </SettingRow>

                    <SettingRow
                      label={t('modal.general.fromNameLabel')}
                      description={t('modal.general.fromNameDesc')}
                    >
                      <Input
                        value={fromName}
                        onChange={(e) => setFromName(e.target.value)}
                        placeholder={t('modal.general.fromNamePlaceholder')}
                      />
                    </SettingRow>

                    {/* Fixed From Email */}
                    <SettingRow
                      label={t('modal.general.fromEmailLabel')}
                      description={t('modal.general.fromEmailDesc')}
                    >
                      <div className="flex items-center gap-3">
                        <div className={lockedFieldClass}>
                          {fromEmail}
                        </div>
                        <div className="flex items-center gap-1 text-gray-400">
                          <Lock className="h-4 w-4" weight="bold" />
                          <span className="text-xs">{t('modal.general.locked')}</span>
                        </div>
                      </div>
                    </SettingRow>

                    {/* SMS Sender ID - LOCKED, read from Supabase */}
                    <SettingRow
                      label={t('modal.general.senderIdLabel')}
                      description={t('modal.general.senderIdDesc')}
                    >
                      <div className="flex items-center gap-3">
                        <div className={lockedFieldClass}>
                          {smsSenderId || <span className="text-gray-400 font-sans">{t('modal.general.notSet')}</span>}
                        </div>
                        <div className="flex items-center gap-1 text-gray-400">
                          <Lock className="h-4 w-4" weight="bold" />
                          <span className="text-xs">{t('modal.general.locked')}</span>
                        </div>
                      </div>
                    </SettingRow>

                    {/* Nasveti glede na storitev */}
                    <SettingRow
                      label={t('modal.general.tipsLabel')}
                      description={t('modal.general.tipsDesc')}
                    >
                      <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
                        {([
                          { value: 'yes' as const, labelKey: 'modal.general.tipsYes' },
                          { value: 'no' as const, labelKey: 'modal.general.tipsNo' },
                          { value: 'auto' as const, labelKey: 'modal.general.tipsAuto' },
                        ] as { value: 'yes' | 'no' | 'auto'; labelKey: string }[]).map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setNastvetiStoritev(opt.value)}
                            className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                              nastvetiStoritev === opt.value
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-900'
                            }`}
                          >
                            {t(opt.labelKey)}
                          </button>
                        ))}
                      </div>
                    </SettingRow>

                    {/* Brand Colors */}
                    <div className="space-y-4 mt-6">
                      <p className="text-sm font-medium text-gray-700">{t('modal.general.colorsTitle')}</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-600 mb-1">{t('modal.general.colorPrimary')}</p>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={brandPrimaryColor}
                              onChange={(e) => setBrandPrimaryColor(e.target.value)}
                              className="h-12 w-12 cursor-pointer rounded-lg border border-gray-200"
                            />
                            <Input
                              value={brandPrimaryColor}
                              onChange={(e) => setBrandPrimaryColor(e.target.value)}
                              className="flex-1"
                            />
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">{t('modal.general.colorSecondary')}</p>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={brandSecondaryColor}
                              onChange={(e) => setBrandSecondaryColor(e.target.value)}
                              className="h-12 w-12 cursor-pointer rounded-lg border border-gray-200"
                            />
                            <Input
                              value={brandSecondaryColor}
                              onChange={(e) => setBrandSecondaryColor(e.target.value)}
                              className="flex-1"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </SettingsSection>

                  {/* Before Appointment Reminders */}
                  <SettingsSection
                    title={t('modal.before.sectionTitle')}
                    description={t('modal.before.sectionDesc')}
                  >
                    <SettingRow
                      label={t('modal.before.enableLabel')}
                      description={t('modal.before.enableDesc')}
                    >
                      <Switch
                        checked={posiljanjePred}
                        onChange={setPosiljanjePred}
                      />
                    </SettingRow>

                    {posiljanjePred && (
                      <>
                        <SettingRow
                          label={t('modal.before.channelLabel')}
                          description={t('modal.before.channelDesc')}
                        >
                          {renderChannelSelector(chanelPred, setChanelPred, 'before')}
                        </SettingRow>

                        {chanelPred === 'sms' && (
                          <div className={innerPanelClass}>
                            <div className="font-semibold text-gray-900 text-sm">{t('modal.before.smsSettings')}</div>

                            {/* Mode selector */}
                            <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
                              {([
                                { value: 'ai' as const, labelKey: 'modal.before.modeAI' },
                                { value: 'manual' as const, labelKey: 'modal.before.modeManual' },
                              ]).map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setSmsModePred(opt.value)}
                                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                                    smsModePred === opt.value
                                      ? 'bg-white text-gray-900 shadow-sm'
                                      : 'text-gray-500 hover:text-gray-900'
                                  }`}
                                >
                                  {t(opt.labelKey)}
                                </button>
                              ))}
                            </div>

                            {smsModePred === 'ai' && (
                              <div className="space-y-4">
                                <p className="text-xs text-gray-500">{t('modal.before.aiDataHint')}</p>

                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0 flex-1">
                                    <span className="text-sm text-gray-700">{t('modal.before.includeService')}</span>
                                    <p className="text-xs text-gray-400 mt-0.5">{t('modal.before.includeServiceDesc')}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSmsStoritevPred(!smsStoritevPred)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${smsStoritevPred ? 'bg-gray-900' : 'bg-gray-200'}`}
                                  >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${smsStoritevPred ? 'translate-x-6' : 'translate-x-1'}`} />
                                  </button>
                                </div>

                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0 flex-1">
                                    <span className="text-sm text-gray-700">{t('modal.before.includeNotes')}</span>
                                    <p className="text-xs text-gray-400 mt-0.5">{t('modal.before.includeNotesDesc')}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSmsOpombePred(!smsOpombePred)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${smsOpombePred ? 'bg-gray-900' : 'bg-gray-200'}`}
                                  >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${smsOpombePred ? 'translate-x-6' : 'translate-x-1'}`} />
                                  </button>
                                </div>

                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0 flex-1">
                                    <span className="text-sm text-gray-700">{t('modal.before.includeInstructions')}</span>
                                    <p className="text-xs text-gray-400 mt-0.5">{t('modal.before.includeInstructionsDesc')}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSmsNavodilaPred(!smsNavodilaPred)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${smsNavodilaPred ? 'bg-gray-900' : 'bg-gray-200'}`}
                                  >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${smsNavodilaPred ? 'translate-x-6' : 'translate-x-1'}`} />
                                  </button>
                                </div>

                                {smsNavodilaPred && (
                                  <div className="space-y-2">
                                    <textarea
                                      value={nastavitvePred}
                                      onChange={(e) => setNastavitvePred(e.target.value)}
                                      rows={5}
                                      maxLength={500}
                                      placeholder={t('modal.before.instructionsPlaceholder')}
                                      className={textareaClass}
                                    />
                                    <div className="flex justify-between items-center">
                                      <p className="text-xs text-gray-400">{t('modal.before.instructionsHint')}</p>
                                      <p className="text-xs text-gray-400 flex-shrink-0 ml-2">{nastavitvePred.length}/500</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {smsModePred === 'manual' && (
                              <div className="space-y-2">
                                <p className="text-xs text-gray-500">{t('modal.before.templateHint')}</p>
                                <TemplateEditor
                                  value={smsTemplatePred}
                                  onChange={setSmsTemplatePred}
                                  maxLength={155}
                                  placeholder={t('modal.before.templatePlaceholder')}
                                  rows={4}
                                  varLengths={smsVarLengths}
                                />
                                <p className="text-xs text-gray-400">{t('modal.before.noEmojiHint')}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {chanelPred === 'email' && (
                          <div className={innerPanelClass}>
                            <div className="font-semibold text-gray-900 text-sm">{t('modal.before.emailInstructionsTitle')}</div>
                            <p className="text-xs text-gray-500">{t('modal.before.emailInstructionsDesc')}</p>
                            <Textarea
                              value={nastavitvePred}
                              onChange={(e) => setNastavitvePred(e.target.value)}
                              rows={5}
                              maxLength={500}
                              placeholder={t('modal.before.emailPlaceholder')}
                            />
                            <p className="text-xs text-gray-400 text-right">{nastavitvePred.length}/500</p>
                          </div>
                        )}

                        <div className={infoPanelClass}>
                          <div className="font-semibold text-gray-900 mb-1">{t('modal.before.timingTitle')}</div>
                          <div className="text-sm text-gray-700">
                            {t('modal.before.timingValue')}
                          </div>
                        </div>
                      </>
                    )}
                  </SettingsSection>

                  {/* After Appointment Reminders */}
                  <SettingsSection
                    title={t('modal.after.sectionTitle')}
                    description={t('modal.after.sectionDesc')}
                  >
                    <SettingRow
                      label={t('modal.after.enableLabel')}
                      description={t('modal.after.enableDesc')}
                    >
                      <Switch
                        checked={posiljanjePo}
                        onChange={setPosiljanjePo}
                      />
                    </SettingRow>

                    {posiljanjePo && (
                      <>
                        <SettingRow
                          label={t('modal.after.channelLabel')}
                          description={t('modal.after.channelDesc')}
                        >
                          {renderChannelSelector(chanelPo, setChanelPo, 'after')}
                        </SettingRow>

                        {chanelPo === 'sms' && (
                          <div className={innerPanelClass}>
                            <div className="font-semibold text-gray-900 text-sm">{t('modal.after.smsSettings')}</div>

                            {/* Mode selector */}
                            <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
                              {([
                                { value: 'ai' as const, labelKey: 'modal.after.modeAI' },
                                { value: 'manual' as const, labelKey: 'modal.after.modeManual' },
                              ]).map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setSmsModePo(opt.value)}
                                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                                    smsModePo === opt.value
                                      ? 'bg-white text-gray-900 shadow-sm'
                                      : 'text-gray-500 hover:text-gray-900'
                                  }`}
                                >
                                  {t(opt.labelKey)}
                                </button>
                              ))}
                            </div>

                            {smsModePo === 'ai' && (
                              <div className="space-y-4">
                                <p className="text-xs text-gray-500">{t('modal.after.aiDataHint')}</p>

                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0 flex-1">
                                    <span className="text-sm text-gray-700">{t('modal.after.includeService')}</span>
                                    <p className="text-xs text-gray-400 mt-0.5">{t('modal.after.includeServiceDesc')}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSmsStoritevPo(!smsStoritevPo)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${smsStoritevPo ? 'bg-gray-900' : 'bg-gray-200'}`}
                                  >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${smsStoritevPo ? 'translate-x-6' : 'translate-x-1'}`} />
                                  </button>
                                </div>

                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0 flex-1">
                                    <span className="text-sm text-gray-700">{t('modal.after.includeNotes')}</span>
                                    <p className="text-xs text-gray-400 mt-0.5">{t('modal.after.includeNotesDesc')}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSmsOpombePo(!smsOpombePo)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${smsOpombePo ? 'bg-gray-900' : 'bg-gray-200'}`}
                                  >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${smsOpombePo ? 'translate-x-6' : 'translate-x-1'}`} />
                                  </button>
                                </div>

                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0 flex-1">
                                    <span className="text-sm text-gray-700">{t('modal.after.includeInstructions')}</span>
                                    <p className="text-xs text-gray-400 mt-0.5">{t('modal.after.includeInstructionsDesc')}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSmsNavodilaPo(!smsNavodilaPo)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${smsNavodilaPo ? 'bg-gray-900' : 'bg-gray-200'}`}
                                  >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${smsNavodilaPo ? 'translate-x-6' : 'translate-x-1'}`} />
                                  </button>
                                </div>

                                {smsNavodilaPo && (
                                  <div className="space-y-2">
                                    <textarea
                                      value={nastavitvePo}
                                      onChange={(e) => setNastavitvePo(e.target.value)}
                                      rows={5}
                                      maxLength={500}
                                      placeholder={t('modal.after.instructionsPlaceholder')}
                                      className={textareaClass}
                                    />
                                    <div className="flex justify-between items-center">
                                      <p className="text-xs text-gray-400">{t('modal.after.instructionsHint')}</p>
                                      <p className="text-xs text-gray-400 flex-shrink-0 ml-2">{nastavitvePo.length}/500</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {smsModePo === 'manual' && (
                              <div className="space-y-2">
                                <p className="text-xs text-gray-500">{t('modal.after.templateHint')}</p>
                                <TemplateEditor
                                  value={smsTemplatePo}
                                  onChange={setSmsTemplatePo}
                                  maxLength={155}
                                  placeholder={t('modal.after.templatePlaceholder')}
                                  rows={4}
                                  varLengths={smsVarLengths}
                                />
                                <p className="text-xs text-gray-400">{t('modal.after.noEmojiHint')}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {chanelPo === 'email' && (
                          <div className={innerPanelClass}>
                            <div className="font-semibold text-gray-900 text-sm">{t('modal.after.emailInstructionsTitle')}</div>
                            <p className="text-xs text-gray-500">{t('modal.after.emailInstructionsDesc')}</p>
                            <Textarea
                              value={nastavitvePo}
                              onChange={(e) => setNastavitvePo(e.target.value)}
                              rows={5}
                              maxLength={500}
                              placeholder={t('modal.after.emailPlaceholder')}
                            />
                            <p className="text-xs text-gray-400 text-right">{nastavitvePo.length}/500</p>
                          </div>
                        )}

                        {/* Discount option — hidden when SMS LP (custom template handles its own content) */}
                        {!(chanelPo === 'sms' && smsModePo === 'manual') && (
                          <>
                            <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm shadow-gray-100/60">
                              <div>
                                <div className="font-semibold text-gray-900">
                                  {t('modal.after.discountTitle')}
                                </div>
                                <div className="text-sm text-gray-600 mt-1">
                                  {t('modal.after.discountDesc')}
                                </div>
                              </div>
                              <Switch
                                checked={showDiscountField}
                                onChange={setShowDiscountField}
                              />
                            </div>

                            {showDiscountField && (
                              <SettingRow
                                label={t('modal.after.discountLabel')}
                                description={t('modal.after.discountFieldDesc')}
                                fullWidth
                              >
                                <Input
                                  value={popustPo}
                                  onChange={(e) => setPopustPo(e.target.value)}
                                  placeholder={t('modal.after.discountPlaceholder')}
                                />
                              </SettingRow>
                            )}
                          </>
                        )}

                        <div className={infoPanelClass}>
                          <div className="font-semibold text-gray-900 mb-1">{t('modal.after.timingTitle')}</div>
                          <div className="text-sm text-gray-700">
                            {t('modal.after.timingValue')}
                          </div>
                        </div>
                      </>
                    )}
                  </SettingsSection>

                  {/* Reschedule notification section */}
                  <SettingsSection
                    title="Obvestilo ob prestavitvi termina"
                    description="Stranka prejme obvestilo, ko ji prestavite termin."
                  >
                    <SettingRow
                      label="Omogoči obvestilo ob prestavitvi"
                      description="Ko prestavite termin, vam sistem predlaga pošiljanje obvestila stranki."
                    >
                      <Switch
                        checked={obvestiloPrestavitevOmogoceno}
                        onChange={setObvestiloPrestavitevOmogoceno}
                      />
                    </SettingRow>

                    {obvestiloPrestavitevOmogoceno && (
                      <>
                        <SettingRow
                          label="Način pošiljanja"
                          description="Izberite kanal za obvestilo ob prestavitvi termina."
                        >
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
                              <button
                                type="button"
                                onClick={() => setObvestiloPrestavitevChannel('email')}
                                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                                  obvestiloPrestavitevChannel === 'email'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-900'
                                }`}
                              >
                                <EnvelopeSimple className="h-4 w-4" weight={obvestiloPrestavitevChannel === 'email' ? 'fill' : 'regular'} />
                                Email
                              </button>
                              <button
                                type="button"
                                disabled={smsLockedForPlan}
                                onClick={() => !smsLockedForPlan && setObvestiloPrestavitevChannel('sms')}
                                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                                  obvestiloPrestavitevChannel === 'sms' && !smsLockedForPlan
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : smsLockedForPlan
                                      ? 'cursor-not-allowed text-gray-400'
                                      : 'text-gray-500 hover:text-gray-900'
                                }`}
                              >
                                <DeviceMobile className="h-4 w-4" weight={obvestiloPrestavitevChannel === 'sms' && !smsLockedForPlan ? 'fill' : 'regular'} />
                                SMS
                              </button>
                            </div>
                            {smsLockedForPlan && (
                              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                <span>SMS je na voljo v višjih paketih.</span>
                                <button
                                  type="button"
                                  onClick={() => { onClose(); router.push('/billing'); }}
                                  className="inline-flex items-center gap-1 font-semibold text-gray-900 underline underline-offset-2"
                                >
                                  Nadgradi paket <ArrowRight className="h-3 w-3" weight="bold" />
                                </button>
                              </div>
                            )}
                          </div>
                        </SettingRow>

                        {obvestiloPrestavitevChannel === 'sms' && (
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">SMS predloga</label>
                            <TemplateEditor
                              value={obvestiloPrestavitevTemplateSms}
                              onChange={setObvestiloPrestavitevTemplateSms}
                              maxLength={155}
                              rows={4}
                              placeholder="Spoštovani {{ime}}, vaš termin je bil prestavljen na {{datum}} ob {{cas}}. {{ime_podjetja}}"
                              varLengths={smsVarLengths}
                            />
                            <p className="text-xs text-gray-400">
                              Uporabite lahko enake spremenljivke kot pri opomnikih pred in po terminu.
                            </p>
                          </div>
                        )}

                        {obvestiloPrestavitevChannel === 'email' && (
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">Email predloga</label>
                            <TemplateEditor
                              value={obvestiloPrestavitevTemplateEmail}
                              onChange={setObvestiloPrestavitevTemplateEmail}
                              maxLength={0}
                              rows={4}
                              placeholder="Spoštovani {{ime}}, vaš termin je bil prestavljen na {{datum}} ob {{cas}}. Lep pozdrav, {{ime_podjetja}}"
                            />
                            <p className="text-xs text-gray-400">
                              Email predloga nima omejitve znakov in podpira šumnike.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </SettingsSection>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-gray-100 bg-white px-5 py-4 sm:px-6">
              <motion.button
                type="button"
                onClick={onClose}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="rounded-lg px-5 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
              >
                {t('modal.closeButton')}
              </motion.button>
              <motion.button
                type="button"
                onClick={handleSave}
                disabled={saving || isLoading}
                whileHover={{ scale: saving ? 1 : 1.02 }}
                whileTap={{ scale: saving ? 1 : 0.98 }}
                className="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                    {t('modal.savingButton')}
                  </>
                ) : (
                  <>
                    <FloppyDisk className="h-4 w-4" weight="bold" />
                    {t('modal.saveButton')}
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
