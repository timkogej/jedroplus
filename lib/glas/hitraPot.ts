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

  // Obdobje (Tim, 17. 11.): "koliko terminov imamo v tem tednu", "kaj imam naslednji teden", "koliko terminov ta mesec"
  const OBD = '((?:v )?(?:ta|tem|naslednji|naslednjem|prihodnji|prihodnjem) (?:teden|tednu|mesec|mesecu))';
  const ob =
    b.match(new RegExp(`^(?:kaj|katere termine|koliko terminov|koliko imam terminov|koliko imamo terminov) (?:(imam|imamo) )?${OBD}(?: (imam|imamo))?(?: na (?:sporedu|urniku))?$`)) ??
    b.match(new RegExp(`^${OBD} (?:kaj|koliko terminov) (imam|imamo)$`));
  if (ob) {
    const glagol = ob.slice(1).find((x) => x === 'imam' || x === 'imamo') ?? (/imam terminov/.test(b) ? 'imam' : /imamo terminov/.test(b) ? 'imamo' : null);
    const obdobje = ob.slice(1).find((x) => x && x !== 'imam' && x !== 'imamo')!.replace(/^v /, '');
    return { orodje: 'koledar_dan', vhod: { datum: obdobje, samo_moji: glagol === 'imam' ? true : glagol === 'imamo' ? false : null } };
  }

  // Preteklik (Tim, 16. 11.: model je odgovoril na pamet in omenil samo en termin):
  // "kaj sem imel danes", "kaj vse sem imela danes katere termine", "koga smo imeli danes"
  const pr = b.match(new RegExp(`^(?:kaj(?: vse)?|katere termine|koga(?: vse)?) (sem|smo) (?:imel|imela|imeli)(?: ${DAN})?(?: (?:katere termine|na sporedu|na urniku))?$`));
  if (pr) return { orodje: 'koledar_dan', vhod: { datum: pr[2] ?? null, samo_moji: pr[1] === 'sem' } };

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

  // Osebni opomniki: vedno iz orodja (kartica), ne iz spomina modela (Tim, 16. 11.).
  // "kateri opomniki so mi ostali", "katere opomnike imam", "moji opomniki"
  if (/^(?:kateri (?:so )?(?:moji )?opomniki(?: so)?(?: mi)?(?: se| sploh)?(?: ostali| ostanejo)?|katere opomnike (?:imam|sem nastavil[a]?)|kaksne opomnike imam|moji opomniki|seznam (?:mojih )?opomnikov)$/.test(b)) {
    return { orodje: 'moji_opomniki', vhod: {} };
  }

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
  zahteve: 'zahteve',
  'zahteve za termin': 'zahteve',
  povprasevanja: 'zahteve',
  'povprasevanja strank': 'zahteve',
  obvestila: 'obvestila',
  nastavitve: 'nastavitve',
  'nadzorno plosco': 'nadzorna_plosca',
  'nadzorna plosca': 'nadzorna_plosca',
  domov: 'nadzorna_plosca',
  paket: 'paketi',
  pakete: 'paketi',
  ekipo: 'ekipa',
};
