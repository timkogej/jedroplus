// lib/glas/hitraPot.ts
//
// Preprosta bralna vprašanja brez LLM (hitreje in brez stroška). Samo za
// stavke, ki jih zanesljivo prepoznamo v celoti; vse ostalo gre LLM.
// Nikoli ne vodi do pisanja.

import { brezSumnikov } from './razresevanje/besedilo';

export interface HitriKlic {
  orodje: string;
  vhod: Record<string, unknown>;
}

const DAN = '(danes|jutri|po ?jutrisnjem|v ponedeljek|v torek|v sredo|v cetrtek|v petek|v soboto|v nedeljo|\\d{1,2}\\.\\s?\\d{1,2}\\.?)';

export function hitraPot(prepis: string): HitriKlic | null {
  const b = brezSumnikov(prepis)
    .replace(/[?!.,]+$/g, '')
    .replace(/[,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // "kaj imam jutri", "kaj imam danes na sporedu", "kaj imamo v petek", "jutri kaj imam"
  const m =
    b.match(new RegExp(`^(?:kaj|katere termine|koliko terminov) (imam|imamo)(?: ${DAN})?(?: na (?:sporedu|urniku))?$`)) ??
    b.match(new RegExp(`^${DAN} kaj (imam|imamo)(?: na (?:sporedu|urniku))?$`));
  if (m) {
    const oseba = m[1] === 'imam' || m[2] === 'imam' ? true : m[1] === 'imamo' || m[2] === 'imamo' ? false : null;
    const dan = [m[1], m[2]].find((x) => x && x !== 'imam' && x !== 'imamo') ?? null;
    return { orodje: 'koledar_dan', vhod: { datum: dan, samo_moji: oseba } };
  }
  return null;
}
