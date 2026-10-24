'use client';

/**
 * Vrstice za nastavitve: "Obvestila na tem telefonu/računalniku" s testnim
 * gumbom in "Aplikacija na začetnem zaslonu" z vodičem.
 * Vsaka vrstica je neposreden otrok SettingsSection, zato dobi svojo lasno črto.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { PaperPlaneTiltIcon } from '@phosphor-icons/react';
import { SettingRow, Switch } from '@/components/settings';
import { detectDevice, isStandaloneDisplay } from '@/lib/pwa/device';
import { disablePush, enablePush, getPushStatus, PUSH_CHANGED_EVENT, sendTestPush, type PushStatus } from '@/lib/pwa/push';
import { openInstallGuide } from './PwaManager';

export function PushSettings() {
  const t = useTranslations('pwa');
  const locale = useLocale();
  const device = useMemo(() => detectDevice(), []);
  const [status, setStatus] = useState<PushStatus>('loading');
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [installed, setInstalled] = useState(false);

  const refresh = useCallback(() => {
    getPushStatus().then(setStatus).catch(() => setStatus('unsupported'));
    setInstalled(isStandaloneDisplay());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(PUSH_CHANGED_EVENT, refresh);
    // Uporabnik se lahko vrne iz sistemskih nastavitev z drugačnim dovoljenjem.
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(PUSH_CHANGED_EVENT, refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const label = device.isIpad
    ? t('settings.tabletLabel')
    : device.isMobile
      ? t('settings.phoneLabel')
      : t('settings.computerLabel');

  const toggle = async (next: boolean) => {
    setBusy(true);
    if (next) {
      const r = await enablePush(locale);
      if (r === 'denied') toast.error(device.os === 'ios' ? t('push.deniedIos') : t('push.denied'));
      else if (r === 'error' || r === 'unsupported') toast.error(t('push.error'));
    } else {
      await disablePush();
    }
    setBusy(false);
    refresh();
  };

  const test = async () => {
    setTesting(true);
    const r = await sendTestPush();
    setTesting(false);
    if (r === 'sent') toast.success(t('settings.testSent'));
    else if (r === 'not-subscribed') {
      toast.error(t('settings.testNotSubscribed'));
      refresh();
    } else if (r === 'not-configured') toast.error(t('push.notConfigured'));
    else toast.error(t('settings.testFailed'));
  };

  const blockedMessage =
    status === 'denied'
      ? device.os === 'ios'
        ? t('push.deniedIos')
        : t('push.denied')
      : status === 'needs-install'
        ? t('push.needsInstall')
        : status === 'ios-too-old'
          ? t('install.iosTooOld')
          : status === 'unsupported'
            ? t('push.unsupported')
            : status === 'not-configured'
              ? t('push.notConfigured')
              : null;

  const switchable = status === 'on' || status === 'off';

  return (
    <>
      <div>
        <SettingRow label={label} description={t('settings.note')}>
          <Switch
            checked={status === 'on'}
            disabled={!switchable || busy}
            variant="brand"
            onChange={toggle}
          />
        </SettingRow>
        {blockedMessage && (
          <div className="mt-3 flex flex-col gap-2 rounded-xl bg-gray-50 px-3.5 py-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
            <span>{blockedMessage}</span>
            {status === 'needs-install' && (
              <button
                type="button"
                onClick={() => openInstallGuide('install')}
                className="self-start whitespace-nowrap text-sm font-semibold text-[#7C78FA] hover:text-[#6D5EF7] sm:self-auto"
              >
                {t('settings.showHow')}
              </button>
            )}
          </div>
        )}
        {status === 'on' && (
          <button
            type="button"
            onClick={test}
            disabled={testing}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:opacity-60"
          >
            <PaperPlaneTiltIcon size={15} />
            {testing ? t('settings.testSending') : t('settings.test')}
          </button>
        )}
      </div>

      <SettingRow
        label={t('settings.installLabel')}
        description={installed ? t('settings.installedNote') : t('settings.installNote')}
      >
        <button
          type="button"
          onClick={() => openInstallGuide(installed ? 'push' : 'install')}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 sm:w-auto"
        >
          {t('settings.installButton')}
        </button>
      </SettingRow>
    </>
  );
}
