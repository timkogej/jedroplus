'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, SpinnerGap, FloppyDisk, Plus, Minus } from '@phosphor-icons/react';
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
import { buildLostLeadsSettingsData, getPodatkiPodjetja } from '@/lib/webhookPayloadBuilders';

interface LostLeadsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LostLeadsSettingsModal({ isOpen, onClose }: LostLeadsSettingsModalProps) {
  const { companyId } = useCompany();
  const { user } = useAuth();

  // Settings from "Podatki podjetij" table
  const [enabled, setEnabled] = useState(false);
  const [inactiveDays, setInactiveDays] = useState(60);
  const [tone, setTone] = useState('prijazen');
  const [instructions, setInstructions] = useState('');
  const [discount, setDiscount] = useState('');
  const [companyRow, setCompanyRow] = useState<Record<string, unknown> | null>(null);

  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const actor = user?.email ?? 'unknown';

  // Helper to check if enabled value is true
  const isEnabledValue = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.toLowerCase();
      if (normalized.includes('omogo') || normalized === 'yes' || normalized === 'da' || normalized === 'true') return true;
      if (normalized.includes('onemogo') || normalized === 'no' || normalized === 'ne' || normalized === 'false') return false;
    }
    return false;
  };

  // Load settings
  useEffect(() => {
    async function loadSettings() {
      if (!companyId || !isOpen) return;
      setIsLoading(true);

      try {
        const { data } = await loadCompanyRow(companyId);
        setCompanyRow(data ?? null);

        if (data) {
          // Map from "Podatki podjetij" table columns
          setEnabled(isEnabledValue(data['Pošiljanje Lost'] ?? data['posiljanje_lost']));

          const casLost = data['Čas LOST LEADS'] ?? data['cas_lost_leads'];
          setInactiveDays(parseInt(String(casLost)) || 60);

          setTone(String(data['Ton komunikacije LOST LEADS'] ?? data['ton_komunikacije_lost_leads'] ?? 'prijazen'));

          setInstructions(String(data['Nastavitve LOST LEADS'] ?? data['NASTAVITVE LOST LEADS'] ?? data['nastavitve_lost_leads'] ?? ''));

          setDiscount(String(data['Popust LOST LEADS'] ?? data['popust_lost_leads'] ?? ''));
        }
      } catch (error) {
        console.error('Error loading lost leads settings:', error);
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
      const companyPayload = getPodatkiPodjetja(companyRow ?? undefined);

      const webhookPayload = {
        event: 'SPREMEMBA_LOST_LEADS',
        entity: 'settings',
        company_id: companyId,
        actor,
        timestamp: new Date().toISOString(),
        data: buildLostLeadsSettingsData({
          companyId,
          userEmail: actor,
          companyProfile: companyPayload,
          nastavitveLostLeads: {
            'Pošiljanje Lost': enabled ? 'Omogočeno' : 'Onemogočeno',
            'Čas LOST LEADS': inactiveDays,
            'Ton komunikacije LOST LEADS': tone,
            'Nastavitve LOST LEADS': instructions,
            'Popust LOST LEADS': discount || 'ni popusta',
            stanje: enabled ? 'Omogočeno' : 'Onemogočeno',
            prag_neaktivnosti_dni: inactiveDays,
            ton_komunikacije: tone,
            navodila_komunikacije: instructions,
            popust: discount ? 'Omogočen' : 'Onemogočen',
            opis_popusta: discount || 'ni popusta',
          },
        }),
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
      console.error('Error saving lost leads settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const adjustDays = (increment: number) => {
    setInactiveDays(prev => Math.max(10, prev + increment));
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
                <h2 className="text-xl font-semibold text-gray-900">Lost Leads nastavitve</h2>
                <p className="text-sm text-gray-500 mt-0.5">Sledenje in ponovno pridobivanje izgubljenih strank</p>
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
                  {[1, 2, 3].map((i) => (
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
                  {/* Enable Lost Leads */}
                  <div className="mb-6 p-6 bg-gradient-to-r from-violet-50 to-cyan-50 border-2 border-violet-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-bold text-gray-900">
                          Omogoči sledenje Lost Leads
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          Avtomatsko zaznavanje in kontaktiranje neaktivnih strank
                        </div>
                      </div>
                      <div className="scale-125">
                        <Switch
                          checked={enabled}
                          onChange={setEnabled}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Detection Settings */}
                  <SettingsSection title="Zaznavanje Lost Leads" description="Kdaj naj sistem zazna neaktivne stranke">
                    <SettingRow
                      label="Neaktivna po"
                      description="Po koliko dneh brez termina je stranka označena kot neaktivna"
                      fullWidth
                    >
                      <div className="flex items-center gap-4">
                        <motion.button
                          type="button"
                          onClick={() => adjustDays(-10)}
                          disabled={inactiveDays <= 10}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex items-center justify-center w-10 h-10 rounded-lg border-2 border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Minus className="h-5 w-5 text-gray-600" weight="bold" />
                        </motion.button>

                        <div className="flex-1">
                          <div className="text-center p-4 bg-white border-2 border-gray-200 rounded-xl">
                            <div className="text-4xl font-bold text-gray-900">
                              {inactiveDays}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">dni</div>
                          </div>
                        </div>

                        <motion.button
                          type="button"
                          onClick={() => adjustDays(10)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex items-center justify-center w-10 h-10 rounded-lg border-2 border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                          <Plus className="h-5 w-5 text-gray-600" weight="bold" />
                        </motion.button>
                      </div>
                      <p className="text-xs text-gray-500 mt-3 text-center">
                        Stranke bodo označene kot neaktivne po {inactiveDays} dneh brez interakcije
                      </p>
                    </SettingRow>
                  </SettingsSection>

                  {/* Communication Instructions */}
                  <SettingsSection title="Navodila za komunikacijo" description="Navodila AI-ju za komunikacijo z neaktivnimi strankami">
                    <SettingRow
                      label="Ton komunikacije"
                      description="Kako naj AI komunicira z neaktivnimi strankami"
                    >
                      <Select
                        value={tone}
                        setValue={setTone}
                        placeholder="Izberi ton"
                      >
                        <SelectOption value="formal">Formalen</SelectOption>
                        <SelectOption value="prijazen">Prijazen</SelectOption>
                        <SelectOption value="sproscen">Sproščen</SelectOption>
                        <SelectOption value="profesionalen">Profesionalen</SelectOption>
                      </Select>
                    </SettingRow>

                    <SettingRow
                      label="Navodila"
                      description="Ta navodila se uporabijo za generiranje personaliziranega sporočila za vsako neaktivno stranko"
                      fullWidth
                    >
                      <Textarea
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        rows={6}
                        maxLength={500}
                        placeholder="Npr: Bodi prijazen in oseben. Omeni koliko časa je minilo od zadnjega obiska. Ponudi možnost rezervacije novega termina. Če je na voljo popust, ga omeni kot posebno ponudbo za zveste stranke."
                        disabled={!enabled}
                      />
                      <p className="text-xs text-gray-400 text-right mt-1">{instructions.length}/500</p>
                    </SettingRow>
                  </SettingsSection>

                  {/* Discount */}
                  <SettingsSection title="Popust za vrnitev" description="Opcijski popust ali posebna ponudba za reaktivacijo strank">
                    <SettingRow
                      label="Popust"
                      description="Opis popusta ali posebne ponudbe (pusti prazno če ne ponujaš popusta)"
                      fullWidth
                    >
                      <Input
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                        maxLength={100}
                        placeholder="Npr.: 15% popust na naslednji obisk"
                        disabled={!enabled}
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        AI bo ta opis vključil v sporočila ko bo komuniciral z neaktivnimi strankami
                      </p>
                    </SettingRow>
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
