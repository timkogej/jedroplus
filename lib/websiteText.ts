// lib/websiteText.ts
//
// Reads a company's public website as plain text, for the "suggest
// instructions from the website" button in Receptionist+ settings. Server
// only. The home page plus a few same-site pages whose link looks useful
// (about, prices, FAQ, contact, gift vouchers, cancellation rules).
//
// The URL comes from the owner, so every hop is checked before it is
// fetched: http(s) only, a public address (no localhost or private ranges),
// redirects followed by hand and checked again, short timeouts, capped size.

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_PAGES = 5;
const MAX_BYTES = 1_500_000;
const PAGE_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const MAX_CHARS_PER_PAGE = 8000;
const MAX_CHARS_TOTAL = 24000;

const USEFUL_LINK =
  /o-nas|onas|about|o-podjetju|cenik|cene|price|pricing|faq|pogosta|vprasanj|kontakt|contact|informacij|info|darilni|bon|gift|pravila|odpoved|politik|policy|parkir/i;

export class WebsiteError extends Error {
  constructor(public code: 'invalid_url' | 'blocked' | 'unreachable' | 'empty') {
    super(code);
  }
}

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd')) return true;
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || a >= 224
  );
}

async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new WebsiteError('invalid_url');
  if (url.username || url.password) throw new WebsiteError('invalid_url');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new WebsiteError('blocked');
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new WebsiteError('unreachable');
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new WebsiteError('blocked');
}

/** Fetch one page as HTML, following redirects by hand (each hop checked). */
async function fetchHtml(start: URL): Promise<{ url: URL; html: string } | null> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
        headers: { 'User-Agent': 'JedroPlus-Receptionist/1.0 (+https://jedroplus.com)', Accept: 'text/html' },
      });
    } catch {
      return null;
    }
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location');
      if (!next) return null;
      url = new URL(next, url);
      continue;
    }
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return null;
    const body = await readCapped(res);
    return body ? { url, html: body } : null;
  }
  return null;
}

async function readCapped(res: Response): Promise<string | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks));
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  scaron: 'š', Scaron: 'Š', ccaron: 'č', Ccaron: 'Č', zcaron: 'ž', Zcaron: 'Ž', euro: '€',
};

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|iframe|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : ' ';
      }
      return ENTITIES[e] ?? m;
    })
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function usefulLinks(html: string, base: URL): URL[] {
  const found = new Map<string, URL>();
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: URL;
    try {
      url = new URL(m[1], base);
    } catch {
      continue;
    }
    if (url.hostname !== base.hostname || !/^https?:$/.test(url.protocol)) continue;
    const label = `${url.pathname} ${htmlToText(m[2])}`;
    if (!USEFUL_LINK.test(label)) continue;
    url.hash = '';
    const key = url.toString();
    if (key !== base.toString() && !found.has(key)) found.set(key, url);
    if (found.size >= MAX_PAGES - 1) break;
  }
  return [...found.values()];
}

/** The site as text, one "## <page url>" section per page read. */
export async function readWebsite(raw: string): Promise<string> {
  let start: URL;
  try {
    start = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    throw new WebsiteError('invalid_url');
  }
  const home = await fetchHtml(start);
  if (!home) throw new WebsiteError('unreachable');

  const pages = [{ url: home.url, text: htmlToText(home.html) }];
  const subpages = await Promise.all(usefulLinks(home.html, home.url).map((u) => fetchHtml(u).catch(() => null)));
  for (const page of subpages) {
    if (page) pages.push({ url: page.url, text: htmlToText(page.html) });
  }

  let total = '';
  for (const page of pages) {
    const section = `## ${page.url.toString()}\n${page.text.slice(0, MAX_CHARS_PER_PAGE)}\n\n`;
    if (total.length + section.length > MAX_CHARS_TOTAL) break;
    total += section;
  }
  if (total.replace(/^## .*$/gm, '').replace(/\s+/g, '').length < 200) throw new WebsiteError('empty');
  return total;
}
