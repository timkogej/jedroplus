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
} from '@phosphor-icons/react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { supabase } from '@/lib/supabaseClient';
import { loadCompanyRow } from '@/lib/settingsStore';
import { BookingSettingsModal } from '@/components/booking/BookingSettingsModal';
import {
  Design1Preview,
  Design2Preview,
  Design3Preview,
  Design4Preview,
} from '@/components/reservations/BookingDesignPreviews';

interface ReservationSettings {
  timeSlotLength: number;
  sendClientConfirmation: boolean;
  sendOnlineConfirmation: boolean;
  primaryColor: string;
  secondaryColor: string;
  bgFromColor: string;
  bgToColor: string;
  bookingUrl: string;
}

interface BookingDesign {
  id: number;
  name: string;
  subtitle: string;
  description: string;
}

const BOOKING_DESIGNS: BookingDesign[] = [
  {
    id: 1,
    name: 'Klasičen',
    subtitle: 'Preprost in pregleden',
    description: 'Klasičen dizajn z elegantnimi gradient ozadji. Idealno za prikaz barv vašega podjetja in ustvarjanje prepoznavne blagovne znamke.',
  },
  {
    id: 2,
    name: 'Moderen',
    subtitle: 'Sodoben in dinamičen',
    description: 'Sodoben dizajn s temnim ozadjem in živahnimi poudarki. Priporočamo temnejšo primarno barvo za najboljši vizualni učinek in premium občutek.',
  },
  {
    id: 3,
    name: 'Minimalen',
    subtitle: 'Čist in enostaven',
    description: 'Luksuzni minimalistični dizajn z nežnimi zemeljskimi toni. Popoln za elegantne salone, spa centre in ekskluzivne storitve.',
  },
  {
    id: 4,
    name: 'Sezonsko',
    subtitle: 'Prilagodljiv in živahen',
    description: 'Dinamičen dizajn, ki se samodejno prilagaja letnemu času in praznikom. Pomlad, poletje, jesen, zima, božič, valentinovo, noč čarovnic in več – vaša stran je vedno sveža in aktualna.',
  },
];

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function RezervacijePage() {
  const router = useRouter();
  const { companyId, companyUuid, loading: companyLoading } = useCompany();

  const [settings, setSettings] = useState<ReservationSettings>({
    timeSlotLength: 30,
    sendClientConfirmation: false,
    sendOnlineConfirmation: false,
    primaryColor: '#8B5CF6',
    secondaryColor: '#06B6D4',
    bgFromColor: '#8B5CF6',
    bgToColor: '#06B6D4',
    bookingUrl: '',
  });

  const [loading, setLoading] = useState(true);
  const [copiedDesignId, setCopiedDesignId] = useState<number | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Fetch settings from same tables as Nastavitve > Rezervacije
  const fetchSettings = useCallback(async () => {
    if (!companyId) return;

    try {
      setLoading(true);

      // Fetch from Podatki podjetij table using loadCompanyRow
      const { data: podatkiRow } = await loadCompanyRow(companyId);

      // Fetch booking URL from companies table using companyUuid
      let bookingUrl = '';
      if (companyUuid) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('booking_url')
          .eq('id', companyUuid)
          .single();

        bookingUrl = companyData?.booking_url || '';
      }

      // Extract settings from the row
      const timeSlotValue = podatkiRow?.['koledar_ure'] || podatkiRow?.['Koledar_ure'] || 30;
      const sendConfirmation = podatkiRow?.['Potrdilo ob rezervaciji'] === 'yes' || podatkiRow?.['potrdilo_ob_rezervaciji'] === 'yes';
      const sendOnlineConfirmation = podatkiRow?.['Potrdilo online rez'] === 'yes' || podatkiRow?.['potrdilo_online_rez'] === 'yes';
      const primaryColor = (podatkiRow?.['Booking_primary'] || podatkiRow?.['booking_primary'] || '#8B5CF6') as string;
      const secondaryColor = (podatkiRow?.['Booking_secondary'] || podatkiRow?.['booking_secondary'] || '#06B6D4') as string;
      const bgFromColor = (podatkiRow?.['booking_bg_from'] || podatkiRow?.['Booking_bg_from'] || primaryColor) as string;
      const bgToColor = (podatkiRow?.['booking_bg_to'] || podatkiRow?.['Booking_bg_to'] || secondaryColor) as string;

      setSettings({
        timeSlotLength: typeof timeSlotValue === 'number' ? timeSlotValue : parseInt(String(timeSlotValue), 10) || 30,
        sendClientConfirmation: sendConfirmation,
        sendOnlineConfirmation: sendOnlineConfirmation,
        primaryColor: primaryColor,
        secondaryColor: secondaryColor,
        bgFromColor: bgFromColor,
        bgToColor: bgToColor,
        bookingUrl: bookingUrl,
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId, companyUuid]);

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

  const getDesignBookingUrl = (designId: number) => {
    if (!settings.bookingUrl) return '';
    // Add design parameter to URL
    const baseUrl = settings.bookingUrl;
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}design=${designId}`;
  };

  const copyToClipboard = (text: string, designId: number) => {
    navigator.clipboard.writeText(text);
    setCopiedDesignId(designId);
    setTimeout(() => setCopiedDesignId(null), 2000);
  };

  if (companyLoading || !companyId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
      </div>
    );
  }

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
            <motion.button
              onClick={() => setShowSettingsModal(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow"
              title="Nastavitve"
            >
              <Gear size={20} weight="bold" className="text-gray-900" />
            </motion.button>
          </motion.div>

          {/* Loading state */}
          {loading ? (
            <div className="flex items-center justify-center py-20 bg-white">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Booking Design Selection - Horizontally scrollable */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 mb-8"
              >
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-[#1A1F36] mb-1">Izbira dizajna</h2>
                  <p className="text-sm text-gray-500">
                    Izberite dizajn za vašo stran za online rezervacije
                  </p>
                </div>

                {/* Horizontally scrollable design cards */}
                <div className="overflow-x-auto pb-4 -mx-2 px-2">
                  <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
                    {BOOKING_DESIGNS.map((design) => {
                      const designUrl = getDesignBookingUrl(design.id);
                      const isCopied = copiedDesignId === design.id;

                      return (
                        <motion.div
                          key={design.id}
                          whileHover={{ scale: 1.02 }}
                          className="w-64 flex-shrink-0 border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-md transition-all"
                        >
                          {/* Design Preview */}
                          <div className="rounded-lg mb-3 overflow-hidden" style={{ height: '140px' }}>
                            {design.id === 1 && <Design1Preview />}
                            {design.id === 2 && <Design2Preview />}
                            {design.id === 3 && <Design3Preview />}
                            {design.id === 4 && <Design4Preview />}
                          </div>

                          <h3 className="font-semibold text-center text-gray-900 text-sm">{design.name}</h3>
                          <p className="text-xs text-center text-gray-500 mt-0.5">{design.subtitle}</p>
                          <p className="text-[10px] text-center text-gray-400 mt-1 mb-3 leading-relaxed">{design.description}</p>

                          {/* Booking Link for this design */}
                          <div className="space-y-2">
                            <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Link za ta dizajn</p>
                              <p className="text-xs font-mono text-gray-700 truncate">
                                {designUrl || 'Ni na voljo'}
                              </p>
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
                                  <>
                                    <Check className="w-3 h-3 text-green-500" weight="bold" />
                                    <span className="text-green-600">Kopirano</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-gray-500" weight="regular" />
                                    <span className="text-gray-600">Kopiraj</span>
                                  </>
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
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>

              {/* Settings Overview - with black outline icons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                {/* Time Slots */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <Clock className="w-5 h-5 text-black" weight="regular" />
                    <h3 className="font-bold text-lg text-gray-900">Časovni intervali</h3>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">
                    {settings.timeSlotLength} min
                  </div>
                  <p className="text-sm text-gray-500 mt-2">Dolžina časovnih intervalov</p>
                </div>

                {/* Confirmations */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle className="w-5 h-5 text-black" weight="regular" />
                    <h3 className="font-bold text-lg text-gray-900">Potrdila</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        settings.sendClientConfirmation ? "bg-green-500" : "bg-gray-300"
                      )} />
                      <span className="text-gray-700">Potrdilo stranki</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        settings.sendOnlineConfirmation ? "bg-green-500" : "bg-gray-300"
                      )} />
                      <span className="text-gray-700">Online rezervacija</span>
                    </div>
                  </div>
                </div>

                {/* Colors - all 4 from database */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <Palette className="w-5 h-5 text-black" weight="regular" />
                    <h3 className="font-bold text-lg text-gray-900">Barve</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-lg border border-gray-200 shadow-inner flex-shrink-0"
                        style={{ backgroundColor: settings.primaryColor }}
                      />
                      <div className="min-w-0">
                        <span className="text-xs text-gray-600 block">Primarna</span>
                        <p className="text-[10px] text-gray-400 font-mono truncate">{settings.primaryColor}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-lg border border-gray-200 shadow-inner flex-shrink-0"
                        style={{ backgroundColor: settings.secondaryColor }}
                      />
                      <div className="min-w-0">
                        <span className="text-xs text-gray-600 block">Sekundarna</span>
                        <p className="text-[10px] text-gray-400 font-mono truncate">{settings.secondaryColor}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-lg border border-gray-200 shadow-inner flex-shrink-0"
                        style={{ backgroundColor: settings.bgFromColor }}
                      />
                      <div className="min-w-0">
                        <span className="text-xs text-gray-600 block">Ozadje od</span>
                        <p className="text-[10px] text-gray-400 font-mono truncate">{settings.bgFromColor}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-lg border border-gray-200 shadow-inner flex-shrink-0"
                        style={{ backgroundColor: settings.bgToColor }}
                      />
                      <div className="min-w-0">
                        <span className="text-xs text-gray-600 block">Ozadje do</span>
                        <p className="text-[10px] text-gray-400 font-mono truncate">{settings.bgToColor}</p>
                      </div>
                    </div>
                  </div>
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
