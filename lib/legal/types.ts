// lib/legal/types.ts
//
// Legal documents shown at /legal/<lang>/<doc>. Text lives in
// lib/legal/content/<lang>.ts; facts that are the same in every language
// (company, addresses, dates) in lib/legal/facts.ts.

export const LEGAL_LANGS = ['sl', 'en', 'de', 'hr', 'it'] as const;
export type LegalLang = (typeof LEGAL_LANGS)[number];

export const LEGAL_DOCS = ['terms', 'privacy', 'dpa', 'subprocessors'] as const;
export type LegalDocKey = (typeof LEGAL_DOCS)[number];

/**
 * A paragraph, or a list item when it starts with "- ". Consecutive list
 * items render as one list.
 */
export type LegalBlock = string;

export interface LegalSection {
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  title: string;
  /** One or two sentences under the title. */
  summary: string;
  sections: LegalSection[];
}

export interface LegalUi {
  /** Shown until a lawyer has reviewed the texts (LEGAL_REVIEWED). */
  draftBanner: string;
  lastUpdated: string;
  /** On translations: the Slovenian version is binding. */
  bindingNote: string;
  otherDocuments: string;
  languageLabel: string;
}

export interface LegalContent {
  ui: LegalUi;
  docs: Record<LegalDocKey, LegalDoc>;
}

export function isLegalLang(value: unknown): value is LegalLang {
  return typeof value === 'string' && (LEGAL_LANGS as readonly string[]).includes(value);
}

export function isLegalDoc(value: unknown): value is LegalDocKey {
  return typeof value === 'string' && (LEGAL_DOCS as readonly string[]).includes(value);
}
