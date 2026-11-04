// Company colours as the emails use them (same rules as brand.js in the email
// build): one main colour, one accent, and safe text colours on top of them.

const DARK = '#111827';

export function normalizeHex(value: unknown): string {
  const raw = String(value ?? '').trim();
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
  if (!m) return '';
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return `#${h.toLowerCase()}`;
}

const rgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const toHex = (c: number[]) =>
  `#${c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`;

function luminance(h: string): number {
  const c = rgb(h).map((x) => {
    const v = x / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrast(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const mix = (h: string, w: string, t: number) => {
  const a = rgb(h);
  const b = rgb(w);
  return toHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
};

/** Darken until the colour reads as text (4.5 : 1) on white. */
function textSafe(h: string): string {
  let out = h;
  for (let t = 0.05; contrast(out, '#ffffff') < 4.5 && t <= 1; t += 0.05) out = mix(h, '#000000', t);
  return out;
}

export interface BrandPalette {
  primary: string;
  onPrimary: string;
  text: string;
  second: string;
  secondText: string;
  secondTint: string;
  /** True when the entered main colour is too light to be used as is. */
  primaryTooLight: boolean;
}

export function brandPalette(primary: unknown, second: unknown): BrandPalette {
  const entered = normalizeHex(primary);
  const tooLight = !!entered && contrast(entered, '#ffffff') < 1.12;
  const p = entered && !tooLight ? entered : DARK;
  let s = normalizeHex(second);
  if (s && (contrast(s, '#ffffff') < 1.12 || (Math.abs(luminance(s) - luminance(p)) < 0.02 && contrast(s, p) < 1.15))) s = '';
  const use = s || p;
  return {
    primary: p,
    onPrimary: contrast(p, '#ffffff') >= contrast(p, DARK) ? '#ffffff' : DARK,
    text: textSafe(p),
    second: use,
    secondText: textSafe(use),
    secondTint: mix(use, '#ffffff', 0.88),
    primaryTooLight: tooLight,
  };
}
