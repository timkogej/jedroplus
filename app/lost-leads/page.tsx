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
  Info,
  ChatText,
  CalendarX,
  CheckCircle,
  XCircle,
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { safeDate } from '@/lib/dashboardHelpers';
import { fetchClients } from '@/lib/data';
import { loadCompanyRow } from '@/lib/settingsStore';
import StatusBadge from '@/components/shared/StatusBadge';
import { LostLeadsSettingsModal } from '@/components/lost-leads/LostLeadsSettingsModal';

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
  const { companyId, companySettings } = useCompany();
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

  const getClientInitials = (client: ClientRow) => {
    const name = getClientName(client);
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

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
    const toneMap: Record<string, string> = {
      'profesionalen': 'Profesionalen',
      'prijazen': 'Prijazen',
      'prodajno_usmerjen': 'Prodajno usmerjen',
      'formal': 'Formalen',
      'sproscen': 'Sproščen',
    };
    return toneMap[toneValue] || toneValue;
  };

  if (!companyId) return null;

  // Calculate stats
  const stats = {
    inactiveClients: inactiveClients.length,
    notifiedClients: inactiveClients.filter(isClientNotified).length,
    pendingNotification: inactiveClients.filter(c => !isClientNotified(c)).length,
  };

  return (
    <ProtectedLayout>
      <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex flex-wrap items-start justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl font-bold text-[#1A1F36]">Lost Leads</h1>
              <p className="mt-1 text-sm text-gray-500">
                Pregled nastavitev in neaktivnih strank
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Settings button - icon only */}
              <motion.button
                onClick={() => setShowSettingsModal(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                title="Nastavitve"
              >
                <span
                  style={{
                    background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  <Gear size={20} weight="bold" />
                </span>
              </motion.button>
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
                  className="relative rounded-2xl p-[3px] bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500"
                >
                  <div className="rounded-[13px] bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="text-3xl font-bold text-gray-900 leading-none">
                        {stats.inactiveClients}
                      </div>
                      <TrendDown className="h-6 w-6 text-gray-900" weight="bold" />
                    </div>
                    <div className="mt-3 text-left">
                      <div className="text-sm font-medium text-gray-600">Neaktivne Stranke</div>
                      <div className="text-xs text-gray-500 mt-1">Skupaj označenih</div>
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
                    <div className="text-3xl font-bold text-gray-900 leading-none">
                      {stats.notifiedClients}
                    </div>
                    <PaperPlaneRight className="h-6 w-6 text-gray-900" weight="bold" />
                  </div>
                  <div className="mt-3 text-left">
                    <div className="text-sm font-medium text-gray-600">Obveščene Stranke</div>
                    <div className="text-xs text-gray-500 mt-1">Prejele sporočilo</div>
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
                    <div className="text-3xl font-bold text-gray-900 leading-none">
                      {stats.pendingNotification}
                    </div>
                    <UserCheck className="h-6 w-6 text-gray-900" weight="bold" />
                  </div>
                  <div className="mt-3 text-left">
                    <div className="text-sm font-medium text-gray-600">Čakajo na Obvestilo</div>
                    <div className="text-xs text-gray-500 mt-1">Še niso bile obveščene</div>
                  </div>
                </motion.div>
              </>
            )}
          </div>

          {/* Settings Overview - Organized Sections */}
          <div className="mb-8 space-y-6">
            {/* Splošne nastavitve */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100"
            >
              <h2 className="text-lg font-semibold text-[#1A1F36] mb-4">Splošne nastavitve</h2>
              {loading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-4 animate-pulse">
                      <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
                      <div className="h-6 w-32 bg-gray-200 rounded" />
                    </div>
                  ))}
                </div>
              ) : !enabled ? (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
                  <XCircle className="w-6 h-6 text-red-500" weight="fill" />
                  <div>
                    <p className="font-medium text-red-700">Onemogočeno</p>
                    <p className="text-sm text-red-600">Lost Leads sledenje je trenutno izklopljeno</p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Status */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <TrendDown className="w-4 h-4" weight="regular" />
                      <span>Status</span>
                    </div>
                    <StatusBadge enabled={enabled} />
                  </div>

                  {/* Inactivity Days */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <CalendarX className="w-4 h-4" weight="regular" />
                      <span>Prag neaktivnosti</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">{inactivityDays} dni</p>
                  </div>

                  {/* Communication Tone */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <ChatText className="w-4 h-4" weight="regular" />
                      <span>Ton komunikacije</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">{getToneLabel(tone)}</p>
                  </div>

                  {/* Discount */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <Users className="w-4 h-4" weight="regular" />
                      <span>Popust za vrnitev</span>
                    </div>
                    {hasDiscount && discountText ? (
                      <p className="text-lg font-semibold text-gray-900">{discountText}</p>
                    ) : (
                      <p className="text-gray-400">Ni nastavljeno</p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Navodila za komunikacijo */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100"
            >
              <h2 className="text-lg font-semibold text-[#1A1F36] mb-4">Navodila za komunikacijo</h2>
              {loading ? (
                <div className="bg-gray-50 rounded-xl p-4 animate-pulse">
                  <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
                  <div className="h-20 bg-gray-200 rounded" />
                </div>
              ) : !enabled ? (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
                  <XCircle className="w-6 h-6 text-red-500" weight="fill" />
                  <div>
                    <p className="font-medium text-red-700">Onemogočeno</p>
                    <p className="text-sm text-red-600">Lost Leads sledenje je trenutno izklopljeno</p>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                    <EnvelopeSimple className="w-4 h-4" weight="regular" />
                    <span>Navodila AI-ju</span>
                  </div>
                  {instructions ? (
                    <p className="text-gray-700 whitespace-pre-wrap">{instructions}</p>
                  ) : (
                    <p className="text-gray-400 italic">Ni navodil</p>
                  )}
                </div>
              )}
            </motion.div>
          </div>

          {/* Inactive Clients Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-[#1A1F36]">
                    Neaktivne Stranke
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {inactiveClients.length} neaktivnih strank (več kot {inactivityDays} dni brez interakcije)
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
                  There are currently no inactive customers.
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  Vse stranke so imele interakcijo v zadnjih {inactivityDays} dneh.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Stranka
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Telefon
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Dni Neaktivnosti
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Obveščen
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
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold text-sm">
                                {getClientInitials(client)}
                              </div>
                              <div className="font-medium text-gray-900">
                                {getClientName(client)}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <EnvelopeSimple className="h-4 w-4 text-gray-400" />
                              {getClientEmail(client)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Phone className="h-4 w-4 text-gray-400" />
                              {getClientPhone(client)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-3 py-1 text-xs font-semibold bg-orange-100 text-orange-700 rounded-full">
                              {daysInactive} dni
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {notified ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full">
                                <CheckCircle className="h-3.5 w-3.5" weight="fill" />
                                Da
                              </span>
                            ) : (
                              <span className="px-3 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full">
                                Ne
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
                    Prikazanih prvih 50 od {inactiveClients.length} neaktivnih strank
                  </div>
                )}
              </div>
            )}
          </motion.div>

          {/* Info Box */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white flex-shrink-0">
                <Info className="h-4 w-4" weight="bold" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-1">O Lost Leads</h4>
                <p className="text-sm text-gray-700">
                  Stranke se avtomatsko označijo kot neaktivne, če nimajo terminov v določenem
                  obdobju. Sistem spremlja te stranke in omogoča pošiljanje personaliziranih
                  sporočil za ponovno aktivacijo.
                </p>
              </div>
            </div>
          </motion.div>
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
