// lib/pwa/push.ts
//
// Push obvestila na tej napravi: registracija service workerja, vklop,
// izklop, testno obvestilo in tiha uskladitev ob vsakem odprtju aplikacije.

import { detectDevice, deviceLabel, platformOf } from './device';

export type PushStatus =
  | 'loading'
  | 'unsupported' // brskalnik ne zna pusha (npr. star brskalnik, vgrajen brskalnik aplikacije)
  | 'needs-install' // iPhone/iPad: push dela samo v aplikaciji z začetnega zaslona
  | 'ios-too-old' // iOS pred 16.4
  | 'not-configured' // manjka NEXT_PUBLIC_VAPID_PUBLIC_KEY
  | 'denied' // uporabnik je obvestila blokiral v brskalniku
  | 'off'
  | 'on';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const WANTED_KEY = 'jp_push_wanted';
export const PUSH_CHANGED_EVENT = 'jp:push-changed';

function announce() {
  try {
    window.dispatchEvent(new Event(PUSH_CHANGED_EVENT));
  } catch {
    /* ni okna */
  }
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function setWanted(on: boolean) {
  try {
    if (on) storage()?.setItem(WANTED_KEY, '1');
    else storage()?.removeItem(WANTED_KEY);
  } catch {
    /* zasebni način */
  }
}

function wanted(): boolean {
  try {
    return storage()?.getItem(WANTED_KEY) === '1';
  } catch {
    return false;
  }
}

function hasPushApis(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

/** Registrira /sw.js (enkrat na nalaganje strani). */
export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return Promise.resolve(null);
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(() => navigator.serviceWorker.ready)
      .catch((err) => {
        console.warn('[pwa] service worker registration failed', err);
        registrationPromise = null;
        return null;
      });
  }
  return registrationPromise;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/** Stanje, ki ga ne moremo popraviti z vklopom (ali null, če je push mogoč). */
export function pushBlocker(): Exclude<PushStatus, 'loading' | 'off' | 'on' | 'denied'> | null {
  const device = detectDevice();
  if (device.os === 'ios' && !device.isStandalone) {
    if (device.iosVersion !== null && device.iosVersion < 16.4) return 'ios-too-old';
    return 'needs-install';
  }
  if (!hasPushApis()) return 'unsupported';
  if (!VAPID_PUBLIC_KEY) return 'not-configured';
  return null;
}

export async function getPushStatus(): Promise<PushStatus> {
  const blocker = pushBlocker();
  if (blocker) return blocker;
  if (Notification.permission === 'denied') return 'denied';
  const reg = await registerServiceWorker();
  if (!reg) return 'unsupported';
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

async function saveSubscription(sub: PushSubscription, locale: string): Promise<boolean> {
  const device = detectDevice();
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      platform: platformOf(device),
      browser: device.isStandalone ? 'app' : device.browser,
      deviceLabel: deviceLabel(device),
      locale,
    }),
  }).catch(() => null);
  return Boolean(res?.ok);
}

async function subscribe(reg: ServiceWorkerRegistration): Promise<PushSubscription> {
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
}

export type EnableResult = 'on' | 'denied' | 'dismissed' | 'unsupported' | 'error';

/**
 * Vklopi obvestila. Kliči neposredno iz klika — Safari dovoli vprašanje za
 * dovoljenje samo kot odziv na dotik.
 */
export async function enablePush(locale: string): Promise<EnableResult> {
  if (pushBlocker()) return 'unsupported';
  // Najprej vprašanje (še znotraj dotika), šele nato service worker.
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'dismissed';

  const reg = await registerServiceWorker();
  if (!reg) return 'unsupported';
  try {
    const sub = await subscribe(reg);
    const saved = await saveSubscription(sub, locale);
    if (!saved) return 'error';
    setWanted(true);
    announce();
    return 'on';
  } catch (err) {
    console.warn('[pwa] push subscribe failed', err);
    return 'error';
  }
}

export async function disablePush(): Promise<void> {
  setWanted(false);
  const reg = await registerServiceWorker();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => null);
  await sub.unsubscribe().catch(() => false);
  announce();
}

export type TestResult = 'sent' | 'not-subscribed' | 'not-configured' | 'error';

export async function sendTestPush(): Promise<TestResult> {
  const reg = await registerServiceWorker();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return 'not-subscribed';
  const res = await fetch('/api/push/test', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => null);
  if (res?.ok) return 'sent';
  const data = (await res?.json().catch(() => null)) as { error?: string } | null;
  if (data?.error === 'push_not_configured') return 'not-configured';
  if (data?.error === 'not_subscribed' || data?.error === 'subscription_gone') return 'not-subscribed';
  return 'error';
}

/**
 * Ob odprtju aplikacije: osveži naročnino na strežniku (brskalnik jo lahko
 * zamenja, uporabnik lahko zamenja podjetje ali jezik) in jo obnovi, če jo je
 * sistem izbrisal, uporabnik pa je obvestila vklopil.
 */
export async function syncPush(locale: string): Promise<void> {
  if (pushBlocker() || Notification.permission !== 'granted') return;
  const reg = await registerServiceWorker();
  if (!reg) return;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    if (!wanted()) return;
    try {
      sub = await subscribe(reg);
    } catch {
      return;
    }
  }
  await saveSubscription(sub, locale);
}

/** Ob odjavi: ta naprava ne sme več dobivati obvestil podjetja. */
export async function forgetPushOnLogout(): Promise<void> {
  try {
    setWanted(false);
    if (!hasPushApis()) return;
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => null);
    await sub.unsubscribe().catch(() => false);
  } catch {
    /* odjava mora uspeti tudi brez tega */
  }
}

/** Številka na ikoni aplikacije (Android, iOS 16.4+, Chrome/Edge na računalniku). */
export function setAppBadge(count: number) {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (!nav.setAppBadge) return;
  (count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge?.())?.catch(() => {});
}
