'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { SpinnerGap, FloppyDisk, Copy, Check, Lock } from '@phosphor-icons/react';
import {
  SettingsSection,
  SettingRow,
  Switch,
  Input,
  Select,
  SaveIndicator,
} from '@/components/settings';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { loadCompanyRow } from '@/lib/settingsStore';
import { callN8nAction } from '@/src/lib/n8nClient';

export default function BookingSettingsPage() {
  const { companyId } = useCompany();
  const { user } = useAuth();

  // Settings from "Podatki podjetij" table
  const [koledarUre, setKoledarUre] = useState<'30' | '60'>('30');
  const [potrdiloReservation, setPotrdiloReservation] = useState(false);
  const [potrdiloOnline, setPotrdiloOnline] = useState(false);
  const [rezervacijeLink, setRezervacijeLink] = useState('');
  const [bookingPrimary, setBookingPrimary] = useState('#7C75FC');
  const [bookingSecondary, setBookingSecondary] = useState('#44D0C6');

  const [copiedLink, setCopiedLink] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const actor = user?.email ?? 'unknown';

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Load settings from "Podatki podjetij" table
  useEffect(() => {
    async function loadSettings() {
      if (!companyId) return;
      setIsLoading(true);

      try {
        const { data } = await loadCompanyRow(companyId);

        if (data) {
          // Map from "Podatki podjetij" table columns
          const ureValue = String(data['koledar_ure'] ?? data['Koledar_ure'] ?? '30');
          // Only allow 30 or 60
          setKoledarUre(ureValue === '60' ? '60' : '30');

          // Parse yes/no values
          const potrdiloRez = data['Potrdilo ob rezervaciji'] ?? data['potrdilo_ob_rezervaciji'];
          setPotrdiloReservation(potrdiloRez === 'yes' || potrdiloRez === true || potrdiloRez === 'da');

          const potrdiloOnl = data['Potrdilo online rez'] ?? data['potrdilo_online_rez'];
          setPotrdiloOnline(potrdiloOnl === 'yes' || potrdiloOnl === true || potrdiloOnl === 'da');

          setRezervacijeLink(String(data['rezervacije_link'] ?? data['Rezervacije_link'] ?? ''));
          setBookingPrimary(String(data['Booking_primary'] ?? data['booking_primary'] ?? '#7C75FC'));
          setBookingSecondary(String(data['Booking_secondary'] ?? data['booking_secondary'] ?? '#44D0C6'));
        }
      } catch (error) {
        console.error('Error loading booking settings:', error);
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
        event: 'BOOKING_SETTINGS_UPDATED',
        entity: 'settings',
        company_id: companyId,
        actor,
        timestamp: new Date().toISOString(),
        data: {
          // Map to "Podatki podjetij" table columns
          'koledar_ure': koledarUre,
          'Potrdilo ob rezervaciji': potrdiloReservation ? 'yes' : 'no',
          'Potrdilo online rez': potrdiloOnline ? 'yes' : 'no',
          'Booking_primary': bookingPrimary,
          'Booking_secondary': bookingSecondary,
          // Additional fields for webhook compatibility
          colors: {
            primary: bookingPrimary,
            secondary: bookingSecondary,
          },
          time_slot_duration: koledarUre,
          send_confirmation: potrdiloReservation,
          send_online_confirmation: potrdiloOnline,
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
      console.error('Error saving booking settings:', error);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4, 5].map((i) => (
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
          <h2 className="text-xl font-semibold text-gray-900">Nastavitve rezervacij</h2>
          <p className="text-sm text-gray-500 mt-1">Kako delujejo spletne rezervacije</p>
        </div>
        <SaveIndicator saving={saving} lastSaved={lastSaved} />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* General Booking Settings */}
        <SettingsSection title="Splošne nastavitve" description="Osnovne nastavitve rezervacij">
          <SettingRow
            label="Dolžina časovnega intervala"
            description="Intervali za rezervacije (30 ali 60 minut)"
          >
            <Select
              value={koledarUre}
              onChange={(value) => setKoledarUre(value as '30' | '60')}
              options={[
                { value: '30', label: '30 minut' },
                { value: '60', label: '60 minut (1 ura)' },
              ]}
            />
          </SettingRow>
        </SettingsSection>

        {/* Confirmation Settings */}
        <SettingsSection title="Potrdila" description="Pošiljanje potrdil strankam">
          <SettingRow
            label="Pošlji potrdilo stranki"
            description="Avtomatsko pošlji email potrdilo ob kreaciji termina"
          >
            <Switch
              checked={potrdiloReservation}
              onChange={setPotrdiloReservation}
            />
          </SettingRow>

          <SettingRow
            label="Pošlji potrdilo po spletni rezervaciji"
            description="Potrdilo ob rezervaciji preko spletnega sistema"
          >
            <Switch
              checked={potrdiloOnline}
              onChange={setPotrdiloOnline}
            />
          </SettingRow>
        </SettingsSection>

        {/* Booking URL - LOCKED */}
        <SettingsSection title="Spletne rezervacije" description="Povezava do vaše rezervacijske strani">
          <SettingRow
            label="Link za spletne rezervacije"
            description="Ta povezava je zaklenjena in se ne more spreminjati"
            fullWidth
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1">
                <Input
                  type="url"
                  value={rezervacijeLink || 'Ni konfiguriranega linka'}
                  disabled
                  className="flex-1 bg-gray-50 cursor-not-allowed"
                />
                <div className="flex items-center gap-1 text-gray-400">
                  <Lock className="h-4 w-4" weight="bold" />
                </div>
              </div>
              {rezervacijeLink && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => copyToClipboard(rezervacijeLink)}
                  className="p-2 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {copiedLink ? (
                    <Check className="w-5 h-5 text-green-500" weight="bold" />
                  ) : (
                    <Copy className="w-5 h-5 text-gray-500" />
                  )}
                </motion.button>
              )}
            </div>
          </SettingRow>
        </SettingsSection>

        {/* Booking Page Colors - Simplified */}
        <SettingsSection title="Barve rezervacijske strani" description="Prilagodite videz vaše rezervacijske strani">
          <SettingRow
            label="Primarna barva"
            description="Glavna barva za gumbe in akcente"
          >
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={bookingPrimary}
                onChange={(e) => setBookingPrimary(e.target.value)}
                className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
              />
              <Input
                value={bookingPrimary}
                onChange={(e) => setBookingPrimary(e.target.value)}
                placeholder="#7C75FC"
                className="w-32"
              />
            </div>
          </SettingRow>

          <SettingRow
            label="Sekundarna barva"
            description="Barva za dodatne elemente"
          >
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={bookingSecondary}
                onChange={(e) => setBookingSecondary(e.target.value)}
                className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
              />
              <Input
                value={bookingSecondary}
                onChange={(e) => setBookingSecondary(e.target.value)}
                placeholder="#44D0C6"
                className="w-32"
              />
            </div>
          </SettingRow>

          {/* Gradient Preview */}
          <div className="mt-6">
            <p className="text-sm font-medium text-gray-700 mb-3">Predogled:</p>
            <div
              className="w-full p-8 rounded-xl border-2 border-gray-200"
              style={{
                background: `linear-gradient(135deg, ${bookingPrimary}20 0%, ${bookingSecondary}20 100%)`,
              }}
            >
              <div className="text-center">
                <div
                  className="inline-block px-6 py-3 rounded-xl font-semibold text-white shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${bookingPrimary} 0%, ${bookingSecondary} 100%)`,
                  }}
                >
                  Predogled gumba
                </div>
              </div>
            </div>
          </div>
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
