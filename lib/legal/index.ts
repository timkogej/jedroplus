// lib/legal/index.ts

import { de } from './content/de';
import { en } from './content/en';
import { hr } from './content/hr';
import { it } from './content/it';
import { sl } from './content/sl';
import type { LegalContent, LegalLang } from './types';

export * from './types';
export { LEGAL_FACTS, LEGAL_REVIEWED, TERMS_VERSION } from './facts';

const CONTENT: Record<LegalLang, LegalContent> = { sl, en, de, hr, it };

export function getLegalContent(lang: LegalLang): LegalContent {
  return CONTENT[lang];
}

export { legalPath } from './paths';
