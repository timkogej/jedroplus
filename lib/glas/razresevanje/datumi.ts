// lib/glas/razresevanje/datumi.ts
//
// Datumi in ure iz slovenskega govora. Vse računamo kot koledarske datume
// "yyyy-MM-dd" v časovnem pasu podjetja (privzeto Europe/Ljubljana), ker so
// tako shranjeni tudi termini (Termini."Datum" + "Čas" brez pasu). Poletni/zimski
// čas zato ne premakne dneva; "zdaj" pretvorimo v pas podjetja z Intl.
//
// Pravilo za odgovore: asistent vedno pove dan v tednu in datum ("jutri,
// petek 14. 11."), da uporabnik takoj opazi napačno razumljen dan.

import { brezSumnikov, besedaVStevilo } from './besedilo';
import { trenutniJezik } from '../jeziki/jezik';
import { opisDatumaTuj } from '../jeziki/koledar';

export const DNEVI = ['ponedeljek', 'torek', 'sreda', 'četrtek', 'petek', 'sobota', 'nedelja'] as const;
const DNEVI_KLJUC = ['ponedeljek', 'torek', 'sred', 'cetrtek', 'petek', 'sobot', 'nedelj'];
const MESECI = ['januar', 'februar', 'marc', 'april', 'maj', 'junij', 'julij', 'avgust', 'septemb', 'oktob', 'novemb', 'decemb'];

/** Koledarski datum v pasu (yyyy-MM-dd) in ura (HH:MM). */
export function zdajVPasu(zdaj: Date, casovniPas: string): { datum: string; ura: string } {
  let pas = casovniPas;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: pas });
  } catch {
    pas = 'Europe/Ljubljana';
  }
  const deli: Record<string, string> = {};
  for (const d of new Intl.DateTimeFormat('en-GB', {
    timeZone: pas, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(zdaj)) {
    if (d.type !== 'literal') deli[d.type] = d.value;
  }
  return { datum: `${deli.year}-${deli.month}-${deli.day}`, ura: `${deli.hour}:${deli.minute}` };
}

function vUtc(datum: string): number {
  const [l, m, d] = datum.split('-').map(Number);
  return Date.UTC(l, m - 1, d);
}

function izUtc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function dodajDni(datum: string, dni: number): string {
  return izUtc(vUtc(datum) + dni * 86_400_000);
}

/** 0 = ponedeljek … 6 = nedelja */
export function danVTednu(datum: string): number {
  return (new Date(vUtc(datum)).getUTCDay() + 6) % 7;
}

export function razlikaDni(od: string, doo: string): number {
  return Math.round((vUtc(doo) - vUtc(od)) / 86_400_000);
}

/** "petek, 14. 11." ali "danes, petek, 14. 11." */
export function opisDatuma(datum: string, danes: string): string {
  const [, m, d] = datum.split('-').map(Number);
  const r = razlikaDni(danes, datum);
  const j = trenutniJezik();
  if (j !== 'sl') return opisDatumaTuj(j, d, m, danVTednu(datum), r);
  const osnova = `${DNEVI[danVTednu(datum)]}, ${d}. ${m}.`;
  if (r === 0) return `danes, ${osnova}`;
  if (r === 1) return `jutri, ${osnova}`;
  if (r === -1) return `včeraj, ${osnova}`;
  return osnova;
}

export interface RazbranDatum {
  datum: string;
  /** Kako je bil izraz razumljen, za odgovor. */
  izraz: string;
}

/**
 * Prvi datum v besedilu ali null. "v petek" pomeni naslednji petek po danes
 * (če je danes petek, čez 7 dni) — odgovor vedno pove datum, zato je napaka vidna.
 */
export function razberiDatum(besedilo: string, danes: string): RazbranDatum | null {
  const b = ' ' + brezSumnikov(besedilo).replace(/[,!?]/g, ' ').replace(/\s+/g, ' ') + ' ';

  if (/\bdanes\b|\bdanasnj/.test(b)) return { datum: danes, izraz: 'danes' };
  // STT pogosto zapiše "po jutrišnjem" — brez tega bi se ujelo kot "jutri" (napačen dan).
  if (/\bpo ?jutrisnj/.test(b)) return { datum: dodajDni(danes, 2), izraz: 'pojutrišnjem' };
  if (/\bjutri|\bjutrisnj/.test(b)) return { datum: dodajDni(danes, 1), izraz: 'jutri' };
  if (/\bvceraj|\bvcerajsnj/.test(b)) return { datum: dodajDni(danes, -1), izraz: 'včeraj' };

  // čez 3 dni | čez šest tednov | čez en mesec | čez teden
  const cez = b.match(/\bcez (?:(\d{1,2}|[a-z]+) )?(dan|dni|dneva|teden|tedna|tedne|tednov|mesec|meseca|mesece|mesecev)\b/);
  if (cez) {
    const n = cez[1] ? besedaVStevilo(cez[1]) : 1;
    if (n && n > 0 && n <= 24) {
      const enota = cez[2];
      if (enota.startsWith('d')) return { datum: dodajDni(danes, n), izraz: `čez ${n} dni` };
      if (enota.startsWith('t')) return { datum: dodajDni(danes, 7 * n), izraz: `čez ${n} tednov` };
      const [l, m, d] = danes.split('-').map(Number);
      const cilj = new Date(Date.UTC(l, m - 1 + n, 1));
      const zadnji = new Date(Date.UTC(cilj.getUTCFullYear(), cilj.getUTCMonth() + 1, 0)).getUTCDate();
      cilj.setUTCDate(Math.min(d, zadnji));
      return { datum: cilj.toISOString().slice(0, 10), izraz: `čez ${n} mesecev` };
    }
  }

  // 15. 11. | 15.11. | 15. 11. 2026 | 15/11
  // "ob 10.15" je ura, ne datum — zato ne sme slediti "ob/okoli/od/do".
  const stevilcno = b.match(/(?<!\b(?:ob|okoli|od|do) )\b(\d{1,2})\s*[./]\s*(\d{1,2})\s*\.?(?:\s*(\d{4}))?/);
  if (stevilcno) {
    const d = Number(stevilcno[1]);
    const m = Number(stevilcno[2]);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      const datum = sestaviDatum(d, m, stevilcno[3] ? Number(stevilcno[3]) : null, danes);
      if (datum) return { datum, izraz: `${d}. ${m}.` };
    }
  }

  // 15. novembra | petnajstega novembra
  const besedni = b.match(/\b(\d{1,2}|[a-z]+?)(?:\.|ega|ga)?\s+(januar|februar|marc|april|maj|junij|julij|avgust|septemb|oktob|novemb|decemb)[a-z]*/);
  if (besedni) {
    const d = /^\d+$/.test(besedni[1]) ? Number(besedni[1]) : vrstilni(besedni[1]);
    const m = MESECI.indexOf(besedni[2]) + 1;
    if (d && m) {
      const datum = sestaviDatum(d, m, null, danes);
      if (datum) return { datum, izraz: `${d}. ${m}.` };
    }
  }

  // "osemnajstega enajstega" (dan in mesec z vrstilnima števnikoma, kot ju zapiše STT)
  const vrstilna = b.match(/\b([a-z]+?(?:ega|ga))\s+([a-z]+?(?:ega|ga))\b/);
  if (vrstilna) {
    const d = vrstilni(vrstilna[1]);
    const m = vrstilni(vrstilna[2]);
    if (d && m && m <= 12) {
      const datum = sestaviDatum(d, m, null, danes);
      if (datum) return { datum, izraz: `${d}. ${m}.` };
    }
  }

  // naslednji teden → ponedeljek naslednjega tedna
  if (/\bnaslednji teden|\bnaslednjem tednu|\bprihodnji teden/.test(b) && !najdiDan(b)) {
    return { datum: dodajDni(danes, 7 - danVTednu(danes)), izraz: 'naslednji teden' };
  }

  const dan = najdiDan(b);
  if (dan !== null) {
    let razlika = (dan - danVTednu(danes) + 7) % 7;
    if (razlika === 0) razlika = 7;
    if (/\bnaslednj|\bprihodnj/.test(b) && razlika < 7 && danVTednu(danes) < dan) {
      // "naslednji petek", ko je danes torek: petek naslednjega tedna
      razlika += 7;
    }
    return { datum: dodajDni(danes, razlika), izraz: DNEVI[dan] };
  }
  return null;
}

function najdiDan(b: string): number | null {
  for (let i = 0; i < DNEVI_KLJUC.length; i++) {
    if (new RegExp(`\\b${DNEVI_KLJUC[i]}`).test(b)) return i;
  }
  return null;
}

const VRSTILNI: Record<string, number> = {
  prv: 1, drug: 2, tretj: 3, cetrt: 4, pet: 5, sest: 6, sedm: 7, osm: 8, devet: 9, deset: 10,
  enajst: 11, dvanajst: 12, trinajst: 13, stirinajst: 14, petnajst: 15, sestnajst: 16,
  sedemnajst: 17, osemnajst: 18, devetnajst: 19, dvajset: 20, trideset: 30,
};

function vrstilni(beseda: string): number | null {
  const b = beseda.replace(/(ega|ga|i|a)$/, '');
  if (b in VRSTILNI) return VRSTILNI[b];
  const m = b.match(/^(ena|en|dva|dve|tri|stiri|pet|sest|sedem|osem|devet)in(dvajset|trideset)$/);
  if (m) return (besedaVStevilo(m[1]) ?? 0) + (besedaVStevilo(m[2]) ?? 0);
  return null;
}

function sestaviDatum(d: number, m: number, leto: number | null, danes: string): string | null {
  let l = leto ?? Number(danes.slice(0, 4));
  const kandidat = () => `${l}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  // Neveljaven datum (31. 2.) zavrni
  const test = new Date(Date.UTC(l, m - 1, d));
  if (test.getUTCMonth() !== m - 1) return null;
  if (!leto && razlikaDni(danes, kandidat()) < -1) l += 1; // brez leta: naslednji tak datum
  return kandidat();
}

/**
 * Ura iz besedila → "HH:MM" ali null.
 * "ob 15h", "ob 15:30", "ob 15.30", "ob treh", "ob treh popoldne", "pol štirih" (= 3:30),
 * "ob 9 zjutraj". Brez "zjutraj/dopoldne" se ure 1–7 razumejo popoldne (salon).
 */
export function razberiUro(besedilo: string): string | null {
  const b = ' ' + brezSumnikov(besedilo).replace(/\s+/g, ' ') + ' ';
  const zjutraj = /\bzjutraj|\bdopoldn/.test(b);
  const popoldne = /\bpopoldn|\bzvecer/.test(b);

  const prilagodi = (h: number, min: number) => {
    let ura = h;
    if (popoldne && ura < 12) ura += 12;
    else if (!zjutraj && ura >= 1 && ura <= 7) ura += 12;
    if (ura > 23 || min > 59) return null;
    return `${String(ura).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  };

  const pol = b.match(/\bpol\s+([a-z]+|\d{1,2})\b/);
  if (pol) {
    const naslednja = /^\d+$/.test(pol[1]) ? Number(pol[1]) : rodilnikUre(pol[1]);
    if (naslednja) return prilagodi(naslednja - 1, 30);
  }

  const digitalno = b.match(/\b(?:ob|od|okoli|do)?\s*(\d{1,2})\s*[:.]\s*(\d{2})\b/);
  if (digitalno) return prilagodi(Number(digitalno[1]), Number(digitalno[2]));

  const cela = b.match(/\b(?:ob|okoli|od)\s+(\d{1,2})\s*(?:h|uri|ura)?\b/);
  if (cela) return prilagodi(Number(cela[1]), 0);

  const besedna = b.match(/\b(?:ob|okoli|od)\s+([a-z]+)\b/);
  if (besedna) {
    const h = mestnikUre(besedna[1]);
    if (h) return prilagodi(h, 0);
  }
  return null;
}

// "ob treh", "ob enajstih" (mestnik) in "pol štirih" (rodilnik) imata isto obliko.
const URE_MESTNIK: Record<string, number> = {
  eni: 1, enih: 1, dveh: 2, treh: 3, stirih: 4, petih: 5, sestih: 6, sedmih: 7, osmih: 8,
  devetih: 9, desetih: 10, enajstih: 11, dvanajstih: 12, trinajstih: 13, stirinajstih: 14,
  petnajstih: 15, sestnajstih: 16, sedemnajstih: 17, osemnajstih: 18, devetnajstih: 19, dvajsetih: 20,
};
function mestnikUre(beseda: string): number | null {
  return URE_MESTNIK[beseda] ?? null;
}
function rodilnikUre(beseda: string): number | null {
  return URE_MESTNIK[beseda] ?? null;
}

/** "HH:MM" → minute od polnoči */
export function vMinute(ura: string): number {
  const [h, m] = ura.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function izMinut(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

// Izrazi v drugih jezikih Asistent+ (en, de, it, hr). Model naj datume v teh jezikih
// poda kot YYYY-MM-DD; to je samo varovalo za najpogostejše besede.
const TUJE_RELATIVNO: [RegExp, number][] = [
  [/\b(day after tomorrow|ubermorgen|dopodomani|prekosutra)\b/, 2],
  [/\b(today|heute|oggi|danas)\b/, 0],
  [/\b(tomorrow|morgen|domani|sutra)\b/, 1],
  [/\b(yesterday|gestern|ieri|jucer)\b/, -1],
];
const TUJI_DNEVI: RegExp[] = [
  /\b(monday|montag|lunedi|ponedjeljak)\b/,
  /\b(tuesday|dienstag|martedi|utorak)\b/,
  /\b(wednesday|mittwoch|mercoledi|srijed[au])\b/,
  /\b(thursday|donnerstag|giovedi|cetvrtak)\b/,
  /\b(friday|freitag|venerdi|petak)\b/,
  /\b(saturday|samstag|sabato|subot[au])\b/,
  /\b(sunday|sonntag|domenica|nedjelj[au])\b/,
];

/** Datum iz angleškega, nemškega, italijanskega ali hrvaškega izraza (danes/jutri/dan v tednu) ali null. */
export function razberiDatumTuj(besedilo: string, danes: string): string | null {
  const b = besedilo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [re, dni] of TUJE_RELATIVNO) if (re.test(b)) return dodajDni(danes, dni);
  for (let i = 0; i < TUJI_DNEVI.length; i++) {
    if (TUJI_DNEVI[i].test(b)) {
      let r = (i - danVTednu(danes) + 7) % 7;
      if (r === 0) r = 7;
      if (/\b(next|nachsten|naechsten|prossim|sljedec)/.test(b) && danVTednu(danes) < i) r += 7;
      return dodajDni(danes, r);
    }
  }
  return null;
}
