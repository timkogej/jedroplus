// lib/pwa/device.ts
//
// Na kateri napravi in v katerem brskalniku smo — od tega so odvisna navodila
// za namestitev in to, ali push sploh deluje.

export type PwaOs = 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'chromeos' | 'other';
export type PwaBrowser = 'safari' | 'chrome' | 'edge' | 'firefox' | 'samsung' | 'opera' | 'inapp' | 'other';

export interface DeviceInfo {
  os: PwaOs;
  browser: PwaBrowser;
  /** iPad se predstavlja kot Mac; ločimo ga po dotiku. */
  isIpad: boolean;
  isMobile: boolean;
  /** Odprto kot nameščena aplikacija (z začetnega zaslona / iz Docka). */
  isStandalone: boolean;
  /** iOS/iPadOS različica (npr. 17.4), če jo znamo prebrati. */
  iosVersion: number | null;
}

export function detectDevice(): DeviceInfo {
  if (typeof window === 'undefined') {
    return { os: 'other', browser: 'other', isIpad: false, isMobile: false, isStandalone: false, iosVersion: null };
  }
  const ua = navigator.userAgent;
  const touch = navigator.maxTouchPoints > 1;

  const isIpad = /iPad/.test(ua) || (/Macintosh/.test(ua) && touch);
  const isIos = /iPhone|iPod/.test(ua) || isIpad;

  let os: PwaOs = 'other';
  if (isIos) os = 'ios';
  else if (/Android/i.test(ua)) os = 'android';
  else if (/CrOS/.test(ua)) os = 'chromeos';
  else if (/Macintosh|Mac OS X/.test(ua)) os = 'macos';
  else if (/Windows/.test(ua)) os = 'windows';
  else if (/Linux/.test(ua)) os = 'linux';

  // Vgrajeni brskalniki aplikacij (Instagram, Facebook, Messenger, TikTok,
  // LinkedIn, Gmail …) ne znajo namestiti spletne aplikacije.
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|TikTok|musical_ly|LinkedInApp|GSA\/|Snapchat|Pinterest/i.test(ua) ||
    (os === 'android' && /; wv\)/.test(ua));

  let browser: PwaBrowser = 'other';
  if (inApp) browser = 'inapp';
  else if (/EdgiOS|EdgA|Edg\//.test(ua)) browser = 'edge';
  else if (/SamsungBrowser/.test(ua)) browser = 'samsung';
  else if (/OPR\/|OPiOS|Opera/.test(ua)) browser = 'opera';
  else if (/FxiOS|Firefox\//.test(ua)) browser = 'firefox';
  else if (/CriOS|Chrome\//.test(ua)) browser = 'chrome';
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'safari';

  const versionMatch = isIos ? ua.match(/OS (\d+)[._](\d+)/) ?? ua.match(/Version\/(\d+)\.(\d+)/) : null;
  const iosVersion = versionMatch ? Number(`${versionMatch[1]}.${versionMatch[2]}`) : null;

  return {
    os,
    browser,
    isIpad,
    isMobile: os === 'ios' || os === 'android',
    isStandalone: isStandaloneDisplay(),
    iosVersion,
  };
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches
  );
}

/** Kratek opis naprave za seznam naprav, npr. "iPhone · Safari". */
export function deviceLabel(d: DeviceInfo): string {
  const osName: Record<PwaOs, string> = {
    ios: d.isIpad ? 'iPad' : 'iPhone',
    android: 'Android',
    macos: 'Mac',
    windows: 'Windows',
    linux: 'Linux',
    chromeos: 'ChromeOS',
    other: 'Naprava',
  };
  const browserName: Record<PwaBrowser, string> = {
    safari: 'Safari',
    chrome: 'Chrome',
    edge: 'Edge',
    firefox: 'Firefox',
    samsung: 'Samsung Internet',
    opera: 'Opera',
    inapp: 'App',
    other: '',
  };
  const b = d.isStandalone ? 'App' : browserName[d.browser];
  return b ? `${osName[d.os]} · ${b}` : osName[d.os];
}

export function platformOf(d: DeviceInfo): 'ios' | 'android' | 'desktop' | 'other' {
  if (d.os === 'ios') return 'ios';
  if (d.os === 'android') return 'android';
  if (d.os === 'macos' || d.os === 'windows' || d.os === 'linux' || d.os === 'chromeos') return 'desktop';
  return 'other';
}
