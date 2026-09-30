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
import { useCompany } from '@/app/company-context';
import { useRolePermissions } from '@/app/role-permission-context';
import { safeDate } from '@/lib/dashboardHelpers';
import { fetchClients } from '@/lib/data';
import { loadCompanyRow } from '@/lib/settingsStore';
import { LostLeadsSettingsModal } from '@/components/lost-leads/LostLeadsSettingsModal';
import ClientInitialsBadge from '@/components/clients/ClientInitialsBadge';
import { GradientSpinner } from '@/components/ui/GradientSpinner';
import { MetricGroup } from '@/components/dashboard';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { SectionPanel, SettingRow, StatusPill, ValuePill } from '@/components/ui/OverviewPrimitives';

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

  const columns: DataTableColumn<ClientRow>[] = [
    {
      id: 'client',
      header: t('page.table.columns.client'),
      sortValue: (c) => getClientName(c).toLowerCase(),
      cell: (c) => (
        <div className="flex items-center gap-3">
          <ClientInitialsBadge
            firstName={getClientName(c).split(/\s+/)[0] || ''}
            lastName={getClientName(c).split(/\s+/).slice(1).join(' ') || ''}
            size="sm"
            gradient="violet-cyan"
            variant="text"
          />
          <span className="text-sm font-medium text-gray-900">{getClientName(c)}</span>
        </div>
      ),
    },
    {
      id: 'email',
      header: t('page.table.columns.email'),
      sortValue: (c) => getClientEmail(c).toLowerCase(),
      cell: (c) => (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <EnvelopeSimple className="h-4 w-4 flex-shrink-0 text-gray-400" weight="regular" />
          <span className="truncate">{getClientEmail(c)}</span>
        </div>
      ),
    },
    {
      id: 'phone',
      header: t('page.table.columns.phone'),
      cell: (c) => (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Phone className="h-4 w-4 flex-shrink-0 text-gray-400" weight="regular" />
          <span className="tnum whitespace-nowrap">{getClientPhone(c)}</span>
        </div>
      ),
    },
    {
      id: 'daysInactive',
      header: t('page.table.columns.daysInactive'),
      sortValue: (c) => getDaysInactive(c),
      cell: (c) => (
        <span className="tnum whitespace-nowrap text-sm text-amber-600">
          {t('page.table.daysValue', { days: getDaysInactive(c) })}
        </span>
      ),
    },
    {
      id: 'notified',
      header: t('page.table.columns.notified'),
      sortValue: (c) => (isClientNotified(c) ? 1 : 0),
      cell: (c) =>
        isClientNotified(c) ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <CheckCircle className="h-3.5 w-3.5" weight="regular" />
            {t('page.table.notifiedYes')}
          </span>
        ) : (
          <span className="text-sm text-gray-400">{t('page.table.notifiedNo')}</span>
        ),
    },
  ];

  return (
    <ProtectedLayout>
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="mb-7 flex flex-wrap items-start justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">{t('page.title')}</h1>
              <p className="mt-0.5 text-base text-gray-500">{t('page.subtitle')}</p>
            </div>

            {canManageSettings && (
              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100"
                title={t('page.settings.title')}
              >
                <Gear size={17} weight="regular" className="text-gray-500" />
                {t('page.settings.title')}
              </button>
            )}
          </motion.div>

          {/* Povzetek — ena kartica z lasnimi črtami, kot drugod. */}
          <div className="mb-8">
            <MetricGroup
              metrics={[
                {
                  label: t('page.stats.inactiveClients'),
                  value: loading ? '—' : stats.inactiveClients,
                  caption: t('page.stats.inactiveClientsDesc'),
                  icon: TrendDown,
                },
                {
                  label: t('page.stats.notifiedClients'),
                  value: loading ? '—' : notifiedThisMonthCount,
                  caption: t('page.stats.notifiedClientsDesc'),
                  icon: PaperPlaneRight,
                },
                {
                  label: t('page.stats.inactivityDays'),
                  value: loading ? '—' : inactivityDays,
                  caption: t('page.stats.inactivityDaysDesc'),
                  icon: CalendarX,
                },
              ]}
            />
          </div>

          {/* Seznam neaktivnih strank */}
          <section className="mb-8">
            <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-gray-500">
              {t('page.table.title')}
            </h2>
            <p className="mb-2 px-1 text-[13px] text-gray-500">
              {t('page.table.subtitle', { count: inactiveClients.length, days: inactivityDays })}
            </p>
            <DataTable<ClientRow>
              rows={inactiveClients}
              columns={columns}
              rowKey={(c) => getClientId(c)}
              isLoading={loading}
              pageSize={20}
              defaultSort={{ columnId: 'daysInactive', direction: 'desc' }}
              empty={
                <div className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white p-12 text-center">
                  <UserCheck className="mb-3 h-7 w-7 text-emerald-400" weight="regular" />
                  <p className="text-base font-semibold text-gray-900">{t('page.table.empty')}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {t('page.table.emptyDesc', { days: inactivityDays })}
                  </p>
                </div>
              }
              mobile={{
                leading: (c) => (
                  <ClientInitialsBadge
                    firstName={getClientName(c).split(/\s+/)[0] || ''}
                    lastName={getClientName(c).split(/\s+/).slice(1).join(' ') || ''}
                    size="md"
                    gradient="violet-cyan"
                    variant="text"
                  />
                ),
                title: (c) => getClientName(c),
                subtitle: (c) => getClientEmail(c),
                meta: (c) => (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tnum text-[13px] text-amber-600">
                      {t('page.table.daysValue', { days: getDaysInactive(c) })}
                    </span>
                    {isClientNotified(c) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <CheckCircle className="h-3 w-3" weight="regular" />
                        {t('page.table.notifiedYes')}
                      </span>
                    )}
                  </div>
                ),
              }}
            />
          </section>

          {/* Nastavitve — isti gradniki kot na Opomnikih in Rezervacijah. */}
          <section className="mb-8">
            <SectionPanel title={t('page.settings.title')}>
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <GradientSpinner />
                </div>
              ) : (
                <>
                  <SettingRow
                    icon={<TrendDown size={16} weight="regular" />}
                    label={t('page.settings.statusLabel')}
                    description={t('page.settings.statusLabelDesc')}
                    value={
                      <StatusPill
                        enabled={enabled}
                        label={enabled ? t('status.enabled') : t('status.disabled')}
                      />
                    }
                  />
                  <SettingRow
                    icon={<CalendarX size={16} weight="regular" />}
                    label={t('page.settings.inactivityThreshold')}
                    description={t('page.settings.inactivityThresholdDesc')}
                    value={<ValuePill>{t('page.table.daysValue', { days: inactivityDays })}</ValuePill>}
                  />
                  <SettingRow
                    icon={<ChatText size={16} weight="regular" />}
                    label={t('page.settings.tone')}
                    description={t('page.settings.toneDesc')}
                    value={<ValuePill>{getToneLabel(tone)}</ValuePill>}
                  />
                  <SettingRow
                    icon={<Users size={16} weight="regular" />}
                    label={t('page.settings.discount')}
                    description={t('page.settings.discountDesc')}
                    value={
                      hasDiscount && discountText ? (
                        <span className="text-sm text-gray-900">{discountText}</span>
                      ) : (
                        <span className="text-sm text-gray-400">{t('page.settings.notSet')}</span>
                      )
                    }
                  />
                  <SettingRow
                    icon={<EnvelopeSimple size={16} weight="regular" />}
                    label={t('page.settings.aiInstructions')}
                    description={t('page.settings.aiInstructionsDesc')}
                    value={
                      instructions ? (
                        <p className="max-w-xs whitespace-pre-wrap text-left text-sm text-gray-900 sm:text-right">
                          {instructions}
                        </p>
                      ) : (
                        <span className="text-sm text-gray-400">{t('page.settings.noInstructions')}</span>
                      )
                    }
                  />
                </>
              )}
            </SectionPanel>
          </section>

          {/* Info Box */}
          {!loading && (
            <SectionPanel title={t('page.info.title')}>
              <div className="p-4">
                <p className="whitespace-pre-wrap text-sm leading-7 text-gray-600">
                  {t.rich('page.info.body', {
                    highlight: (chunks) => (
                      <span className="font-semibold text-gray-900">{chunks}</span>
                    ),
                  })}
                </p>
              </div>
            </SectionPanel>
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
