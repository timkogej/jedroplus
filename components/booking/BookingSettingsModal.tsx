'use client';

import { useState, useEffect, useRef } from 'react';
import { useBillingUsage } from '@/hooks/useBillingUsage';
import { motion, AnimatePresence } from 'motion/react';
import { X, SpinnerGap, FloppyDisk, EnvelopeSimple, DeviceMobile, ArrowRight } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  SettingsSection,
  SettingRow,
  Switch,
  Input,
  SaveIndicator,
} from '@/components/settings';
import { Select, SelectOption } from '@/components/ui/animated-select';
import { useCompany } from '@/app/company-context';
import { useAuth } from '@/app/auth-context';
import { loadCompanyRow } from '@/lib/settingsStore';
import { callN8nAction } from '@/src/lib/n8nClient';
import { hasPosOnlinePaymentsSubscription, isJedroProPlan, parseSettingBool } from '@/lib/onlinePayments';
import { TemplateEditor, migrateTemplate, sanitizeTemplateText, linkLength } from '@/components/reminders/TemplateEditor';
import { EnglishVariant } from '@/components/reminders/EnglishVariant';
import { EmailConfirmationTemplate, type EmailTemplateValue } from '@/components/booking/EmailConfirmationTemplate';
import { sheet } from '@/components/ui/sheetClasses';
import { useSheetDrag } from '@/components/ui/useSheetDrag';
import { BodyPortal } from '@/components/ui/BodyPortal';
import { QuestionnaireEditor } from '@/components/booking/QuestionnaireEditor';
import { sanitizeQuestions, type Question } from '@/lib/questionnaire';
import { fetchServices } from '@/lib/supabase/services';

const BOOKING_WINDOW_DAYS = [7, 14, 21, 30, 60, 90, 180, 365];

/** Preset windows, plus the saved value when it is not one of them. */
function bookingWindowOptions(current: string): number[] {
  const days = parseInt(current, 10);
  return Number.isFinite(days) && !BOOKING_WINDOW_DAYS.includes(days)
    ? [...BOOKING_WINDOW_DAYS, days].sort((a, b) => a - b)
    : BOOKING_WINDOW_DAYS;
}

interface BookingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── Channel picker (SMS / Email) ─────────────────────────────────────────────

function ChannelPicker({
  value,
  onChange,
  smsLocked = false,
  onUpgradeClick,
  t,
}: {
  value: 'sms' | 'email';
  onChange: (v: 'sms' | 'email') => void;
  smsLocked?: boolean;
  onUpgradeClick?: () => void;
  t: ReturnType<typeof useTranslations<'reservations'>>;
}) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="inline-flex w-fit flex-wrap gap-0.5 rounded-[9px] bg-gray-100 p-0.5">
        <button
          type="button"
          onClick={() => onChange('email')}
          className={`flex items-center gap-2 rounded-[7px] px-3 py-1.5 text-sm font-medium transition-colors
                     ${value === 'email'
                       ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.1)]'
                       : 'text-gray-500 hover:text-gray-900'
                     }`}
        >
          <EnvelopeSimple className="h-4 w-4" weight="regular" />
          Email
        </button>
        {smsLocked ? (
          <div className="flex cursor-not-allowed items-center gap-2 rounded-[7px] px-3 py-1.5 text-sm font-medium text-gray-400">
            <DeviceMobile className="h-4 w-4" weight="regular" />
            SMS
            <span className="text-xs text-gray-400">{t('modal.confirmations.smsUnavailable')}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onChange('sms')}
            className={`flex items-center gap-2 rounded-[7px] px-3 py-1.5 text-sm font-medium transition-colors
                       ${value === 'sms'
                         ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.1)]'
                         : 'text-gray-500 hover:text-gray-900'
                       }`}
          >
            <DeviceMobile className="h-4 w-4" weight="regular" />
            SMS
          </button>
        )}
      </div>
      {smsLocked && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{t('modal.confirmations.smsUpgradeNote')}</span>
          <button
            type="button"
            onClick={onUpgradeClick}
            className="flex items-center gap-1 text-xs font-semibold text-gray-700 underline underline-offset-2 hover:text-gray-900"
          >
            {t('modal.confirmations.smsUpgradeLink')} <ArrowRight className="h-3 w-3" weight="bold" />
          </button>
        </div>
      )}
    </div>
  );
}

export function BookingSettingsModal({ isOpen, onClose }: BookingSettingsModalProps) {
  const sheetDrag = useSheetDrag(onClose);
  const t = useTranslations('reservations');
  const { companyId, companyUuid, planCode } = useCompany();
  const { user } = useAuth();
  const router = useRouter();
  // SMS works whenever the plan + add-ons (or the free trial) leave SMS
  // available — same rule as the reminder editor. Jedro Plus with bought SMS
  // add-ons can send SMS confirmations.
  const { usage: billingUsage } = useBillingUsage();
  const smsLockedForPlan = billingUsage ? billingUsage.sms.unavailable : planCode === 'FREE';

  // Settings from "Podatki podjetij" table
  const [bookingOmogocen, setBookingOmogocen] = useState(true);
  // 'instant' = free times, 'request' = the client sends a request (1793000000).
  const [bookingMode, setBookingMode] = useState<'instant' | 'request'>('instant');
  const loadedBookingModeRef = useRef<'instant' | 'request'>('instant');
  // Questionnaire before the appointment (1793200000); saved through our own route.
  const [questions, setQuestions] = useState<Question[]>([]);
  const loadedQuestionsRef = useRef('[]');
  const [serviceOptions, setServiceOptions] = useState<{ id: string; naziv: string }[]>([]);
  const [koledarUre, setKoledarUre] = useState<'15' | '30' | '60'>('30');
  const [maxDneviRezervacija, setMaxDneviRezervacija] = useState('14');
  const [potrdiloReservation, setPotrdiloReservation] = useState(false);
  const [potrdiloChannel, setPotrdiloChannel] = useState<'sms' | 'email'>('email');
  const [potrdiloOnline, setPotrdiloOnline] = useState(false);
  const [potrdiloOnlineChannel, setPotrdiloOnlineChannel] = useState<'sms' | 'email'>('email');

  // SMS config - confirmation ("potrdilo")
  const [smsModePotrdilo, setSmsModePotrdilo] = useState<'ai' | 'manual'>('ai');
  const [smsTemplatePotrdilo, setSmsTemplatePotrdilo] = useState('');
  // English version of the own template, for clients (and Receptionist+
  // callers) who don't speak the company's language. Saved separately
  // through /api/company/message-templates, like the reminders' variants.
  const [potrdiloEn, setPotrdiloEn] = useState('');
  const loadedPotrdiloEnRef = useRef('');
  const [sendingLanguage, setSendingLanguage] = useState('sl');
  const [lastnaPredlogaPotrdilo, setLastnaPredlogaPotrdilo] = useState('');

  // Email confirmation: AI (default) or own template, for manual and online
  // bookings. Saved through /api/company/message-templates (1792900000).
  const [emailModePotrdilo, setEmailModePotrdilo] = useState<'ai' | 'manual'>('ai');
  const [emailPotrdilo, setEmailPotrdilo] = useState<EmailTemplateValue>({ subject: '', body: '' });
  const [emailPotrdiloEn, setEmailPotrdiloEn] = useState<EmailTemplateValue>({ subject: '', body: '' });
  const loadedEmailTemplatesRef = useRef<Record<string, string>>({});

  // Company data for SMS variable length estimation
  const [kompanyEmail, setKompanyEmail] = useState('');
  const [nazivPodjetja, setNazivPodjetja] = useState('');
  const [naslovPodjetja, setNaslovPodjetja] = useState('');
  const [apptManagementLink, setApptManagementLink] = useState('');
  const [bookingPrimary, setBookingPrimary] = useState('#7C75FC');
  const [bookingSecondary, setBookingSecondary] = useState('#44D0C6');
  const [bookingBgFrom, setBookingBgFrom] = useState('#7C75FC');
  const [bookingBgTo, setBookingBgTo] = useState('#44D0C6');
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [stripePaymentMode, setStripePaymentMode] = useState<'full' | 'deposit'>('full');
  const [stripeDepositPercent, setStripeDepositPercent] = useState('30');
  const [hasPosSubscription, setHasPosSubscription] = useState(false);
  const [checkingPosSubscription, setCheckingPosSubscription] = useState(false);

  const [cancelApptDays, setCancelApptDays] = useState('1');
  const [rescheduleApptDays, setRescheduleApptDays] = useState('1');

  // Booking links (for main link selector)
  const [bookingLink1, setBookingLink1] = useState('');
  const [bookingLink2, setBookingLink2] = useState('');
  const [bookingLink3, setBookingLink3] = useState('');
  const [bookingLink4, setBookingLink4] = useState('');
  const [bookingLink5, setBookingLink5] = useState('');
  const [mainBookingLink, setMainBookingLink] = useState('');

  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const actor = user?.email ?? 'unknown';
  const hasProPlan = isJedroProPlan(planCode);
  const hasOnlinePaymentAccess = hasProPlan && hasPosSubscription;
  const bookingLinkOptions = [
    { value: bookingLink1, label: t('modal.mainLink.classic') },
    { value: bookingLink2, label: t('modal.mainLink.modern') },
    { value: bookingLink3, label: t('modal.mainLink.minimal') },
    { value: bookingLink4, label: t('modal.mainLink.seasonal') },
    { value: bookingLink5, label: t('modal.mainLink.magazine') },
  ].filter((option) => option.value.trim());
  const hasBookingLinkOptions = bookingLinkOptions.length > 0;
  const needsMainBookingLink = hasBookingLinkOptions && !mainBookingLink.trim();

  // Variable estimated lengths for SMS character counting
  const smsVarLengths: Record<string, number> = {
    '{{cas}}': 5,
    '{{datum}}': 6,
    '{{telefon_podjetja}}': 9,
    '{{email_podjetja}}': kompanyEmail.length || 20,
    '{{ime}}': 10,
    '{{priimek}}': 10,
    '{{ime_izvajalca}}': 20,
    '{{ime_podjetja}}': nazivPodjetja.length || 15,
    '{{naslov}}': naslovPodjetja.length || 20,
    '{{leto}}': 4,
    // Šteje se brez sheme — tako gre povezava tudi ven.
    '{{povezava_prenarocanje}}': linkLength(apptManagementLink),
  };

  useEffect(() => {
    let cancelled = false;

    async function loadPosSubscription() {
      if (!isOpen || !companyUuid) {
        setHasPosSubscription(false);
        setCheckingPosSubscription(false);
        return;
      }

      setCheckingPosSubscription(true);
      const hasSubscription = await hasPosOnlinePaymentsSubscription(companyUuid);
      if (!cancelled) {
        setHasPosSubscription(hasSubscription);
        setCheckingPosSubscription(false);
      }
    }

    loadPosSubscription();

    return () => {
      cancelled = true;
    };
  }, [companyUuid, isOpen]);

  // Services for "Velja za" in the questionnaire.
  useEffect(() => {
    if (!isOpen || !companyId) return;
    let cancelled = false;
    fetchServices(companyId).then(({ data }) => {
      if (!cancelled && data) {
        setServiceOptions(data.filter((s) => s.aktivna).map((s) => ({ id: s.id, naziv: s.naziv })));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, isOpen]);

  // Load settings
  useEffect(() => {
    async function loadSettings() {
      if (!companyId || !isOpen) return;
      setIsLoading(true);

      try {
        const { data } = await loadCompanyRow(companyId);

        if (data) {
          const bookingEnabled = data['booking_omogocen'];
          setBookingOmogocen(bookingEnabled !== false && bookingEnabled !== 'false');
          const mode = data['booking_mode'] === 'request' ? 'request' : 'instant';
          setBookingMode(mode);
          loadedBookingModeRef.current = mode;

          const loadedQuestions = sanitizeQuestions(data['vprasalnik']) ?? [];
          setQuestions(loadedQuestions);
          loadedQuestionsRef.current = JSON.stringify(loadedQuestions);

          const ureValue = String(data['koledar_ure'] ?? data['Koledar_ure'] ?? '30');
          setKoledarUre(ureValue === '60' ? '60' : ureValue === '15' ? '15' : '30');

          // Booking window, read by booking-v2 init (online page and Receptionist+).
          const maxDni = parseInt(String(data['max_dnevi_rezervacija'] ?? '14'), 10);
          setMaxDneviRezervacija(String(Number.isFinite(maxDni) && maxDni > 0 ? maxDni : 14));

          const potrdiloRez = data['Potrdilo po rezervaciji'] ?? data['Potrdilo ob rezervaciji'];
          setPotrdiloReservation(potrdiloRez === true || potrdiloRez === 'true' || potrdiloRez === 'yes' || potrdiloRez === 'da');

          // Read potrdilo_channel
          const ch = String(data['potrdilo_channel'] ?? 'email').toLowerCase();
          setPotrdiloChannel(ch === 'sms' ? 'sms' : 'email');

          // SMS config - confirmation ("potrdilo")
          const smsTypePotrdilo = String(data['sms_type_potrdilo'] ?? 'AI').toUpperCase();
          setSmsModePotrdilo(smsTypePotrdilo === 'LP' ? 'manual' : 'ai');
          setSmsTemplatePotrdilo(sanitizeTemplateText(migrateTemplate(String(data['lastna_predloga_potrdilo'] ?? ''))));
          setLastnaPredlogaPotrdilo(sanitizeTemplateText(migrateTemplate(String(data['lastna_predloga_potrdilo'] ?? ''))));
          const potrdiloEnLoaded = sanitizeTemplateText(migrateTemplate(String(data['lastna_predloga_potrdilo_en'] ?? '')));
          setPotrdiloEn(potrdiloEnLoaded);
          loadedPotrdiloEnRef.current = potrdiloEnLoaded;
          setSendingLanguage(String(data['jezik posiljanja'] ?? data['jezik_posiljanja'] ?? 'sl'));

          const emailLoaded = {
            email_type_potrdilo: String(data['email_type_potrdilo'] ?? 'AI').toUpperCase() === 'LP' ? 'LP' : 'AI',
            email_zadeva_potrdilo: String(data['email_zadeva_potrdilo'] ?? ''),
            email_predloga_potrdilo: String(data['email_predloga_potrdilo'] ?? ''),
            email_zadeva_potrdilo_en: String(data['email_zadeva_potrdilo_en'] ?? ''),
            email_predloga_potrdilo_en: String(data['email_predloga_potrdilo_en'] ?? ''),
          };
          loadedEmailTemplatesRef.current = emailLoaded;
          setEmailModePotrdilo(emailLoaded.email_type_potrdilo === 'LP' ? 'manual' : 'ai');
          setEmailPotrdilo({
            subject: migrateTemplate(emailLoaded.email_zadeva_potrdilo),
            body: migrateTemplate(emailLoaded.email_predloga_potrdilo),
          });
          setEmailPotrdiloEn({
            subject: migrateTemplate(emailLoaded.email_zadeva_potrdilo_en),
            body: migrateTemplate(emailLoaded.email_predloga_potrdilo_en),
          });

          // Company data for SMS variable length estimation
          setKompanyEmail(String(data['Kontaktni email'] ?? data['kontaktni_email'] ?? data['from_email'] ?? ''));
          setNazivPodjetja(String(data['Naziv podjetja'] ?? data['Naziv Podjetja'] ?? data['naziv_podjetja'] ?? ''));
          setNaslovPodjetja(String(data['Naslov podjetja'] ?? data['naslov_podjetja'] ?? data['Naslov'] ?? ''));
          setApptManagementLink(String(data['appt_management_link'] ?? ''));

          const potrdiloOnl = data['Potrdilo online termina'] ?? data['Potrdilo online rez'];
          setPotrdiloOnline(potrdiloOnl === true || potrdiloOnl === 'true' || potrdiloOnl === 'yes' || potrdiloOnl === 'da');

          // Read potrdilo_online_channel
          const onlCh = String(data['potrdilo_online_channel'] ?? 'email').toLowerCase();
          setPotrdiloOnlineChannel(onlCh === 'sms' ? 'sms' : 'email');

          setBookingPrimary(String(data['Booking_primary'] ?? data['booking_primary'] ?? '#7C75FC'));
          setBookingSecondary(String(data['Booking_secondary'] ?? data['booking_secondary'] ?? '#44D0C6'));
          setBookingBgFrom(String(data['Booking_bg_from'] ?? data['booking_bg_from'] ?? data['Booking_primary'] ?? data['booking_primary'] ?? '#7C75FC'));
          setBookingBgTo(String(data['Booking_bg_to'] ?? data['booking_bg_to'] ?? data['Booking_secondary'] ?? data['booking_secondary'] ?? '#44D0C6'));
          setStripeEnabled(parseSettingBool(data['stripe_enabled'] ?? data['Stripe_enabled'], false));
          const paymentMode = String(data['stripe_payment_mode'] ?? 'full').toLowerCase();
          setStripePaymentMode(paymentMode === 'deposit' ? 'deposit' : 'full');
          const depositPercent = Number(data['stripe_deposit_percent'] ?? 30);
          setStripeDepositPercent(String(Number.isFinite(depositPercent) && depositPercent > 0 ? depositPercent : 30));

          const bl1 = String(data['booking_link_1'] ?? data['Booking_link_1'] ?? '');
          const bl2 = String(data['booking_link_2'] ?? data['Booking_link_2'] ?? '');
          const bl3 = String(data['booking_link_3'] ?? data['Booking_link_3'] ?? '');
          const bl4 = String(data['booking_link_4'] ?? data['Booking_link_4'] ?? '');
          const bl5 = String(data['booking_link_5'] ?? data['Booking_link_5'] ?? '');
          setBookingLink1(bl1);
          setBookingLink2(bl2);
          setBookingLink3(bl3);
          setBookingLink4(bl4);
          setBookingLink5(bl5);
          setMainBookingLink(String(data['main_booking_link'] ?? ''));

          setCancelApptDays(String(data['cancel_appt_days'] ?? '1'));
          setRescheduleApptDays(String(data['reschedule_appt_days'] ?? '1'));
        }
      } catch (error) {
        console.error('Error loading booking settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [companyId, isOpen]);

  const handleSave = async () => {
    if (!companyId) return;
    const incomplete = questions.some(
      (q) => !q.vprasanje.trim() || (q.tip === 'izbira' && (q.moznosti ?? []).filter((o) => o.trim()).length < 2)
    );
    if (incomplete) {
      toast.error(t('modal.questionnaire.incompleteError'));
      return;
    }
    setSaving(true);

    try {
      const normalizedDepositPercent = Math.min(100, Math.max(1, parseInt(stripeDepositPercent, 10) || 30));
      const effectiveStripeEnabled = hasOnlinePaymentAccess ? stripeEnabled : false;
      const effectivePaymentMode = effectiveStripeEnabled ? stripePaymentMode : 'full';
      const webhookPayload = {
        event: 'BOOKING_SETTINGS_UPDATED',
        entity: 'settings',
        company_id: companyId,
        actor,
        timestamp: new Date().toISOString(),
        data: {
          'booking_omogocen': bookingOmogocen,
          'koledar_ure': koledarUre,
          'max_dnevi_rezervacija': maxDneviRezervacija,
          'Potrdilo po rezervaciji': potrdiloReservation ? 'true' : 'false',
          'Potrdilo ob rezervaciji': potrdiloReservation ? 'true' : 'false',
          'potrdilo_channel': potrdiloChannel,
          'sms_type_potrdilo': smsModePotrdilo === 'manual' ? 'LP' : 'AI',
          'lastna_predloga_potrdilo': smsModePotrdilo === 'manual' ? smsTemplatePotrdilo : lastnaPredlogaPotrdilo,
          'Potrdilo online termina': potrdiloOnline ? 'true' : 'false',
          'Potrdilo online rez': potrdiloOnline ? 'true' : 'false',
          'potrdilo_online_channel': potrdiloOnlineChannel,
          'Booking_primary': bookingPrimary,
          'Booking_secondary': bookingSecondary,
          'Booking_bg_from': bookingBgFrom,
          'Booking_bg_to': bookingBgTo,
          'main_booking_link': mainBookingLink,
          colors: {
            primary: bookingPrimary,
            secondary: bookingSecondary,
            bg_from: bookingBgFrom,
            bg_to: bookingBgTo,
          },
          time_slot_duration: koledarUre,
          send_confirmation: potrdiloReservation,
          confirmation_channel: potrdiloChannel,
          send_online_confirmation: potrdiloOnline,
          online_confirmation_channel: potrdiloOnlineChannel,
          cancel_appt_days: parseInt(cancelApptDays, 10),
          reschedule_appt_days: parseInt(rescheduleApptDays, 10),
          stripe_enabled: effectiveStripeEnabled,
          stripe_payment_mode: effectivePaymentMode,
          stripe_deposit_percent: effectivePaymentMode === 'deposit' ? normalizedDepositPercent : null,
        },
      };

      const result = await callN8nAction(webhookPayload);

      if (!result.ok) {
        throw new Error(t('modal.footer.saveError'));
      }

      if (bookingMode !== loadedBookingModeRef.current) {
        const res = await fetch('/api/company/booking-mode', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ booking_mode: bookingMode }),
        }).catch(() => null);
        if (!res?.ok) {
          toast.error(t('modal.general.modeSaveError'));
          return;
        }
        loadedBookingModeRef.current = bookingMode;
      }

      if (JSON.stringify(questions) !== loadedQuestionsRef.current) {
        const res = await fetch('/api/company/questionnaire', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questions }),
        }).catch(() => null);
        if (!res?.ok) {
          toast.error(t('modal.questionnaire.saveError'));
          return;
        }
        loadedQuestionsRef.current = JSON.stringify(questions);
      }

      // Columns the app writes itself (n8n's settings workflow doesn't know them).
      const templatePatch: Record<string, string> = {};
      if (potrdiloEn.trim() !== loadedPotrdiloEnRef.current.trim()) {
        templatePatch.lastna_predloga_potrdilo_en = potrdiloEn;
      }
      const emailCurrent: Record<string, string> = {
        email_type_potrdilo: emailModePotrdilo === 'manual' ? 'LP' : 'AI',
        email_zadeva_potrdilo: emailPotrdilo.subject,
        email_predloga_potrdilo: emailPotrdilo.body,
        email_zadeva_potrdilo_en: emailPotrdiloEn.subject,
        email_predloga_potrdilo_en: emailPotrdiloEn.body,
      };
      for (const [column, value] of Object.entries(emailCurrent)) {
        if (value.trim() !== (loadedEmailTemplatesRef.current[column] ?? '').trim()) templatePatch[column] = value;
      }
      if (Object.keys(templatePatch).length > 0) {
        const res = await fetch('/api/company/message-templates', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templatePatch),
        }).catch(() => null);
        if (!res?.ok) {
          toast.error(
            Object.keys(templatePatch).some((column) => column.startsWith('email_'))
              ? t('modal.confirmations.email.saveError')
              : t('modal.confirmations.englishSaveError'),
          );
          return;
        }
        loadedPotrdiloEnRef.current = potrdiloEn;
        loadedEmailTemplatesRef.current = { ...loadedEmailTemplatesRef.current, ...emailCurrent };
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      setLastSaved(new Date());

      // Close modal after 0.8s delay and refresh page
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 800);
    } catch (error) {
      console.error('Error saving booking settings:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <BodyPortal>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={sheet.backdrop}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            {...sheetDrag.panel}
            className={`${sheet.panel} sm:max-w-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={sheet.header} {...sheetDrag.handle}>
              <div className={sheet.grabber} aria-hidden="true" />
              <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className={sheet.title}>{t('modal.title')}</h2>
                <p className={sheet.subtitle}>{t('modal.subtitle')}</p>
              </div>
              <div className="flex items-center gap-3">
                <SaveIndicator saving={saving} lastSaved={lastSaved} />
                <button
                  onClick={onClose}
                  className={sheet.close}
                >
                  <X className="h-5 w-5" weight="regular" />
                </button>
              </div>
            </div>
            </div>

            {/* Content */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {isLoading ? (
                <div className="space-y-5">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="animate-pulse rounded-xl bg-white p-5">
                      <div className="mb-4 h-4 w-1/4 rounded bg-gray-100" />
                      <div className="space-y-3">
                        <div className="h-10 bg-gray-100 rounded" />
                        <div className="h-10 bg-gray-100 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {/* General Booking Settings */}
                  <SettingsSection title={t('modal.general.sectionTitle')} description={t('modal.general.sectionDesc')}>
                    <SettingRow
                      label={t('modal.general.enableLabel')}
                      description={t('modal.general.enableDesc')}
                    >
                      <Switch
                        checked={bookingOmogocen}
                        onChange={setBookingOmogocen}
                      />
                    </SettingRow>

                    <div className="py-1">
                      <p className="text-sm font-medium text-gray-900">{t('modal.general.modeLabel')}</p>
                      <p className="mt-0.5 text-[13px] text-gray-500">{t('modal.general.modeDesc')}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {([
                          { value: 'instant' as const, title: t('modal.general.modeInstant'), desc: t('modal.general.modeInstantDesc') },
                          { value: 'request' as const, title: t('modal.general.modeRequest'), desc: t('modal.general.modeRequestDesc') },
                        ]).map((opt) => {
                          const active = bookingMode === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              aria-pressed={active}
                              onClick={() => setBookingMode(opt.value)}
                              className={`rounded-xl border p-3.5 text-left transition-colors ${
                                active ? 'border-violet-400 bg-violet-50/60 ring-1 ring-violet-300' : 'border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                                <span
                                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                                    active ? 'border-violet-500 bg-violet-500' : 'border-gray-300'
                                  }`}
                                >
                                  {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                                </span>
                                {opt.title}
                              </span>
                              <span className="mt-1 block text-[13px] leading-5 text-gray-500">{opt.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <SettingRow
                      label={t('modal.general.intervalLabel')}
                      description={t('modal.general.intervalDesc')}
                    >
                      <Select
                        value={koledarUre}
                        setValue={(value) => setKoledarUre(value as '15' | '30' | '60')}
                        placeholder={t('modal.general.intervalPlaceholder')}
                        className="[&>button]:rounded-[10px]"
                      >
                        <SelectOption value="15">{t('modal.general.interval15')}</SelectOption>
                        <SelectOption value="30">{t('modal.general.interval30')}</SelectOption>
                        <SelectOption value="60">{t('modal.general.interval60')}</SelectOption>
                      </Select>
                    </SettingRow>

                    <SettingRow
                      label={t('modal.general.windowLabel')}
                      description={t('modal.general.windowDesc')}
                    >
                      <Select
                        value={maxDneviRezervacija}
                        setValue={(value) => setMaxDneviRezervacija(value)}
                        placeholder={t('modal.general.intervalPlaceholder')}
                        className="[&>button]:rounded-[10px]"
                      >
                        {bookingWindowOptions(maxDneviRezervacija).map((days) => (
                          <SelectOption key={days} value={String(days)}>
                            {t('modal.general.windowDays', { days })}
                          </SelectOption>
                        ))}
                      </Select>
                    </SettingRow>
                  </SettingsSection>

                  {/* Online payments */}
                  <SettingsSection title={t('modal.payments.sectionTitle')} description={t('modal.payments.sectionDesc')}>
                    <SettingRow
                      label={t('modal.payments.enableLabel')}
                      description={hasOnlinePaymentAccess ? t('modal.payments.enableDesc') : t('modal.payments.lockedDesc')}
                    >
                      <Switch
                        checked={hasOnlinePaymentAccess && stripeEnabled}
                        onChange={setStripeEnabled}
                        disabled={!hasOnlinePaymentAccess || checkingPosSubscription}
                      />
                    </SettingRow>

                    {(!hasOnlinePaymentAccess || checkingPosSubscription) && (
                      <div className="rounded-[10px] bg-gray-50 p-3">
                        <p className="mb-2 text-xs font-medium text-gray-600">
                          {checkingPosSubscription ? t('modal.payments.checking') : t('modal.payments.requirementsTitle')}
                        </p>
                        <div className="space-y-1.5 text-xs text-gray-500">
                          <div className="flex items-center justify-between gap-3">
                            <span>{t('modal.payments.requirementPlan')}</span>
                            <span className={hasProPlan ? 'text-emerald-600' : 'text-amber-600'}>
                              {hasProPlan ? t('modal.payments.ok') : t('modal.payments.missing')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>{t('modal.payments.requirementPos')}</span>
                            <span className={hasPosSubscription ? 'text-emerald-600' : 'text-amber-600'}>
                              {hasPosSubscription ? t('modal.payments.ok') : t('modal.payments.missing')}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {hasOnlinePaymentAccess && stripeEnabled && (
                      <>
                        <SettingRow
                          label={t('modal.payments.modeLabel')}
                          description={t('modal.payments.modeDesc')}
                        >
                          <Select
                            value={stripePaymentMode}
                            setValue={(value) => setStripePaymentMode(value === 'deposit' ? 'deposit' : 'full')}
                            placeholder={t('modal.payments.modePlaceholder')}
                            className="[&>button]:rounded-[10px]"
                          >
                            <SelectOption value="full">{t('modal.payments.modeFull')}</SelectOption>
                            <SelectOption value="deposit">{t('modal.payments.modeDeposit')}</SelectOption>
                          </Select>
                        </SettingRow>

                        {stripePaymentMode === 'deposit' && (
                          <SettingRow
                            label={t('modal.payments.depositLabel')}
                            description={t('modal.payments.depositDesc')}
                          >
                            <Input
                              type="number"
                              min={1}
                              max={100}
                              value={stripeDepositPercent}
                              onChange={(e) => setStripeDepositPercent(e.target.value)}
                              suffix="%"
                            />
                          </SettingRow>
                        )}
                      </>
                    )}
                  </SettingsSection>

                  {/* Main Booking Link */}
                  <SettingsSection title={t('modal.mainLink.sectionTitle')} description={t('modal.mainLink.sectionDesc')}>
                    <SettingRow
                      label={(
                        <span className="inline-flex items-center gap-2">
                          {t('modal.mainLink.selectLabel')}
                          {needsMainBookingLink && (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold leading-none text-white">
                              !
                            </span>
                          )}
                        </span>
                      )}
                      description={t('modal.mainLink.selectDesc')}
                      error={needsMainBookingLink ? t('modal.mainLink.missingRequired') : undefined}
                    >
                      <Select
                        value={mainBookingLink}
                        setValue={setMainBookingLink}
                        placeholder={
                          hasBookingLinkOptions
                            ? t('modal.mainLink.selectPlaceholder')
                            : t('modal.mainLink.noLinksAvailable')
                        }
                        disabled={!hasBookingLinkOptions}
                        className="[&>button]:rounded-[10px]"
                      >
                        {bookingLinkOptions.map((option) => (
                          <SelectOption key={option.value} value={option.value}>
                            {option.label}
                          </SelectOption>
                        ))}
                      </Select>
                    </SettingRow>
                    {mainBookingLink && (
                      <div className="rounded-[10px] bg-gray-50 px-3 py-2">
                        <p className="break-all text-xs text-gray-500">{mainBookingLink}</p>
                      </div>
                    )}
                  </SettingsSection>

                  {/* Confirmation Settings */}
                  <SettingsSection title={t('modal.confirmations.sectionTitle')} description={t('modal.confirmations.sectionDesc')}>
                    {/* Confirmation on manual booking */}
                    <div className="space-y-1">
                      <SettingRow
                        label={t('modal.confirmations.manualLabel')}
                        description={t('modal.confirmations.manualDesc')}
                      >
                        <Switch
                          checked={potrdiloReservation}
                          onChange={setPotrdiloReservation}
                        />
                      </SettingRow>
                      {potrdiloReservation && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-4 pb-3"
                        >
                          <p className="text-xs font-medium text-gray-500 mb-2">{t('modal.confirmations.channelLabel')}</p>
                          {smsLockedForPlan && (
                            <p className="text-xs text-gray-500 mb-1">
                              {t('modal.confirmations.smsPlanNotePrefix')}{' '}
                              <button
                                type="button"
                                onClick={() => { onClose(); router.push(billingUsage && !billingUsage.isFree ? '/nastavitve/addoni' : '/nastavitve/paketi#razpolozljivi-paketi'); }}
                                className="font-semibold text-gray-700 underline underline-offset-2 hover:text-gray-900"
                              >
                                {t('modal.confirmations.smsPlanNoteLink')}
                              </button>
                              .
                            </p>
                          )}
                          <ChannelPicker
                            value={potrdiloChannel}
                            onChange={setPotrdiloChannel}
                            smsLocked={smsLockedForPlan}
                            onUpgradeClick={() => { onClose(); router.push(billingUsage && !billingUsage.isFree ? '/nastavitve/addoni' : '/nastavitve/paketi#razpolozljivi-paketi'); }}
                            t={t}
                          />

                          {potrdiloChannel === 'sms' && !smsLockedForPlan && (
                            <div className="mt-3 space-y-4 rounded-[10px] bg-gray-50 p-4">
                              <div className="font-semibold text-gray-900 text-sm">{t('modal.confirmations.smsSettings')}</div>

                              {/* Mode selector */}
                              <div className="grid grid-cols-2 gap-0.5 rounded-[9px] bg-gray-100 p-0.5">
                                {([
                                  { value: 'ai' as const, labelKey: 'modal.confirmations.modeAI' },
                                  { value: 'manual' as const, labelKey: 'modal.confirmations.modeManual' },
                                ]).map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setSmsModePotrdilo(opt.value)}
                                    className={`rounded-[7px] px-3 py-1.5 text-sm font-medium transition-all ${
                                      smsModePotrdilo === opt.value
                                        ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.1)]'
                                        : 'text-gray-500 hover:text-gray-900'
                                    }`}
                                  >
                                    {t(opt.labelKey)}
                                  </button>
                                ))}
                              </div>

                              {smsModePotrdilo === 'manual' && (
                                <div className="space-y-2">
                                  <p className="text-xs text-gray-500">{t('modal.confirmations.templateHint')}</p>
                                  <TemplateEditor
                                    value={smsTemplatePotrdilo}
                                    onChange={setSmsTemplatePotrdilo}
                                    maxLength={155}
                                    placeholder={String(t.raw('modal.confirmations.templatePlaceholder'))}
                                    rows={4}
                                    varLengths={smsVarLengths}
                                  />
                                  <p className="text-xs text-gray-400">{t('modal.confirmations.noEmojiHint')}</p>
                                  {sendingLanguage !== 'en' && (
                                    <EnglishVariant
                                      value={potrdiloEn}
                                      onChange={setPotrdiloEn}
                                      maxLength={155}
                                      varLengths={smsVarLengths}
                                      companyName={nazivPodjetja}
                                      placeholder="Hi {{ime}}, your appointment is booked for {{datum}} at {{cas}}. {{ime_podjetja}}"
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>

                    {/* Confirmation on online booking */}
                    <div className="space-y-1">
                      <SettingRow
                        label={t('modal.confirmations.onlineLabel')}
                        description={t('modal.confirmations.onlineDesc')}
                      >
                        <Switch
                          checked={potrdiloOnline}
                          onChange={setPotrdiloOnline}
                        />
                      </SettingRow>
                      {potrdiloOnline && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-4 pb-3"
                        >
                          <p className="text-xs font-medium text-gray-500 mb-2">{t('modal.confirmations.channelLabel')}</p>
                          {smsLockedForPlan && (
                            <p className="text-xs text-gray-500 mb-1">
                              {t('modal.confirmations.smsPlanNotePrefix')}{' '}
                              <button
                                type="button"
                                onClick={() => { onClose(); router.push(billingUsage && !billingUsage.isFree ? '/nastavitve/addoni' : '/nastavitve/paketi#razpolozljivi-paketi'); }}
                                className="font-semibold text-gray-700 underline underline-offset-2 hover:text-gray-900"
                              >
                                {t('modal.confirmations.smsPlanNoteLink')}
                              </button>
                              .
                            </p>
                          )}
                          <ChannelPicker
                            value={potrdiloOnlineChannel}
                            onChange={setPotrdiloOnlineChannel}
                            smsLocked={smsLockedForPlan}
                            onUpgradeClick={() => { onClose(); router.push(billingUsage && !billingUsage.isFree ? '/nastavitve/addoni' : '/nastavitve/paketi#razpolozljivi-paketi'); }}
                            t={t}
                          />
                        </motion.div>
                      )}
                    </div>

                    {/* One email text for both kinds of booking */}
                    {((potrdiloReservation && potrdiloChannel === 'email') ||
                      (potrdiloOnline && potrdiloOnlineChannel === 'email')) && (
                      <div className="px-4 pb-3">
                        <EmailConfirmationTemplate
                          mode={emailModePotrdilo}
                          onModeChange={setEmailModePotrdilo}
                          value={emailPotrdilo}
                          onChange={setEmailPotrdilo}
                          english={emailPotrdiloEn}
                          onEnglishChange={setEmailPotrdiloEn}
                          showEnglish={sendingLanguage !== 'en'}
                          companyName={nazivPodjetja}
                        />
                      </div>
                    )}
                  </SettingsSection>

                  {/* Cancellation & Rescheduling Policy */}
                  <SettingsSection title={t('modal.policy.sectionTitle')} description={t('modal.policy.sectionDesc')}>
                    <SettingRow
                      label={t('modal.policy.cancelLabel')}
                      description={t('modal.policy.cancelDesc')}
                    >
                      <Select
                        value={cancelApptDays}
                        setValue={setCancelApptDays}
                        placeholder={t('modal.policy.selectPlaceholder')}
                        className="[&>button]:rounded-[10px]"
                      >
                        <SelectOption value="0">{t('modal.policy.sameDay')}</SelectOption>
                        <SelectOption value="1">{t('modal.policy.day1')}</SelectOption>
                        <SelectOption value="2">{t('modal.policy.day2')}</SelectOption>
                        <SelectOption value="3">{t('modal.policy.day3')}</SelectOption>
                        <SelectOption value="5">{t('modal.policy.day5')}</SelectOption>
                        <SelectOption value="7">{t('modal.policy.day7')}</SelectOption>
                        <SelectOption value="14">{t('modal.policy.day14')}</SelectOption>
                      </Select>
                    </SettingRow>

                    <SettingRow
                      label={t('modal.policy.rescheduleLabel')}
                      description={t('modal.policy.rescheduleDesc')}
                    >
                      <Select
                        value={rescheduleApptDays}
                        setValue={setRescheduleApptDays}
                        placeholder={t('modal.policy.selectPlaceholder')}
                        className="[&>button]:rounded-[10px]"
                      >
                        <SelectOption value="0">{t('modal.policy.sameDay')}</SelectOption>
                        <SelectOption value="1">{t('modal.policy.day1')}</SelectOption>
                        <SelectOption value="2">{t('modal.policy.day2')}</SelectOption>
                        <SelectOption value="3">{t('modal.policy.day3')}</SelectOption>
                        <SelectOption value="5">{t('modal.policy.day5')}</SelectOption>
                        <SelectOption value="7">{t('modal.policy.day7')}</SelectOption>
                        <SelectOption value="14">{t('modal.policy.day14')}</SelectOption>
                      </Select>
                    </SettingRow>
                  </SettingsSection>

                  {/* Questionnaire before the appointment */}
                  <SettingsSection title={t('modal.questionnaire.sectionTitle')} description={t('modal.questionnaire.sectionDesc')}>
                    <QuestionnaireEditor questions={questions} onChange={setQuestions} services={serviceOptions} />
                  </SettingsSection>

                  {/* Booking Page Colors */}
                  <SettingsSection title={t('modal.colors.sectionTitle')} description={t('modal.colors.sectionDesc')}>
                    <SettingRow
                      label={t('modal.colors.primaryLabel')}
                      description={t('modal.colors.primaryDesc')}
                    >
                      <div className="flex gap-3 items-center">
                        <input
                          type="color"
                          value={bookingPrimary}
                          onChange={(e) => setBookingPrimary(e.target.value)}
                          className="h-10 w-10 cursor-pointer rounded-lg border border-gray-200 bg-white p-0.5"
                        />
                        <Input
                          value={bookingPrimary}
                          onChange={(e) => setBookingPrimary(e.target.value)}
                          placeholder="#7C75FC"
                          className="w-28"
                        />
                      </div>
                    </SettingRow>

                    <SettingRow
                      label={t('modal.colors.secondaryLabel')}
                      description={t('modal.colors.secondaryDesc')}
                    >
                      <div className="flex gap-3 items-center">
                        <input
                          type="color"
                          value={bookingSecondary}
                          onChange={(e) => setBookingSecondary(e.target.value)}
                          className="h-10 w-10 cursor-pointer rounded-lg border border-gray-200 bg-white p-0.5"
                        />
                        <Input
                          value={bookingSecondary}
                          onChange={(e) => setBookingSecondary(e.target.value)}
                          placeholder="#44D0C6"
                          className="w-28"
                        />
                      </div>
                    </SettingRow>

                    <SettingRow
                      label={t('modal.colors.bgFromLabel')}
                      description={t('modal.colors.bgFromDesc')}
                    >
                      <div className="flex gap-3 items-center">
                        <input
                          type="color"
                          value={bookingBgFrom}
                          onChange={(e) => setBookingBgFrom(e.target.value)}
                          className="h-10 w-10 cursor-pointer rounded-lg border border-gray-200 bg-white p-0.5"
                        />
                        <Input
                          value={bookingBgFrom}
                          onChange={(e) => setBookingBgFrom(e.target.value)}
                          placeholder="#7C75FC"
                          className="w-28"
                        />
                      </div>
                    </SettingRow>

                    <SettingRow
                      label={t('modal.colors.bgToLabel')}
                      description={t('modal.colors.bgToDesc')}
                    >
                      <div className="flex gap-3 items-center">
                        <input
                          type="color"
                          value={bookingBgTo}
                          onChange={(e) => setBookingBgTo(e.target.value)}
                          className="h-10 w-10 cursor-pointer rounded-lg border border-gray-200 bg-white p-0.5"
                        />
                        <Input
                          value={bookingBgTo}
                          onChange={(e) => setBookingBgTo(e.target.value)}
                          placeholder="#44D0C6"
                          className="w-28"
                        />
                      </div>
                    </SettingRow>

                    {/* Gradient Preview */}
                    <div className="mt-5">
                      <p className="mb-3 text-sm font-medium text-gray-900">{t('modal.colors.previewLabel')}</p>
                      <div
                        className="w-full rounded-lg border border-gray-100 p-5"
                        style={{
                          background: `linear-gradient(135deg, ${bookingBgFrom} 0%, ${bookingBgTo} 100%)`,
                        }}
                      >
                        <div className="text-center">
                          <div
                            className="inline-block rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
                            style={{
                              background: `linear-gradient(135deg, ${bookingPrimary} 0%, ${bookingSecondary} 100%)`,
                            }}
                          >
                            {t('modal.colors.previewButton')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </SettingsSection>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className={sheet.footer}>
              <motion.button
                type="button"
                onClick={onClose}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={sheet.cancel}
              >
                {t('modal.footer.close')}
              </motion.button>
              <motion.button
                type="button"
                onClick={handleSave}
                disabled={saving || isLoading}
                whileHover={{ scale: saving ? 1 : 1.02 }}
                whileTap={{ scale: saving ? 1 : 0.98 }}
                className={`${sheet.action} bg-gradient-to-r from-violet-500 to-cyan-500 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {saving ? (
                  <>
                    <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" />
                    {t('modal.footer.saving')}
                  </>
                ) : (
                  <>
                    <FloppyDisk className="h-4 w-4" weight="bold" />
                    {t('modal.footer.save')}
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </BodyPortal>
  );
}
