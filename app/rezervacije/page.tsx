'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Gear,
  Palette,
  Clock,
  CheckCircle,
  Copy,
  ArrowSquareOut,
  Check,
  Link,
  Warning,
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { useRolePermissions } from '@/app/role-permission-context';
import { loadCompanyRow } from '@/lib/settingsStore';
import { BookingSettingsModal } from '@/components/booking/BookingSettingsModal';
import { GradientSpinner } from '@/components/ui/GradientSpinner';

interface ReservationSettings {
  timeSlotLength: number;
  sendClientConfirmation: boolean;
  clientConfirmationChannel: string;
  sendOnlineConfirmation: boolean;
  onlineConfirmationChannel: string;
  primaryColor: string;
  secondaryColor: string;
  bgFromColor: string;
  bgToColor: string;
  bookingOmogocen: boolean;
  bookingLink1: string;
  bookingLink2: string;
  bookingLink3: string;
  bookingLink4: string;
  bookingLink5: string;
  bookingLink6: string;
  apptManagementLink: string;
  mainBookingLink: string;
}

interface BookingDesign {
  id: number;
  name: string;
  subtitle: string;
  description: string;
  linkKey: keyof ReservationSettings;
}

const STANDARD_DESIGNS: BookingDesign[] = [
  {
    id: 1,
    name: 'Klasičen',
    subtitle: 'Preprost in pregleden',
    description: 'Klasičen dizajn z elegantnimi gradient ozadji. Idealno za prikaz barv vašega podjetja in ustvarjanje prepoznavne blagovne znamke.',
    linkKey: 'bookingLink1',
  },
  {
    id: 2,
    name: 'Moderen',
    subtitle: 'Sodoben in dinamičen',
    description: 'Sodoben dizajn s temnim ozadjem in živahnimi poudarki. Priporočamo temnejšo primarno barvo za najboljši vizualni učinek in premium občutek.',
    linkKey: 'bookingLink2',
  },
  {
    id: 3,
    name: 'Minimalen',
    subtitle: 'Čist in enostaven',
    description: 'Luksuzni minimalistični dizajn z nežnimi zemeljskimi toni. Popoln za elegantne salone, spa centre in ekskluzivne storitve.',
    linkKey: 'bookingLink3',
  },
];

const PREMIUM_DESIGNS: BookingDesign[] = [
  {
    id: 4,
    name: 'Sezonsko',
    subtitle: 'Prilagodljiv in živahen',
    description: 'Dinamičen dizajn, ki se samodejno prilagaja letnemu času in praznikom. Pomlad, poletje, jesen, zima, božič, valentinovo, noč čarovnic in več – vaša stran je vedno sveža in aktualna.',
    linkKey: 'bookingLink4',
  },
  {
    id: 5,
    name: 'Magazine',
    subtitle: 'Eleganten in urejevalen',
    description: 'Premium Magazine dizajn z uredniško estetiko in visokokakovostnim vizualnim slogom. Idealno za ekskluzivne salone, kozmetične studio in premium storitve.',
    linkKey: 'bookingLink5',
  },
  {
    id: 6,
    name: 'Casino',
    subtitle: 'Glamurozen in razburljiv',
    description: 'Ekskluziven kazino dizajn z glamurozno atmosfero, bleščečimi akcenti in dinamičnimi vizualnimi elementi. Popoln za tiste, ki želijo rezervacijo terminov spremeniti v nepozabno izkušnjo.',
    linkKey: 'bookingLink6',
  },
];

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function RezervacijePage() {
  const router = useRouter();
  const { companyId, loading: companyLoading } = useCompany();
  const { role, permissions } = useRolePermissions();
  const canManageSettings = role !== 'staff' || (permissions?.can_manage_rezervacije ?? true);

  const [settings, setSettings] = useState<ReservationSettings>({
    timeSlotLength: 30,
    sendClientConfirmation: false,
    clientConfirmationChannel: 'email',
    sendOnlineConfirmation: false,
    onlineConfirmationChannel: 'email',
    primaryColor: '#8B5CF6',
    secondaryColor: '#06B6D4',
    bgFromColor: '#8B5CF6',
    bgToColor: '#06B6D4',
    bookingOmogocen: true,
    bookingLink1: '',
    bookingLink2: '',
    bookingLink3: '',
    bookingLink4: '',
    bookingLink5: '',
    bookingLink6: '',
    apptManagementLink: '',
    mainBookingLink: '',
  });

  const [loading, setLoading] = useState(true);
  const [copiedDesignId, setCopiedDesignId] = useState<number | null>(null);
  const [copiedMgmt, setCopiedMgmt] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Fetch settings from same tables as Nastavitve > Rezervacije
  const fetchSettings = useCallback(async () => {
    if (!companyId) return;

    try {
      setLoading(true);

      // Fetch from Podatki podjetij table using loadCompanyRow
      const { data: podatkiRow } = await loadCompanyRow(companyId);

      // Extract settings from the row
      const timeSlotValue = podatkiRow?.['koledar_ure'] || podatkiRow?.['Koledar_ure'] || 30;

      // Client confirmation: read from "Potrdilo po rezervaciji" column
      const potrdiloPodatkiRaw = podatkiRow?.['Potrdilo po rezervaciji'] ?? podatkiRow?.['Potrdilo ob rezervaciji'];
      const sendConfirmation = potrdiloPodatkiRaw === true || potrdiloPodatkiRaw === 'true' || potrdiloPodatkiRaw === 'yes' || potrdiloPodatkiRaw === 'da';
      const clientConfirmationChannel = (podatkiRow?.['potrdilo_channel'] || 'email') as string;

      // Online confirmation: read from "Potrdilo online termina" column
      const potrdiloPodatkiOnlineRaw = podatkiRow?.['Potrdilo online termina'] ?? podatkiRow?.['Potrdilo online rez'];
      const sendOnlineConfirmation = potrdiloPodatkiOnlineRaw === true || potrdiloPodatkiOnlineRaw === 'true' || potrdiloPodatkiOnlineRaw === 'yes' || potrdiloPodatkiOnlineRaw === 'da';
      const onlineConfirmationChannel = (podatkiRow?.['potrdilo_online_channel'] || 'email') as string;
      const primaryColor = (podatkiRow?.['Booking_primary'] || podatkiRow?.['booking_primary'] || '#8B5CF6') as string;
      const secondaryColor = (podatkiRow?.['Booking_secondary'] || podatkiRow?.['booking_secondary'] || '#06B6D4') as string;
      const bgFromColor = (podatkiRow?.['booking_bg_from'] || podatkiRow?.['Booking_bg_from'] || primaryColor) as string;
      const bgToColor = (podatkiRow?.['booking_bg_to'] || podatkiRow?.['Booking_bg_to'] || secondaryColor) as string;

      const bookingEnabled = podatkiRow?.['booking_omogocen'];

      setSettings({
        timeSlotLength: typeof timeSlotValue === 'number' ? timeSlotValue : parseInt(String(timeSlotValue), 10) || 30,
        sendClientConfirmation: sendConfirmation,
        clientConfirmationChannel,
        sendOnlineConfirmation: sendOnlineConfirmation,
        onlineConfirmationChannel,
        primaryColor: primaryColor,
        secondaryColor: secondaryColor,
        bgFromColor: bgFromColor,
        bgToColor: bgToColor,
        bookingOmogocen: bookingEnabled !== false && bookingEnabled !== 'false',
        bookingLink1: String(podatkiRow?.['booking_link_1'] ?? podatkiRow?.['Booking_link_1'] ?? ''),
        bookingLink2: String(podatkiRow?.['booking_link_2'] ?? podatkiRow?.['Booking_link_2'] ?? ''),
        bookingLink3: String(podatkiRow?.['booking_link_3'] ?? podatkiRow?.['Booking_link_3'] ?? ''),
        bookingLink4: String(podatkiRow?.['booking_link_4'] ?? podatkiRow?.['Booking_link_4'] ?? ''),
        bookingLink5: String(podatkiRow?.['booking_link_5'] ?? podatkiRow?.['Booking_link_5'] ?? ''),
        bookingLink6: String(podatkiRow?.['booking_link_6'] ?? podatkiRow?.['Booking_link_6'] ?? ''),
        apptManagementLink: String(podatkiRow?.['appt_management_link'] ?? ''),
        mainBookingLink: String(podatkiRow?.['main_booking_link'] ?? ''),
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Redirect if no company
  useEffect(() => {
    if (!companyLoading && !companyId) {
      router.replace('/onboarding');
    }
  }, [companyId, companyLoading, router]);

  // Fetch settings on mount
  useEffect(() => {
    if (companyId) {
      fetchSettings();
    }
  }, [companyId, fetchSettings]);

  const getDesignLink = (design: BookingDesign): string => {
    return String(settings[design.linkKey] ?? '');
  };

  const copyToClipboard = (text: string, designId: number) => {
    navigator.clipboard.writeText(text);
    setCopiedDesignId(designId);
    setTimeout(() => setCopiedDesignId(null), 2000);
  };

  if (companyLoading || !companyId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <GradientSpinner />
      </div>
    );
  }

  const hasIncompleteSettings = !loading && !settings.mainBookingLink.trim();

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
              <h1 className="text-2xl font-bold text-[#1A1F36]">Rezervacije</h1>
              <p className="mt-1 text-sm text-gray-500">
                Upravljanje spletnega sistema za rezervacije
              </p>
            </div>

            {/* Settings button - icon only */}
            {canManageSettings && (
              <motion.button
                onClick={() => setShowSettingsModal(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                title="Nastavitve"
              >
                <Gear size={20} weight="bold" className="text-gray-900" />
                {hasIncompleteSettings && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-white border border-white" style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>!</span>
                )}
              </motion.button>
            )}
          </motion.div>

          {/* Incomplete settings banner */}
          {hasIncompleteSettings && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex items-center gap-3 rounded-2xl px-5 py-3.5 bg-orange-50 border border-orange-200"
            >
              <Warning size={18} weight="fill" className="text-orange-500 flex-shrink-0" />
              <p className="text-sm text-orange-800 flex-1">
                <span className="font-semibold">Izpolnite nastavitve označene s !</span>{' '}
                za brezhibno delovanje in izkoriščanje celotnega potenciala rezervacij.
              </p>
              {canManageSettings && (
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="text-xs font-semibold text-orange-700 hover:text-orange-900 underline underline-offset-2 flex-shrink-0"
                >
                  Odpri nastavitve →
                </button>
              )}
            </motion.div>
          )}

          {/* Monthly designs announcement banner */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 flex items-center gap-3 rounded-2xl px-5 py-3.5"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(59,130,246,0.06) 50%, rgba(6,182,212,0.08) 100%)',
              border: '1px solid rgba(139,92,246,0.15)',
            }}
          >
            <span style={{ fontSize: 16 }}>✦</span>
            <p className="text-sm font-semibold" style={{
              background: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Vsak mesec novi dizajni za booking strani
            </p>
          </motion.div>

          {/* Multi-channel info banner */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-6 flex items-start gap-3 rounded-2xl px-5 py-3.5 bg-amber-50 border border-amber-100"
          >
            <span className="text-amber-500 mt-0.5 flex-shrink-0" style={{ fontSize: 16 }}>💡</span>
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Vsak booking link lahko uporabite na drugem kanalu.</span>{' '}
              Na Instagram profilu en dizajn, na spletni strani drug, v email podpisu tretji – vsak kanal ima lahko svojega. Stranke vsakič pristanejo na isti vaši strani, samo z drugačnim videzom.
            </p>
          </motion.div>

          {/* Loading state */}
          {loading ? (
            <div className="flex items-center justify-center py-20 bg-white">
              <GradientSpinner />
            </div>
          ) : (
            <>
              {/* Standard Booking Pages */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 mb-6"
              >
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-[#1A1F36] mb-1">Standardne strani za rezervacijo</h2>
                  <p className="text-sm text-gray-500">Klasičen, Moderen in Minimalen dizajn</p>
                </div>
                <div className="overflow-x-auto pb-4 -mx-2 px-2">
                  <div className="flex gap-5" style={{ minWidth: 'max-content' }}>
                    {STANDARD_DESIGNS.map((design) => {
                      const designUrl = getDesignLink(design);
                      const isCopied = copiedDesignId === design.id;
                      return (
                        <div
                          key={design.id}
                          className="w-64 sm:w-80 flex-shrink-0 border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-md transition-all"
                        >
                          {/* Image placeholder */}
                          <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center mb-3 gap-1" style={{ height: '120px' }}>
                            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9H6" />
                            </svg>
                            <span className="text-xs text-gray-400">Slika</span>
                          </div>
                          <h3 className="font-semibold text-center text-gray-900 text-sm">{design.name}</h3>
                          <p className="text-xs text-center text-gray-500 mt-0.5">{design.subtitle}</p>
                          <p className="text-[10px] text-center text-gray-400 mt-1 mb-3 leading-relaxed">{design.description}</p>
                          <div className="space-y-2">
                            <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Booking link</p>
                              {designUrl ? (
                                <p
                                  className="text-xs truncate"
                                  style={{
                                    background: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                  }}
                                >
                                  {designUrl}
                                </p>
                              ) : (
                                <p className="text-xs text-gray-400">Ni na voljo</p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => copyToClipboard(designUrl, design.id)}
                                disabled={!designUrl}
                                className="flex-1 h-8 flex items-center justify-center gap-1 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 text-xs"
                              >
                                {isCopied ? (
                                  <><Check className="w-3 h-3 text-green-500" weight="bold" /><span className="text-green-600">Kopirano</span></>
                                ) : (
                                  <><Copy className="w-3 h-3 text-gray-500" weight="regular" /><span className="text-gray-600">Kopiraj</span></>
                                )}
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => window.open(designUrl, '_blank')}
                                disabled={!designUrl}
                                className="h-8 w-8 flex items-center justify-center bg-gradient-to-r from-violet-500 to-cyan-500 text-white rounded-lg shadow-sm disabled:opacity-50"
                              >
                                <ArrowSquareOut className="w-3.5 h-3.5" weight="bold" />
                              </motion.button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>

              {/* Premium Booking Pages */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 mb-8"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-semibold text-[#1A1F36]">Premium strani za rezervacijo</h2>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                        style={{ background: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)' }}
                      >
                        Premium
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">Sezonsko in Magazine dizajn</p>
                  </div>
                </div>
                <div className="overflow-x-auto pb-4 -mx-2 px-2">
                  <div className="flex gap-5" style={{ minWidth: 'max-content' }}>
                    {PREMIUM_DESIGNS.map((design) => {
                      const designUrl = getDesignLink(design);
                      const isCopied = copiedDesignId === design.id;
                      return (
                        <div
                          key={design.id}
                          className="w-64 sm:w-80 flex-shrink-0 border border-gray-200 rounded-xl p-4 hover:border-violet-200 hover:shadow-md transition-all"
                          style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.03), rgba(6,182,212,0.03))' }}
                        >
                          {/* Image placeholder */}
                          <div className="rounded-lg border-2 border-dashed border-violet-200 bg-violet-50/30 flex flex-col items-center justify-center mb-3 gap-1" style={{ height: '120px' }}>
                            <svg className="w-8 h-8 text-violet-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9H6" />
                            </svg>
                            <span className="text-xs text-violet-300">Slika</span>
                          </div>
                          <h3 className="font-semibold text-center text-gray-900 text-sm">{design.name}</h3>
                          <p className="text-xs text-center text-gray-500 mt-0.5">{design.subtitle}</p>
                          <p className="text-[10px] text-center text-gray-400 mt-1 mb-3 leading-relaxed">{design.description}</p>
                          <div className="space-y-2">
                            <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Booking link</p>
                              {designUrl ? (
                                <p
                                  className="text-xs truncate"
                                  style={{
                                    background: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                  }}
                                >
                                  {designUrl}
                                </p>
                              ) : (
                                <p className="text-xs text-gray-400">Kmalu na voljo</p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => copyToClipboard(designUrl, design.id)}
                                disabled={!designUrl}
                                className="flex-1 h-8 flex items-center justify-center gap-1 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 text-xs"
                              >
                                {isCopied ? (
                                  <><Check className="w-3 h-3 text-green-500" weight="bold" /><span className="text-green-600">Kopirano</span></>
                                ) : (
                                  <><Copy className="w-3 h-3 text-gray-500" weight="regular" /><span className="text-gray-600">Kopiraj</span></>
                                )}
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => window.open(designUrl, '_blank')}
                                disabled={!designUrl}
                                className="h-8 w-8 flex items-center justify-center bg-gradient-to-r from-violet-500 to-cyan-500 text-white rounded-lg shadow-sm disabled:opacity-50"
                              >
                                <ArrowSquareOut className="w-3.5 h-3.5" weight="bold" />
                              </motion.button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>

              {/* Custom booking CTA */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="mb-6 flex items-center gap-3 rounded-2xl px-5 py-4 bg-white shadow-sm ring-1 ring-gray-100"
              >
                <span className="text-lg flex-shrink-0">✉️</span>
                <p className="text-sm text-gray-600">
                  Želite prilagojen booking sistem prav za vaše podjetje?{' '}
                  <a
                    href="mailto:info@jedroplus.com"
                    className="font-semibold"
                    style={{
                      background: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    Pišite nam na info@jedroplus.com
                  </a>
                </p>
              </motion.div>

              {/* Main Booking Link */}
              {settings.mainBookingLink && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.23 }}
                  className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 mb-6"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Link className="w-5 h-5 text-violet-400" weight="regular" />
                    <h2 className="text-base font-semibold text-[#1A1F36]">Glavni booking link</h2>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Uporablja se pri pošiljanju strankam, kadar je potrebno deliti link za rezervacijo.
                  </p>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex-1 min-w-0">
                      <a
                        href={settings.mainBookingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm truncate block"
                        style={{
                          background: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                        }}
                      >
                        {settings.mainBookingLink}
                      </a>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          navigator.clipboard.writeText(settings.mainBookingLink);
                          setCopiedDesignId(-1);
                          setTimeout(() => setCopiedDesignId(null), 2000);
                        }}
                        className="h-8 px-3 flex items-center gap-1.5 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors text-xs"
                      >
                        {copiedDesignId === -1 ? (
                          <><Check className="w-3 h-3 text-green-500" weight="bold" /><span className="text-green-600">Kopirano</span></>
                        ) : (
                          <><Copy className="w-3 h-3 text-gray-500" weight="regular" /><span className="text-gray-600">Kopiraj</span></>
                        )}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => window.open(settings.mainBookingLink, '_blank')}
                        className="h-8 w-8 flex items-center justify-center bg-gradient-to-r from-violet-500 to-cyan-500 text-white rounded-lg shadow-sm"
                      >
                        <ArrowSquareOut className="w-3.5 h-3.5" weight="bold" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Appointment Management Link */}
              {settings.apptManagementLink && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 mb-6"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Link className="w-5 h-5 text-gray-400" weight="regular" />
                    <h2 className="text-base font-semibold text-[#1A1F36]">Link za prenaročanje in odpoved terminov</h2>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Univerzalen link za upravljanje terminov — stranke ga lahko uporabijo za prenaročanje ali odpoved.
                  </p>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex-1 min-w-0">
                      <a
                        href={settings.apptManagementLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm truncate block"
                        style={{
                          background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                        }}
                      >
                        {settings.apptManagementLink}
                      </a>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          navigator.clipboard.writeText(settings.apptManagementLink);
                          setCopiedMgmt(true);
                          setTimeout(() => setCopiedMgmt(false), 2000);
                        }}
                        className="h-8 px-3 flex items-center gap-1.5 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors text-xs"
                      >
                        {copiedMgmt ? (
                          <><Check className="w-3 h-3 text-green-500" weight="bold" /><span className="text-green-600">Kopirano</span></>
                        ) : (
                          <><Copy className="w-3 h-3 text-gray-500" weight="regular" /><span className="text-gray-600">Kopiraj</span></>
                        )}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => window.open(settings.apptManagementLink, '_blank')}
                        className="h-8 w-8 flex items-center justify-center bg-gradient-to-r from-violet-500 to-pink-500 text-white rounded-lg shadow-sm"
                      >
                        <ArrowSquareOut className="w-3.5 h-3.5" weight="bold" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Settings Overview */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100"
              >
                <h2 className="text-base font-semibold text-[#1A1F36] mb-4">Nastavitve</h2>
                <div className="space-y-3">
                  {/* Booking Enabled - single row */}
                  <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-gray-400" weight="regular" />
                      <span className="text-sm font-medium text-gray-700">Spletne rezervacije</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-semibold", settings.bookingOmogocen ? "text-green-600" : "text-red-500")}>
                        {settings.bookingOmogocen ? 'Omogočeno' : 'Onemogočeno'}
                      </span>
                      <div className={cn("w-2.5 h-2.5 rounded-full", settings.bookingOmogocen ? "bg-green-500" : "bg-red-400")} />
                    </div>
                  </div>

                  {/* Time Slots */}
                  <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" weight="regular" />
                      <span className="text-sm font-medium text-gray-700">Časovni intervali</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{settings.timeSlotLength} min</span>
                  </div>

                  {/* Confirmations */}
                  <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-gray-400" weight="regular" />
                      <span className="text-sm font-medium text-gray-700">Potrdilo stranki</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {settings.sendClientConfirmation && (
                        <span className="text-xs font-medium text-gray-500 uppercase">
                          {settings.clientConfirmationChannel === 'sms' ? 'SMS' : 'Email'}
                        </span>
                      )}
                      <span className={cn("text-sm font-semibold", settings.sendClientConfirmation ? "text-green-600" : "text-gray-400")}>
                        {settings.sendClientConfirmation ? 'Da' : 'Ne'}
                      </span>
                      <div className={cn("w-2.5 h-2.5 rounded-full", settings.sendClientConfirmation ? "bg-green-500" : "bg-gray-300")} />
                    </div>
                  </div>

                  {/* Online confirmation */}
                  <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-gray-400" weight="regular" />
                      <span className="text-sm font-medium text-gray-700">Potrdilo po spletni rezervaciji</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {settings.sendOnlineConfirmation && (
                        <span className="text-xs font-medium text-gray-500 uppercase">
                          {settings.onlineConfirmationChannel === 'sms' ? 'SMS' : 'Email'}
                        </span>
                      )}
                      <span className={cn("text-sm font-semibold", settings.sendOnlineConfirmation ? "text-green-600" : "text-gray-400")}>
                        {settings.sendOnlineConfirmation ? 'Da' : 'Ne'}
                      </span>
                      <div className={cn("w-2.5 h-2.5 rounded-full", settings.sendOnlineConfirmation ? "bg-green-500" : "bg-gray-300")} />
                    </div>
                  </div>

                  {/* Main Booking Link row */}
                  {settings.mainBookingLink && (
                    <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <Link className="w-4 h-4 text-gray-400" weight="regular" />
                        <span className="text-sm font-medium text-gray-700">Glavni booking link</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-violet-400" />
                        <span className="text-sm font-semibold text-violet-600">Nastavljen</span>
                      </div>
                    </div>
                  )}

                  {/* Colors */}
                  <div className={`flex items-center justify-between py-2.5 ${(settings.apptManagementLink || settings.mainBookingLink) ? 'border-b border-gray-100' : ''}`}>
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-gray-400" weight="regular" />
                      <span className="text-sm font-medium text-gray-700">Barve</span>
                    </div>
                    <div className="flex gap-1.5">
                      {[settings.primaryColor, settings.secondaryColor, settings.bgFromColor, settings.bgToColor].map((color, i) => (
                        <div key={i} className="w-6 h-6 rounded-md border border-gray-200 shadow-inner" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                  </div>

                  {/* Appointment Management Link */}
                  {settings.apptManagementLink && (
                    <div className="flex items-start justify-between gap-4 py-2.5">
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Link className="w-4 h-4 text-gray-400" weight="regular" />
                        <span className="text-sm font-medium text-gray-700">Link za prenaročanje in odpoved</span>
                      </div>
                      <a
                        href={settings.apptManagementLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium truncate max-w-xs"
                        style={{
                          background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                        }}
                      >
                        {settings.apptManagementLink}
                      </a>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </div>
      </main>

      {/* Settings Modal */}
      <BookingSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </ProtectedLayout>
  );
}
