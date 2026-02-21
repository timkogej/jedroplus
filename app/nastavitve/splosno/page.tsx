'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { Copy, Check, Lock } from '@phosphor-icons/react';
import {
  SettingsSection,
  SettingRow,
  Switch,
  Input,
  SaveIndicator,
} from '@/components/settings';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { loadCompanyRow } from '@/lib/settingsStore';
import { sendWebhook, WEBHOOK_EVENTS } from '@/components/utils/webhookUtils';

export default function GeneralSettingsPage() {
  const { companyId } = useCompany();
  const { user } = useAuth();

  // User data from auth
  const [userName, setUserName] = useState('');
  const userEmail = user?.email || '';

  // Company data for ID and Join Code
  const [companyIdDisplay, setCompanyIdDisplay] = useState('');
  const [joinCode, setJoinCode] = useState('');

  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true);

  // Copy states
  const [copiedId, setCopiedId] = useState(false);
  const [copiedJoinCode, setCopiedJoinCode] = useState(false);

  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load settings
  useEffect(() => {
    async function loadSettings() {
      if (!companyId) return;
      setIsLoading(true);

      try {
        // Get user name from auth metadata
        const displayName = user?.user_metadata?.display_name ||
                           user?.user_metadata?.full_name ||
                           user?.email?.split('@')[0] || '';
        setUserName(displayName);

        // Load company data
        const { data } = await loadCompanyRow(companyId);
        if (data) {
          setCompanyIdDisplay(String(data['ID Podjetja'] ?? data['id_podjetja'] ?? companyId));
          setJoinCode(String(data['join_code'] ?? data['Join_code'] ?? ''));
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [companyId, user]);

  // Auto-save with debounce
  const saveSettings = useCallback(async () => {
    if (!companyId) return;
    setSaving(true);

    try {
      await sendWebhook({
        event: WEBHOOK_EVENTS.GENERAL_SETTINGS_UPDATED,
        entity: 'settings',
        company_id: companyId,
        actor: userEmail || 'unknown',
        timestamp: new Date().toISOString(),
        data: {
          section: 'general',
          new_values: {
            userName,
            emailNotifications,
          },
        },
      });

      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  }, [companyId, userEmail, userName, emailNotifications]);

  // Debounced save trigger
  const triggerSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => saveSettings(), 1000);
  }, [saveSettings]);

  // Copy to clipboard
  const copyToClipboard = async (text: string, type: 'id' | 'joinCode') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'id') {
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
      } else {
        setCopiedJoinCode(true);
        setTimeout(() => setCopiedJoinCode(false), 2000);
      }
    } catch (error) {
      console.error('Failed to copy:', error);
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
      {/* Header with save indicator */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Splošne nastavitve</h2>
          <p className="text-sm text-gray-500 mt-1">Osnovne nastavitve aplikacije in vašega računa</p>
        </div>
        <SaveIndicator saving={saving} lastSaved={lastSaved} />
      </div>

      {/* Settings sections */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.1 }}
      >
        {/* Account & Profile */}
        <SettingsSection title="Račun & Profil" description="Vaši osebni podatki">
          <SettingRow
            label="Ime uporabnika"
            description="Ime se ne more spreminjati"
          >
            <div className="flex items-center gap-3">
              <Input
                value={userName}
                disabled
                className="bg-gray-50 cursor-not-allowed"
              />
              <div className="flex items-center gap-1 text-gray-400">
                <Lock className="h-4 w-4" weight="bold" />
              </div>
            </div>
          </SettingRow>

          <SettingRow
            label="Email"
            description="Email se ne more spreminjati"
          >
            <div className="flex items-center gap-3">
              <Input
                type="email"
                value={userEmail}
                disabled
                className="bg-gray-50 cursor-not-allowed"
              />
              <div className="flex items-center gap-1 text-gray-400">
                <Lock className="h-4 w-4" weight="bold" />
              </div>
            </div>
          </SettingRow>
        </SettingsSection>

        {/* Language & Region - Fixed/Locked */}
        <SettingsSection title="Jezik & Regija" description="Lokalne nastavitve (zaklenjene)">
          <SettingRow
            label="Jezik aplikacije"
            description="Trenutno samo slovenščina"
          >
            <div className="flex items-center gap-3">
              <Input
                value="Slovenščina"
                disabled
                className="bg-gray-50 cursor-not-allowed"
              />
              <div className="flex items-center gap-1 text-gray-400">
                <Lock className="h-4 w-4" weight="bold" />
              </div>
            </div>
          </SettingRow>

          <SettingRow
            label="Regija"
            description="Vaša geografska lokacija"
          >
            <div className="flex items-center gap-3">
              <Input
                value="Ljubljana, SI"
                disabled
                className="bg-gray-50 cursor-not-allowed"
              />
              <div className="flex items-center gap-1 text-gray-400">
                <Lock className="h-4 w-4" weight="bold" />
              </div>
            </div>
          </SettingRow>

          <SettingRow
            label="Časovni pas"
            description="Vaš lokalni časovni pas"
          >
            <div className="flex items-center gap-3">
              <Input
                value="MT+1"
                disabled
                className="bg-gray-50 cursor-not-allowed"
              />
              <div className="flex items-center gap-1 text-gray-400">
                <Lock className="h-4 w-4" weight="bold" />
              </div>
            </div>
          </SettingRow>

          <SettingRow
            label="Format datuma"
            description="Kako se prikazujejo datumi"
          >
            <div className="flex items-center gap-3">
              <Input
                value="dd.mm.yyyy"
                disabled
                className="bg-gray-50 cursor-not-allowed"
              />
              <div className="flex items-center gap-1 text-gray-400">
                <Lock className="h-4 w-4" weight="bold" />
              </div>
            </div>
          </SettingRow>
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection title="Obvestila" description="Nastavitve obvestil">
          <SettingRow
            label="Email obvestila"
            description="Prejemaj obvestila na email"
          >
            <Switch
              checked={emailNotifications}
              onChange={(checked) => {
                setEmailNotifications(checked);
                triggerSave();
              }}
            />
          </SettingRow>

        </SettingsSection>

        {/* Company ID & Codes - New Section with Gradient */}
        <SettingsSection title="Podatki podjetja" description="ID podjetja in kode za dodajanje uporabnikov">
          <div className="relative p-[2px] rounded-xl bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500">
            <div className="bg-white rounded-xl p-6 space-y-6">
              {/* Company ID */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-1">ID podjetja</p>
                  <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
                    {companyIdDisplay || companyId}
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => copyToClipboard(companyIdDisplay || companyId || '', 'id')}
                  className="p-2 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {copiedId ? (
                    <Check className="w-5 h-5 text-green-500" weight="bold" />
                  ) : (
                    <Copy className="w-5 h-5 text-gray-500" />
                  )}
                </motion.button>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200" />

              {/* Admin Code */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-1">Admin code</p>
                  <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
                    {joinCode || '—'}
                  </div>
                </div>
                {joinCode && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => copyToClipboard(joinCode, 'joinCode')}
                    className="p-2 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {copiedJoinCode ? (
                      <Check className="w-5 h-5 text-green-500" weight="bold" />
                    ) : (
                      <Copy className="w-5 h-5 text-gray-500" />
                    )}
                  </motion.button>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200" />

              {/* Employee Code */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-1">Employee code</p>
                  <div className="text-2xl font-bold text-gray-300">
                    —
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200" />

              {/* Explanation */}
              <div className="text-sm text-gray-600">
                <strong>Admin code</strong> je za dodajanje administratorjev v vaše podjetje.
                <strong> Employee code</strong> pa je za dodajanje zaposlenih.
              </div>
            </div>
          </div>
        </SettingsSection>
      </motion.div>
    </div>
  );
}
