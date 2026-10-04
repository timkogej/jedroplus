// Client-message language as stored in "Stranke".language, "Termini".language
// and "Podatki podjetij".language and read by n8n. These legacy codes stay in
// the database until n8n is migrated; in new code convert at the edge with
// toIsoLanguage() / fromIsoLanguage() and work with ISO 639-1 ('sl', 'en', …),
// the same codes the UI locales and receptionist_settings.language use.
export type CommunicationLanguageCode = 'slo' | 'eng' | 'de' | 'it' | 'hr';

export type IsoLanguageCode = 'sl' | 'en' | 'de' | 'it' | 'hr';

const TO_ISO: Record<CommunicationLanguageCode, IsoLanguageCode> = {
  slo: 'sl',
  eng: 'en',
  de: 'de',
  it: 'it',
  hr: 'hr',
};

/** Any spelling ('slo', 'sl', 'Slovenščina', 'eng', …) → ISO 639-1. */
export function toIsoLanguage(value: unknown, fallback: CommunicationLanguageCode = 'slo'): IsoLanguageCode {
  return TO_ISO[normalizeCommunicationLanguage(value, fallback)];
}

/** Any spelling → the legacy code the database and n8n expect. */
export function fromIsoLanguage(value: unknown, fallback: CommunicationLanguageCode = 'slo'): CommunicationLanguageCode {
  return normalizeCommunicationLanguage(value, fallback);
}

export type CommunicationLanguageOption = {
  value: CommunicationLanguageCode;
  code: string;
  flag: string;
  label: string;
};

export const COMMUNICATION_LANGUAGES: CommunicationLanguageOption[] = [
  { value: 'slo', code: 'SLO', flag: '🇸🇮', label: 'Slovenščina' },
  { value: 'eng', code: 'ENG', flag: '🇬🇧', label: 'English' },
  { value: 'de', code: 'DE', flag: '🇩🇪', label: 'Deutsch' },
  { value: 'it', code: 'IT', flag: '🇮🇹', label: 'Italiano' },
  { value: 'hr', code: 'HR', flag: '🇭🇷', label: 'Hrvatski' },
];

const LANGUAGE_ALIASES: Record<string, CommunicationLanguageCode> = {
  sl: 'slo',
  si: 'slo',
  slo: 'slo',
  slovenscina: 'slo',
  slovensčina: 'slo',
  slovenščina: 'slo',
  slovenian: 'slo',
  en: 'eng',
  eng: 'eng',
  english: 'eng',
  de: 'de',
  ger: 'de',
  deu: 'de',
  german: 'de',
  deutsch: 'de',
  it: 'it',
  ita: 'it',
  italian: 'it',
  italiano: 'it',
  hr: 'hr',
  hrv: 'hr',
  cro: 'hr',
  croatian: 'hr',
  hrvatski: 'hr',
};

const stripDiacritics = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function normalizeCommunicationLanguage(
  value: unknown,
  fallback: CommunicationLanguageCode = 'slo'
): CommunicationLanguageCode {
  if (value === null || value === undefined) return fallback;

  const normalized = stripDiacritics(String(value).trim().toLowerCase());
  if (!normalized) return fallback;

  return LANGUAGE_ALIASES[normalized] ?? fallback;
}

export function getCommunicationLanguageOption(
  value: unknown,
  fallback: CommunicationLanguageCode = 'slo'
) {
  const normalized = normalizeCommunicationLanguage(value, fallback);
  return COMMUNICATION_LANGUAGES.find((option) => option.value === normalized) ?? COMMUNICATION_LANGUAGES[0];
}

export function getCompanyCommunicationLanguage(
  companySettings: Record<string, unknown> | null | undefined,
  fallback: CommunicationLanguageCode = 'slo'
) {
  return normalizeCommunicationLanguage(
    companySettings?.language ??
      companySettings?.Language ??
      companySettings?.preferred_language ??
      companySettings?.notification_language,
    fallback
  );
}
