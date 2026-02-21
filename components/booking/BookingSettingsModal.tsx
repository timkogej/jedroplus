'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, SpinnerGap, FloppyDisk, Copy, Check, Lock } from '@phosphor-icons/react';
import {
  SettingsSection,
  SettingRow,
  Switch,
  Input,
  SaveIndicator,
} from '@/components/settings';
import { Select, SelectOption } from '@/components/ui/animated-select';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { loadCompanyRow } from '@/lib/settingsStore';
import { callN8nAction } from '@/src/lib/n8nClient';

interface BookingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BookingSettingsModal({ isOpen, onClose }: BookingSettingsModalProps) {
  const { companyId } = useCompany();
  const { user } = useAuth();

  // Settings from "Podatki podjetij" table
  const [koledarUre, setKoledarUre] = useState<'30' | '60'>('30');
  const [potrdiloReservation, setPotrdiloReservation] = useState(false);
  const [potrdiloOnline, setPotrdiloOnline] = useState(false);
  const [rezervacijeLink, setRezervacijeLink] = useState('');
  const [bookingPrimary, setBookingPrimary] = useState('#7C75FC');
  const [bookingSecondary, setBookingSecondary] = useState('#44D0C6');
  const [bookingBgFrom, setBookingBgFrom] = useState('#7C75FC');
  const [bookingBgTo, setBookingBgTo] = useState('#44D0C6');

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

  // Load settings
  useEffect(() => {
    async function loadSettings() {
      if (!companyId || !isOpen) return;
      setIsLoading(true);

      try {
        const { data } = await loadCompanyRow(companyId);

        if (data) {
          const ureValue = String(data['koledar_ure'] ?? data['Koledar_ure'] ?? '30');
          setKoledarUre(ureValue === '60' ? '60' : '30');

          const potrdiloRez = data['Potrdilo ob rezervaciji'] ?? data['potrdilo_ob_rezervaciji'];
          setPotrdiloReservation(potrdiloRez === 'yes' || potrdiloRez === true || potrdiloRez === 'da');

          const potrdiloOnl = data['Potrdilo online rez'] ?? data['potrdilo_online_rez'];
          setPotrdiloOnline(potrdiloOnl === 'yes' || potrdiloOnl === true || potrdiloOnl === 'da');

          setRezervacijeLink(String(data['rezervacije_link'] ?? data['Rezervacije_link'] ?? ''));
          setBookingPrimary(String(data['Booking_primary'] ?? data['booking_primary'] ?? '#7C75FC'));
          setBookingSecondary(String(data['Booking_secondary'] ?? data['booking_secondary'] ?? '#44D0C6'));
          setBookingBgFrom(String(data['Booking_bg_from'] ?? data['booking_bg_from'] ?? data['Booking_primary'] ?? data['booking_primary'] ?? '#7C75FC'));
          setBookingBgTo(String(data['Booking_bg_to'] ?? data['booking_bg_to'] ?? data['Booking_secondary'] ?? data['booking_secondary'] ?? '#44D0C6'));
        }
      } catch (error) {
        console.error('Error loading booking settings:', error);
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
        event: 'BOOKING_SETTINGS_UPDATED',
        entity: 'settings',
        company_id: companyId,
        actor,
        timestamp: new Date().toISOString(),
        data: {
          'koledar_ure': koledarUre,
          'Potrdilo ob rezervaciji': potrdiloReservation ? 'yes' : 'no',
          'Potrdilo online rez': potrdiloOnline ? 'yes' : 'no',
          'Booking_primary': bookingPrimary,
          'Booking_secondary': bookingSecondary,
          'Booking_bg_from': bookingBgFrom,
          'Booking_bg_to': bookingBgTo,
          colors: {
            primary: bookingPrimary,
            secondary: bookingSecondary,
            bg_from: bookingBgFrom,
            bg_to: bookingBgTo,
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

      await new Promise(resolve => setTimeout(resolve, 1000));
      setLastSaved(new Date());

      // Close modal after 0.8s delay and refresh page
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 800);
    } catch (error) {
      console.error('Error saving booking settings:', error);
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Nastavitve rezervacij</h2>
                <p className="text-sm text-gray-500 mt-0.5">Kako delujejo spletne rezervacije</p>
              </div>
              <div className="flex items-center gap-3">
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
            <div className="flex-1 overflow-y-auto p-6">
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
                  {/* General Booking Settings */}
                  <SettingsSection title="Splošne nastavitve" description="Osnovne nastavitve rezervacij">
                    <SettingRow
                      label="Dolžina časovnega intervala"
                      description="Intervali za rezervacije (30 ali 60 minut)"
                    >
                      <Select
                        value={koledarUre}
                        setValue={(value) => setKoledarUre(value as '30' | '60')}
                        placeholder="Izberi interval"
                      >
                        <SelectOption value="30">30 minut</SelectOption>
                        <SelectOption value="60">60 minut (1 ura)</SelectOption>
                      </Select>
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

                  {/* Booking Page Colors */}
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

                    <SettingRow
                      label="Ozadje gradient (začetek)"
                      description="Začetna barva gradient ozadja (stolpec Booking_bg_from)"
                    >
                      <div className="flex gap-3 items-center">
                        <input
                          type="color"
                          value={bookingBgFrom}
                          onChange={(e) => setBookingBgFrom(e.target.value)}
                          className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
                        />
                        <Input
                          value={bookingBgFrom}
                          onChange={(e) => setBookingBgFrom(e.target.value)}
                          placeholder="#7C75FC"
                          className="w-32"
                        />
                      </div>
                    </SettingRow>

                    <SettingRow
                      label="Ozadje gradient (konec)"
                      description="Končna barva gradient ozadja (stolpec Booking_bg_to)"
                    >
                      <div className="flex gap-3 items-center">
                        <input
                          type="color"
                          value={bookingBgTo}
                          onChange={(e) => setBookingBgTo(e.target.value)}
                          className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
                        />
                        <Input
                          value={bookingBgTo}
                          onChange={(e) => setBookingBgTo(e.target.value)}
                          placeholder="#44D0C6"
                          className="w-32"
                        />
                      </div>
                    </SettingRow>

                    {/* Gradient Preview */}
                    <div className="mt-6">
                      <p className="text-sm font-medium text-gray-700 mb-3">Predogled ozadja:</p>
                      <div
                        className="w-full p-8 rounded-xl border-2 border-gray-200"
                        style={{
                          background: `linear-gradient(135deg, ${bookingBgFrom} 0%, ${bookingBgTo} 100%)`,
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
