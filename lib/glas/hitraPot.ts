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

  // "kaj me danes caka", "kaj me caka jutri", "povzetek dneva", "kako izgleda moj dan"
  const pz =
    b.match(new RegExp(`^kaj (me|nas)(?: ${DAN})? caka(?: ${DAN})?$`)) ??
    b.match(new RegExp(`^(?:povzetek|pregled)(?: dneva| dneva ${DAN}| za ${DAN}| ${DAN})?$`)) ??
    b.match(new RegExp(`^kako (?:izgleda|zgleda) (moj |najin |nas )?dan(?: ${DAN})?$`));
  if (pz) {
    const dan = pz.slice(1).find((x) => x && /^(danes|jutri|po|v |\d)/.test(x)) ?? null;
    const moj = pz[1] === 'me' || pz[1] === 'moj ' ? true : pz[1] === 'nas' || pz[1] === 'nas ' ? false : null;
    return { orodje: 'povzetek_dneva', vhod: { datum: dan, samo_moji: moj } };
  }

  // "kdo je naslednja", "kdo je moja naslednja stranka", "kdo pride naslednji"
  const n = b.match(/^kdo (?:je (moja |moj )?naslednj[aiie]|pride naslednj[aiie])(?: stranka)?$/);
  if (n) return { orodje: 'naslednja_stranka', vhod: { samo_moji: n[1] ? true : null } };

  // "kdo dela jutri", "kdo dela danes", "jutri kdo dela"
  const d = b.match(new RegExp(`^kdo (?:vse )?dela(?: ${DAN})?$`)) ?? b.match(new RegExp(`^${DAN} kdo dela$`));
  if (d) return { orodje: 'kdo_dela', vhod: { datum: d[1] ?? null } };

  // "kdaj imam danes prosto", "kdaj imam prosto jutri", "ali imam danes kaj prostega"
  const p =
    b.match(new RegExp(`^kdaj imam(?: ${DAN})? (?:prosto|luknjo|luknje)(?: ${DAN})?$`)) ??
    b.match(new RegExp(`^(?:ali )?imam(?: ${DAN})? kaj prostega(?: ${DAN})?$`));
  if (p) return { orodje: 'proste_luknje', vhod: { datum: p[1] ?? p[2] ?? null, oseba: null, najmanj_min: null } };

  // "odpri koledar", "pojdi na stranke", "pokazi nastavitve"
  const o = b.match(/^(?:odpri|pojdi na|pokazi|prikazi)(?: stran)? (.+)$/);
  if (o && STRANI_PO_IMENU[o[1]]) return { orodje: 'odpri_stran', vhod: { stran: STRANI_PO_IMENU[o[1]], stranka: null, stranka_id: null } };
  return null;
}

/** Izgovorjeno ime strani (brez šumnikov) → ključ v orodju odpri_stran. */
const STRANI_PO_IMENU: Record<string, string> = {
  koledar: 'koledar',
  termine: 'termini',
  termini: 'termini',
  stranke: 'stranke',
  storitve: 'storitve',
  zaposlene: 'zaposleni',
  zaposleni: 'zaposleni',
  resurse: 'resursi',
  resursi: 'resursi',
  opomnike: 'opomniki',
  opomniki: 'opomniki',
  rezervacije: 'rezervacije',
  'spletne rezervacije': 'rezervacije',
  obvestila: 'obvestila',
  nastavitve: 'nastavitve',
  'nadzorno plosco': 'nadzorna_plosca',
  'nadzorna plosca': 'nadzorna_plosca',
  domov: 'nadzorna_plosca',
  paket: 'paketi',
  pakete: 'paketi',
  ekipo: 'ekipa',
};
