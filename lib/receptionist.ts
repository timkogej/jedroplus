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

// Owner's free-text instructions for the receptionist (FAQ, parking, rules).
export const INSTRUCTIONS_MAX_LENGTH = 4000;

/** E.164, the same rule as the receptionist_settings.transfer_number check. */
export function isTransferNumber(value: string): boolean {
  return /^\+[1-9][0-9]{6,14}$/.test(value);
}

// ─── Greeting styles ────────────────────────────────────────────────────────
// What the caller hears first. The worker builds the real greeting
// (receptionistplus-worker agent/greeting.py); these texts are the preview in
// settings and must say the same. "custom" = the owner's greeting_text, after
// the standard AI notice.

export const GREETING_STYLES = ['classic', 'sales', 'short', 'custom'] as const;
export type GreetingStyle = (typeof GREETING_STYLES)[number];

export function isGreetingStyle(value: unknown): value is GreetingStyle {
  return typeof value === 'string' && (GREETING_STYLES as readonly string[]).includes(value);
}

export const GREETING_NAME_MAX_LENGTH = 60;
export const ASSISTANT_NAME_MAX_LENGTH = 30;

type PresetTexts = {
  day: string; // midday greeting, used in the preview
  who: string; whoNamed: string; shortWho: string; shortWhoNamed: string;
  classic: string; sales: string; short: string;
};

const GREETING_PRESETS: Record<IsoLanguageCode, PresetTexts> = {
  sl: {
    day: 'dober dan',
    who: 'Sem digitalna asistentka.', whoNamed: 'Sem {assistant}, digitalna asistentka.',
    shortWho: 'tukaj digitalna asistentka.', shortWhoNamed: 'tukaj {assistant}, digitalna asistentka.',
    classic: 'Kako vam lahko pomagam?',
    sales: 'Lahko vam takoj uredim termin ali odgovorim na vprašanje.',
    short: 'Izvolite?',
  },
  en: {
    day: 'good afternoon',
    who: "I'm the digital assistant.", whoNamed: "I'm {assistant}, the digital assistant.",
    shortWho: 'this is the digital assistant.', shortWhoNamed: 'this is {assistant}, the digital assistant.',
    classic: 'How can I help you?',
    sales: 'I can book an appointment for you right away or answer a question.',
    short: 'How can I help?',
  },
  de: {
    day: 'guten Tag',
    who: 'Ich bin die digitale Assistentin.', whoNamed: 'Ich bin {assistant}, die digitale Assistentin.',
    shortWho: 'hier spricht die digitale Assistentin.', shortWhoNamed: 'hier spricht {assistant}, die digitale Assistentin.',
    classic: 'Wie kann ich Ihnen helfen?',
    sales: 'Ich kann Ihnen gleich einen Termin buchen oder eine Frage beantworten.',
    short: 'Was kann ich für Sie tun?',
  },
  hr: {
    day: 'dobar dan',
    who: 'Ja sam digitalna asistentica.', whoNamed: 'Ja sam {assistant}, digitalna asistentica.',
    shortWho: 'ovdje digitalna asistentica.', shortWhoNamed: 'ovdje {assistant}, digitalna asistentica.',
    classic: 'Kako vam mogu pomoći?',
    sales: 'Mogu vam odmah rezervirati termin ili odgovoriti na pitanje.',
    short: 'Izvolite?',
  },
  it: {
    day: 'buongiorno',
    who: "Sono l'assistente digitale.", whoNamed: "Sono {assistant}, l'assistente digitale.",
    shortWho: "qui l'assistente digitale.", shortWhoNamed: "qui {assistant}, l'assistente digitale.",
    classic: 'Come posso aiutarla?',
    sales: 'Posso fissarle subito un appuntamento o rispondere a una domanda.',
    short: 'Mi dica?',
  },
};

/** The AI notice said before the owner's own greeting (style "custom"). */
export const AI_NOTICE: Record<IsoLanguageCode, string> = {
  sl: 'Prosimo, upoštevajte, da govorite z digitalnim glasovnim asistentom, ne z osebo.',
  en: 'Please note that you are speaking with a digital voice assistant, not a person.',
  de: 'Bitte beachten Sie, dass Sie mit einem digitalen Sprachassistenten sprechen, nicht mit einer Person.',
  hr: 'Molimo, imajte na umu da razgovarate s digitalnim glasovnim asistentom, a ne s osobom.',
  it: 'La informiamo che sta parlando con un assistente vocale digitale, non con una persona.',
};

const LEGAL_FORM =
  /[\s,]+(?:j\.?\s?d\.?\s?o\.?\s?o|d\.?\s?o\.?\s?o|d\.?\s?d|s\.?\s?p|k\.?\s?d|d\.?\s?n\.?\s?o|gmbh|ag|e\.?\s?u|og|kg|ltd|llc|inc|s\.?\s?r\.?\s?l|s\.?\s?p\.?\s?a|s\.?\s?a\.?\s?s|obrt)\.?$/i;

/** "Frizerstvo Maja, Maja Novak s.p." → "Frizerstvo Maja" (as agent/greeting.py). */
export function spokenBusinessName(legalName: string | null | undefined): string {
  let name = String(legalName ?? '').replace(/\s+/g, ' ').trim();
  const head = name.split(',')[0].trim();
  if (head) name = head;
  for (let i = 0; i < 3; i++) {
    const stripped = name.replace(LEGAL_FORM, '').replace(/^[\s,]+|[\s,]+$/g, '');
    if (stripped === name || !stripped) break;
    name = stripped;
  }
  return name;
}

/** The greeting as callers hear it around midday (the worker says "dobro
 *  jutro" / "dober večer" at other times). */
export function greetingPreview(
  style: GreetingStyle,
  language: IsoLanguageCode,
  businessName: string,
  assistantName: string,
  customText: string,
): string {
  const name = businessName.trim();
  const assistant = assistantName.trim();
  if (style === 'custom' && customText.trim()) {
    const text = customText.trim().split('{name}').join(name).split('{podjetje}').join(name);
    return `${AI_NOTICE[language]} ${text}`;
  }
  const p = GREETING_PRESETS[language];
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (style === 'short') {
    const who = (assistant ? p.shortWhoNamed : p.shortWho).replace('{assistant}', assistant);
    return `${name ? `${name}, ${p.day}` : cap(p.day)}, ${who} ${p.short}`;
  }
  const who = (assistant ? p.whoNamed : p.who).replace('{assistant}', assistant);
  return `${name ? `${name}, ${p.day}!` : `${cap(p.day)}!`} ${who} ${style === 'sales' ? p.sales : p.classic}`;
}

// ─── Before-booking questions and advice ────────────────────────────────────
// [{text, service_ids}], service_ids empty = every service. Read by the worker
// (agent/booking_extras.py), which takes at most 10 of 300 characters each.

export type BookingItem = { text: string; service_ids: string[] };

export const BOOKING_ITEMS_MAX = 10;
export const BOOKING_ITEM_MAX_LENGTH = 300;

/** Cleaned list, or null when the input isn't a list of items. Empty texts are dropped. */
export function parseBookingItems(value: unknown): BookingItem[] | null {
  if (!Array.isArray(value) || value.length > BOOKING_ITEMS_MAX) return null;
  const items: BookingItem[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') return null;
    const { text, service_ids: ids } = row as { text?: unknown; service_ids?: unknown };
    if (typeof text !== 'string' || text.length > BOOKING_ITEM_MAX_LENGTH) return null;
    if (ids !== undefined && (!Array.isArray(ids) || ids.some((i) => typeof i !== 'string' || i.length > 40))) {
      return null;
    }
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean) items.push({ text: clean, service_ids: [...new Set((ids as string[] | undefined) ?? [])] });
  }
  return items;
}
