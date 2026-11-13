// lib/glas/odjemalec/tok.ts
//
// Čista logika poteka pogovora (brez DOM-a, testirano v tests/glas/tok.test.ts):
//
//   * kdaj je uporabnik res končal (Soniox <end> pride ~0,45 s po VSAKEM premoru,
//     tudi sredi stavka; max_endpoint_delay_ms tega ne spremeni — meritev
//     scripts/glas-meritve/konec-govora.mjs, 13. 11. 2026);
//   * ali je govor med asistentovim govorom prava prekinitev ali lasten odmev;
//   * kratki lokalni odzivi ("hvala, to je vse").

const brezLocil = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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
const MASILA = new Set(['uh', 'uhm', 'uhh', 'ehm', 'em', 'eem', 'eee', 'ee', 'aaa', 'aa', 'hm', 'hmm', 'mmm', 'mm', 'njah', 'pac', 'no']);

/** Besede, za katerimi stavek ne more biti končan (predlogi, vezniki, nedokončane besedne zveze). */
const NEDOKONCANE = new Set([
  // predlogi
  'ob', 'za', 'pri', 'na', 'v', 'vo', 'z', 's', 'k', 'h', 'od', 'do', 'po', 'pod', 'nad', 'med', 'pred', 'cez', 'brez', 'proti', 'okoli', 'okrog', 'zaradi', 'iz',
  // vezniki
  'in', 'ter', 'ali', 'pa', 'ki', 'da', 'ker', 'ko', 'ce', 'kot', 'ampak', 'vendar', 'oziroma', 'torej', 'potem', 'se', 'tudi',
  // nedokončane zveze ("ob pol", "nov termin za", "termin ob")
  'pol', 'cetrt', 'nov', 'novo', 'novi', 'nova', 'moj', 'moja', 'njen', 'njegov', 'zapisi', 'vpisi', 'prestavi', 'dodaj', 'odpri',
  // mašila
  ...MASILA,
]);

/**
 * Koliko časa po Soniox <end> še čakamo na nadaljevanje. `surovo` je prepis z
 * ločili (Soniox: "ob.", "jutri,", "in—").
 */
export function cakanjePoKoncu(surovo: string): number {
  const b = besede(surovo);
  if (b.length === 0) return CAKANJE.samoMasilo;
  if (b.every((x) => MASILA.has(x))) return CAKANJE.samoMasilo;
  const s = surovo.trim();
  // Vejica, pomišljaj ali tri pike na koncu: misel ni končana.
  if (/[,;:\-–—…]$/.test(s) || /\.\.\.$/.test(s)) return CAKANJE.nedokoncano;
  const zadnja = b[b.length - 1];
  if (NEDOKONCANE.has(zadnja)) return CAKANJE.nedokoncano;
  if (b.length <= 3) return CAKANJE.kratko;
  return CAKANJE.obicajno;
}

/** Ali novo slišano besedilo (med razmišljanjem) pomeni, da uporabnik nadaljuje svojo izjavo. */
export function jeNadaljevanje(slisano: string): boolean {
  const b = besede(slisano).filter((x) => !MASILA.has(x) && x.length >= 2);
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
  return besede(slisano).filter((b) => !MASILA.has(b) && !govor.has(koren(b)));
}

/** Ena beseda je dovolj za prekinitev, če je ena od teh (in je ni v asistentovem govoru). */
const PREKINI_Z_ENO = new Set([
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
  return tuje.length === 1 && PREKINI_Z_ENO.has(tuje[0]);
}

/** Po prekinitvi: z začetka odstrani besede, ki so bile odmev asistentovega govora. */
export function odstraniOdmev(slisano: string, govor: Set<string>): string {
  const deli = slisano.trim().split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < deli.length) {
    const b = brezLocil(deli[i]);
    if (b && !govor.has(koren(b)) && !MASILA.has(b)) break;
    i++;
  }
  return deli.slice(i).join(' ');
}

// ───────────────────────────── lokalni odzivi ─────────────────────────────

const KONEC_POGOVORA = new Set([
  'hvala to je vse', 'to je vse', 'to je to', 'to bo vse', 'hvala to bo vse', 'hvala lepa to je vse', 'hvala ti to je vse', 'hvala to je to',
  'to je vse hvala', 'konec', 'koncaj', 'koncaj pogovor', 'konec pogovora', 'nasvidenje', 'na svidenje', 'adijo', 'hvala adijo', 'hvala nasvidenje',
  'nic vec', 'hvala nic vec', 'ni vec', 'lahko nehas', 'adio', 'cao', 'hvala cao', 'hvala lep dan', 'ok hvala to je vse', 'okej hvala to je vse',
  'thats all', 'thank you thats all', 'das wars', 'danke das wars', 'to je sve', 'hvala to je sve', 'e tutto', 'grazie e tutto',
]);

const ZAHVALA = new Set(['hvala', 'hvala lepa', 'hvala ti', 'hvala vam', 'super hvala', 'ok hvala', 'okej hvala', 'v redu hvala', 'odlicno hvala', 'thanks', 'thank you', 'danke', 'grazie']);

/** "hvala, to je vse" → konec; "hvala" → kratek odziv, pogovor teče naprej. */
export function lokalniOdziv(izjava: string): { vrsta: 'konec' | 'zahvala'; govor: string } | null {
  const s = brezLocil(izjava);
  if (KONEC_POGOVORA.has(s)) return { vrsta: 'konec', govor: 'Prav. Lep dan.' };
  if (ZAHVALA.has(s)) return { vrsta: 'zahvala', govor: 'Prosim.' };
  return null;
}

/** Napaka za glas: samo prvi stavek, brez "Nič ni bilo spremenjeno." (to je na zaslonu). */
export function napakaZaGovor(sporocilo: string): string {
  const prvi = sporocilo.split(/(?<=[.!?])\s+/)[0]?.trim() ?? '';
  return prvi.replace(/\s*\(\d+\)\s*$/, '') || 'Nekaj ni šlo.';
}

/** Kratki namigi, ko odgovor zamuja (izmenjujejo se, da ne zvenijo kot posnetek). */
export const NAMIGI_CAKANJA = ['Moment.', 'Samo trenutek.', 'Preverim.'];
