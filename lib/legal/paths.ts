// lib/legal/paths.ts
//
// Links to the legal pages. Kept apart from the texts so client components
// can link without bundling all five languages.

import { LEGAL_LANGS, type LegalDocKey } from './types';

export { LEGAL_DOCS } from './types';
export { TERMS_VERSION } from './facts';

/** Public URL of a document, e.g. /legal/sl/terms (English if the language has no texts). */
export function legalPath(doc: LegalDocKey, lang: string): string {
  const safe = (LEGAL_LANGS as readonly string[]).includes(lang) ? lang : 'en';
  return `/legal/${safe}/${doc}`;
}
