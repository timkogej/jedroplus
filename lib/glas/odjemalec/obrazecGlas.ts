// lib/glas/odjemalec/obrazecGlas.ts
//
// Povezava med plavajočim asistentom in obstoječimi obrazci:
//
//   * obrazec, ki ga je odprl asistent, javi "odprt"/"zaprt" (in svoj element,
//     da gre krogec v njegov zgornji levi kot);
//   * asistent na "shrani" pošlje ukaz, obrazec pokliče svoj requestSubmit()
//     — isto pot kot gumb Shrani (preverjanje, potrdila, resursi, n8n);
//   * na "prekliči" obrazec pokliče svoj onClose;
//   * obrazec javi izid: napaka v polju ali "ni shranjeno" (zaprtje = shranjeno);
//   * vprašanje brez obrazca ("Obvestim stranko?" po glasovni prestavitvi) javi
//     besedilo vprašanja; "ja" pokliče isti gumb kot dotik.
//
// Asistent sam ne shrani in ne pošlje ničesar. Dogodki gredo prek window (ista stran).
//
// Na stran, ki je že odprta (npr. koledar), asistent pošlje "pojdi" kot dogodek,
// ker se stran ob premiku na isti naslov ne naloži znova.

import { jePotrditev, jeZavrnitev } from './besede';

export const DOGODEK_STANJE = 'asistent-obrazec-stanje';
export const DOGODEK_UKAZ = 'asistent-obrazec-ukaz';
export const DOGODEK_IZID = 'asistent-obrazec-izid';
export const DOGODEK_POJDI = 'asistent-pojdi';

export type UkazObrazcu = 'shrani' | 'preklici';

export interface StanjeObrazca {
  odprt: boolean;
  /** Element obrazca ali lista (za položaj krogca). */
  el?: HTMLElement | null;
  /** Vprašanje namesto obrazca (npr. "Obvestim stranko?"): asistent ga izgovori. */
  vprasanje?: string;
  /** Kaj asistent reče, ko je vprašanje potrjeno (privzeto »Poslano.«). */
  uspeh?: string;
}

/** Izid glasovnega "shrani", ko obrazec ostane odprt (zaprtje pomeni shranjeno). */
export interface IzidObrazca {
  ok: false;
  /** Besedilo napake s polja (npr. "Izberite storitev."); null = ni znano. */
  napaka: string | null;
}

// sl, hr, en, de, it (brez šumnikov in naglasov po preprosto()).
const SHRANI =
  /^(ja |da |okej |ok |yes |si )?(shrani|shranite|shrani ga|shrani jo|shrani to|potrdi|potrdim|vpisi|vpisite|zapisi|zapisite|spremi|spremite|save|save it|speichern|salva|salvare|poslji|poslji ga|obvesti|obvesti jo|obvesti ga)( prosim| hvala| molim| please| bitte| grazie)?$/;
const PREKLICI =
  /^(zapri|zaprite|zapri obrazec|preklici|preklicite|pozabi|pusti|opusti|odustani|zatvori|cancel|close|abbrechen|schliessen|annulla|chiudi|ne obvesti|ne obvescaj|ni treba)( prosim| hvala| to| please| bitte)?$/;

const preprosto = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Kratka izjava, ki se nanaša na odprt obrazec; vse drugo je nov ukaz za asistenta. */
export function ukazObrazcu(izjava: string): UkazObrazcu | null {
  const s = preprosto(izjava);
  if (!s) return null;
  if (SHRANI.test(s) || jePotrditev(s) || s === 'mhm' || s === 'aha ja') return 'shrani';
  if (PREKLICI.test(s) || jeZavrnitev(s)) return 'preklici';
  return null;
}

export function javiStanjeObrazca(stanje: boolean | StanjeObrazca): void {
  const detail: StanjeObrazca = typeof stanje === 'boolean' ? { odprt: stanje } : stanje;
  window.dispatchEvent(new CustomEvent(DOGODEK_STANJE, { detail }));
}

export function posljiUkazObrazcu(ukaz: UkazObrazcu): void {
  window.dispatchEvent(new CustomEvent(DOGODEK_UKAZ, { detail: { ukaz } }));
}

export function javiIzidObrazca(izid: IzidObrazca): void {
  window.dispatchEvent(new CustomEvent(DOGODEK_IZID, { detail: izid }));
}

/** `pot` je brez jezika, npr. "/koledar?termin=OB-1&datum=2026-11-13". */
export function posljiPojdi(pot: string): void {
  window.dispatchEvent(new CustomEvent(DOGODEK_POJDI, { detail: { pot } }));
}

/** Prva vidna napaka v obrazcu (rdeče besedilo pod poljem ali seznam napak). */
export function napakaVObrazcu(koren: ParentNode | null | undefined): string | null {
  if (!koren) return null;
  // Ikone imajo isti rdeči razred, a brez besedila: vzamemo prvi element z besedilom.
  for (const el of Array.from(koren.querySelectorAll('[role="alert"], .text-red-500, .text-red-600, .text-red-700'))) {
    const t = el.textContent?.replace(/\s+/g, ' ').trim();
    if (t) return t.slice(0, 160);
  }
  return null;
}
