'use client';

/**
 * Vodič "Dodaj Jedro+ na začetni zaslon" in vklop obvestil.
 *
 * Prepozna napravo in brskalnik:
 *   - iPhone/iPad v Safariju → koraki Deli → Dodaj na začetni zaslon → Dodaj
 *   - iPhone/iPad v drugem brskalniku ali v aplikaciji → "odpri v Safariju"
 *   - Android (Chrome, Edge, Samsung …) → gumb Namesti (beforeinstallprompt)
 *     ali koraki prek menija
 *   - računalnik → gumb Namesti ali koraki (Chrome/Edge, Safari → Dodaj v Dock,
 *     Firefox ne nameša — obvestila delujejo kar v brskalniku)
 * Ko je aplikacija nameščena (ali že odprta kot aplikacija), takoj ponudi
 * vklop obvestil.
 */

import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'motion/react';
import {
  ExportIcon,
  PlusSquareIcon,
  CheckCircleIcon,
  DotsThreeVerticalIcon,
  ListIcon,
  DownloadSimpleIcon,
  HouseSimpleIcon,
  BellRingingIcon,
  CopyIcon,
  CompassIcon,
  ArrowDownIcon,
  CursorClickIcon,
  AppWindowIcon,
  LightningIcon,
} from '@phosphor-icons/react';
import { Sheet, SheetHeader } from '@/components/ui/sheet';
import { BodyPortal } from '@/components/ui/BodyPortal';
import { detectDevice, type DeviceInfo } from '@/lib/pwa/device';
import { getInstallState, getServerInstallState, promptInstall, subscribeInstallState } from '@/lib/pwa/installPrompt';
import { enablePush, pushBlocker, type EnableResult } from '@/lib/pwa/push';
import { Bold, GuideSteps, Notice, PrimaryButton, SecondaryButton, type GuideStep } from './parts';

export type GuideStart = 'install' | 'push';

interface InstallGuideProps {
  onClose: () => void;
  /** "Ne zdaj" — klicatelj si zapomni izbiro. Če manjka, je to navaden Zapri. */
  onDismiss?: () => void;
  start?: GuideStart;
  /** Obvestila so bila vklopljena (za osvežitev stanja v nastavitvah). */
  onPushEnabled?: () => void;
}

const b = (chunks: ReactNode) => <Bold>{chunks}</Bold>;

export function InstallGuide({ onClose, onDismiss, start = 'install', onPushEnabled }: InstallGuideProps) {
  const t = useTranslations('pwa');
  const device = useMemo<DeviceInfo>(() => detectDevice(), []);
  const install = useSyncExternalStore(subscribeInstallState, getInstallState, getServerInstallState);
  const installed = device.isStandalone || install.installed;
  const [view, setView] = useState<GuideStart>(installed ? 'push' : start);

  const isComputer = !device.isMobile;
  const title =
    view === 'push'
      ? installed && !device.isStandalone
        ? t('install.installedTitle')
        : t('push.title')
      : isComputer
        ? t('install.titleComputer')
        : t('install.title');

  return (
    <BodyPortal>
      <Sheet onClose={onClose} maxWidth="sm:max-w-[440px]">
        <div role="dialog" aria-modal="true" aria-label={title} className="flex min-h-0 flex-col">
          <SheetHeader title={title} onClose={onClose} closeLabel={t('common.close')} />
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
            {view === 'install' ? (
              <InstallView
                device={device}
                canPrompt={install.canPrompt}
                onInstalled={() => setView('push')}
                onSkipToPush={() => setView('push')}
                onDismiss={onDismiss ?? onClose}
              />
            ) : (
              <PushView
                device={device}
                justInstalled={installed && !device.isStandalone}
                onDone={onClose}
                onDismiss={onDismiss ?? onClose}
                onEnabled={onPushEnabled}
                onShowInstall={() => setView('install')}
              />
            )}
          </div>
        </div>
      </Sheet>
    </BodyPortal>
  );
}

// ---------------------------------------------------------------------------
// Namestitev
// ---------------------------------------------------------------------------

function Benefits() {
  const t = useTranslations('pwa');
  const items = [
    { icon: LightningIcon, text: t('install.benefitFast') },
    { icon: BellRingingIcon, text: t('install.benefitPush') },
    { icon: HouseSimpleIcon, text: t('install.benefitFree') },
  ];
  return (
    <ul className="mb-5 space-y-2">
      {items.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-center gap-2.5 text-[15px] text-gray-700">
          <Icon size={18} className="flex-shrink-0 text-[#7C78FA]" aria-hidden="true" />
          {text}
        </li>
      ))}
    </ul>
  );
}

function AppTile() {
  return (
    <div className="mb-4 flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/android-icon-192.png" alt="" width={52} height={52} className="h-[52px] w-[52px] rounded-[12px] border border-gray-100" />
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-gray-900">Jedro+</p>
        <p className="truncate text-[13px] text-gray-500">{typeof window === 'undefined' ? '' : window.location.host}</p>
      </div>
    </div>
  );
}

interface InstallViewProps {
  device: DeviceInfo;
  canPrompt: boolean;
  onInstalled: () => void;
  onSkipToPush: () => void;
  onDismiss: () => void;
}

function InstallView({ device, canPrompt, onInstalled, onSkipToPush, onDismiss }: InstallViewProps) {
  const t = useTranslations('pwa');
  const [installing, setInstalling] = useState(false);
  const [showSteps, setShowSteps] = useState(!canPrompt);
  const [copied, setCopied] = useState(false);

  const handleInstall = useCallback(async () => {
    setInstalling(true);
    const outcome = await promptInstall();
    setInstalling(false);
    if (outcome === 'accepted') onInstalled();
    if (outcome === 'unavailable') setShowSteps(true);
  }, [onInstalled]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/dashboard`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      /* odložišče ni dovoljeno — povezava je vidna v naslovni vrstici */
    }
  }, []);

  const isIphone = device.os === 'ios' && !device.isIpad;
  let body: ReactNode;
  let primary: ReactNode = null;

  if (device.browser === 'inapp') {
    body = (
      <>
        <p className="mb-4 text-[15px] font-semibold text-gray-900">{t('install.inApp.title')}</p>
        <Notice>{t('install.inApp.body')}</Notice>
      </>
    );
    primary = (
      <PrimaryButton onClick={copyLink} className="w-full">
        {copied ? <CheckCircleIcon size={18} weight="bold" /> : <CopyIcon size={18} />}
        {copied ? t('install.iosOther.copied') : t('install.iosOther.copy')}
      </PrimaryButton>
    );
  } else if (device.os === 'ios' && device.browser !== 'safari') {
    body = (
      <>
        <div className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-gray-900">
          <CompassIcon size={20} className="text-[#007AFF]" aria-hidden="true" />
          {t('install.iosOther.title')}
        </div>
        <Notice>{t('install.iosOther.body')}</Notice>
      </>
    );
    primary = (
      <PrimaryButton onClick={copyLink} className="w-full">
        {copied ? <CheckCircleIcon size={18} weight="bold" /> : <CopyIcon size={18} />}
        {copied ? t('install.iosOther.copied') : t('install.iosOther.copy')}
      </PrimaryButton>
    );
  } else if (device.os === 'ios') {
    const steps: GuideStep[] = [
      { icon: ExportIcon, text: t.rich('install.ios.step1', { b }), hint: t('install.ios.step1Hint') },
      { icon: PlusSquareIcon, text: t.rich('install.ios.step2', { b }) },
      { icon: CheckCircleIcon, text: t.rich('install.ios.step3', { b }) },
      { icon: BellRingingIcon, text: t('install.ios.step4') },
    ];
    body = (
      <>
        <GuideSteps steps={steps} />
        {device.iosVersion !== null && device.iosVersion < 16.4 && (
          <div className="mt-3">
            <Notice tone="warning">{t('install.iosTooOld')}</Notice>
          </div>
        )}
        {isIphone && (
          <motion.div
            className="mt-4 flex flex-col items-center gap-1 text-[13px] text-gray-400"
            animate={{ y: [0, 5, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          >
            {t('install.ios.arrowHint')}
            <ArrowDownIcon size={18} weight="bold" className="text-[#007AFF]" />
          </motion.div>
        )}
      </>
    );
  } else if (device.os === 'android') {
    const samsung = device.browser === 'samsung';
    const steps: GuideStep[] = samsung
      ? [
          { icon: ListIcon, text: t.rich('install.android.samsungStep1', { b }) },
          { icon: PlusSquareIcon, text: t.rich('install.android.samsungStep2', { b }) },
          { icon: CheckCircleIcon, text: t.rich('install.android.step3', { b }) },
        ]
      : [
          { icon: DotsThreeVerticalIcon, text: t.rich('install.android.step1', { b }) },
          { icon: DownloadSimpleIcon, text: t.rich('install.android.step2', { b }) },
          { icon: CheckCircleIcon, text: t.rich('install.android.step3', { b }) },
        ];
    body = <StepsOrButton steps={steps} showSteps={showSteps} canPrompt={canPrompt} onShowSteps={() => setShowSteps(true)} />;
    if (canPrompt) {
      primary = (
        <PrimaryButton onClick={handleInstall} disabled={installing} className="w-full">
          <DownloadSimpleIcon size={18} weight="bold" />
          {installing ? t('install.installing') : t('install.installButton')}
        </PrimaryButton>
      );
    }
  } else if (device.browser === 'safari') {
    body = (
      <GuideSteps
        steps={[
          { icon: AppWindowIcon, text: t.rich('install.desktop.safariStep1', { b }) },
          { icon: CheckCircleIcon, text: t.rich('install.desktop.safariStep2', { b }) },
        ]}
      />
    );
  } else if (device.browser === 'firefox' || (!canPrompt && device.browser === 'other')) {
    body = <Notice>{t('install.desktop.firefox')}</Notice>;
    primary = (
      <PrimaryButton onClick={onSkipToPush} className="w-full">
        <BellRingingIcon size={18} weight="bold" />
        {t('push.enable')}
      </PrimaryButton>
    );
  } else {
    const steps: GuideStep[] = [
      { icon: CursorClickIcon, text: t.rich('install.desktop.step1', { b }) },
      { icon: DotsThreeVerticalIcon, text: t.rich('install.desktop.step2', { b }) },
    ];
    body = <StepsOrButton steps={steps} showSteps={showSteps} canPrompt={canPrompt} onShowSteps={() => setShowSteps(true)} />;
    if (canPrompt) {
      primary = (
        <PrimaryButton onClick={handleInstall} disabled={installing} className="w-full">
          <DownloadSimpleIcon size={18} weight="bold" />
          {installing ? t('install.installing') : t('install.installButton')}
        </PrimaryButton>
      );
    }
  }

  return (
    <div>
      <AppTile />
      <p className="mb-4 text-[15px] leading-relaxed text-gray-600">{t('install.subtitle')}</p>
      <Benefits />
      {body}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <SecondaryButton onClick={onDismiss}>{t('common.notNow')}</SecondaryButton>
        {primary && <div className="sm:min-w-[220px]">{primary}</div>}
      </div>
    </div>
  );
}

function StepsOrButton({
  steps,
  showSteps,
  canPrompt,
  onShowSteps,
}: {
  steps: GuideStep[];
  showSteps: boolean;
  canPrompt: boolean;
  onShowSteps: () => void;
}) {
  const t = useTranslations('pwa');
  if (showSteps || !canPrompt) return <GuideSteps steps={steps} />;
  return (
    <button
      type="button"
      onClick={onShowSteps}
      className="text-sm font-medium text-[#7C78FA] transition-colors hover:text-[#6D5EF7]"
    >
      {t('install.showSteps')}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Obvestila
// ---------------------------------------------------------------------------

interface PushViewProps {
  device: DeviceInfo;
  justInstalled: boolean;
  onDone: () => void;
  onDismiss: () => void;
  onEnabled?: () => void;
  onShowInstall: () => void;
}

function PushView({ device, justInstalled, onDone, onDismiss, onEnabled, onShowInstall }: PushViewProps) {
  const t = useTranslations('pwa');
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EnableResult | null>(() =>
    typeof Notification !== 'undefined' && Notification.permission === 'denied' ? 'denied' : null,
  );
  const blocker = pushBlocker();

  const handleEnable = async () => {
    setBusy(true);
    const r = await enablePush(locale);
    setBusy(false);
    setResult(r);
    if (r === 'on') onEnabled?.();
  };

  if (blocker === 'needs-install' || blocker === 'ios-too-old') {
    return (
      <div>
        <Notice tone="warning">{blocker === 'ios-too-old' ? t('install.iosTooOld') : t('push.needsInstall')}</Notice>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <SecondaryButton onClick={onDismiss}>{t('common.notNow')}</SecondaryButton>
          <PrimaryButton onClick={onShowInstall}>{t('settings.showHow')}</PrimaryButton>
        </div>
      </div>
    );
  }

  if (result === 'on') {
    return (
      <div className="flex flex-col items-center py-2 text-center">
        <CheckCircleIcon size={44} weight="fill" className="text-emerald-500" aria-hidden="true" />
        <p className="mt-3 text-[17px] font-semibold text-gray-900">{t('push.enabled')}</p>
        <p className="mt-1 text-[15px] text-gray-500">{t('push.enabledBody')}</p>
        <PrimaryButton onClick={onDone} className="mt-6 w-full">
          {t('common.done')}
        </PrimaryButton>
      </div>
    );
  }

  const message =
    blocker === 'unsupported'
      ? t('push.unsupported')
      : blocker === 'not-configured'
        ? t('push.notConfigured')
        : result === 'denied'
          ? device.os === 'ios'
            ? t('push.deniedIos')
            : t('push.denied')
          : result === 'dismissed'
            ? t('push.dismissed')
            : result === 'error' || result === 'unsupported'
              ? t('push.error')
              : null;

  return (
    <div>
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[12px] bg-[#7C78FA]/10 text-[#7C78FA]" aria-hidden="true">
          <BellRingingIcon size={24} />
        </span>
        <p className="text-[15px] leading-relaxed text-gray-600">
          {justInstalled && <span className="mb-1 block">{t('install.installedBody')}</span>}
          {t('push.subtitle')}
        </p>
      </div>
      {message && (
        <div className="mb-4">
          <Notice tone="warning">{message}</Notice>
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <SecondaryButton onClick={onDismiss}>{t('common.notNow')}</SecondaryButton>
        {!blocker && result !== 'denied' && (
          <PrimaryButton onClick={handleEnable} disabled={busy} className="sm:min-w-[200px]">
            <BellRingingIcon size={18} weight="bold" />
            {busy ? t('push.enabling') : t('push.enable')}
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}
