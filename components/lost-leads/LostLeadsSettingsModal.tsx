'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, SpinnerGap, FloppyDisk, Plus, Minus } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
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
import { sheet } from '@/components/ui/sheetClasses';
import { loadCompanyRow } from '@/lib/settingsStore';
import { callN8nAction } from '@/src/lib/n8nClient';
import { buildLostLeadsSettingsData, getPodatkiPodjetja } from '@/lib/webhookPayloadBuilders';

interface LostLeadsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LostLeadsSettingsModal({ isOpen, onClose }: LostLeadsSettingsModalProps) {
  const t = useTranslations('lost-leads');
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
          className={sheet.backdrop}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`${sheet.panel} sm:max-w-3xl`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={sheet.header}>
              <div className={sheet.grabber} aria-hidden="true" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className={`${sheet.title} truncate`}>{t('modal.title')}</h2>
                  <p className={`${sheet.subtitle} truncate`}>{t('modal.subtitle')}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <SaveIndicator saving={saving} lastSaved={lastSaved} />
                  <button
                    onClick={onClose}
                    className={sheet.close}
                  >
                    <X className="h-5 w-5" weight="regular" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {isLoading ? (
                <div className="space-y-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-xl p-6 animate-pulse">
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
                  <div className="mb-7 rounded-xl border border-gray-100 bg-white px-4 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold text-gray-900">
                          {t('modal.enableTitle')}
                        </div>
                        <div className="mt-0.5 text-sm text-gray-500">
                          {t('modal.enableDesc')}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <Switch
                          checked={enabled}
                          onChange={setEnabled}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Detection Settings */}
                  <SettingsSection
                    title={t('modal.detection.sectionTitle')}
                    description={t('modal.detection.sectionDesc')}
                  >
                    <SettingRow
                      label={t('modal.detection.inactiveAfterLabel')}
                      description={t('modal.detection.inactiveAfterDesc')}
                      fullWidth
                    >
                      <div className="flex items-center gap-4">
                        <motion.button
                          type="button"
                          onClick={() => adjustDays(-10)}
                          disabled={inactiveDays <= 10}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Minus className="h-4 w-4 text-gray-900" weight="bold" />
                        </motion.button>

                        <div className="flex-1">
                          <div className="text-center">
                            <div className="tnum text-4xl font-semibold tracking-tight text-gray-900">
                              {inactiveDays}
                            </div>
                            <div className="mt-0.5 text-[13px] text-gray-500">{t('modal.detection.daysLabel')}</div>
                          </div>
                        </div>

                        <motion.button
                          type="button"
                          onClick={() => adjustDays(10)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200"
                        >
                          <Plus className="h-4 w-4 text-gray-900" weight="bold" />
                        </motion.button>
                      </div>
                      <p className="text-xs text-gray-500 mt-3 text-center">
                        {t('modal.detection.inactiveDaysHint', { count: inactiveDays })}
                      </p>
                    </SettingRow>
                  </SettingsSection>

                  {/* Communication Instructions */}
                  <SettingsSection
                    title={t('modal.communication.sectionTitle')}
                    description={t('modal.communication.sectionDesc')}
                  >
                    <SettingRow
                      label={t('modal.communication.toneLabel')}
                      description={t('modal.communication.toneDesc')}
                    >
                      <Select
                        value={tone}
                        setValue={setTone}
                        placeholder={t('modal.communication.tonePlaceholder')}
                      >
                        <SelectOption value="formal">{t('modal.communication.toneOptions.formal')}</SelectOption>
                        <SelectOption value="prijazen">{t('modal.communication.toneOptions.friendly')}</SelectOption>
                        <SelectOption value="sproscen">{t('modal.communication.toneOptions.relaxed')}</SelectOption>
                        <SelectOption value="profesionalen">{t('modal.communication.toneOptions.professional')}</SelectOption>
                      </Select>
                    </SettingRow>

                    <SettingRow
                      label={t('modal.communication.instructionsLabel')}
                      description={t('modal.communication.instructionsDesc')}
                      fullWidth
                    >
                      <Textarea
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        rows={6}
                        maxLength={500}
                        placeholder={t('modal.communication.instructionsPlaceholder')}
                        disabled={!enabled}
                      />
                      <p className="text-xs text-gray-400 text-right mt-1">{instructions.length}/500</p>
                    </SettingRow>
                  </SettingsSection>

                  {/* Discount */}
                  <SettingsSection
                    title={t('modal.discount.sectionTitle')}
                    description={t('modal.discount.sectionDesc')}
                  >
                    <SettingRow
                      label={t('modal.discount.label')}
                      description={t('modal.discount.fieldDesc')}
                      fullWidth
                    >
                      <Input
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                        maxLength={100}
                        placeholder={t('modal.discount.placeholder')}
                        disabled={!enabled}
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        {t('modal.discount.aiHint')}
                      </p>
                    </SettingRow>
                  </SettingsSection>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className={sheet.footer}>
              <motion.button
                type="button"
                onClick={onClose}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={sheet.cancel}
              >
                {t('modal.closeButton')}
              </motion.button>
              <motion.button
                type="button"
                onClick={handleSave}
                disabled={saving || isLoading}
                whileHover={{ scale: saving ? 1 : 1.02 }}
                whileTap={{ scale: saving ? 1 : 0.98 }}
                className={`${sheet.action} bg-gradient-to-r from-violet-500 to-cyan-500 disabled:cursor-not-allowed disabled:opacity-50`}
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
