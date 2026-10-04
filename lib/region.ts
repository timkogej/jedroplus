// lib/region.ts
//
// Where a company works: country, time zone, currency and the language its
// clients most likely speak. Everything that depends on "where" (today's
// date, money, phone numbers, reminder times) reads it from here instead of
// assuming Slovenia.
//
// Stored on "Podatki podjetij" as country_code (ISO 3166-1 alpha-2),
// timezone (IANA) and valuta (ISO 4217). Companies created before those
// columns existed only have the English country name onboarding sent to n8n
// (or nothing), so resolveCompanyRegion() falls back through those.

import type { CommunicationLanguageCode } from './communicationLanguage';

export type CountryCode = string; // ISO 3166-1 alpha-2, upper case

export interface CountryDefaults {
  code: CountryCode;
  /** The English name onboarding has always sent to n8n (legacy `country`). */
  legacyName: string;
  timezone: string;
  currency: string;
  /** Language clients in this country most likely read; null → English. */
  language: CommunicationLanguageCode | null;
}

// Same countries onboarding offers. First entry is the default.
export const COUNTRIES: CountryDefaults[] = [
  { code: 'SI', legacyName: 'Slovenia', timezone: 'Europe/Ljubljana', currency: 'EUR', language: 'slo' },
  { code: 'HR', legacyName: 'Croatia', timezone: 'Europe/Zagreb', currency: 'EUR', language: 'hr' },
  { code: 'RS', legacyName: 'Serbia', timezone: 'Europe/Belgrade', currency: 'RSD', language: null },
  { code: 'BA', legacyName: 'Bosnia and Herzegovina', timezone: 'Europe/Sarajevo', currency: 'BAM', language: null },
  { code: 'ME', legacyName: 'Montenegro', timezone: 'Europe/Podgorica', currency: 'EUR', language: null },
  { code: 'MK', legacyName: 'North Macedonia', timezone: 'Europe/Skopje', currency: 'MKD', language: null },
  { code: 'AT', legacyName: 'Austria', timezone: 'Europe/Vienna', currency: 'EUR', language: 'de' },
  { code: 'DE', legacyName: 'Germany', timezone: 'Europe/Berlin', currency: 'EUR', language: 'de' },
  { code: 'IT', legacyName: 'Italy', timezone: 'Europe/Rome', currency: 'EUR', language: 'it' },
  { code: 'HU', legacyName: 'Hungary', timezone: 'Europe/Budapest', currency: 'HUF', language: null },
  { code: 'CZ', legacyName: 'Czech Republic', timezone: 'Europe/Prague', currency: 'CZK', language: null },
  { code: 'SK', legacyName: 'Slovakia', timezone: 'Europe/Bratislava', currency: 'EUR', language: null },
  { code: 'PL', legacyName: 'Poland', timezone: 'Europe/Warsaw', currency: 'PLN', language: null },
  { code: 'RO', legacyName: 'Romania', timezone: 'Europe/Bucharest', currency: 'RON', language: null },
  { code: 'BG', legacyName: 'Bulgaria', timezone: 'Europe/Sofia', currency: 'EUR', language: null },
  { code: 'FR', legacyName: 'France', timezone: 'Europe/Paris', currency: 'EUR', language: null },
  { code: 'ES', legacyName: 'Spain', timezone: 'Europe/Madrid', currency: 'EUR', language: null },
  { code: 'PT', legacyName: 'Portugal', timezone: 'Europe/Lisbon', currency: 'EUR', language: null },
  { code: 'NL', legacyName: 'Netherlands', timezone: 'Europe/Amsterdam', currency: 'EUR', language: null },
  { code: 'BE', legacyName: 'Belgium', timezone: 'Europe/Brussels', currency: 'EUR', language: null },
  { code: 'CH', legacyName: 'Switzerland', timezone: 'Europe/Zurich', currency: 'CHF', language: 'de' },
  { code: 'GB', legacyName: 'United Kingdom', timezone: 'Europe/London', currency: 'GBP', language: 'eng' },
  { code: 'US', legacyName: 'United States', timezone: 'America/New_York', currency: 'USD', language: 'eng' },
  { code: 'CA', legacyName: 'Canada', timezone: 'America/Toronto', currency: 'CAD', language: 'eng' },
  { code: 'AU', legacyName: 'Australia', timezone: 'Australia/Sydney', currency: 'AUD', language: 'eng' },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));
const BY_LEGACY_NAME = new Map(COUNTRIES.map((c) => [c.legacyName.toLowerCase(), c]));

/** Accepts "SI", "si", "Slovenia" — returns the country's defaults or null. */
export function findCountry(value: unknown): CountryDefaults | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  return BY_CODE.get(text.toUpperCase()) ?? BY_LEGACY_NAME.get(text.toLowerCase()) ?? null;
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function isValidCurrency(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[A-Za-z]{3}$/.test(value.trim())) return false;
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: value.trim().toUpperCase() });
    return true;
  } catch {
    return false;
  }
}

/** Every IANA zone the runtime knows, for the settings picker. */
export function listTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  const zones = intl.supportedValuesOf?.('timeZone') ?? [];
  const known = new Set(zones);
  for (const c of COUNTRIES) known.add(c.timezone);
  return Array.from(known).sort();
}

/** Currencies of the supported countries plus a few common ones. */
export const CURRENCIES: string[] = Array.from(
  new Set([...COUNTRIES.map((c) => c.currency), 'EUR', 'USD', 'GBP', 'CHF'])
).sort();

export interface CompanyRegion {
  countryCode: CountryCode;
  timezone: string;
  currency: string;
  /** Default language for client messages in this country (legacy code). */
  language: CommunicationLanguageCode | null;
}

function pickString(row: Record<string, unknown> | null | undefined, keys: string[]): string | undefined {
  if (!row) return undefined;
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

/**
 * The company's region from its "Podatki podjetij" row. Explicit columns win;
 * otherwise the legacy country name decides; otherwise Slovenia.
 */
export function resolveCompanyRegion(row: Record<string, unknown> | null | undefined): CompanyRegion {
  const country =
    findCountry(pickString(row, ['country_code'])) ??
    findCountry(pickString(row, ['country', 'Country', 'Država', 'drzava'])) ??
    DEFAULT_COUNTRY;

  const tz = pickString(row, ['timezone', 'time_zone']);
  const currency = pickString(row, ['valuta', 'Valuta', 'currency', 'default_currency']);

  return {
    countryCode: country.code,
    timezone: isValidTimeZone(tz) ? tz : country.timezone,
    currency: isValidCurrency(currency) ? currency.toUpperCase() : country.currency,
    language: country.language,
  };
}

/** Defaults for a newly chosen country (onboarding, settings). */
export function regionForCountry(value: unknown): CompanyRegion {
  const country = findCountry(value) ?? DEFAULT_COUNTRY;
  return {
    countryCode: country.code,
    timezone: country.timezone,
    currency: country.currency,
    language: country.language,
  };
}
