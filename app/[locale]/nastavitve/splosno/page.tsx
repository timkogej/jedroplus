'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { CaretLeft, Copy, Check, Lock } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('settings');
  const { companyId } = useCompany();
  const { user } = useAuth();

  const [userName, setUserName] = useState('');
  const userEmail = user?.email || '';

  const [companyIdDisplay, setCompanyIdDisplay] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [staffCode, setStaffCode] = useState('');
  const [companySlug, setCompanySlug] = useState('');

  const [emailNotifications, setEmailNotifications] = useState(true);

  const [copiedId, setCopiedId] = useState(false);
  const [copiedAdminCode, setCopiedAdminCode] = useState(false);
  const [copiedStaffCode, setCopiedStaffCode] = useState(false);

  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function loadSettings() {
      if (!companyId) return;
      setIsLoading(true);

      try {
        const displayName = user?.user_metadata?.display_name ||
                           user?.user_metadata?.full_name ||
                           user?.email?.split('@')[0] || '';
        setUserName(displayName);

        const { data } = await loadCompanyRow(companyId);
        if (data) {
          setCompanyIdDisplay(String(data['ID Podjetja'] ?? data['id_podjetja'] ?? companyId));
        }

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
          new_values: { userName, emailNotifications },
        },
      });

      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  }, [companyId, userEmail, userName, emailNotifications]);

  const triggerSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => saveSettings(), 1000);
  }, [saveSettings]);

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
        {t('back')}
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{t('general.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('general.subtitle')}</p>
        </div>
        <SaveIndicator saving={saving} lastSaved={lastSaved} />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.1 }}
      >
        {/* Account & Profile */}
        <SettingsSection title={t('general.account.title')} description={t('general.account.subtitle')}>
          <SettingRow
            label={t('general.account.nameLabel')}
            description={t('general.account.nameNote')}
          >
            <div className="flex items-center gap-3">
              <Input value={userName} disabled className="bg-gray-50 cursor-not-allowed" />
              <div className="flex items-center gap-1 text-gray-400">
                <Lock className="w-3.5 h-3.5" weight="bold" />
              </div>
            </div>
          </SettingRow>

          <SettingRow
            label={t('general.account.emailLabel')}
            description={t('general.account.emailNote')}
          >
            <div className="flex items-center gap-3">
              <Input type="email" value={userEmail} disabled className="bg-gray-50 cursor-not-allowed" />
              <div className="flex items-center gap-1 text-gray-400">
                <Lock className="w-3.5 h-3.5" weight="bold" />
              </div>
            </div>
          </SettingRow>
        </SettingsSection>

        {/* Language & Region */}
        <SettingsSection title={t('general.langRegion.title')} description={t('general.langRegion.subtitle')}>
          <SettingRow label={t('general.langRegion.languageLabel')} description={t('general.langRegion.languageNote')}>
            <div className="flex items-center gap-3">
              <Input value={t('general.langRegion.languageValue')} disabled className="bg-gray-50 cursor-not-allowed" />
              <div className="flex items-center gap-1 text-gray-400">
                <Lock className="w-3.5 h-3.5" weight="bold" />
              </div>
            </div>
          </SettingRow>

          <SettingRow label={t('general.langRegion.regionLabel')} description={t('general.langRegion.regionNote')}>
            <div className="flex items-center gap-3">
              <Input value="Ljubljana, SI" disabled className="bg-gray-50 cursor-not-allowed" />
              <div className="flex items-center gap-1 text-gray-400">
                <Lock className="w-3.5 h-3.5" weight="bold" />
              </div>
            </div>
          </SettingRow>

          <SettingRow label={t('general.langRegion.timezoneLabel')} description={t('general.langRegion.timezoneNote')}>
            <div className="flex items-center gap-3">
              <Input value="MT+1" disabled className="bg-gray-50 cursor-not-allowed" />
              <div className="flex items-center gap-1 text-gray-400">
                <Lock className="w-3.5 h-3.5" weight="bold" />
              </div>
            </div>
          </SettingRow>

          <SettingRow label={t('general.langRegion.dateFormatLabel')} description={t('general.langRegion.dateFormatNote')}>
            <div className="flex items-center gap-3">
              <Input value="dd.mm.yyyy" disabled className="bg-gray-50 cursor-not-allowed" />
              <div className="flex items-center gap-1 text-gray-400">
                <Lock className="w-3.5 h-3.5" weight="bold" />
              </div>
            </div>
          </SettingRow>
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection title={t('general.notifications.title')} description={t('general.notifications.subtitle')}>
          <SettingRow
            label={t('general.notifications.emailLabel')}
            description={t('general.notifications.emailNote')}
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

        {/* Company ID & Codes */}
        <SettingsSection title={t('general.companyData.title')} description={t('general.companyData.subtitle')}>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
            {/* Company ID */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 mb-1">{t('general.companyData.companyIdLabel')}</p>
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

            <div className="border-t border-gray-100" />

            {/* Admin Code */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900 mb-0.5">{t('general.companyData.adminCodeLabel')}</p>
                <p className="text-xs text-gray-500 mb-2">{t('general.companyData.adminCodeNote')}</p>
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

            <div className="border-t border-gray-100" />

            {/* Employee Code */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900 mb-0.5">{t('general.companyData.employeeCodeLabel')}</p>
                <p className="text-xs text-gray-500 mb-2">{t('general.companyData.employeeCodeNote')}</p>
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

            <div className="border-t border-gray-100" />

            {/* Company Slug */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 mb-1">{t('general.companyData.slugLabel')}</p>
                <p className="text-xs text-gray-400 mb-2">{t('general.companyData.slugNote')}</p>
                {companySlug ? (
                  <div className="text-2xl font-bold gradient-text tracking-tight">
                    {companySlug}
                  </div>
                ) : (
                  <div className="text-2xl font-bold text-gray-300">—</div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-100" />

            <div className="text-xs text-gray-400">
              {t('general.companyData.disclaimer')}
            </div>
          </div>
        </SettingsSection>

        {/* QR code */}
        <SettingsSection title={t('general.qr.title')} description={t('general.qr.subtitle')}>
          <div className="flex flex-col items-center gap-3 py-4">
            {companySlug ? (
              <QRCodeCard slug={companySlug} size={160} compact />
            ) : (
              <p className="text-xs text-gray-400">{t('general.qr.noSlug')}</p>
            )}
            <p className="text-xs text-gray-400 text-center">
              {t('general.qr.caption')}
            </p>
          </div>
        </SettingsSection>
      </motion.div>
    </div>
  );
}
