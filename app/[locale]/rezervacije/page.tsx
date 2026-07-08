'use client';

import { useEffect, useState, useCallback, type CSSProperties } from 'react';
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
import { useTranslations } from 'next-intl';
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
  designKey: string;
  linkKey: keyof ReservationSettings;
  accent: string;
  squareStyle: CSSProperties;
  badgeStyle: CSSProperties;
  titleStyle: CSSProperties;
  subtitleStyle: CSSProperties;
  bodyStyle: CSSProperties;
  dividerStyle: CSSProperties;
}

const STANDARD_DESIGNS: BookingDesign[] = [
  {
    id: 1,
    designKey: 'classic',
    linkKey: 'bookingLink1',
    accent: 'linear-gradient(135deg, #7c3aed, #2563eb, #06b6d4)',
    squareStyle: {
      background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 58%, #06B6D4 100%)',
      color: 'rgba(255,255,255,0.96)',
      borderColor: 'rgba(255,255,255,0.22)',
      fontFamily: '"Nunito", var(--font-geist-sans), Arial, sans-serif',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
    },
    badgeStyle: {
      background: 'rgba(255,255,255,0.18)',
      color: 'rgba(255,255,255,0.92)',
      borderColor: 'rgba(255,255,255,0.26)',
    },
    titleStyle: {
      color: '#FFFFFF',
      fontFamily: '"Nunito", var(--font-geist-sans), Arial, sans-serif',
      fontWeight: 800,
    },
    subtitleStyle: { color: 'rgba(255,255,255,0.72)' },
    bodyStyle: { color: 'rgba(255,255,255,0.78)' },
    dividerStyle: {
      background: 'linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,0.08))',
    },
  },
  {
    id: 2,
    designKey: 'modern',
    linkKey: 'bookingLink2',
    accent: 'linear-gradient(135deg, #111827, #f43f5e)',
    squareStyle: {
      background: 'linear-gradient(135deg, #0F0F1A 0%, #1A0A1E 56%, #111827 100%)',
      color: '#F8FAFC',
      borderColor: 'rgba(244,63,94,0.28)',
      fontFamily: '"DM Sans", var(--font-geist-sans), Arial, sans-serif',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
    },
    badgeStyle: {
      background: 'rgba(244,63,94,0.12)',
      color: '#FDA4AF',
      borderColor: 'rgba(244,63,94,0.36)',
    },
    titleStyle: {
      color: '#F8FAFC',
      fontFamily: '"Clash Display", var(--font-geist-sans), Arial, sans-serif',
      fontWeight: 400,
    },
    subtitleStyle: { color: 'rgba(248,250,252,0.6)' },
    bodyStyle: { color: 'rgba(248,250,252,0.68)' },
    dividerStyle: {
      background: 'linear-gradient(90deg, #F43F5E, rgba(244,63,94,0.05))',
    },
  },
  {
    id: 3,
    designKey: 'elegant',
    linkKey: 'bookingLink3',
    accent: 'linear-gradient(135deg, #3d2b1f, #c4956a)',
    squareStyle: {
      background: 'linear-gradient(180deg, rgba(196,149,106,0.12) 0%, #FFFFFF 22%, #FFFFFF 78%, rgba(196,149,106,0.08) 100%)',
      color: '#3D2B1F',
      borderColor: '#E8DDD1',
      fontFamily: 'Inter, var(--font-geist-sans), Arial, sans-serif',
    },
    badgeStyle: {
      background: '#FAF7F2',
      color: '#9C8572',
      borderColor: '#E8DDD1',
    },
    titleStyle: {
      color: '#3D2B1F',
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontWeight: 500,
    },
    subtitleStyle: { color: '#9C8572' },
    bodyStyle: { color: '#6F5A49' },
    dividerStyle: {
      background: '#C4956A',
    },
  },
];

const PREMIUM_DESIGNS: BookingDesign[] = [
  {
    id: 4,
    designKey: 'seasonal',
    linkKey: 'bookingLink4',
    accent: 'linear-gradient(135deg, #38BDF8, #FACC15)',
    squareStyle: {
      background: 'linear-gradient(150deg, #E0F7FF 0%, #BAE6FD 58%, #F0F9FF 100%)',
      color: '#0F172A',
      borderColor: 'rgba(14,165,233,0.22)',
      fontFamily: '"Quicksand", var(--font-geist-sans), Arial, sans-serif',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
    },
    badgeStyle: {
      background: 'rgba(255,255,255,0.62)',
      color: '#0F172A',
      borderColor: 'rgba(14,165,233,0.24)',
    },
    titleStyle: {
      color: '#0F172A',
      fontFamily: '"Quicksand", var(--font-geist-sans), Arial, sans-serif',
      fontWeight: 700,
    },
    subtitleStyle: { color: 'rgba(15,23,42,0.72)' },
    bodyStyle: { color: 'rgba(15,23,42,0.72)' },
    dividerStyle: {
      background: 'linear-gradient(90deg, #0EA5E9, rgba(250,204,21,0.55), transparent)',
    },
  },
  {
    id: 5,
    designKey: 'magazine',
    linkKey: 'bookingLink5',
    accent: 'linear-gradient(135deg, #1a1a2e, #8b5cf6)',
    squareStyle: {
      background: '#FAFAF9',
      color: '#1A1A1A',
      borderColor: 'rgba(0,0,0,0.1)',
      fontFamily: 'Georgia, "Times New Roman", serif',
    },
    badgeStyle: {
      background: '#FFFFFF',
      color: '#6B6B6B',
      borderColor: 'rgba(0,0,0,0.12)',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
    },
    titleStyle: {
      color: '#1A1A1A',
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontWeight: 500,
    },
    subtitleStyle: {
      color: '#6B6B6B',
      fontStyle: 'italic',
    },
    bodyStyle: { color: '#525252' },
    dividerStyle: {
      borderTop: '1px dotted rgba(0,0,0,0.28)',
      background: 'transparent',
    },
  },
  {
    id: 6,
    designKey: 'casino',
    linkKey: 'bookingLink6',
    accent: 'linear-gradient(135deg, #a07830, #c9a84c, #e8c96d)',
    squareStyle: {
      background:
        'repeating-linear-gradient(45deg, rgba(201,168,76,0.018) 0 1px, transparent 1px 12px), repeating-linear-gradient(-45deg, rgba(201,168,76,0.012) 0 1px, transparent 1px 14px), radial-gradient(circle at 20% 20%, #145228 0%, transparent 34%), radial-gradient(circle at 80% 78%, #0D3B1E 0%, transparent 38%), #060F08',
      color: '#F5EDD6',
      borderColor: 'rgba(201,168,76,0.3)',
      fontFamily: 'Georgia, "Times New Roman", serif',
      boxShadow: 'inset 0 1px 0 rgba(232,201,109,0.13)',
    },
    badgeStyle: {
      background: 'rgba(201,168,76,0.12)',
      color: '#E8C96D',
      borderColor: 'rgba(201,168,76,0.38)',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
    },
    titleStyle: {
      color: '#F5EDD6',
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontWeight: 700,
    },
    subtitleStyle: {
      color: '#C9A84C',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
    },
    bodyStyle: {
      color: '#E8D9B8',
      fontStyle: 'italic',
    },
    dividerStyle: {
      background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.75), transparent)',
    },
  },
];

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function RezervacijePage() {
  const t = useTranslations('reservations');
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
  const renderDesignCard = (design: BookingDesign) => {
    const designUrl = getDesignLink(design);
    const isCopied = copiedDesignId === design.id;
    const designName = t(`designs.${design.designKey}.name`);

    return (
      <motion.article
        key={design.id}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        className="group flex h-full w-[260px] flex-none flex-col rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:border-gray-300 hover:shadow-lg md:w-full md:p-4"
      >
        <div
          className="relative aspect-square overflow-hidden rounded-lg border p-4 sm:p-5"
          style={design.squareStyle}
        >
          {design.designKey === 'seasonal' && (
            <>
              <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[#FACC15] shadow-[0_0_36px_rgba(250,204,21,0.5)] sm:-right-7 sm:-top-7 sm:h-24 sm:w-24 sm:shadow-[0_0_44px_rgba(250,204,21,0.52)]" />
              <div className="pointer-events-none absolute right-3 top-3 h-10 w-10 rounded-full border border-yellow-300/60 sm:right-4 sm:top-4 sm:h-12 sm:w-12" />
            </>
          )}
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="flex items-center">
              <span
                className="flex h-7 min-w-7 items-center justify-center rounded-md border px-2 text-[11px] font-semibold"
                style={design.badgeStyle}
              >
                {String(design.id).padStart(2, '0')}
              </span>
            </div>

            <div>
              <div className="mb-3 h-px w-16 sm:mb-5 sm:w-20" style={design.dividerStyle} />
              <h3 className="text-xl leading-tight sm:text-2xl" style={design.titleStyle}>
                {designName}
              </h3>
              <p className="mt-1.5 text-xs font-medium leading-5 sm:mt-2 sm:text-sm" style={design.subtitleStyle}>
                {t(`designs.${design.designKey}.subtitle`)}
              </p>
              <p
                className="mt-3 text-xs leading-5 sm:mt-4 sm:text-sm sm:leading-6"
                style={{
                  ...design.bodyStyle,
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 4,
                  overflow: 'hidden',
                }}
              >
                {t(`designs.${design.designKey}.description`)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_40px] gap-2">
          <motion.button
            whileHover={designUrl ? { scale: 1.01 } : undefined}
            whileTap={designUrl ? { scale: 0.99 } : undefined}
            onClick={() => copyToClipboard(designUrl, design.id)}
            disabled={!designUrl}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isCopied ? (
              <>
                <Check className="h-4 w-4 text-green-500" weight="bold" />
                <span className="text-green-600">{t('designs.copied')}</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-gray-500" weight="regular" />
                <span>{t('designs.copy')}</span>
              </>
            )}
          </motion.button>
          <motion.button
            whileHover={designUrl ? { scale: 1.03 } : undefined}
            whileTap={designUrl ? { scale: 0.97 } : undefined}
            onClick={() => window.open(designUrl, '_blank')}
            disabled={!designUrl}
            aria-label={`${designName} ${t('designs.bookingLinkLabel')}`}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
            style={{ background: design.accent }}
          >
            <ArrowSquareOut className="h-4 w-4" weight="bold" />
          </motion.button>
        </div>
      </motion.article>
    );
  };

  return (
    <ProtectedLayout>
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex flex-wrap items-start justify-between gap-4"
          >
            <div>
              <h1
                className="text-3xl font-normal text-[#1A1F36]"
                style={{ fontFamily: '"Clash Display", var(--font-geist-sans), Arial, sans-serif' }}
              >
                {t('page.title')}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('page.subtitle')}
              </p>
            </div>

            {/* Settings button - icon only */}
            {canManageSettings && (
              <motion.button
                onClick={() => setShowSettingsModal(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                title={t('modal.title')}
              >
                <Gear size={20} weight="bold" className="text-gray-900" />
                {hasIncompleteSettings && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-orange-500 text-white" style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>!</span>
                )}
              </motion.button>
            )}
          </motion.div>

          {/* Incomplete settings banner */}
          {hasIncompleteSettings && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-5 py-3.5"
            >
              <Warning size={18} weight="fill" className="text-orange-500 flex-shrink-0" />
              <p className="text-sm text-orange-800 flex-1">
                {t('incompleteBanner.message')}
              </p>
              {canManageSettings && (
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="text-xs font-semibold text-orange-700 hover:text-orange-900 underline underline-offset-2 flex-shrink-0"
                >
                  {t('incompleteBanner.openButton')}
                </button>
              )}
            </motion.div>
          )}

          <div className="mb-6 grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 rounded-lg border border-violet-100 bg-white px-5 py-4 shadow-sm"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-violet-50">
                <Palette className="h-4 w-4 text-violet-600" weight="bold" />
              </div>
              <p
                className="text-sm font-semibold"
                style={{
                  background: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {t('newDesignsBanner')}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="flex items-start gap-3 rounded-lg border border-amber-100 bg-white px-5 py-4 shadow-sm"
            >
              <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50">
                <Link className="h-4 w-4 text-amber-600" weight="bold" />
              </div>
              <p className="text-sm leading-6 text-gray-600">
                <span className="font-semibold text-gray-900">{t('multiChannelBanner.bold')}</span>{' '}
                {t('multiChannelBanner.body')}
              </p>
            </motion.div>
          </div>

          {/* Loading state */}
          {loading ? (
            <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-20 shadow-sm">
              <GradientSpinner />
            </div>
          ) : (
            <>
              {/* Standard Booking Pages */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="mb-1 text-lg font-semibold text-[#1A1F36]">{t('standardSection.title')}</h2>
                    <p className="text-sm text-gray-500">{t('standardSection.subtitle')}</p>
                  </div>
                  <div className="flex gap-1.5">
                    {STANDARD_DESIGNS.map((design) => (
                      <span
                        key={design.id}
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: design.accent }}
                      />
                    ))}
                  </div>
                </div>
                <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-3">
                  {STANDARD_DESIGNS.map((design) => renderDesignCard(design))}
                </div>
              </motion.div>

              {/* Premium Booking Pages */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-[#1A1F36]">{t('premiumSection.title')}</h2>
                      <span
                        className="rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                        style={{ background: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)' }}
                      >
                        Premium
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{t('premiumSection.subtitle')}</p>
                  </div>
                  <div className="flex gap-1.5">
                    {PREMIUM_DESIGNS.map((design) => (
                      <span
                        key={design.id}
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: design.accent }}
                      />
                    ))}
                  </div>
                </div>
                <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-3">
                  {PREMIUM_DESIGNS.map((design) => renderDesignCard(design))}
                </div>
              </motion.div>

              {/* Custom booking CTA */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="mb-6 flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-50">
                  <Link className="h-4 w-4 text-gray-500" weight="bold" />
                </div>
                <p className="text-sm text-gray-600">
                  {t('customCta.text')}{' '}
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
                    {t('customCta.linkText')}
                  </a>
                </p>
              </motion.div>

              {/* Main Booking Link */}
              {settings.mainBookingLink && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.23 }}
                  className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Link className="w-5 h-5 text-violet-400" weight="regular" />
                    <h2 className="text-base font-semibold text-[#1A1F36]">{t('mainLink.title')}</h2>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    {t('mainLink.subtitle')}
                  </p>
                  <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
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
                          <><Check className="w-3 h-3 text-green-500" weight="bold" /><span className="text-green-600">{t('mainLink.copied')}</span></>
                        ) : (
                          <><Copy className="w-3 h-3 text-gray-500" weight="regular" /><span className="text-gray-600">{t('mainLink.copy')}</span></>
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
                  className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Link className="w-5 h-5 text-gray-400" weight="regular" />
                    <h2 className="text-base font-semibold text-[#1A1F36]">{t('mgmtLink.title')}</h2>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    {t('mgmtLink.subtitle')}
                  </p>
                  <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
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
                          <><Check className="w-3 h-3 text-green-500" weight="bold" /><span className="text-green-600">{t('mainLink.copied')}</span></>
                        ) : (
                          <><Copy className="w-3 h-3 text-gray-500" weight="regular" /><span className="text-gray-600">{t('mainLink.copy')}</span></>
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
                className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
              >
                <h2 className="text-base font-semibold text-[#1A1F36] mb-4">{t('settingsOverview.title')}</h2>
                <div className="space-y-3">
                  {/* Booking Enabled - single row */}
                  <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-gray-400" weight="regular" />
                      <span className="text-sm font-medium text-gray-700">{t('settingsOverview.bookingEnabled')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-semibold", settings.bookingOmogocen ? "text-green-600" : "text-red-500")}>
                        {settings.bookingOmogocen ? t('settingsOverview.enabled') : t('settingsOverview.disabled')}
                      </span>
                      <div className={cn("w-2.5 h-2.5 rounded-full", settings.bookingOmogocen ? "bg-green-500" : "bg-red-400")} />
                    </div>
                  </div>

                  {/* Time Slots */}
                  <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" weight="regular" />
                      <span className="text-sm font-medium text-gray-700">{t('settingsOverview.timeSlots')}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{t('settingsOverview.timeSlotValue', { minutes: settings.timeSlotLength })}</span>
                  </div>

                  {/* Confirmations */}
                  <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-gray-400" weight="regular" />
                      <span className="text-sm font-medium text-gray-700">{t('settingsOverview.clientConfirm')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {settings.sendClientConfirmation && (
                        <span className="text-xs font-medium text-gray-500 uppercase">
                          {settings.clientConfirmationChannel === 'sms' ? 'SMS' : 'Email'}
                        </span>
                      )}
                      <span className={cn("text-sm font-semibold", settings.sendClientConfirmation ? "text-green-600" : "text-gray-400")}>
                        {settings.sendClientConfirmation ? t('settingsOverview.yes') : t('settingsOverview.no')}
                      </span>
                      <div className={cn("w-2.5 h-2.5 rounded-full", settings.sendClientConfirmation ? "bg-green-500" : "bg-gray-300")} />
                    </div>
                  </div>

                  {/* Online confirmation */}
                  <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-gray-400" weight="regular" />
                      <span className="text-sm font-medium text-gray-700">{t('settingsOverview.onlineConfirm')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {settings.sendOnlineConfirmation && (
                        <span className="text-xs font-medium text-gray-500 uppercase">
                          {settings.onlineConfirmationChannel === 'sms' ? 'SMS' : 'Email'}
                        </span>
                      )}
                      <span className={cn("text-sm font-semibold", settings.sendOnlineConfirmation ? "text-green-600" : "text-gray-400")}>
                        {settings.sendOnlineConfirmation ? t('settingsOverview.yes') : t('settingsOverview.no')}
                      </span>
                      <div className={cn("w-2.5 h-2.5 rounded-full", settings.sendOnlineConfirmation ? "bg-green-500" : "bg-gray-300")} />
                    </div>
                  </div>

                  {/* Main Booking Link row */}
                  {settings.mainBookingLink && (
                    <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <Link className="w-4 h-4 text-gray-400" weight="regular" />
                        <span className="text-sm font-medium text-gray-700">{t('settingsOverview.mainLinkLabel')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-violet-400" />
                        <span className="text-sm font-semibold text-violet-600">{t('settingsOverview.linkSet')}</span>
                      </div>
                    </div>
                  )}

                  {/* Colors */}
                  <div className={`flex items-center justify-between py-2.5 ${(settings.apptManagementLink || settings.mainBookingLink) ? 'border-b border-gray-100' : ''}`}>
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-gray-400" weight="regular" />
                      <span className="text-sm font-medium text-gray-700">{t('settingsOverview.colors')}</span>
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
                        <span className="text-sm font-medium text-gray-700">{t('settingsOverview.mgmtLinkLabel')}</span>
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
