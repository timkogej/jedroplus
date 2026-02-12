'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { SpinnerGap, FloppyDisk, Lock } from '@phosphor-icons/react';
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

const SENDING_LANGUAGES = [
  { value: 'sl', label: 'Slovenščina' },
  { value: 'en', label: 'English' },
  { value: 'it', label: 'Italiano' },
  { value: 'de', label: 'Deutsch' },
];

export default function ReminderSettingsPage() {
  const { companyId } = useCompany();
  const { user } = useAuth();

  // Settings from "Podatki podjetij" table
  const [sendingLanguage, setSendingLanguage] = useState('sl');
  const [tonKomunikacije, setTonKomunikacije] = useState('prijazen');
  const [replyTo, setReplyTo] = useState('');
  const [fromName, setFromName] = useState('');
  const fromEmail = 'booking@jedroplus.com'; // FIXED - cannot be changed
  const [chanelPred, setChanelPred] = useState('email');
  const [chanelPo, setChanelPo] = useState('email');
  const [posiljanjePred, setPosiljanjePred] = useState(false);
  const [nastavitvePred, setNastavitvePred] = useState('');
  const [posiljanjePo, setPosiljanjePo] = useState(false);
  const [nastavitvePo, setNastavitvePo] = useState('');
  const [showDiscountField, setShowDiscountField] = useState(false);
  const [popustPo, setPopustPo] = useState('');

  // Brand colors for email templates
  const [brandPrimaryColor, setBrandPrimaryColor] = useState('#7C75FC');
  const [brandSecondaryColor, setBrandSecondaryColor] = useState('#50C3D2');

  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const actor = user?.email ?? 'unknown';

  // Load settings from "Podatki podjetij" table
  useEffect(() => {
    async function loadSettings() {
      if (!companyId) return;
      setIsLoading(true);

      try {
        const { data } = await loadCompanyRow(companyId);

        if (data) {
          // Map from "Podatki podjetij" table columns
          setSendingLanguage(String(data['jezik posiljanja'] ?? data['jezik_posiljanja'] ?? 'sl'));
          setTonKomunikacije(String(data['Ton komunikacije opomikov'] ?? data['ton_komunikacije_opomikov'] ?? 'prijazen'));
          setReplyTo(String(data['reply_to'] ?? data['Reply_to'] ?? ''));
          setFromName(String(data['from_name'] ?? data['From_name'] ?? ''));
          setChanelPred(String(data['chanel_pred'] ?? data['Chanel_pred'] ?? 'email'));
          setChanelPo(String(data['channel_po'] ?? data['Channel_po'] ?? 'email'));

          // Parse boolean/string values
          const posiljanjePredValue = data['Pošiljanje PRED'] ?? data['posiljanje_pred'];
          setPosiljanjePred(posiljanjePredValue === true || posiljanjePredValue === 'yes' || posiljanjePredValue === 'da');

          setNastavitvePred(String(data['Nastavitve PRED'] ?? data['nastavitve_pred'] ?? ''));

          const posiljanjePoValue = data['Pošiljanje PO'] ?? data['posiljanje_po'];
          setPosiljanjePo(posiljanjePoValue === true || posiljanjePoValue === 'yes' || posiljanjePoValue === 'da');

          setNastavitvePo(String(data['Nastavitve PO'] ?? data['nastavitve_po'] ?? ''));

          const popust = data['Popust PO'] ?? data['popust_po'] ?? '';
          const popustStr = String(popust).trim();
          setShowDiscountField(popustStr !== '' && popustStr !== '0');
          setPopustPo(popustStr);

          // Brand colors
          setBrandPrimaryColor(String(data['from_email_primary_color'] ?? data['brand_primary_color'] ?? '#7C75FC'));
          setBrandSecondaryColor(String(data['from_email_secondary_color'] ?? data['brand_secondary_color'] ?? '#50C3D2'));
        }
      } catch (error) {
        console.error('Error loading reminder settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [companyId]);

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
          // Map to "Podatki podjetij" table columns
          'jezik posiljanja': sendingLanguage,
          'Ton komunikacije opomikov': tonKomunikacije,
          'reply_to': replyTo,
          'from_name': fromName,
          'chanel_pred': chanelPred,
          'channel_po': chanelPo,
          'Pošiljanje PRED': posiljanjePred, // true/false instead of yes/no
          'Nastavitve PRED': nastavitvePred,
          'Pošiljanje PO': posiljanjePo, // true/false instead of yes/no
          'Nastavitve PO': nastavitvePo,
          'Poslji popust po': showDiscountField, // true/false instead of yes/no
          'Popust PO': showDiscountField ? popustPo : '',
          // Brand colors for email templates
          'from_email_primary_color': brandPrimaryColor,
          'from_email_secondary_color': brandSecondaryColor,
          // Additional fields for webhook compatibility
          sending_language: sendingLanguage,
          jezik_kratko: sendingLanguage, // Language abbreviation (sl, en, it, de)
          communication_tone: tonKomunikacije,
          reply_to_email: replyTo,
          sender_name: fromName,
          sender_email: fromEmail,
          brand_primary_color: brandPrimaryColor,
          brand_secondary_color: brandSecondaryColor,
          before_appointment: {
            enabled: posiljanjePred,
            channel: chanelPred,
            timing: '1 dan prej', // Fixed
            instructions: nastavitvePred,
          },
          after_appointment: {
            enabled: posiljanjePo,
            channel: chanelPo,
            timing: 'takoj po terminu', // Fixed
            instructions: nastavitvePo,
            send_discount: showDiscountField,
            discount_amount: showDiscountField ? popustPo : null,
          },
        },
      };

      const result = await callN8nAction(webhookPayload);

      if (!result.ok) {
        throw new Error('Napaka pri shranjevanju');
      }

      // Wait 1 second for system to process
      await new Promise(resolve => setTimeout(resolve, 1000));

      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving reminder settings:', error);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-6" />
            <div className="space-y-4">
              <div className="h-10 bg-gray-100 rounded" />
              <div className="h-10 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Nastavitve opomnikov</h2>
          <p className="text-sm text-gray-500 mt-1">Kako in kdaj pošiljati opomnike strankam</p>
        </div>
        <SaveIndicator saving={saving} lastSaved={lastSaved} />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
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
            description="Ime ki se prikaže kot pošiljatelj"
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
            <p className="text-xs text-gray-500">
              Te barve bodo uporabljene v email predlogah za gumbe, povezave in poudarke
            </p>
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
                <Select
                  value={chanelPred}
                  setValue={setChanelPred}
                  placeholder="Izberi način"
                >
                  <SelectOption value="email">Email</SelectOption>
                  <SelectOption value="sms">SMS</SelectOption>
                </Select>
              </SettingRow>

              {/* Fixed timing */}
              <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                <div className="font-semibold text-gray-900 mb-1">Čas pošiljanja opomnika</div>
                <div className="text-sm text-gray-700">
                  Fiksno: <strong>1 dan pred terminom</strong>
                </div>
              </div>

              <SettingRow
                label="Navodila za opomnik"
                description="Dodatna navodila ali informacije za opomnik pred terminom"
                fullWidth
              >
                <Textarea
                  value={nastavitvePred}
                  onChange={(e) => setNastavitvePred(e.target.value)}
                  rows={5}
                  placeholder="Npr: Prosimo pridite 5 minut pred terminom. Parkirišče je na zadnji strani stavbe."
                />
                <p className="text-sm text-gray-600 mt-2">
                  <strong>Namig:</strong> Če imate specifične nasvete za posamezne storitve (npr. priprava pred frizerskim terminom,
                  kaj prinesti na trening itd.), jih vključite tukaj. AI asistent bo upošteval te navodila
                  in jih prilagodil glede na izbrano storitev.
                </p>
              </SettingRow>
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
                <Select
                  value={chanelPo}
                  setValue={setChanelPo}
                  placeholder="Izberi način"
                >
                  <SelectOption value="email">Email</SelectOption>
                  <SelectOption value="sms">SMS</SelectOption>
                </Select>
              </SettingRow>

              {/* Fixed timing */}
              <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                <div className="font-semibold text-gray-900 mb-1">Čas pošiljanja</div>
                <div className="text-sm text-gray-700">
                  Fiksno: <strong>Takoj po zaključenem terminu</strong>
                </div>
              </div>

              <SettingRow
                label="Navodila za opomnik"
                description="Dodatna navodila ali informacije za follow-up po terminu"
                fullWidth
              >
                <Textarea
                  value={nastavitvePo}
                  onChange={(e) => setNastavitvePo(e.target.value)}
                  rows={5}
                  placeholder="Npr: Hvala za obisk! Za najboljše rezultate priporočamo uporabo našega specialnega šampona."
                />
                <p className="text-sm text-gray-600 mt-2">
                  <strong>Namig:</strong> Vključite navodila za nego po storitvi, priporočila za vzdrževanje
                  ali druge koristne nasvete, specifične za posamezne storitve. AI bo ta navodila
                  personaliziral glede na opravljeno storitev.
                </p>
              </SettingRow>

              {/* Discount option */}
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
        </SettingsSection>

        {/* Save Button */}
        <div className="flex justify-end pt-6">
          <motion.button
            type="button"
            onClick={handleSave}
            disabled={saving}
            whileHover={{ scale: saving ? 1 : 1.02 }}
            whileTap={{ scale: saving ? 1 : 0.98 }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500
                       px-6 py-3 text-sm font-medium text-white shadow-lg shadow-violet-500/25
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
                Shrani spremembe
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
