// lib/glas/govor.ts
//
// Besedilo za glas (Soniox Nina): ure z besedami, kot jih rečemo, brez
// seznamov in pomišljajev. Zaslon dobi `sporocilo`, zvočnik pa `govor`.
// Ure po Receptionist+ (agent/spoken_time.py): "14:30" → "ob pól treh".
// "pól" z naglasom, ker ga Nina sicer naglasi narobe (Receptionist+, 2026-11).

import { danVTednu, razlikaDni } from './razresevanje/datumi';

const OB: Record<number, string> = {
  1: 'enih', 2: 'dveh', 3: 'treh', 4: 'štirih', 5: 'petih', 6: 'šestih', 7: 'sedmih',
  8: 'osmih', 9: 'devetih', 10: 'desetih', 11: 'enajstih', 12: 'dvanajstih',
};
const IMENOVALNIK: Record<number, string> = {
  1: 'ena', 2: 'dve', 3: 'tri', 4: 'štiri', 5: 'pet', 6: 'šest', 7: 'sedem',
  8: 'osem', 9: 'devet', 10: 'deset', 11: 'enajst', 12: 'dvanajst',
};

const DAN_TOZILNIK = ['ponedeljek', 'torek', 'sredo', 'četrtek', 'petek', 'soboto', 'nedeljo'];
const MESEC_RODILNIK = ['januarja', 'februarja', 'marca', 'aprila', 'maja', 'junija', 'julija', 'avgusta', 'septembra', 'oktobra', 'novembra', 'decembra'];

/**
 * Datum za glas, vedno z dnevom v tednu (da uporabnik sliši, če je dan napačno
 * razumljen): "danes", "jutri, v petek", "v ponedeljek, 16. novembra".
 */
export function datumZaGovor(datum: string, danes: string): string {
  const r = razlikaDni(danes, datum);
  const dan = `v ${DAN_TOZILNIK[danVTednu(datum)]}`;
  if (r === 0) return 'danes';
  if (r === 1) return `jutri, ${dan}`;
  if (r === -1) return `včeraj, ${dan}`;
  if (r === 2) return `pojutrišnjem, ${dan}`;
  const [, m, d] = datum.split('-').map(Number);
  return `${dan}, ${d}. ${MESEC_RODILNIK[m - 1]}`;
}

const h12 = (h: number) => h % 12 || 12;

/** "09:00" → "ob devetih", "14:30" → "ob pól treh", "14:10" → "ob 14.10". */
export function uraZaGovor(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return hhmm;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return hhmm;
  if (min === 0) return `ob ${OB[h12(h)]}`;
  if (min === 30) return `ob pól ${OB[h12(h + 1)]}`;
  if (min === 15) return `ob četrt čez ${IMENOVALNIK[h12(h)]}`;
  if (min === 45) return `ob tri četrt na ${IMENOVALNIK[h12(h + 1)]}`;
  return `ob ${h}.${String(min).padStart(2, '0')}`;
}

/**
 * Splošna pretvorba besedila za zaslon v govor: "ob 10:30" → "ob pól enajstih",
 * gole ure in razponi ("09:00–10:30") → začetek, vrstice → stavki.
 */
export function zaGovor(besedilo: string): string {
  return besedilo
    .replace(/\bob (\d{1,2}:\d{2})\b/g, (_, u: string) => uraZaGovor(u))
    .replace(/\b(\d{1,2}:\d{2})(?:\s*[–-]\s*\d{1,2}:\d{2})?/g, (_, u: string) => uraZaGovor(u))
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\.\s*\./g, '.')
    .replace(/[»«"]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Največ toliko terminov preberemo na glas; ostalo je na zaslonu. */
export const NAJVEC_NA_GLAS = 5;

/** Vprašanje z možnostmi za glas: "Katero stranko: Ana Novak ali Ana Novinc?" (brez oklepajev). */
export function vprasanjeZaGovor(v: { besedilo: string; moznosti?: { oznaka: string }[] }): string {
  const m = (v.moznosti ?? []).slice(0, 4).map((x) => x.oznaka.replace(/\s*\([^)]*\)/g, '').trim()).filter(Boolean);
  const osnova = zaGovor(v.besedilo).replace(/\?\s*$/, '');
  if (m.length < 2) return `${osnova}?`;
  return `${osnova}: ${m.slice(0, -1).join(', ')} ali ${m.at(-1)}?`;
}

/** "09:00", "10:30" → "od devetih do pól enajstih". */
export function razponZaGovor(od: string, doo: string): string {
  return `${uraZaGovor(od).replace(/^ob /, 'od ')} ${uraZaGovor(doo).replace(/^ob /, 'do ')}`;
}

/** 30 → "pol ure", 60 → "eno uro", 90 → "uro in pol", 150 → "2 uri in 30 minut". */
export function trajanjeZaGovor(min: number): string {
  const ur = Math.floor(min / 60);
  const ost = min % 60;
  if (ur === 0) return ost === 30 ? 'pol ure' : `${ost} minut`;
  const ure = ur === 1 ? 'eno uro' : ur === 2 ? 'dve uri' : ur <= 4 ? `${ur} ure` : `${ur} ur`;
  if (ost === 0) return ure;
  if (ost === 30) return ur === 1 ? 'uro in pol' : `${ure} in pol`;
  return `${ure} in ${ost} minut`;
}

/**
 * Model včasih izgovori svoje razmišljanje ("Ukaz se konča z »ob«, zato vprašam.").
 * Takšne stavke odstranimo; če ne ostane nič, vrnemo izvirnik.
 */
export function brezRazmisleka(besedilo: string): string {
  const stavki = besedilo.split(/(?<=[.!?])\s+/);
  const META = /\b(ukaz\w*|prepis\w*|odrezan\w*)\b|\b(zato|samo) (vprašam|sprašujem)\b|\bkratko vprašanje\b|\bposkušam razumeti\b/i;
  // Razmišljanje v angleščini (slovenski odgovor teh besed nima).
  const ANGLESKO = /\b(the|should|rules|command|user|hmm|so I|per the|got cut)\b/i;
  const ostane = stavki.filter((s) => !META.test(s) && !ANGLESKO.test(s));
  return ostane.length ? ostane.join(' ').trim() : besedilo;
}
