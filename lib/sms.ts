// lib/sms.ts
//
// Countries SMS may be sent to. The package price is the same everywhere, so
// SMS only go where they cost about what they cost in Slovenia; clients with
// a number elsewhere get email instead.
//
// n8n decides with the SQL function sms_allowed(phone, company_country)
// (migration 1790400000) — keep SMS_COUNTRIES and the sms_countries table in
// sync. The app uses this list only to warn in the UI.

import { parsePhoneNumberFromString, type CountryCode as PhoneCountry } from 'libphonenumber-js';
import { DEFAULT_COUNTRY, findCountry } from './region';

export const SMS_COUNTRIES = ['SI', 'HR', 'AT', 'DE', 'IT'] as const;

const ALLOWED = new Set<string>(SMS_COUNTRIES);

/** Country of the number (local numbers belong to the company's country). */
export function phoneCountry(phone: unknown, companyCountry?: string | null): string | null {
  if (typeof phone !== 'string' || !phone.trim()) return null;
  const defaultCountry = (findCountry(companyCountry)?.code ?? DEFAULT_COUNTRY.code) as PhoneCountry;
  const parsed = parsePhoneNumberFromString(phone.trim().replace(/^00(?=[1-9])/, '+'), defaultCountry);
  return parsed?.country ?? null;
}

/**
 * False only when the number is known to be in a country without SMS.
 * Unparseable numbers are left to n8n (true), so this never hides a
 * working number.
 */
export function smsAllowedFor(phone: unknown, companyCountry?: string | null): boolean {
  const country = phoneCountry(phone, companyCountry);
  return country === null || ALLOWED.has(country);
}
