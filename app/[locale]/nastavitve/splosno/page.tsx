'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { CaretLeft, Copy, Check, Lock } from '@phosphor-icons/react';
import { QRCodeCard } from '@/components/qr/QRCodeCard';
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
import { supabaseReadOnly } from '@/src/lib/supabaseReadOnly';

export default function GeneralSettingsPage() {
  const { companyId } = useCompany();
  const { user } = useAuth();

  // User data from auth
  const [userName, setUserName] = useState('');
  const userEmail = user?.email || '';

  // Company data for ID and Join Codes
  const [companyIdDisplay, setCompanyIdDisplay] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [staffCode, setStaffCode] = useState('');
  const [companySlug, setCompanySlug] = useState('');

  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true);

  // Copy states
  const [copiedId, setCopiedId] = useState(false);
  const [copiedAdminCode, setCopiedAdminCode] = useState(false);
  const [copiedStaffCode, setCopiedStaffCode] = useState(false);

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
        }

        // Load join codes and slug from companies table
        const { data: companyRow } = await supabaseReadOnly
          .from('companies')
          .select('slug, join_code_admin, join_code_staff')
          .eq('company_id', companyId)
          .maybeSingle();
        if (companyRow) {
          if (companyRow.slug) setCompanySlug(String(companyRow.slug));
          if (companyRow.join_code_admin) setAdminCode(String(companyRow.join_code_admin));
          if (companyRow.join_code_staff) setStaffCode(String(companyRow.join_code_staff));
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
  const copyToClipboard = async (text: string, type: 'id' | 'adminCode' | 'staffCode') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'id') {
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
      } else if (type === 'adminCode') {
        setCopiedAdminCode(true);
        setTimeout(() => setCopiedAdminCode(false), 2000);
      } else {
        setCopiedStaffCode(true);
        setTimeout(() => setCopiedStaffCode(false), 2000);
      }
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-[#6D5EF7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/nastavitve"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-4"
      >
        <CaretLeft className="w-3.5 h-3.5" weight="regular" />
        Nastavitve
      </Link>

      {/* Header with save indicator */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Splošno</h1>
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
                <Lock className="w-3.5 h-3.5" weight="bold" />
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
                <Lock className="w-3.5 h-3.5" weight="bold" />
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
                <Lock className="w-3.5 h-3.5" weight="bold" />
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
                <Lock className="w-3.5 h-3.5" weight="bold" />
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
                <Lock className="w-3.5 h-3.5" weight="bold" />
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
                <Lock className="w-3.5 h-3.5" weight="bold" />
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
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
              {/* Company ID */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 mb-1">ID podjetja</p>
                  <div className="text-2xl font-bold gradient-text tracking-tight">
                    {companyIdDisplay || companyId}
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => copyToClipboard(companyIdDisplay || companyId || '', 'id')}
                  className="p-2 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  {copiedId ? (
                    <Check className="w-4 h-4 text-gray-900" weight="bold" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-500" />
                  )}
                </motion.button>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* Admin Code */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900 mb-0.5">Admin code</p>
                  <p className="text-xs text-gray-500 mb-2">Za dodajanje administratorjev v vaše podjetje. Administrator ima popoln dostop: vidi in ureja vse termine, stranke, storitve, osebje, analitiko, nastavitve in pakete.</p>
                  <div className="text-2xl font-bold gradient-text tracking-tight">
                    {adminCode || '—'}
                  </div>
                </div>
                {adminCode && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => copyToClipboard(adminCode, 'adminCode')}
                    className="p-2 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    {copiedAdminCode ? (
                      <Check className="w-4 h-4 text-gray-900" weight="bold" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-500" />
                    )}
                  </motion.button>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* Employee Code */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900 mb-0.5">Employee code</p>
                  <p className="text-xs text-gray-500 mb-2">Za dodajanje zaposlenih v vaše podjetje. Zaposleni vidi le svoj urnik in termine, ki so mu dodeljeni. Nima dostopa do nastavitev, analitike ali podatkov o drugih zaposlenih.</p>
                  <div className="text-2xl font-bold gradient-text tracking-tight">
                    {staffCode || '—'}
                  </div>
                </div>
                {staffCode && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => copyToClipboard(staffCode, 'staffCode')}
                    className="p-2 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    {copiedStaffCode ? (
                      <Check className="w-4 h-4 text-gray-900" weight="bold" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-500" />
                    )}
                  </motion.button>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* Company Slug */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 mb-1">Slug podjetja</p>
                  <p className="text-xs text-gray-400 mb-2">Končnica, ki se uporablja pri booking linkih in pri chatbotu na spletni strani</p>
                  {companySlug ? (
                    <div className="text-2xl font-bold gradient-text tracking-tight">
                      {companySlug}
                    </div>
                  ) : (
                    <div className="text-2xl font-bold text-gray-300">—</div>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* Explanation */}
              <div className="text-xs text-gray-400">
                Kode delite le z zaupanja vrednimi osebami. Administrator ima polni dostop do sistema, zaposleni pa le do svojih terminov.
              </div>
          </div>
        </SettingsSection>
        {/* QR koda */}
        <SettingsSection title="QR koda za registracijo strank" description="Stranke skenirajo kodo in se registrirajo v vaš sistem">
          <div className="flex flex-col items-center gap-3 py-4">
            {companySlug ? (
              <QRCodeCard slug={companySlug} size={160} compact />
            ) : (
              <p className="text-xs text-gray-400">Slug podjetja ni nastavljen.</p>
            )}
            <p className="text-xs text-gray-400 text-center">
              Stranke skenirajo kodo in se registrirajo v vaš sistem.
            </p>
          </div>
        </SettingsSection>

      </motion.div>
    </div>
  );
}
