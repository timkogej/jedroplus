// lib/glas/odjemalec/tok.ts
//
// Čista logika poteka pogovora (brez DOM-a, testirano v tests/glas/tok.test.ts):
//
//   * kdaj je uporabnik res končal (Soniox <end> pride ~0,45 s po VSAKEM premoru,
//     tudi sredi stavka; max_endpoint_delay_ms tega ne spremeni — meritev
//     scripts/glas-meritve/konec-govora.mjs, 13. 11. 2026);
//   * ali je govor med asistentovim govorom prava prekinitev ali lasten odmev;
//   * kratki lokalni odzivi ("hvala, to je vse").
//
// Besede so v jeziku pogovora (jezikOdjemalca); slovenske množice so tu, drugi jeziki
// v jezikOdjemalca.ts.

import { BESEDE, besedila, jezikOdjemalca, type BesedeJezika } from './jezikOdjemalca';

const brezLocil = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // "don't", "d'accordo", "potvrđujem", "schließen" → kot v seznamih besed
    .replace(/['’`]/g, '')
    .replace(/đ/g, 'd')
    .replace(/ß/g, 'ss')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const besede = (s: string) => brezLocil(s).split(' ').filter(Boolean);

/** Čakanje po Soniox <end>, preden izjavo pošljemo (ms). */
export const CAKANJE = {
  /** Kratek odgovor ("ja", "shrani", "ne"): takoj. */
  kratko: 150,
  /** Navaden stavek: kratko, ker se ob nadaljevanju zahteva prekliče in izjavi združita. */
  obicajno: 350,
  /** Stavek se konča z "ob", "za", vejico …: uporabnik bo nadaljeval. */
  nedokoncano: 2200,
  /** Samo "uh", "ehm": misli. */
  samoMasilo: 2600,
} as const;

/** Mašila: same po sebi niso izjava. ("mhm" ni mašilo — pomeni "ja".) */
const MASILA_SL = new Set(['uh', 'uhm', 'uhh', 'ehm', 'em', 'eem', 'eee', 'ee', 'aaa', 'aa', 'hm', 'hmm', 'mmm', 'mm', 'njah', 'pac', 'no']);

/** Besede, za katerimi stavek ne more biti končan (predlogi, vezniki, nedokončane besedne zveze). */
const NEDOKONCANE_SL = new Set([
  // predlogi
  'ob', 'za', 'pri', 'na', 'v', 'vo', 'z', 's', 'k', 'h', 'od', 'do', 'po', 'pod', 'nad', 'med', 'pred', 'cez', 'brez', 'proti', 'okoli', 'okrog', 'zaradi', 'iz',
  // vezniki
  'in', 'ter', 'ali', 'pa', 'ki', 'da', 'ker', 'ko', 'ce', 'kot', 'ampak', 'vendar', 'oziroma', 'torej', 'potem', 'se', 'tudi',
  // nedokončane zveze ("ob pol", "nov termin za", "termin ob")
  'pol', 'cetrt', 'nov', 'novo', 'novi', 'nova', 'moj', 'moja', 'njen', 'njegov', 'zapisi', 'vpisi', 'prestavi', 'dodaj', 'odpri',
  // mašila
  ...MASILA_SL,
]);

type Mnozice = { [K in keyof BesedeJezika]: Set<string> };
const SL: Omit<Mnozice, 'da' | 'ne'> = {
  masila: MASILA_SL,
  nedokoncane: NEDOKONCANE_SL,
  konec: new Set<string>(),
  zahvala: new Set<string>(),
  ponovi: new Set<string>(),
  pocasneje: new Set<string>(),
  prekini: new Set<string>(),
};
const MNOZICE = new Map<string, Omit<Mnozice, 'da' | 'ne'>>();
/** Množice besed za jezik pogovora (slovenske so zgoraj in spodaj, nespremenjene). */
function m(): Omit<Mnozice, 'da' | 'ne'> {
  const j = jezikOdjemalca();
  if (j === 'sl') return SL;
  let x = MNOZICE.get(j);
  if (!x) {
    const b = BESEDE[j];
    x = {
      masila: new Set(b.masila),
      nedokoncane: new Set([...b.nedokoncane, ...b.masila]),
      konec: new Set(b.konec),
      zahvala: new Set(b.zahvala),
      ponovi: new Set(b.ponovi),
      pocasneje: new Set(b.pocasneje),
      prekini: new Set(b.prekini),
    };
    MNOZICE.set(j, x);
  }
  return x;
}

/**
 * Koliko časa po Soniox <end> še čakamo na nadaljevanje. `surovo` je prepis z
 * ločili (Soniox: "ob.", "jutri,", "in—").
 */
export function cakanjePoKoncu(surovo: string): number {
  const b = besede(surovo);
  if (b.length === 0) return CAKANJE.samoMasilo;
  const { masila, nedokoncane } = m();
  if (b.every((x) => masila.has(x))) return CAKANJE.samoMasilo;
  const s = surovo.trim();
  // Vejica, pomišljaj ali tri pike na koncu: misel ni končana.
  if (/[,;:\-–—…]$/.test(s) || /\.\.\.$/.test(s)) return CAKANJE.nedokoncano;
  const zadnja = b[b.length - 1];
  if (nedokoncane.has(zadnja)) return CAKANJE.nedokoncano;
  if (b.length <= 3) return CAKANJE.kratko;
  return CAKANJE.obicajno;
}

/** Ali novo slišano besedilo (med razmišljanjem) pomeni, da uporabnik nadaljuje svojo izjavo. */
export function jeNadaljevanje(slisano: string): boolean {
  const { masila } = m();
  const b = besede(slisano).filter((x) => !masila.has(x) && x.length >= 2);
  return b.length > 0;
}

// ───────────────────────────── odmev in prekinitev ─────────────────────────────

/** Korenski del besede za primerjavo z odmevom (sklon in odrezan konec ne motita). */
const koren = (b: string) => (b.length > 5 ? b.slice(0, 4) : b.length > 3 ? b.slice(0, 3) : b);

/** Besede, ki jih asistent ravno govori (korenski deli). */
export function besedeGovora(govor: string): Set<string> {
  return new Set(besede(govor).map(koren));
}

/** Besede iz `slisano`, ki NISO odmev asistentovega govora in niso mašila. */
export function tujeBesede(slisano: string, govor: Set<string>): string[] {
  const { masila } = m();
  return besede(slisano).filter((b) => !masila.has(b) && !govor.has(koren(b)));
}

/** Ena beseda je dovolj za prekinitev, če je ena od teh (in je ni v asistentovem govoru). */
const PREKINI_Z_ENO_SL = new Set([
  'stop', 'stoj', 'cakaj', 'pocakaj', 'pocakajte', 'nehaj', 'utihni', 'dovolj', 'hej', 'halo', 'moment', 'ne', 'ja', 'shrani', 'preklici', 'zapri',
  'stani', 'wait', 'nein', 'basta', 'aspetta',
]);

/** RMS okvirja 16-bitnega PCM (0–1). */
export function rms(okvir: Int16Array): number {
  if (okvir.length === 0) return 0;
  let v = 0;
  for (let i = 0; i < okvir.length; i++) v += okvir[i] * okvir[i];
  return Math.sqrt(v / okvir.length) / 0x8000;
}

/**
 * Najmanjša glasnost mikrofona za prekinitev. Z vklopljenim odmevnim izničevanjem
 * je ostanek lastnega glasu tipično pod -45 dBFS; govor v bližini mikrofona nad -35.
 */
export const PRAG_PREKINITVE = 0.012;

/**
 * Prava prekinitev: uporabnik je rekel vsaj dve besedi, ki jih asistent ne govori
 * (ali eno jasno: "stop", "počakaj", "ne", "ja"), IN mikrofon je bil v zadnjem
 * trenutku dovolj glasen. Lasten odmev skozi zvočnik da besede iz `govor`, zato
 * ne prekine; šum brez besed tudi ne.
 */
export function jePrekinitev(o: { slisano: string; govor: Set<string>; glasnost: number; prag?: number }): boolean {
  if (o.glasnost < (o.prag ?? PRAG_PREKINITVE)) return false;
  const tuje = tujeBesede(o.slisano, o.govor);
  if (tuje.length >= 2) return true;
  return tuje.length === 1 && (PREKINI_Z_ENO_SL.has(tuje[0]) || m().prekini.has(tuje[0]));
}

/** Po prekinitvi: z začetka odstrani besede, ki so bile odmev asistentovega govora. */
export function odstraniOdmev(slisano: string, govor: Set<string>): string {
  const deli = slisano.trim().split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < deli.length) {
    const b = brezLocil(deli[i]);
    if (b && !govor.has(koren(b)) && !m().masila.has(b)) break;
    i++;
  }
  return deli.slice(i).join(' ');
}

// ───────────────────────────── lokalni odzivi ─────────────────────────────

const KONEC_POGOVORA_SL = new Set([
  'hvala to je vse', 'to je vse', 'to je to', 'to bo vse', 'hvala to bo vse', 'hvala lepa to je vse', 'hvala ti to je vse', 'hvala to je to',
  'to je vse hvala', 'konec', 'koncaj', 'koncaj pogovor', 'konec pogovora', 'nasvidenje', 'na svidenje', 'adijo', 'hvala adijo', 'hvala nasvidenje',
  'nic vec', 'hvala nic vec', 'ni vec', 'lahko nehas', 'adio', 'cao', 'hvala cao', 'hvala lep dan', 'ok hvala to je vse', 'okej hvala to je vse',
  'thats all', 'thank you thats all', 'das wars', 'danke das wars', 'to je sve', 'hvala to je sve', 'e tutto', 'grazie e tutto',
]);

const ZAHVALA_SL = new Set(['hvala', 'hvala lepa', 'hvala ti', 'hvala vam', 'super hvala', 'ok hvala', 'okej hvala', 'v redu hvala', 'odlicno hvala', 'thanks', 'thank you', 'danke', 'grazie']);

const PONOVI_SL = new Set([
  'ponovi', 'ponovi prosim', 'prosim ponovi', 'lahko ponovis', 'ponovi se enkrat', 'se enkrat', 'se enkrat prosim', 'povej se enkrat',
  'kaj si rekla', 'kaj si rekel', 'kaj si rekla prosim', 'nisem slisal', 'nisem slisala', 'nisem razumel', 'nisem razumela', 'ponovite',
  'ponovite prosim', 'kako prosim', 'kaj prosim', 'pardon', 'repeat', 'say again', 'wie bitte',
]);
const POCASNEJE_SL = new Set([
  'pocasneje', 'pocasneje prosim', 'bolj pocasi', 'pocasi', 'malo pocasneje', 'govori pocasneje', 'govori pocasi', 'lahko pocasneje',
  'povej pocasneje', 'ponovi pocasneje', 'ponovi pocasi', 'se enkrat pocasneje', 'pocasneje ponovi', 'slower', 'langsamer',
]);

/** Najnižja hitrost glasu po "počasneje" (Soniox speed; običajno 1.04). */
export const NAJNIZJA_HITROST = 0.75;

/**
 * "hvala, to je vse" → konec; "hvala" → kratek odziv; "ponovi" → zadnji odgovor znova;
 * "počasneje" → zadnji odgovor znova in počasneje (do konca pogovora). Brez strežnika in AI.
 */
export function lokalniOdziv(izjava: string): { vrsta: 'konec' | 'zahvala' | 'ponovi' | 'pocasneje'; govor: string } | null {
  const s = brezLocil(izjava);
  const x = m();
  const B = besedila();
  // Slovenske množice že vsebujejo nekaj tujih fraz ("thats all", "danke"), zato veljajo vedno.
  if (KONEC_POGOVORA_SL.has(s) || x.konec.has(s)) return { vrsta: 'konec', govor: B.konec };
  if (ZAHVALA_SL.has(s) || x.zahvala.has(s)) return { vrsta: 'zahvala', govor: B.zahvala };
  if (POCASNEJE_SL.has(s) || x.pocasneje.has(s)) return { vrsta: 'pocasneje', govor: '' };
  if (PONOVI_SL.has(s) || x.ponovi.has(s)) return { vrsta: 'ponovi', govor: '' };
  return null;
}

/** Hitrost po "počasneje": vsakič za 0,15 nižja, ne pod NAJNIZJA_HITROST. */
export function pocasneje(hitrost: number): number {
  return Math.max(NAJNIZJA_HITROST, Math.round((hitrost - 0.15) * 100) / 100);
}

/** Napaka za glas: samo prvi stavek, brez "Nič ni bilo spremenjeno." (to je na zaslonu). */
export function napakaZaGovor(sporocilo: string): string {
  const prvi = sporocilo.split(/(?<=[.!?])\s+/)[0]?.trim() ?? '';
  return prvi.replace(/\s*\(\d+\)\s*$/, '') || besedila().nekajNiSlo;
}

/** Kratki namigi, ko odgovor zamuja (izmenjujejo se, da ne zvenijo kot posnetek). */
export const NAMIGI_CAKANJA = ['Moment.', 'Samo trenutek.', 'Preverim.'];

/** Namigi čakanja v jeziku pogovora. */
export function namigiCakanja(): string[] {
  return besedila().namigi;
}
