'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
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
  ClipboardText,
  CaretRight,
  Lock,
  QrCode,
} from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import ProtectedLayout from '@/components/ProtectedLayout';
import { useCompany } from '@/app/company-context';
import { isJedroProPlan } from '@/lib/onlinePayments';
import { useRolePermissions } from '@/app/role-permission-context';
import { loadCompanyRow } from '@/lib/settingsStore';
import { GradientSpinner } from '@/components/ui/GradientSpinner';
import { DesignCard } from '@/components/reservations/DesignCard';
import {
  STANDARD_DESIGNS,
  PREMIUM_DESIGNS,
  type BookingDesign,
} from '@/lib/reservations/bookingDesigns';
import {
  SectionPanel,
  SettingRow,
  StatusPill,
  ValuePill,
} from '@/components/ui/OverviewPrimitives';
import {
  DEFAULT_RESERVATION_SETTINGS,
  parseReservationSettings,
  type ReservationSettings,
} from '@/lib/reservations/reservationSettings';

// Lazy-load the settings modal (750 lines + deps) — it only renders on
// Gear-click, so it stays out of the initial bundle. Same pattern as the
// clients page's CrmImportModal. Its internal refetch-on-open is unchanged.
const BookingSettingsModal = dynamic(
  () => import('@/components/booking/BookingSettingsModal').then((m) => m.BookingSettingsModal),
  { ssr: false }
);

export default function RezervacijeClient({
  initialData,
}: {
  initialData: ReservationSettings | null;
}) {
  const t = useTranslations('reservations');
  const router = useRouter();
  const { companyId, loading: companyLoading, planCode } = useCompany();
  // Pro designs are part of Jedro Pro (and above). Other plans can look but not copy.
  const proDesignsUnlocked = isJedroProPlan(planCode) || String(planCode ?? '').toUpperCase().includes('ENTERPRISE');
  const { role, permissions } = useRolePermissions();
  const canManageSettings = role !== 'staff' || (permissions?.can_manage_rezervacije ?? true);

  const [settings, setSettings] = useState<ReservationSettings>(
    initialData ?? DEFAULT_RESERVATION_SETTINGS
  );

  const [loading, setLoading] = useState(!initialData);

  // When the server already seeded settings, skip the mount fetch once. Resets
  // so back-navigation (component remount without a fresh server pass) refetches.
  const skipAutoFetch = useRef(!!initialData);
  const [copiedDesignId, setCopiedDesignId] = useState<number | null>(null);
  const [copiedMgmt, setCopiedMgmt] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Fetch settings from same tables as Nastavitve > Rezervacije
  const fetchSettings = useCallback(async () => {
    if (!companyId) return;

    try {
      setLoading(true);

      // Fetch from Podatki podjetij table using loadCompanyRow, then map via the
      // shared parser (same mapping the server loader uses) for identical output.
      const { data: podatkiRow } = await loadCompanyRow(companyId);
      setSettings(parseReservationSettings(podatkiRow));
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

  // Fetch settings on mount. When the server already seeded settings, skip this
  // once so there's no duplicate fetch / spinner flash on first paint.
  useEffect(() => {
    if (!companyId) return;
    if (skipAutoFetch.current) {
      skipAutoFetch.current = false;
      return;
    }
    fetchSettings();
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

  const availableBookingLinks = [
    settings.bookingLink1,
    settings.bookingLink2,
    settings.bookingLink3,
    settings.bookingLink4,
    settings.bookingLink5,
    settings.bookingLink6,
  ].filter((link) => String(link).trim());
  const hasBookingLinksAvailable = availableBookingLinks.length > 0;
  const hasMainBookingLink = Boolean(settings.mainBookingLink.trim());
  const hasIncompleteSettings =
    !loading && settings.bookingOmogocen && hasBookingLinksAvailable && !hasMainBookingLink;
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

            {/* Settings button */}
            {canManageSettings && (
              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                className="relative inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 active:bg-gray-100"
                title={t('modal.title')}
              >
                <Gear size={17} weight="regular" className="text-gray-500" />
                {t('modal.title')}
                {hasIncompleteSettings && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-amber-500 text-[9px] font-bold leading-none text-white">!</span>
                )}
              </button>
            )}
          </motion.div>

          {/* Incomplete settings banner */}
          {hasIncompleteSettings && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4"
            >
              <Warning size={18} weight="regular" className="flex-shrink-0 text-amber-600" />
              <p className="flex-1 text-sm font-medium text-amber-900">
                {t('incompleteBanner.message')}
              </p>
              {canManageSettings && (
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="flex-shrink-0 text-xs font-semibold text-amber-900 underline underline-offset-4 transition hover:text-amber-700"
                >
                  {t('incompleteBanner.openButton')}
                </button>
              )}
            </motion.div>
          )}

          {/* Zahteve za termin nav card */}
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -1 }}
            onClick={() => router.push('/rezervacije/zahteve')}
            className="mb-3 flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
          >
            <ClipboardText className="h-5 w-5 flex-shrink-0 text-gray-400" weight="regular" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">{t('requestsNav.title')}</p>
              <p className="mt-0.5 text-[13px] text-gray-500">{t('requestsNav.subtitle')}</p>
            </div>
            <CaretRight className="h-4 w-4 flex-shrink-0 text-gray-300" weight="bold" />
          </motion.button>

          <div className="mb-6 grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 rounded-xl border border-violet-100 bg-violet-50 p-4"
            >
              <Palette className="h-5 w-5 flex-shrink-0 text-violet-600" weight="regular" />
              <p className="text-sm font-medium text-violet-900">{t('newDesignsBanner')}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4"
            >
              <Link className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" weight="regular" />
              <p className="text-sm leading-6 text-gray-600">
                <span className="font-semibold text-gray-900">{t('multiChannelBanner.bold')}</span>{' '}
                {t('multiChannelBanner.body')}
              </p>
            </motion.div>
          </div>

          {/* Loading state */}
          {loading ? (
            <div className="flex items-center justify-center rounded-xl border border-gray-100 bg-white py-20">
              <GradientSpinner />
            </div>
          ) : (
            <>
              {/* Standard Booking Pages */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                className="mb-6 rounded-xl border border-gray-100 bg-white p-5"
              >
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="mb-1 text-[15px] font-semibold text-gray-900">{t('standardSection.title')}</h2>
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
                  {STANDARD_DESIGNS.map((design) => (
                    <DesignCard
                      key={design.id}
                      design={design}
                      isCopied={copiedDesignId === design.id}
                      onCopy={copyToClipboard}
                      designUrl={getDesignLink(design)}
                    />
                  ))}
                </div>
              </motion.div>

              {/* Premium Booking Pages */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.04, ease: [0.32, 0.72, 0, 1] }}
                className="mb-8 rounded-xl border border-gray-100 bg-white p-5"
              >
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h2 className="text-[15px] font-semibold text-gray-900">{t('premiumSection.title')}</h2>
                      <span
                        className="rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                        style={{ background: 'linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)' }}
                      >
                        {t('premiumSection.badge')}
                      </span>
                      {!proDesignsUnlocked && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                          <Lock className="h-3 w-3" weight="bold" aria-hidden="true" />
                          {t('premiumSection.lockedLabel')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{t('premiumSection.subtitle')}</p>
                    {!proDesignsUnlocked && (
                      <p className="mt-1 text-sm text-gray-600">{t('premiumSection.lockedNote')}</p>
                    )}
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
                  {PREMIUM_DESIGNS.map((design) => (
                    <DesignCard
                      key={design.id}
                      design={design}
                      locked={!proDesignsUnlocked}
                      isCopied={copiedDesignId === design.id}
                      onCopy={copyToClipboard}
                      designUrl={getDesignLink(design)}
                    />
                  ))}
                </div>
              </motion.div>

              {/* Custom booking CTA */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="mb-6 flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4"
              >
                <Link className="h-5 w-5 flex-shrink-0 text-gray-400" weight="regular" />
                <p className="text-sm text-gray-600">
                  {t('customCta.text')}{' '}
                  <a
                    href="mailto:info@jedroplus.com"
                    className="font-semibold text-[#7C78FA] transition-opacity hover:opacity-70"
                  >
                    {t('customCta.linkText')}
                  </a>
                </p>
              </motion.div>

              {/* Main Booking Link */}
              {hasMainBookingLink && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                  className="mb-6 rounded-xl border border-gray-100 bg-white p-5"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <Link className="h-5 w-5 text-gray-400" weight="regular" />
                    <h2 className="text-[15px] font-semibold text-gray-900">{t('mainLink.title')}</h2>
                  </div>
                  <p className="mb-3 text-[13px] text-gray-500">
                    {t('mainLink.subtitle')}
                  </p>
                  <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-3">
                    <div className="flex-1 min-w-0">
                      <a
                        href={settings.mainBookingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-sm text-[#7C78FA] transition-opacity hover:opacity-70"
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
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs transition-colors hover:bg-gray-100"
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
                        onClick={() => router.push('/qr-koda')}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs transition-colors hover:bg-gray-100"
                      >
                        <QrCode className="w-3 h-3 text-gray-500" weight="regular" />
                        <span className="text-gray-600">{t('mainLink.qrButton')}</span>
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => window.open(settings.mainBookingLink, '_blank')}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-sm transition-opacity hover:opacity-90"
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
                  transition={{ duration: 0.28, delay: 0.04, ease: [0.32, 0.72, 0, 1] }}
                  className="mb-6 rounded-xl border border-gray-100 bg-white p-5"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <Link className="h-5 w-5 text-gray-400" weight="regular" />
                    <h2 className="text-[15px] font-semibold text-gray-900">{t('mgmtLink.title')}</h2>
                  </div>
                  <p className="mb-3 text-[13px] text-gray-500">
                    {t('mgmtLink.subtitle')}
                  </p>
                  <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-3">
                    <div className="flex-1 min-w-0">
                      <a
                        href={settings.apptManagementLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-sm text-[#7C78FA] transition-opacity hover:opacity-70"
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
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs transition-colors hover:bg-gray-100"
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
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-sm transition-opacity hover:opacity-90"
                      >
                        <ArrowSquareOut className="w-3.5 h-3.5" weight="bold" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Settings Overview — isti gradniki kot na Opomnikih, da sta
                  pregleda nastavitev po aplikaciji videti enako. */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.08, ease: [0.32, 0.72, 0, 1] }}
              >
                <SectionPanel title={t('settingsOverview.title')}>
                  <SettingRow
                    icon={<CheckCircle size={16} weight="regular" />}
                    label={t('settingsOverview.bookingEnabled')}
                    description={t('settingsOverview.bookingEnabledDesc')}
                    value={
                      <StatusPill
                        enabled={settings.bookingOmogocen}
                        label={settings.bookingOmogocen ? t('settingsOverview.enabled') : t('settingsOverview.disabled')}
                      />
                    }
                  />

                  <SettingRow
                    icon={<Clock size={16} weight="regular" />}
                    label={t('settingsOverview.timeSlots')}
                    description={t('settingsOverview.timeSlotsDesc')}
                    value={
                      <ValuePill>
                        {t('settingsOverview.timeSlotValue', { minutes: settings.timeSlotLength })}
                      </ValuePill>
                    }
                  />

                  <SettingRow
                    icon={<CheckCircle size={16} weight="regular" />}
                    label={t('settingsOverview.clientConfirm')}
                    description={t('settingsOverview.clientConfirmDesc')}
                    value={
                      <span className="inline-flex items-center gap-2">
                        {settings.sendClientConfirmation && (
                          <ValuePill>
                            {settings.clientConfirmationChannel === 'sms' ? 'SMS' : 'Email'}
                          </ValuePill>
                        )}
                        <StatusPill
                          enabled={settings.sendClientConfirmation}
                          label={settings.sendClientConfirmation ? t('settingsOverview.yes') : t('settingsOverview.no')}
                        />
                      </span>
                    }
                  />

                  <SettingRow
                    icon={<CheckCircle size={16} weight="regular" />}
                    label={t('settingsOverview.onlineConfirm')}
                    description={t('settingsOverview.onlineConfirmDesc')}
                    value={
                      <span className="inline-flex items-center gap-2">
                        {settings.sendOnlineConfirmation && (
                          <ValuePill>
                            {settings.onlineConfirmationChannel === 'sms' ? 'SMS' : 'Email'}
                          </ValuePill>
                        )}
                        <StatusPill
                          enabled={settings.sendOnlineConfirmation}
                          label={settings.sendOnlineConfirmation ? t('settingsOverview.yes') : t('settingsOverview.no')}
                        />
                      </span>
                    }
                  />

                  {settings.bookingOmogocen && !settings.sendOnlineConfirmation && (
                    <div className="border-b border-gray-100 p-4 last:border-b-0">
                      <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                        {t('settingsOverview.onlineConfirmOffHint')}{' '}
                        <button
                          type="button"
                          onClick={() => setShowSettingsModal(true)}
                          className="font-semibold underline underline-offset-4 hover:text-amber-700"
                        >
                          {t('settingsOverview.onlineConfirmOffCta')}
                        </button>
                      </div>
                    </div>
                  )}

                  {(hasBookingLinksAvailable || hasMainBookingLink) && (
                    <SettingRow
                      icon={<Link size={16} weight="regular" />}
                      label={t('settingsOverview.mainLinkLabel')}
                      description={t('settingsOverview.mainLinkDesc')}
                      value={
                        hasMainBookingLink ? (
                          <ValuePill tone="blue">{t('settingsOverview.linkSet')}</ValuePill>
                        ) : (
                          <ValuePill tone="amber">{t('settingsOverview.notConfigured')}</ValuePill>
                        )
                      }
                    />
                  )}

                  <SettingRow
                    icon={<Palette size={16} weight="regular" />}
                    label={t('settingsOverview.colors')}
                    description={t('settingsOverview.colorsDesc')}
                    value={
                      <span className="inline-flex gap-1.5">
                        {[settings.primaryColor, settings.secondaryColor, settings.bgFromColor, settings.bgToColor].map((color, i) => (
                          <span
                            key={i}
                            className="h-5 w-5 rounded-md ring-1 ring-black/10"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </span>
                    }
                  />

                  {settings.apptManagementLink && (
                    <SettingRow
                      icon={<Link size={16} weight="regular" />}
                      label={t('settingsOverview.mgmtLinkLabel')}
                      description={t('settingsOverview.mgmtLinkDesc')}
                      value={
                        <a
                          href={settings.apptManagementLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block max-w-[16rem] truncate text-sm font-medium text-[#7C78FA] transition-opacity hover:opacity-70"
                        >
                          {settings.apptManagementLink}
                        </a>
                      }
                    />
                  )}
                </SectionPanel>
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
