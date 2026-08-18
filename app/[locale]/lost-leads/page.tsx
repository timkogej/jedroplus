'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  TrendDown,
  Gear,
  Users,
  PaperPlaneRight,
  UserCheck,
  EnvelopeSimple,
  Phone,
  ChatText,
  CalendarX,
  CheckCircle,
} from '@phosphor-icons/react';
import { useTranslations, useLocale } from 'next-intl';
import ProtectedLayout from '@/components/ProtectedLayout';
import AmbientBottomGlow from '@/components/shared/AmbientBottomGlow';
import { useCompany } from '@/app/company-context';
import { useRolePermissions } from '@/app/role-permission-context';
import { safeDate } from '@/lib/dashboardHelpers';
import { fetchClients } from '@/lib/data';
import { loadCompanyRow } from '@/lib/settingsStore';
import { LostLeadsSettingsModal } from '@/components/lost-leads/LostLeadsSettingsModal';
import ClientInitialsBadge from '@/components/clients/ClientInitialsBadge';
import { GradientSpinner } from '@/components/ui/GradientSpinner';

type ClientRow = Record<string, unknown>;

const isEnabledValue = (value: unknown, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (normalized.includes('omogo')) return true;
    if (normalized.includes('onemogo')) return false;
  }
  return fallback;
};

export default function LostLeadsPage() {
  const t = useTranslations('lost-leads');
  const locale = useLocale();
  const { companyId, companySettings } = useCompany();
  const { role, permissions } = useRolePermissions();
  const canManageSettings = role !== 'staff' || (permissions?.can_manage_lost_leads ?? true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [companyRow, setCompanyRow] = useState<Record<string, unknown> | null>(
    companySettings ?? null
  );
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Settings values (read-only display)
  const [enabled, setEnabled] = useState(false);
  const [inactivityDays, setInactivityDays] = useState(30);
  const [instructions, setInstructions] = useState('');
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountText, setDiscountText] = useState('');
  const [tone, setTone] = useState('prijazen');

  // Load data - NO dependency on LostLeadSetting table
  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);

    try {
      // Load settings from "Podatki podjetij" table ONLY - no LostLeadSetting query
      const { data: companyData } = await loadCompanyRow(companyId);
      setCompanyRow(companyData ?? null);

      // Fetch all clients
      const clientResult = await fetchClients(companyId, 1000);
      setClients(clientResult.data ?? []);

    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!companyRow) return;

    // Read settings from "Podatki podjetij" table ONLY
    // Map "Pošiljanje Lost" -> enabled
    setEnabled(isEnabledValue(
      companyRow['Pošiljanje Lost'] ?? companyRow['posiljanje_lost'],
      false
    ));

    // Map "Čas LOST LEADS" -> inactivityDays
    const casLost = companyRow['Čas LOST LEADS'] ?? companyRow['cas_lost_leads'];
    setInactivityDays(parseInt(String(casLost)) || 30);

    // Map "Nastavitve LOST LEADS" -> instructions
    setInstructions(String(
      companyRow['Nastavitve LOST LEADS'] ?? companyRow['nastavitve_lost_leads'] ?? ''
    ));

    // Map "Popust LOST LEADS" -> hasDiscount and discountText
    const popustLost = companyRow['Popust LOST LEADS'] ?? companyRow['popust_lost_leads'] ?? '';
    const popustStr = String(popustLost).trim();
    setHasDiscount(popustStr !== '' && popustStr.toLowerCase() !== 'ni popusta' && popustStr !== '0');
    setDiscountText(popustStr === 'ni popusta' ? '' : popustStr);

    // Map "Ton komunikacije opomikov" -> tone
    setTone(String(companyRow['Ton komunikacije opomikov'] ?? companyRow['lost_leads_tone'] ?? 'prijazen'));
  }, [companyRow]);

  // Calculate inactive clients based on correct logic:
  // In "Podatki podjetij", column "Čas LOST LEADS" = number of days
  // In "Stranke", column "Zadnja interkacija" = last interaction date
  // thresholdDate = today - inactivityDays
  // If customer.ZadnjaInterkacija <= thresholdDate, show in inactive list
  const inactiveClients = useMemo(() => {
    if (!inactivityDays || inactivityDays <= 0) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thresholdDate = new Date(today);
    thresholdDate.setDate(thresholdDate.getDate() - inactivityDays);

    return clients.filter((client) => {
      // Use "Zadnja interkacija" column from "Stranke" table
      const lastInteractionValue = client['Zadnja interkacija'] ?? client['Zadnja interakcija'] ?? client['last_interaction'];
      const lastInteractionDate = safeDate(lastInteractionValue);

      if (!lastInteractionDate) return false;

      // Customer is inactive if last interaction <= thresholdDate
      return lastInteractionDate <= thresholdDate;
    });
  }, [clients, inactivityDays]);

  const getClientId = (client: ClientRow) =>
    String(client['id'] ?? client['ID'] ?? `client-${Math.random()}`);

  const getDaysInactive = (client: ClientRow) => {
    const lastInteractionValue = client['Zadnja interkacija'] ?? client['Zadnja interakcija'] ?? client['last_interaction'];
    const date = safeDate(lastInteractionValue);
    if (!date) return 0;
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getClientName = (client: ClientRow) =>
    String(client['Stranka'] ?? client['Naziv'] ?? client['Ime'] ?? '-');

  const getClientEmail = (client: ClientRow) =>
    String(client['Email stranke'] ?? client['Email'] ?? client['to_email'] ?? '-');

  const getClientPhone = (client: ClientRow) =>
    String(client['Telefonska številka'] ?? client['Telefon'] ?? client['phone'] ?? '-');

  // Check if client has been notified via Lost Leads (from "Obveščen lost" column)
  const isClientNotified = (client: ClientRow): boolean => {
    const notifiedValue = client['Obveščen lost'] ?? client['obvescen_lost'];
    if (typeof notifiedValue === 'boolean') return notifiedValue;
    if (typeof notifiedValue === 'string') {
      const normalized = notifiedValue.toLowerCase();
      return normalized === 'da' || normalized === 'yes' || normalized === 'true' || normalized.includes('omogo');
    }
    return false;
  };

  const getToneLabel = (toneValue: string) => {
    const map: Record<string, string> = {
      'profesionalen': t('tone.professional'),
      'prijazen': t('tone.friendly'),
      'prodajno_usmerjen': t('tone.salesOriented'),
      'formal': t('tone.formal'),
      'sproscen': t('tone.relaxed'),
    };
    return map[toneValue] ?? toneValue;
  };

  const notifiedThisMonthCount = useMemo(() => {
    const now = new Date();
    return clients.filter((client) => {
      const datumLostLead = client['Datum lost lead'] ?? client['datum_lost_lead'];
      if (!datumLostLead) return false;
      const date = safeDate(datumLostLead);
      if (!date) return false;
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
  }, [clients]);

  if (!companyId) return null;

  // Calculate stats
  const stats = {
    inactiveClients: inactiveClients.length,
    notifiedClients: inactiveClients.filter(isClientNotified).length,
    pendingNotification: inactiveClients.filter(c => !isClientNotified(c)).length,
  };

  return (
    <ProtectedLayout>
      <main className="relative isolate min-h-screen bg-white">
        <AmbientBottomGlow tone="turquoise" />
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex flex-wrap items-start justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl font-normal text-[#1A1F36]">{t('page.title')}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('page.subtitle')}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Settings button - icon only */}
              {canManageSettings && (
                <motion.button
                  onClick={() => setShowSettingsModal(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                  title={t('page.settings.title')}
                >
                  <Gear size={20} weight="bold" className="text-gray-900" />
                </motion.button>
              )}
            </div>
          </motion.div>

          {/* Statistics Cards - Centered icons and numbers */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100"
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-8 w-16 rounded-lg bg-gray-200 animate-pulse" />
                      <div className="h-6 w-6 rounded bg-gray-200 animate-pulse" />
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
                      <div className="h-3 w-20 rounded bg-gray-200 animate-pulse" />
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {/* Inactive Clients */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0 }}
                  className="relative rounded-2xl p-[1px] bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500"
                >
                  <div className="rounded-[15px] bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="text-3xl text-gray-900 leading-none">
                        {stats.inactiveClients}
                      </div>
                      <TrendDown className="h-6 w-6 text-gray-900" weight="regular" />
                    </div>
                    <div className="mt-3 text-left">
                      <div className="text-sm font-medium text-gray-600">{t('page.stats.inactiveClients')}</div>
                      <div className="text-xs text-gray-500 mt-1">{t('page.stats.inactiveClientsDesc')}</div>
                    </div>
                  </div>
                </motion.div>

                {/* Notified Clients */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-3xl text-gray-900 leading-none">
                      {notifiedThisMonthCount}
                    </div>
                    <PaperPlaneRight className="h-6 w-6 text-gray-900" weight="regular" />
                  </div>
                  <div className="mt-3 text-left">
                    <div className="text-sm font-medium text-gray-600">{t('page.stats.notifiedClients')}</div>
                    <div className="text-xs text-gray-500 mt-1">{t('page.stats.notifiedClientsDesc')}</div>
                  </div>
                </motion.div>

                {/* Pending Notification */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-3xl text-gray-900 leading-none">
                      {inactivityDays}
                    </div>
                    <CalendarX className="h-6 w-6 text-gray-900" weight="regular" />
                  </div>
                  <div className="mt-3 text-left">
                    <div className="text-sm font-medium text-gray-600">{t('page.stats.inactivityDays')}</div>
                    <div className="text-xs text-gray-500 mt-1">{t('page.stats.inactivityDaysDesc')}</div>
                  </div>
                </motion.div>
              </>
            )}
          </div>

          {/* Inactive Clients Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8 rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-[#1A1F36]">
                    {t('page.table.title')}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {t('page.table.subtitle', { count: inactiveClients.length, days: inactivityDays })}
                  </p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="animate-pulse flex flex-col items-center">
                  <div className="h-16 w-16 rounded-full bg-gray-200 mb-4" />
                  <div className="h-5 w-32 bg-gray-200 rounded mb-2" />
                  <div className="h-4 w-48 bg-gray-200 rounded" />
                </div>
              </div>
            ) : inactiveClients.length === 0 ? (
              <div className="p-12 text-center">
                <UserCheck className="h-16 w-16 text-emerald-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium">
                  {t('page.table.empty')}
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  {t('page.table.emptyDesc', { days: inactivityDays })}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        {t('page.table.columns.client')}
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        {t('page.table.columns.email')}
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        {t('page.table.columns.phone')}
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        {t('page.table.columns.daysInactive')}
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        {t('page.table.columns.notified')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {inactiveClients.slice(0, 50).map((client, index) => {
                      const daysInactive = getDaysInactive(client);
                      const notified = isClientNotified(client);
                      return (
                        <motion.tr
                          key={getClientId(client)}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.02 }}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <ClientInitialsBadge
                                firstName={getClientName(client).split(/\s+/)[0] || ''}
                                lastName={getClientName(client).split(/\s+/).slice(1).join(' ') || ''}
                                size="sm"
                                gradient="violet-cyan"
                                variant="text"
                              />
                              <div className="font-medium text-gray-900">
                                {getClientName(client)}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm text-gray-900">
                              <EnvelopeSimple className="h-4 w-4 text-gray-900" />
                              {getClientEmail(client)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm text-gray-900">
                              <Phone className="h-4 w-4 text-gray-900" />
                              {getClientPhone(client)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-orange-600">
                              {t('page.table.daysValue', { days: daysInactive })}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {notified ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full">
                                <CheckCircle className="h-3.5 w-3.5" weight="fill" />
                                {t('page.table.notifiedYes')}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-900">
                                {t('page.table.notifiedNo')}
                              </span>
                            )}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
                {inactiveClients.length > 50 && (
                  <div className="p-4 text-center text-sm text-gray-500 border-t border-gray-100">
                    {t('page.table.limitNote', { total: inactiveClients.length })}
                  </div>
                )}
              </div>
            )}
          </motion.div>

          {/* Settings Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 mb-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100"
          >
            <h2 className="text-base font-semibold text-[#1A1F36] mb-4">{t('page.settings.title')}</h2>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <GradientSpinner />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                  <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                    <TrendDown className="w-4 h-4 flex-shrink-0 text-gray-900" weight="regular" />
                    <span className="text-sm text-gray-700">{t('page.settings.statusLabel')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${enabled ? 'text-green-600' : 'text-red-500'}`}>
                      {enabled ? t('status.enabled') : t('status.disabled')}
                    </span>
                    <div className={`w-2.5 h-2.5 rounded-full ${enabled ? 'bg-green-500' : 'bg-red-400'}`} />
                  </div>
                </div>

                <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <CalendarX className="w-4 h-4 text-gray-900" weight="regular" />
                    <span className="text-sm text-gray-700">{t('page.settings.inactivityThreshold')}</span>
                  </div>
                  <span className="text-sm text-gray-900">{t('page.table.daysValue', { days: inactivityDays })}</span>
                </div>

                <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <ChatText className="w-4 h-4 text-gray-900" weight="regular" />
                    <span className="text-sm text-gray-700">{t('page.settings.tone')}</span>
                  </div>
                  <span className="text-sm text-gray-900">{getToneLabel(tone)}</span>
                </div>

                <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-900" weight="regular" />
                    <span className="text-sm text-gray-700">{t('page.settings.discount')}</span>
                  </div>
                  {hasDiscount && discountText ? (
                    <span className="text-sm text-gray-900">{discountText}</span>
                  ) : (
                    <span className="text-sm text-gray-400">{t('page.settings.notSet')}</span>
                  )}
                </div>

                <div className="flex items-start justify-between gap-4 py-2.5">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <EnvelopeSimple className="w-4 h-4 text-gray-900" weight="regular" />
                    <span className="text-sm text-gray-700">{t('page.settings.aiInstructions')}</span>
                  </div>
                  {instructions ? (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap text-left max-w-xs">{instructions}</p>
                  ) : (
                    <span className="text-sm text-gray-400">{t('page.settings.noInstructions')}</span>
                  )}
                </div>
              </div>
            )}
          </motion.div>

          {/* Info Box */}
          {!loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100"
            >
              <h4 className="mb-3 text-base font-semibold text-gray-900">{t('page.info.title')}</h4>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                {t.rich('page.info.body', {
                  highlight: (chunks) => (
                    <span className="bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 bg-clip-text font-semibold text-transparent">
                      {chunks}
                    </span>
                  ),
                })}
              </p>
            </motion.div>
          )}
        </div>
      </main>

      {/* Settings Modal */}
      <LostLeadsSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </ProtectedLayout>
  );
}
