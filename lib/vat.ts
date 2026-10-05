// lib/vat.ts
//
// EU VAT numbers: normalise, check the format, and ask VIES whether the
// number is registered. A valid number from another EU country means the
// invoice is reverse-charged (no VAT); a company without one pays the VAT
// of its own country (Stripe Tax works this out when it has the number).

// Format per member state (after the 2-letter prefix). Greece uses "EL".
const FORMATS: Record<string, RegExp> = {
  AT: /^U\d{8}$/,
  BE: /^[01]\d{9}$/,
  BG: /^\d{9,10}$/,
  CY: /^\d{8}[A-Z]$/,
  CZ: /^\d{8,10}$/,
  DE: /^\d{9}$/,
  DK: /^\d{8}$/,
  EE: /^\d{9}$/,
  EL: /^\d{9}$/,
  ES: /^[A-Z0-9]\d{7}[A-Z0-9]$/,
  FI: /^\d{8}$/,
  FR: /^[A-HJ-NP-Z0-9]{2}\d{9}$/,
  HR: /^\d{11}$/,
  HU: /^\d{8}$/,
  IE: /^\d{7}[A-W][A-I]?$|^\d[A-Z+*]\d{5}[A-W]$/,
  IT: /^\d{11}$/,
  LT: /^(\d{9}|\d{12})$/,
  LU: /^\d{8}$/,
  LV: /^\d{11}$/,
  MT: /^\d{8}$/,
  NL: /^\d{9}B\d{2}$/,
  PL: /^\d{10}$/,
  PT: /^\d{9}$/,
  RO: /^\d{2,10}$/,
  SE: /^\d{12}$/,
  SI: /^\d{8}$/,
  SK: /^\d{10}$/,
};

export interface ParsedVat {
  /** VIES member-state code (Greece = EL). */
  country: string;
  number: string;
  /** "SI12345678" */
  full: string;
}

/**
 * "si 1234 5678", "SI-12345678" → { country: 'SI', number: '12345678' }.
 * A number without a prefix takes the company's country. Null when the
 * format can't be an EU VAT number.
 */
export function parseVat(raw: unknown, companyCountry?: string | null): ParsedVat | null {
  if (typeof raw !== 'string') return null;
  let text = raw.toUpperCase().replace(/[\s.\-/]/g, '');
  if (!text) return null;
  if (!/^[A-Z]{2}/.test(text) && companyCountry) {
    text = (companyCountry.toUpperCase() === 'GR' ? 'EL' : companyCountry.toUpperCase()) + text;
  }
  const country = text.slice(0, 2) === 'GR' ? 'EL' : text.slice(0, 2);
  const number = text.slice(2);
  const format = FORMATS[country];
  if (!format || !format.test(number)) return null;
  return { country, number, full: `${country}${number}` };
}

export type VatCheck =
  | { status: 'valid'; name: string | null; address: string | null }
  | { status: 'invalid' }
  /** VIES or the member state's service is down — try later, don't block. */
  | { status: 'unavailable' };

const VIES_URL = 'https://ec.europa.eu/taxation_customs/vies/rest-api/ms';

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text !== '---' ? text : null;
}

/** Asks VIES (server side). Never throws. */
export async function checkVatWithVies(vat: ParsedVat, fetchImpl: typeof fetch = fetch): Promise<VatCheck> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetchImpl(`${VIES_URL}/${vat.country}/vat/${encodeURIComponent(vat.number)}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return { status: 'unavailable' };

    const body = (await res.json()) as Record<string, unknown>;
    const valid = body.isValid ?? body.valid;
    if (valid === true) {
      return { status: 'valid', name: cleanText(body.name), address: cleanText(body.address) };
    }
    // userError is 'INVALID' / 'INVALID_INPUT' for a bad number; anything
    // else (MS_UNAVAILABLE, TIMEOUT, MS_MAX_CONCURRENT_REQ, …) is an outage.
    const userError = typeof body.userError === 'string' ? body.userError : '';
    return valid === false && (userError === '' || userError.startsWith('INVALID'))
      ? { status: 'invalid' }
      : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}
