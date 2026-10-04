// lib/phone.ts
//
// Phone numbers in E.164 ("+38640123456"), so SMS and Receptionist+ reach
// clients abroad and a caller can be matched to a client. A number typed
// without a country code ("040 123 456") is read as the company's country.

import {
  parsePhoneNumberFromString,
  getExampleNumber,
  type CountryCode as PhoneCountry,
} from 'libphonenumber-js';
import examples from 'libphonenumber-js/mobile/examples';
import { DEFAULT_COUNTRY, findCountry } from './region';
import type { CommunicationLanguageCode } from './communicationLanguage';

function asPhoneCountry(country: string | null | undefined): PhoneCountry {
  return (findCountry(country)?.code ?? DEFAULT_COUNTRY.code) as PhoneCountry;
}

function parse(raw: unknown, defaultCountry?: string | null) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const text = String(raw).trim();
  if (!text) return undefined;
  // "00386…" is common in Europe; libphonenumber only understands "+".
  const withPlus = text.replace(/^00(?=[1-9])/, '+');
  return parsePhoneNumberFromString(withPlus, asPhoneCountry(defaultCountry));
}

/**
 * E.164 for a valid number; otherwise the trimmed input unchanged, so nothing
 * a user typed is ever lost. Empty input → ''.
 */
export function normalizePhone(raw: unknown, defaultCountry?: string | null): string {
  const parsed = parse(raw, defaultCountry);
  if (parsed?.isValid()) return parsed.number;
  return raw === null || raw === undefined ? '' : String(raw).trim();
}

export function isValidPhone(raw: unknown, defaultCountry?: string | null): boolean {
  return Boolean(parse(raw, defaultCountry)?.isValid());
}

/**
 * How people read it: national format for numbers from the company's own
 * country ("040 123 456"), international for the rest ("+49 151 23456789").
 */
export function formatPhone(raw: unknown, companyCountry?: string | null): string {
  const parsed = parse(raw, companyCountry);
  if (!parsed?.isValid()) return raw === null || raw === undefined ? '' : String(raw).trim();
  return parsed.country === asPhoneCountry(companyCountry)
    ? parsed.formatNational()
    : parsed.formatInternational();
}

/** Example mobile number for input placeholders ("+386 31 234 567"). */
export function phonePlaceholder(country?: string | null): string {
  const example = getExampleNumber(asPhoneCountry(country), examples);
  return example ? example.formatInternational() : '+386 31 234 567';
}

/**
 * The language a client with this number most likely reads, for pre-filling
 * the client's language. Null when the number is local or unknown — then the
 * company's own language applies.
 */
export function languageFromPhone(
  raw: unknown,
  companyCountry?: string | null
): CommunicationLanguageCode | null {
  const parsed = parse(raw, companyCountry);
  if (!parsed?.isValid() || !parsed.country) return null;
  if (parsed.country === asPhoneCountry(companyCountry)) return null;
  return findCountry(parsed.country)?.language ?? 'eng';
}
