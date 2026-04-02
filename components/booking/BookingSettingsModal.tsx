'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, SpinnerGap, FloppyDisk, EnvelopeSimple, DeviceMobile, ArrowRight } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
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

// ── Channel picker (SMS / Email) ─────────────────────────────────────────────

function ChannelPicker({
  value,
  onChange,
  smsLocked = false,
  onUpgradeClick,
}: {
  value: 'sms' | 'email';
  onChange: (v: 'sms' | 'email') => void;
  smsLocked?: boolean;
  onUpgradeClick?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 mt-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange('email')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all
                     ${value === 'email'
                       ? 'bg-violet-50 border-violet-300 text-violet-700 ring-1 ring-violet-200'
                       : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                     }`}
        >
          <EnvelopeSimple className="h-4 w-4" weight={value === 'email' ? 'fill' : 'regular'} />
          Email
        </button>
        {smsLocked ? (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed text-sm font-medium">
            <DeviceMobile className="h-4 w-4" weight="regular" />
            SMS
            <span className="text-xs text-gray-400">– ni dostopno</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onChange('sms')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all
                       ${value === 'sms'
                         ? 'bg-violet-50 border-violet-300 text-violet-700 ring-1 ring-violet-200'
                         : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                       }`}
          >
            <DeviceMobile className="h-4 w-4" weight={value === 'sms' ? 'fill' : 'regular'} />
            SMS
          </button>
        )}
      </div>
      {smsLocked && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">SMS je na voljo v višjih paketih.</span>
          <button
            type="button"
            onClick={onUpgradeClick}
            className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 underline underline-offset-2"
          >
            Nadgradi paket <ArrowRight className="h-3 w-3" weight="bold" />
          </button>
        </div>
      )}
    </div>
  );
}

export function BookingSettingsModal({ isOpen, onClose }: BookingSettingsModalProps) {
  const { companyId, planCode } = useCompany();
  const { user } = useAuth();
  const router = useRouter();
  const smsLockedForPlan = planCode === 'JEDRO_PLUS';

  // Settings from "Podatki podjetij" table
  const [bookingOmogocen, setBookingOmogocen] = useState(true);
  const [koledarUre, setKoledarUre] = useState<'15' | '30' | '60'>('30');
  const [potrdiloReservation, setPotrdiloReservation] = useState(false);
  const [potrdiloChannel, setPotrdiloChannel] = useState<'sms' | 'email'>('email');
  const [potrdiloOnline, setPotrdiloOnline] = useState(false);
  const [potrdiloOnlineChannel, setPotrdiloOnlineChannel] = useState<'sms' | 'email'>('email');
  const [bookingPrimary, setBookingPrimary] = useState('#7C75FC');
  const [bookingSecondary, setBookingSecondary] = useState('#44D0C6');
  const [bookingBgFrom, setBookingBgFrom] = useState('#7C75FC');
  const [bookingBgTo, setBookingBgTo] = useState('#44D0C6');

  const [cancelApptDays, setCancelApptDays] = useState('1');
  const [rescheduleApptDays, setRescheduleApptDays] = useState('1');

  // Booking links (for main link selector)
  const [bookingLink1, setBookingLink1] = useState('');
  const [bookingLink2, setBookingLink2] = useState('');
  const [bookingLink3, setBookingLink3] = useState('');
  const [bookingLink4, setBookingLink4] = useState('');
  const [bookingLink5, setBookingLink5] = useState('');
  const [mainBookingLink, setMainBookingLink] = useState('');

  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const actor = user?.email ?? 'unknown';

  // Load settings
  useEffect(() => {
    async function loadSettings() {
      if (!companyId || !isOpen) return;
      setIsLoading(true);

      try {
        const { data } = await loadCompanyRow(companyId);

        if (data) {
          const bookingEnabled = data['booking_omogocen'];
          setBookingOmogocen(bookingEnabled !== false && bookingEnabled !== 'false');

          const ureValue = String(data['koledar_ure'] ?? data['Koledar_ure'] ?? '30');
          setKoledarUre(ureValue === '60' ? '60' : ureValue === '15' ? '15' : '30');

          const potrdiloRez = data['Potrdilo po rezervaciji'] ?? data['Potrdilo ob rezervaciji'];
          setPotrdiloReservation(potrdiloRez === true || potrdiloRez === 'true' || potrdiloRez === 'yes' || potrdiloRez === 'da');

          // Read potrdilo_channel
          const ch = String(data['potrdilo_channel'] ?? 'email').toLowerCase();
          setPotrdiloChannel(ch === 'sms' ? 'sms' : 'email');

          const potrdiloOnl = data['Potrdilo online termina'] ?? data['Potrdilo online rez'];
          setPotrdiloOnline(potrdiloOnl === true || potrdiloOnl === 'true' || potrdiloOnl === 'yes' || potrdiloOnl === 'da');

          // Read potrdilo_online_channel
          const onlCh = String(data['potrdilo_online_channel'] ?? 'email').toLowerCase();
          setPotrdiloOnlineChannel(onlCh === 'sms' ? 'sms' : 'email');

          setBookingPrimary(String(data['Booking_primary'] ?? data['booking_primary'] ?? '#7C75FC'));
          setBookingSecondary(String(data['Booking_secondary'] ?? data['booking_secondary'] ?? '#44D0C6'));
          setBookingBgFrom(String(data['Booking_bg_from'] ?? data['booking_bg_from'] ?? data['Booking_primary'] ?? data['booking_primary'] ?? '#7C75FC'));
          setBookingBgTo(String(data['Booking_bg_to'] ?? data['booking_bg_to'] ?? data['Booking_secondary'] ?? data['booking_secondary'] ?? '#44D0C6'));

          const bl1 = String(data['booking_link_1'] ?? data['Booking_link_1'] ?? '');
          const bl2 = String(data['booking_link_2'] ?? data['Booking_link_2'] ?? '');
          const bl3 = String(data['booking_link_3'] ?? data['Booking_link_3'] ?? '');
          const bl4 = String(data['booking_link_4'] ?? data['Booking_link_4'] ?? '');
          const bl5 = String(data['booking_link_5'] ?? data['Booking_link_5'] ?? '');
          setBookingLink1(bl1);
          setBookingLink2(bl2);
          setBookingLink3(bl3);
          setBookingLink4(bl4);
          setBookingLink5(bl5);
          setMainBookingLink(String(data['main_booking_link'] ?? ''));

          setCancelApptDays(String(data['cancel_appt_days'] ?? '1'));
          setRescheduleApptDays(String(data['reschedule_appt_days'] ?? '1'));
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
          'booking_omogocen': bookingOmogocen,
          'koledar_ure': koledarUre,
          'Potrdilo po rezervaciji': potrdiloReservation ? 'true' : 'false',
          'Potrdilo ob rezervaciji': potrdiloReservation ? 'true' : 'false',
          'potrdilo_channel': potrdiloChannel,
          'Potrdilo online termina': potrdiloOnline ? 'true' : 'false',
          'Potrdilo online rez': potrdiloOnline ? 'true' : 'false',
          'potrdilo_online_channel': potrdiloOnlineChannel,
          'Booking_primary': bookingPrimary,
          'Booking_secondary': bookingSecondary,
          'Booking_bg_from': bookingBgFrom,
          'Booking_bg_to': bookingBgTo,
          'main_booking_link': mainBookingLink,
          colors: {
            primary: bookingPrimary,
            secondary: bookingSecondary,
            bg_from: bookingBgFrom,
            bg_to: bookingBgTo,
          },
          time_slot_duration: koledarUre,
          send_confirmation: potrdiloReservation,
          confirmation_channel: potrdiloChannel,
          send_online_confirmation: potrdiloOnline,
          online_confirmation_channel: potrdiloOnlineChannel,
          cancel_appt_days: parseInt(cancelApptDays, 10),
          reschedule_appt_days: parseInt(rescheduleApptDays, 10),
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
                      label="Omogoči spletne rezervacije"
                      description="Ali so spletne rezervacije aktivne"
                    >
                      <Switch
                        checked={bookingOmogocen}
                        onChange={setBookingOmogocen}
                      />
                    </SettingRow>

                    <SettingRow
                      label="Dolžina časovnega intervala"
                      description="Intervali za rezervacije (15, 30 ali 60 minut)"
                    >
                      <Select
                        value={koledarUre}
                        setValue={(value) => setKoledarUre(value as '15' | '30' | '60')}
                        placeholder="Izberi interval"
                      >
                        <SelectOption value="15">15 minut</SelectOption>
                        <SelectOption value="30">30 minut</SelectOption>
                        <SelectOption value="60">60 minut (1 ura)</SelectOption>
                      </Select>
                    </SettingRow>
                  </SettingsSection>

                  {/* Main Booking Link */}
                  <SettingsSection title="Glavni booking link" description="Link, ki se uporablja pri pošiljanju strankam">
                    <SettingRow
                      label="Izberi glavni booking link"
                      description="Ta link se bo uporabljal pri pošiljanju rezervacij strankam"
                    >
                      <Select
                        value={mainBookingLink}
                        setValue={setMainBookingLink}
                        placeholder="Izberi link..."
                      >
                        {bookingLink1 && <SelectOption value={bookingLink1}>Klasičen</SelectOption>}
                        {bookingLink2 && <SelectOption value={bookingLink2}>Moderen</SelectOption>}
                        {bookingLink3 && <SelectOption value={bookingLink3}>Minimalen</SelectOption>}
                        {bookingLink4 && <SelectOption value={bookingLink4}>Sezonsko</SelectOption>}
                        {bookingLink5 && <SelectOption value={bookingLink5}>Magazine</SelectOption>}
                      </Select>
                    </SettingRow>
                    {mainBookingLink && (
                      <div className="px-4 pb-3">
                        <p className="text-xs text-gray-500 mt-1 break-all">{mainBookingLink}</p>
                      </div>
                    )}
                  </SettingsSection>

                  {/* Confirmation Settings */}
                  <SettingsSection title="Potrdila" description="Pošiljanje potrdil strankam">
                    {/* Confirmation on manual booking */}
                    <div className="space-y-1">
                      <SettingRow
                        label="Pošlji potrdilo ob rezervaciji termina"
                        description="Avtomatsko pošlji potrdilo ob kreaciji termina"
                      >
                        <Switch
                          checked={potrdiloReservation}
                          onChange={setPotrdiloReservation}
                        />
                      </SettingRow>
                      {potrdiloReservation && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-4 pb-3"
                        >
                          <p className="text-xs font-medium text-gray-500 mb-2">Pošlji potrdilo preko:</p>
                          {smsLockedForPlan && (
                            <p className="text-xs text-gray-500 mb-1">
                              Za pošiljanje SMS potrdil{' '}
                              <button
                                type="button"
                                onClick={() => { onClose(); router.push('/billing'); }}
                                className="font-semibold text-violet-600 hover:text-violet-800 underline underline-offset-2"
                              >
                                nadgradite paket
                              </button>
                              .
                            </p>
                          )}
                          <ChannelPicker
                            value={potrdiloChannel}
                            onChange={setPotrdiloChannel}
                            smsLocked={smsLockedForPlan}
                            onUpgradeClick={() => { onClose(); router.push('/billing'); }}
                          />
                        </motion.div>
                      )}
                    </div>

                    {/* Confirmation on online booking */}
                    <div className="space-y-1">
                      <SettingRow
                        label="Pošlji potrdilo po online rezervaciji"
                        description="Potrdilo ob rezervaciji preko spletnega sistema"
                      >
                        <Switch
                          checked={potrdiloOnline}
                          onChange={setPotrdiloOnline}
                        />
                      </SettingRow>
                      {potrdiloOnline && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-4 pb-3"
                        >
                          <p className="text-xs font-medium text-gray-500 mb-2">Pošlji potrdilo preko:</p>
                          {smsLockedForPlan && (
                            <p className="text-xs text-gray-500 mb-1">
                              Za pošiljanje SMS potrdil{' '}
                              <button
                                type="button"
                                onClick={() => { onClose(); router.push('/billing'); }}
                                className="font-semibold text-violet-600 hover:text-violet-800 underline underline-offset-2"
                              >
                                nadgradite paket
                              </button>
                              .
                            </p>
                          )}
                          <ChannelPicker
                            value={potrdiloOnlineChannel}
                            onChange={setPotrdiloOnlineChannel}
                            smsLocked={smsLockedForPlan}
                            onUpgradeClick={() => { onClose(); router.push('/billing'); }}
                          />
                        </motion.div>
                      )}
                    </div>
                  </SettingsSection>

                  {/* Cancellation & Rescheduling Policy */}
                  <SettingsSection title="Politika odpovedi in prestavitev" description="Koliko dni pred terminom lahko stranke odpovejo ali prestavijo">
                    <SettingRow
                      label="Odpoved termina"
                      description="Koliko dni pred terminom lahko stranka odpove"
                    >
                      <Select
                        value={cancelApptDays}
                        setValue={setCancelApptDays}
                        placeholder="Izberi"
                      >
                        <SelectOption value="0">Isti dan</SelectOption>
                        <SelectOption value="1">1 dan prej</SelectOption>
                        <SelectOption value="2">2 dni prej</SelectOption>
                        <SelectOption value="3">3 dni prej</SelectOption>
                        <SelectOption value="5">5 dni prej</SelectOption>
                        <SelectOption value="7">7 dni prej</SelectOption>
                        <SelectOption value="14">14 dni prej</SelectOption>
                      </Select>
                    </SettingRow>

                    <SettingRow
                      label="Prestavitev termina"
                      description="Koliko dni pred terminom lahko stranka prestavi"
                    >
                      <Select
                        value={rescheduleApptDays}
                        setValue={setRescheduleApptDays}
                        placeholder="Izberi"
                      >
                        <SelectOption value="0">Isti dan</SelectOption>
                        <SelectOption value="1">1 dan prej</SelectOption>
                        <SelectOption value="2">2 dni prej</SelectOption>
                        <SelectOption value="3">3 dni prej</SelectOption>
                        <SelectOption value="5">5 dni prej</SelectOption>
                        <SelectOption value="7">7 dni prej</SelectOption>
                        <SelectOption value="14">14 dni prej</SelectOption>
                      </Select>
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
