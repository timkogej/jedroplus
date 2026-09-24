// lib/receptionist.ts
//
// Receptionist+ languages and the default texts callers hear. These follow
// the receptionist's language (the caller's), not the owner's app language.

import type { IsoLanguageCode } from './communicationLanguage';

export const RECEPTIONIST_LANGUAGES: IsoLanguageCode[] = ['sl', 'en', 'de', 'hr', 'it'];

export function isReceptionistLanguage(value: unknown): value is IsoLanguageCode {
  return typeof value === 'string' && (RECEPTIONIST_LANGUAGES as string[]).includes(value);
}

export const DEFAULT_GREETING: Record<IsoLanguageCode, string> = {
  sl: 'Pozdravljeni, dobrodošli! Kako vam lahko pomagam?',
  en: 'Hello and welcome! How can I help you?',
  de: 'Guten Tag und herzlich willkommen! Wie kann ich Ihnen helfen?',
  hr: 'Dobar dan i dobro došli! Kako vam mogu pomoći?',
  it: 'Buongiorno e benvenuti! Come posso aiutarla?',
};

// Said before the greeting when calls are recorded or transcribed — callers
// must be told (GDPR; in Germany and Italy recording without notice is an
// offence).
export const DEFAULT_RECORDING_NOTICE: Record<IsoLanguageCode, string> = {
  sl: 'Klic se snema in prepisuje za potrebe rezervacije.',
  en: 'This call is recorded and transcribed to handle your booking.',
  de: 'Dieses Gespräch wird zur Bearbeitung Ihrer Buchung aufgezeichnet und transkribiert.',
  hr: 'Poziv se snima i prepisuje radi obrade vaše rezervacije.',
  it: 'La chiamata viene registrata e trascritta per gestire la sua prenotazione.',
};

export const GREETING_MAX_LENGTH = 400;
