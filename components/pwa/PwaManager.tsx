'use client';

/**
 * PWA v prijavljenem delu aplikacije:
 *   - registrira service worker in tiho uskladi push naročnino te naprave,
 *   - številko neprebranih obvestil prikaže na ikoni aplikacije,
 *   - ob pravem trenutku nevsiljivo ponudi namestitev na začetni zaslon
 *     (telefon, ne v aplikaciji) ali vklop obvestil (nameščena aplikacija in
 *     računalnik), z "Ne zdaj", ki si izbiro zapomni,
 *   - odpre vodič, ko ga kdo zahteva z `openInstallGuide()` (npr. nastavitve).
 */

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useLocale } from 'next-intl';
import { InstallGuide, type GuideStart } from './InstallGuide';
import { detectDevice } from '@/lib/pwa/device';
import { getPushStatus, registerServiceWorker, setAppBadge, syncPush } from '@/lib/pwa/push';

const OPEN_EVENT = 'jp:open-install-guide';
const INSTALL_SNOOZE = 'jp_pwa_install_snooze_until';
const INSTALL_DISMISSALS = 'jp_pwa_install_dismissals';
const PUSH_SNOOZE = 'jp_pwa_push_snooze_until';
const PROMPTED_THIS_SESSION = 'jp_pwa_prompted';

const DAY = 24 * 60 * 60 * 1000;
// Po vsakem "Ne zdaj" počakamo dlje; po tretjem ne sprašujemo več sami
// (vodič ostane v nastavitvah).
const INSTALL_SNOOZE_DAYS = [3, 14, 45];
const PUSH_SNOOZE_DAYS = 21;

export function openInstallGuide(start: GuideStart = 'install') {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { start } }));
}

function read(key: string, session = false): string | null {
  try {
    return (session ? window.sessionStorage : window.localStorage).getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string, session = false) {
  try {
    (session ? window.sessionStorage : window.localStorage).setItem(key, value);
  } catch {
    /* zasebni način — vprašali bomo spet naslednjič */
  }
}

function snoozed(key: string): boolean {
  const until = Number(read(key) ?? 0);
  return Number.isFinite(until) && until > Date.now();
}

interface PwaManagerProps {
  unreadCount: number;
  /** Ne prekinjaj vodenega ogleda ali drugega okna. */
  blocked: boolean;
}

type AutoOpen = { start: GuideStart; reason: 'install' | 'push' };

export function PwaManager({ unreadCount, blocked }: PwaManagerProps) {
  const locale = useLocale();
  const [open, setOpen] = useState<{ start: GuideStart; auto: AutoOpen['reason'] | null } | null>(null);
  const [candidate, setCandidate] = useState<AutoOpen | null>(null);

  // Service worker + tiha uskladitev naročnine.
  useEffect(() => {
    registerServiceWorker().then((reg) => {
      if (reg) syncPush(locale).catch(() => {});
    });
  }, [locale]);

  useEffect(() => {
    setAppBadge(unreadCount);
  }, [unreadCount]);

  // Ročno odpiranje (nastavitve, obvestila …).
  useEffect(() => {
    const onOpen = (e: Event) => {
      const start = (e as CustomEvent<{ start?: GuideStart }>).detail?.start ?? 'install';
      setOpen({ start, auto: null });
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  // Ali je ta obisk primeren trenutek za samodejni predlog?
  useEffect(() => {
    if (read(PROMPTED_THIS_SESSION, true)) return;
    let cancelled = false;
    const device = detectDevice();

    (async () => {
      const status = await getPushStatus();
      if (cancelled) return;
      const permissionUnasked = typeof Notification !== 'undefined' && Notification.permission === 'default';

      // 1) Telefon v brskalniku → namestitev na začetni zaslon.
      if (device.isMobile && !device.isStandalone) {
        const dismissals = Number(read(INSTALL_DISMISSALS) ?? 0);
        if (dismissals < INSTALL_SNOOZE_DAYS.length && !snoozed(INSTALL_SNOOZE)) {
          setCandidate({ start: 'install', reason: 'install' });
        }
        return;
      }

      // 2) Nameščena aplikacija ali računalnik → vklop obvestil, če še ni odločeno.
      if (status === 'off' && permissionUnasked && !snoozed(PUSH_SNOOZE)) {
        setCandidate({ start: 'push', reason: 'push' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Pokaži z zamikom, ko se stran umiri in ni odprto nobeno drugo okno.
  useEffect(() => {
    if (!candidate || open || blocked) return;
    const delay = candidate.reason === 'push' && detectDevice().isStandalone ? 1500 : 4000;
    const timer = window.setTimeout(() => {
      if (document.querySelector('[role="dialog"]')) return;
      write(PROMPTED_THIS_SESSION, '1', true);
      setCandidate(null);
      setOpen({ start: candidate.start, auto: candidate.reason });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [candidate, open, blocked]);

  const close = useCallback(() => setOpen(null), []);

  const dismiss = useCallback(() => {
    if (open?.auto === 'install') {
      const n = Number(read(INSTALL_DISMISSALS) ?? 0);
      const days = INSTALL_SNOOZE_DAYS[Math.min(n, INSTALL_SNOOZE_DAYS.length - 1)];
      write(INSTALL_DISMISSALS, String(n + 1));
      write(INSTALL_SNOOZE, String(Date.now() + days * DAY));
    } else if (open?.auto === 'push' || open?.start === 'push') {
      write(PUSH_SNOOZE, String(Date.now() + PUSH_SNOOZE_DAYS * DAY));
    }
    setOpen(null);
  }, [open]);

  return (
    <AnimatePresence>
      {open && <InstallGuide key="pwa-guide" start={open.start} onClose={close} onDismiss={dismiss} />}
    </AnimatePresence>
  );
}
