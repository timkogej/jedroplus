// lib/glas/govor.ts
//
// Besedilo za glas (Soniox Nina): ure z besedami, kot jih rečemo, brez
// seznamov in pomišljajev. Zaslon dobi `sporocilo`, zvočnik pa `govor`.
// Ure po Receptionist+ (agent/spoken_time.py): "14:30" → "ob pól treh".
// "pól" z naglasom, ker ga Nina sicer naglasi narobe (Receptionist+, 2026-11).

import { danVTednu, razlikaDni } from './razresevanje/datumi';
import { trenutniJezik } from './jeziki/jezik';
import { ALI, EMAIL_TUJE, PREDLOG_URE, STEVKE_TUJE, datumZaGovorTuj, razponZaGovorTuj, trajanjeZaGovorTuj, uraZaGovorTuj } from './jeziki/koledar';

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
  const j = trenutniJezik();
  if (j !== 'sl') {
    const [, mm, dd] = datum.split('-').map(Number);
    return datumZaGovorTuj(j, dd, mm, danVTednu(datum), r);
  }
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
  const j = trenutniJezik();
  if (j !== 'sl') return uraZaGovorTuj(j, h, min);
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
  const j = trenutniJezik();
  const ure =
    j === 'sl'
      ? besedilo
          .replace(/\bob (\d{1,2}:\d{2})\b/g, (_, u: string) => uraZaGovor(u))
          .replace(/\b(\d{1,2}:\d{2})(?:\s*[–-]\s*\d{1,2}:\d{2})?/g, (_, u: string) => uraZaGovor(u))
      : // En prehod: izgovorjena ura ("at 10:30 am") vsebuje števke in se ne sme pretvoriti znova.
        besedilo.replace(
          new RegExp(`(?:\\b${PREDLOG_URE[j]} )?\\b(\\d{1,2}:\\d{2})(?:\\s*[–-]\\s*\\d{1,2}:\\d{2})?`, 'g'),
          (_, u: string) => uraZaGovor(u)
        );
  return ure
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
  return `${osnova}: ${m.slice(0, -1).join(', ')} ${ALI[trenutniJezik()]} ${m.at(-1)}?`;
}

/** "09:00", "10:30" → "od devetih do pól enajstih". */
export function razponZaGovor(od: string, doo: string): string {
  const j = trenutniJezik();
  if (j !== 'sl') {
    const r = (x: string) => x.split(':').map(Number) as [number, number];
    return razponZaGovorTuj(j, r(od), r(doo));
  }
  return `${uraZaGovor(od).replace(/^ob /, 'od ')} ${uraZaGovor(doo).replace(/^ob /, 'do ')}`;
}

/** 30 → "pol ure", 60 → "eno uro", 90 → "uro in pol", 150 → "2 uri in 30 minut". */
export function trajanjeZaGovor(min: number): string {
  const j = trenutniJezik();
  if (j !== 'sl') return trajanjeZaGovorTuj(j, min);
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
  // V angleškem pogovoru so angleški stavki odgovor, ne razmišljanje.
  const angl = trenutniJezik() === 'en';
  const ostane = stavki.filter((s) => !META.test(s) && (angl || !ANGLESKO.test(s)));
  return ostane.length ? ostane.join(' ').trim() : besedilo;
}

const STEVKE = ['nič', 'ena', 'dve', 'tri', 'štiri', 'pet', 'šest', 'sedem', 'osem', 'devet'];

/** Skupine števk telefona: "+38631555111" → ["+386", "31", "555", "111"], "041234567" → ["041", "234", "567"]. */
export function skupineTelefona(telefon: string): string[] {
  const t = telefon.replace(/[^\d+]/g, '');
  const plus = t.startsWith('+');
  let stevke = t.replace(/\D/g, '');
  const out: string[] = [];
  if (plus && stevke.startsWith('386')) {
    out.push('+386');
    stevke = stevke.slice(3);
  } else if (plus) {
    out.push(`+${stevke.slice(0, 2)}`);
    stevke = stevke.slice(2);
  }
  const deli: string[] = [];
  for (let i = stevke.length; i > 0; i -= 3) deli.unshift(stevke.slice(Math.max(0, i - 3), i));
  if (deli.length > 1 && deli[0].length === 1) deli.splice(0, 2, deli[0] + deli[1]);
  return [...out, ...deli].filter(Boolean);
}

/** Telefon za zaslon: "041 234 567". */
export function telefonZaZaslon(telefon: string): string {
  return skupineTelefona(telefon).join(' ');
}

/** Telefon za glas, po skupinah števk: "nič štiri ena, dve tri štiri, pet šest sedem". */
export function telefonZaGovor(telefon: string): string {
  const j = trenutniJezik();
  const st = j === 'sl' ? STEVKE : STEVKE_TUJE[j];
  const plus = j === 'sl' ? 'plus' : EMAIL_TUJE[j].plus;
  return skupineTelefona(telefon)
    .map((g) => [...g].map((c) => (c === '+' ? plus : st[Number(c)])).join(' '))
    .join(', ');
}

/** E-pošta za glas: "mateja.k@gmail.com" → "mateja pika k afna gmail pika com". */
export function emailZaGovor(email: string): string {
  const j = trenutniJezik();
  const st = j === 'sl' ? STEVKE : STEVKE_TUJE[j];
  const z = j === 'sl' ? { afna: 'afna', pika: 'pika', pomisljaj: 'pomišljaj', podcrtaj: 'podčrtaj', plus: 'plus' } : EMAIL_TUJE[j];
  return email
    .toLowerCase()
    .replace(/\d/g, (c) => ` ${st[Number(c)]} `)
    .replace(/@/g, ` ${z.afna} `)
    .replace(/\./g, ` ${z.pika} `)
    .replace(/-/g, ` ${z.pomisljaj} `)
    .replace(/_/g, ` ${z.podcrtaj} `)
    .replace(/\+/g, ` ${z.plus} `)
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Varna povezava za gumb Pokliči / Piši, ali null. */
export function povezavaKontakta(vrsta: 'klic' | 'pisi', vrednost: string): string | null {
  if (vrsta === 'klic') {
    const t = vrednost.replace(/[^\d+]/g, '');
    return /^\+?\d{6,15}$/.test(t) ? `tel:${t}` : null;
  }
  const e = vrednost.trim();
  return /^[^\s@?&#/:]{1,64}@[^\s@?&#/:]{1,190}\.[a-z]{2,}$/i.test(e) ? `mailto:${e}` : null;
}

/**
 * Ime v mestniku za "pri …": Luka → Luki, Tina → Tini, Marko → Marku, Tim → Timu,
 * Matej → Mateju, Peter → Petru. Sklanja se samo prva beseda (ime), priimek ostane.
 */
export function mestnik(ime: string): string {
  const [prvo, ...ostalo] = ime.trim().split(/\s+/);
  if (!prvo) return ime;
  let m: string;
  if (/[aA]$/.test(prvo)) m = `${prvo.slice(0, -1)}i`;
  else if (/[oO]$/.test(prvo)) m = `${prvo.slice(0, -1)}u`;
  else if (/[eE]$/.test(prvo)) m = `${prvo}tu`;
  else if (/[iIuU]$/.test(prvo)) m = `${prvo}ju`;
  else if (/[^aeiou]er$/i.test(prvo)) m = `${prvo.slice(0, -2)}ru`;
  else if (/\p{L}$/u.test(prvo)) m = `${prvo}u`;
  else m = prvo;
  return [m, ...ostalo].join(' ');
}

/**
 * Za dnevnik (glas_ukazi.prepis): telefonske številke (7+ števk) in e-naslovi se zamenjajo
 * z oznako. Ure ("10:30"), datumi ("15. 11.") in kratka števila ostanejo.
 */
export function brezKontaktov(besedilo: string): string {
  return besedilo
    .replace(/[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}/gi, '(e-pošta)')
    .replace(/[^\s@]+ afna [^\s@]+( pika [^\s@]+)+/gi, '(e-pošta)')
    .replace(/\+?\d[\d \-/]{5,}\d/g, (m) => (m.replace(/\D/g, '').length >= 7 ? '(telefon)' : m));
}
