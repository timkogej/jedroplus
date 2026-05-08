'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, SpinnerGap, FloppyDisk, Lock, EnvelopeSimple, DeviceMobile, ArrowRight } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import {
  SettingsSection,
  SettingRow,
  Switch,
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
  const { companyId, companyUuid, planCode } = useCompany();
  const { user } = useAuth();
  const router = useRouter();
  const smsLockedForPlan = planCode === 'JEDRO_PLUS';

  // Settings from "Podatki podjetij" table
  const [sendingLanguage, setSendingLanguage] = useState('sl');
  const [tonKomunikacije, setTonKomunikacije] = useState('prijazen');
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
        },
      };

      const result = await callN8nAction(webhookPayload);

      if (!result.ok) {
        throw new Error('Prišlo je do napake pri shranjevanju');
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
            className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold text-gray-900 truncate">Nastavitve opomnikov</h2>
                <p className="text-sm text-gray-500 mt-0.5 truncate">Kako in kdaj pošiljati opomnike strankam</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <SaveIndicator saving={saving} lastSaved={lastSaved} />
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" weight="bold" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
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
                  <SettingsSection title="Splošne nastavitve" description="Osnovne nastavitve opomnikov">
                    <SettingRow
                      label="Jezik pošiljanja"
                      description="Jezik za pošiljanje opomnikov in sporočil"
                    >
                      <Select
                        value={sendingLanguage}
                        setValue={setSendingLanguage}
                        placeholder="Izberi jezik"
                      >
                        {SENDING_LANGUAGES.map((lang) => (
                          <SelectOption key={lang.value} value={lang.value}>{lang.label}</SelectOption>
                        ))}
                      </Select>
                    </SettingRow>

                    <SettingRow
                      label="Ton komunikacije"
                      description="Kako naj sistem komunicira s strankami"
                    >
                      <Select
                        value={tonKomunikacije}
                        setValue={setTonKomunikacije}
                        placeholder="Izberi ton"
                      >
                        <SelectOption value="formal">Formalen</SelectOption>
                        <SelectOption value="prijazen">Prijazen</SelectOption>
                        <SelectOption value="sproscen">Sproščen</SelectOption>
                        <SelectOption value="profesionalen">Profesionalen</SelectOption>
                      </Select>
                    </SettingRow>

                    <SettingRow
                      label="Reply-to Email"
                      description="Email naslov na katerega lahko stranke odgovorijo"
                    >
                      <Input
                        type="email"
                        value={replyTo}
                        onChange={(e) => setReplyTo(e.target.value)}
                        placeholder="info@vasepodjetje.si"
                      />
                    </SettingRow>

                    <SettingRow
                      label="Ime pošiljatelja"
                      description="Ime ki se prikaže pri email kot pošiljatelj"
                    >
                      <Input
                        value={fromName}
                        onChange={(e) => setFromName(e.target.value)}
                        placeholder="Salon Lepote"
                      />
                    </SettingRow>

                    {/* Fixed From Email */}
                    <SettingRow
                      label="Email naslov pošiljatelja"
                      description="Ta email naslov je fiksiran in se ne more spreminjati"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1 font-mono text-sm text-gray-700 p-3 bg-gray-100 rounded-xl border-2 border-gray-200">
                          {fromEmail}
                        </div>
                        <div className="flex items-center gap-1 text-gray-400">
                          <Lock className="h-4 w-4" weight="bold" />
                          <span className="text-xs">Zaklenjeno</span>
                        </div>
                      </div>
                    </SettingRow>

                    {/* SMS Sender ID - LOCKED, read from Supabase */}
                    <SettingRow
                      label="ID pošiljatelja SMS"
                      description="Ime pošiljatelja ki se prikaže pri SMS sporočilih"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1 font-mono text-sm text-gray-700 p-3 bg-gray-100 rounded-xl border-2 border-gray-200">
                          {smsSenderId || <span className="text-gray-400 font-sans">Ni nastavljeno</span>}
                        </div>
                        <div className="flex items-center gap-1 text-gray-400">
                          <Lock className="h-4 w-4" weight="bold" />
                          <span className="text-xs">Zaklenjeno</span>
                        </div>
                      </div>
                    </SettingRow>

                    {/* Nasveti glede na storitev */}
                    <SettingRow
                      label="Nasveti glede na storitev"
                      description="Ali naj opomniki vsebujejo nasvete prilagojene glede na storitev"
                    >
                      <div className="flex gap-2">
                        {([
                          { value: 'yes' as const, label: 'Da' },
                          { value: 'no' as const, label: 'Ne' },
                          { value: 'auto' as const, label: 'AI določi' },
                        ] as { value: 'yes' | 'no' | 'auto'; label: string }[]).map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setNastvetiStoritev(opt.value)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                              nastvetiStoritev === opt.value
                                ? 'border-transparent text-white'
                                : 'border-gray-200 text-gray-700 bg-white hover:border-gray-300'
                            }`}
                            style={nastvetiStoritev === opt.value ? {
                              background: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)',
                            } : undefined}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </SettingRow>

                    {/* Brand Colors */}
                    <div className="space-y-4 mt-6">
                      <p className="text-sm font-medium text-gray-700">Barve za email predloge</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Primarna barva</p>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={brandPrimaryColor}
                              onChange={(e) => setBrandPrimaryColor(e.target.value)}
                              className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
                            />
                            <Input
                              value={brandPrimaryColor}
                              onChange={(e) => setBrandPrimaryColor(e.target.value)}
                              className="flex-1"
                            />
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Sekundarna barva</p>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={brandSecondaryColor}
                              onChange={(e) => setBrandSecondaryColor(e.target.value)}
                              className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
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
                  <SettingsSection title="Opomniki pred terminom" description="Opomniki ki jih stranke prejmejo pred terminom">
                    <SettingRow
                      label="Pošlji opomnik pred terminom"
                      description="Avtomatsko pošiljanje opomnika 1 dan pred terminom"
                    >
                      <Switch
                        checked={posiljanjePred}
                        onChange={setPosiljanjePred}
                      />
                    </SettingRow>

                    {posiljanjePred && (
                      <>
                        <SettingRow
                          label="Način pošiljanja"
                          description="Email ali SMS"
                        >
                          {smsLockedForPlan ? (
                            <div className="flex flex-col gap-2">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setChanelPred('email')}
                                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${chanelPred === 'email' ? 'bg-violet-50 border-violet-300 text-violet-700 ring-1 ring-violet-200' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
                                >
                                  <EnvelopeSimple className="h-4 w-4" weight={chanelPred === 'email' ? 'fill' : 'regular'} />
                                  Email
                                </button>
                                <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed text-sm font-medium">
                                  <DeviceMobile className="h-4 w-4" weight="regular" />
                                  SMS
                                  <span className="text-xs text-gray-400">– ni dostopno</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">SMS je na voljo v višjih paketih.</span>
                                <button
                                  type="button"
                                  onClick={() => { onClose(); router.push('/billing'); }}
                                  className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 underline underline-offset-2"
                                >
                                  Nadgradi paket <ArrowRight className="h-3 w-3" weight="bold" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <Select
                              value={chanelPred}
                              setValue={setChanelPred}
                              placeholder="Izberi način"
                            >
                              <SelectOption value="email">Email</SelectOption>
                              <SelectOption value="sms">SMS</SelectOption>
                            </Select>
                          )}
                        </SettingRow>

                        {chanelPred === 'sms' && (
                          <div className="p-4 bg-gray-50 border-2 border-gray-200 rounded-xl space-y-4">
                            <div className="font-semibold text-gray-900 text-sm">Nastavitve SMS sporočila</div>

                            {/* Mode selector */}
                            <div className="flex gap-2">
                              {([
                                { value: 'ai' as const, label: 'AI sestavi' },
                                { value: 'manual' as const, label: 'Lastna predloga' },
                              ]).map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setSmsModePred(opt.value)}
                                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                                    smsModePred === opt.value
                                      ? 'border-transparent text-white'
                                      : 'border-gray-200 text-gray-700 bg-white hover:border-gray-300'
                                  }`}
                                  style={smsModePred === opt.value ? { background: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)' } : undefined}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>

                            {smsModePred === 'ai' && (
                              <div className="space-y-4">
                                <p className="text-xs text-gray-500">AI bo sestavil SMS na podlagi izbranih podatkov:</p>

                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0 flex-1">
                                    <span className="text-sm text-gray-700">Vključi storitev</span>
                                    <p className="text-xs text-gray-400 mt-0.5">Omeni storitev termina v opomniku.</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSmsStoritevPred(!smsStoritevPred)}
                                    className={`flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${smsStoritevPred ? 'bg-violet-500' : 'bg-gray-200'}`}
                                  >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${smsStoritevPred ? 'translate-x-6' : 'translate-x-1'}`} />
                                  </button>
                                </div>

                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0 flex-1">
                                    <span className="text-sm text-gray-700">Vključi opombe o terminu</span>
                                    <p className="text-xs text-gray-400 mt-0.5">Vključi opombe termina in morebitne opombe stranke.</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSmsOpombePred(!smsOpombePred)}
                                    className={`flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${smsOpombePred ? 'bg-violet-500' : 'bg-gray-200'}`}
                                  >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${smsOpombePred ? 'translate-x-6' : 'translate-x-1'}`} />
                                  </button>
                                </div>

                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0 flex-1">
                                    <span className="text-sm text-gray-700">Vključi navodila za opomnike</span>
                                    <p className="text-xs text-gray-400 mt-0.5">Vpišite spodaj navodila, ki jih AI upošteva pri sestavljanju opomnika.</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSmsNavodilaPred(!smsNavodilaPred)}
                                    className={`flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${smsNavodilaPred ? 'bg-violet-500' : 'bg-gray-200'}`}
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
                                      placeholder="Npr: Stranke vedno nagovorite po imenu. Pred masažo opomni, da naj pridejo spočiti in ne takoj po jedi. Za storitev 'gel lak' opomni, da naj ne namakajo nohtov vsaj dan prej. Ton naj bo topel in profesionalen."
                                      className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-300 focus:outline-none resize-none"
                                    />
                                    <div className="flex justify-between items-center">
                                      <p className="text-xs text-gray-400">Navedite poslovne navade, posebne nasvete pred določenimi storitvami, kaj naj AI omeni ali izpostavi, kakšen odnos do stranke si želite ipd.</p>
                                      <p className="text-xs text-gray-400 flex-shrink-0 ml-2">{nastavitvePred.length}/500</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {smsModePred === 'manual' && (
                              <div className="space-y-2">
                                <p className="text-xs text-gray-500">Predloga SMS sporočila (max 155 znakov)</p>
                                <TemplateEditor
                                  value={smsTemplatePred}
                                  onChange={setSmsTemplatePred}
                                  maxLength={155}
                                  placeholder="Npr: Spomin na vaš termin jutri ob {{cas}}. {{ime_podjetja}}. Za odpoved pokličite {{telefon_podjetja}}."
                                  rows={4}
                                  varLengths={smsVarLengths}
                                />
                                <p className="text-xs text-gray-400">Brez emojijev in posebnih znakov.</p>
                              </div>
                            )}
                          </div>
                        )}

                        {chanelPred === 'email' && (
                          <div className="p-4 bg-gray-50 border-2 border-gray-200 rounded-xl space-y-3">
                            <div className="font-semibold text-gray-900 text-sm">Navodila za opomnik pred terminom</div>
                            <p className="text-xs text-gray-500">Dodatna navodila ali informacije za opomnik pred terminom</p>
                            <Textarea
                              value={nastavitvePred}
                              onChange={(e) => setNastavitvePred(e.target.value)}
                              rows={5}
                              maxLength={500}
                              placeholder="Npr: Prosimo pridite 5 minut pred terminom. Parkirišče je na zadnji strani stavbe."
                            />
                            <p className="text-xs text-gray-400 text-right">{nastavitvePred.length}/500</p>
                          </div>
                        )}

                        <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                          <div className="font-semibold text-gray-900 mb-1">Čas pošiljanja opomnika</div>
                          <div className="text-sm text-gray-700">
                            Fiksno: <strong>1 dan pred terminom</strong>
                          </div>
                        </div>
                      </>
                    )}
                  </SettingsSection>

                  {/* After Appointment Reminders */}
                  <SettingsSection title="Opomniki po terminu" description="Follow-up sporočila po zaključenem terminu">
                    <SettingRow
                      label="Pošlji opomnik po terminu"
                      description="Follow-up takoj po zaključenem terminu"
                    >
                      <Switch
                        checked={posiljanjePo}
                        onChange={setPosiljanjePo}
                      />
                    </SettingRow>

                    {posiljanjePo && (
                      <>
                        <SettingRow
                          label="Način pošiljanja"
                          description="Email ali SMS"
                        >
                          {smsLockedForPlan ? (
                            <div className="flex flex-col gap-2">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setChanelPo('email')}
                                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${chanelPo === 'email' ? 'bg-violet-50 border-violet-300 text-violet-700 ring-1 ring-violet-200' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
                                >
                                  <EnvelopeSimple className="h-4 w-4" weight={chanelPo === 'email' ? 'fill' : 'regular'} />
                                  Email
                                </button>
                                <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed text-sm font-medium">
                                  <DeviceMobile className="h-4 w-4" weight="regular" />
                                  SMS
                                  <span className="text-xs text-gray-400">– ni dostopno</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">SMS je na voljo v višjih paketih.</span>
                                <button
                                  type="button"
                                  onClick={() => { onClose(); router.push('/billing'); }}
                                  className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 underline underline-offset-2"
                                >
                                  Nadgradi paket <ArrowRight className="h-3 w-3" weight="bold" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <Select
                              value={chanelPo}
                              setValue={setChanelPo}
                              placeholder="Izberi način"
                            >
                              <SelectOption value="email">Email</SelectOption>
                              <SelectOption value="sms">SMS</SelectOption>
                            </Select>
                          )}
                        </SettingRow>

                        {chanelPo === 'sms' && (
                          <div className="p-4 bg-gray-50 border-2 border-gray-200 rounded-xl space-y-4">
                            <div className="font-semibold text-gray-900 text-sm">Nastavitve SMS sporočila</div>

                            {/* Mode selector */}
                            <div className="flex gap-2">
                              {([
                                { value: 'ai' as const, label: 'AI sestavi' },
                                { value: 'manual' as const, label: 'Lastna predloga' },
                              ]).map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setSmsModePo(opt.value)}
                                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                                    smsModePo === opt.value
                                      ? 'border-transparent text-white'
                                      : 'border-gray-200 text-gray-700 bg-white hover:border-gray-300'
                                  }`}
                                  style={smsModePo === opt.value ? { background: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)' } : undefined}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>

                            {smsModePo === 'ai' && (
                              <div className="space-y-4">
                                <p className="text-xs text-gray-500">AI bo sestavil SMS na podlagi izbranih podatkov:</p>

                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0 flex-1">
                                    <span className="text-sm text-gray-700">Vključi storitev</span>
                                    <p className="text-xs text-gray-400 mt-0.5">Omeni storitev termina v sporočilu po obisku.</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSmsStoritevPo(!smsStoritevPo)}
                                    className={`flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${smsStoritevPo ? 'bg-violet-500' : 'bg-gray-200'}`}
                                  >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${smsStoritevPo ? 'translate-x-6' : 'translate-x-1'}`} />
                                  </button>
                                </div>

                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0 flex-1">
                                    <span className="text-sm text-gray-700">Vključi opombe po terminu</span>
                                    <p className="text-xs text-gray-400 mt-0.5">Vključi opombe, ki jih napišete ob zaključku termina.</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSmsOpombePo(!smsOpombePo)}
                                    className={`flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${smsOpombePo ? 'bg-violet-500' : 'bg-gray-200'}`}
                                  >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${smsOpombePo ? 'translate-x-6' : 'translate-x-1'}`} />
                                  </button>
                                </div>

                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0 flex-1">
                                    <span className="text-sm text-gray-700">Vključi navodila za opomnike</span>
                                    <p className="text-xs text-gray-400 mt-0.5">Vpišite spodaj navodila, ki jih AI upošteva pri sestavljanju sporočila po terminu.</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSmsNavodilaPo(!smsNavodilaPo)}
                                    className={`flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${smsNavodilaPo ? 'bg-violet-500' : 'bg-gray-200'}`}
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
                                      placeholder="Npr: Po masaži priporočite, da stranka pije veliko vode. Za storitev 'barvanje las' opomni, naj se izogiba mokrim lasom vsaj 24 ur. Stranki zaželite lep dan in jo povabite k ponovnemu obisku."
                                      className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-300 focus:outline-none resize-none"
                                    />
                                    <div className="flex justify-between items-center">
                                      <p className="text-xs text-gray-400">Navedite poslovne navade, posebne nasvete po določenih storitvah, kaj naj AI omeni ali priporoči, ter kakšen odnos do stranke si želite po obisku.</p>
                                      <p className="text-xs text-gray-400 flex-shrink-0 ml-2">{nastavitvePo.length}/500</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {smsModePo === 'manual' && (
                              <div className="space-y-2">
                                <p className="text-xs text-gray-500">Predloga SMS sporočila (max 155 znakov)</p>
                                <TemplateEditor
                                  value={smsTemplatePo}
                                  onChange={setSmsTemplatePo}
                                  maxLength={155}
                                  placeholder="Npr: Hvala za obisk! Za naslednji termin nas kontaktirajte na {{telefon_podjetja}}."
                                  rows={4}
                                  varLengths={smsVarLengths}
                                />
                                <p className="text-xs text-gray-400">Brez emojijev in posebnih znakov.</p>
                              </div>
                            )}
                          </div>
                        )}

                        {chanelPo === 'email' && (
                          <div className="p-4 bg-gray-50 border-2 border-gray-200 rounded-xl space-y-3">
                            <div className="font-semibold text-gray-900 text-sm">Navodila za opomnik po terminu</div>
                            <p className="text-xs text-gray-500">Dodatna navodila ali informacije za follow-up po terminu</p>
                            <Textarea
                              value={nastavitvePo}
                              onChange={(e) => setNastavitvePo(e.target.value)}
                              rows={5}
                              maxLength={500}
                              placeholder="Npr: Hvala za obisk! Za najboljše rezultate priporočamo uporabo našega specialnega šampona."
                            />
                            <p className="text-xs text-gray-400 text-right">{nastavitvePo.length}/500</p>
                          </div>
                        )}

                        {/* Discount option — hidden when SMS LP (custom template handles its own content) */}
                        {!(chanelPo === 'sms' && smsModePo === 'manual') && (
                          <>
                            <div className="flex items-center justify-between p-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
                              <div>
                                <div className="font-semibold text-gray-900">
                                  Vključi popust v sporočilo
                                </div>
                                <div className="text-sm text-gray-600 mt-1">
                                  Ponudi popust za naslednji obisk
                                </div>
                              </div>
                              <Switch
                                checked={showDiscountField}
                                onChange={setShowDiscountField}
                              />
                            </div>

                            {showDiscountField && (
                              <SettingRow
                                label="Popust / Akcija"
                                description="Opis popusta ki se vključi v sporočilo"
                                fullWidth
                              >
                                <Input
                                  value={popustPo}
                                  onChange={(e) => setPopustPo(e.target.value)}
                                  placeholder="10% popust na naslednji obisk"
                                />
                              </SettingRow>
                            )}
                          </>
                        )}

                        <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                          <div className="font-semibold text-gray-900 mb-1">Čas pošiljanja</div>
                          <div className="text-sm text-gray-700">
                            Fiksno: <strong>Takoj po zaključenem terminu</strong>
                          </div>
                        </div>
                      </>
                    )}
                  </SettingsSection>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <motion.button
                type="button"
                onClick={onClose}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Zapri
              </motion.button>
              <motion.button
                type="button"
                onClick={handleSave}
                disabled={saving || isLoading}
                whileHover={{ scale: saving ? 1 : 1.02 }}
                whileTap={{ scale: saving ? 1 : 0.98 }}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500
                           px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/25
                           transition-shadow hover:shadow-xl hover:shadow-violet-500/30
                           disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                    Shranjujem...
                  </>
                ) : (
                  <>
                    <FloppyDisk className="h-4 w-4" weight="bold" />
                    Shrani
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
