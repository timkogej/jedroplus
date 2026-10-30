/* Jedro+ service worker
 *
 * - push: pokaže obvestilo (ikona in značka Jedro+) in posodobi številko na ikoni
 * - notificationclick: odpre pravo stran (termin, Receptionist+ …) v že odprti
 *   aplikaciji ali v novem oknu
 * - pushsubscriptionchange: brskalnik je zamenjal naročnino → shrani novo
 * - fetch: samo za prehode med stranmi; brez povezave pokaže /offline.html.
 *   Ničesar drugega ne predpomnimo, da aplikacija nikoli ne kaže starih podatkov.
 */

const VERSION = 'jp-sw-1';
const OFFLINE_URL = '/offline.html';
const ICON = '/android-icon-192.png';
const BADGE = '/brand/push-badge-96.png';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      // Ikoni nista obvezni — če ena ne uspe, se service worker vseeno namesti.
      .then((cache) => Promise.allSettled([cache.add(OFFLINE_URL), cache.add(ICON), cache.add(BADGE)]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.mode !== 'navigate' || req.method !== 'GET') return;
  event.respondWith(
    fetch(req).catch(() => caches.match(OFFLINE_URL).then((res) => res || Response.error())),
  );
});

function parsePush(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch {
    return { body: event.data.text() };
  }
}

function setBadge(count) {
  if (typeof count !== 'number' || !('setAppBadge' in self.navigator)) return Promise.resolve();
  const op = count > 0 ? self.navigator.setAppBadge(count) : self.navigator.clearAppBadge();
  return op.catch(() => {});
}

self.addEventListener('push', (event) => {
  const data = parsePush(event);
  const title = data.title || 'Jedro+';
  const options = {
    body: data.body || '',
    icon: ICON,
    badge: BADGE,
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    timestamp: data.timestamp || Date.now(),
    requireInteraction: Boolean(data.requireInteraction),
    data: {
      url: data.url || '/obvestila',
      notificationId: data.notificationId || null,
      type: data.type || null,
    },
  };

  event.waitUntil(Promise.all([self.registration.showNotification(title, options), setBadge(data.badgeCount)]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || '/obvestila';
  let target;
  try {
    target = new URL(raw, self.location.origin);
  } catch {
    target = new URL('/obvestila', self.location.origin);
  }

  event.waitUntil(
    (async () => {
      // Povezava zunaj aplikacije (npr. Stripe) → vedno novo okno.
      if (target.origin !== self.location.origin) {
        return self.clients.openWindow(target.href);
      }
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const sameOrigin = windows.filter((c) => new URL(c.url).origin === self.location.origin);
      const client = sameOrigin.find((c) => c.focused) || sameOrigin[0];
      if (client) {
        try {
          await client.focus();
        } catch {
          /* iOS včasih ne dovoli fokusa — navigacija vseeno uspe */
        }
        if ('navigate' in client) {
          try {
            return await client.navigate(target.href);
          } catch {
            /* okno ni pod tem SW — odpri novo */
          }
        }
      }
      return self.clients.openWindow(target.href);
    })(),
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription;
      const key = old && old.options ? old.options.applicationServerKey : null;
      const sub =
        event.newSubscription ||
        (key ? await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }) : null);
      if (!sub) return;
      await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      }).catch(() => {});
    })(),
  );
});

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'jp:set-badge') event.waitUntil(setBadge(msg.count));
  if (msg.type === 'jp:skip-waiting') self.skipWaiting();
});
