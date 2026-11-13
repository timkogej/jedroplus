// lib/glas/odjemalec/obrazecGlas.ts
//
// Povezava med plavajočim asistentom in obstoječimi obrazci (faza 4):
//
//   * obrazec, ki ga je odprl asistent, javi "odprt"/"zaprt";
//   * asistent na "shrani" pošlje ukaz, obrazec pokliče svoj requestSubmit()
//     — isto pot kot gumb Shrani (preverjanje, potrdila, resursi, n8n);
//   * na "prekliči" obrazec pokliče svoj onClose.
//
// Asistent sam ne shrani ničesar. Dogodki gredo prek window (ista stran).
//
// Na stran, ki je že odprta (npr. koledar), asistent pošlje "pojdi" kot dogodek,
// ker se stran ob premiku na isti naslov ne naloži znova.

import { jePotrditev, jeZavrnitev } from './besede';

export const DOGODEK_STANJE = 'asistent-obrazec-stanje';
export const DOGODEK_UKAZ = 'asistent-obrazec-ukaz';
export const DOGODEK_POJDI = 'asistent-pojdi';

export type UkazObrazcu = 'shrani' | 'preklici';

// sl, hr, en, de, it (brez šumnikov in naglasov po preprosto()).
const SHRANI =
  /^(ja |da |okej |ok |yes |si )?(shrani|shranite|shrani ga|shrani jo|shrani to|potrdi|potrdim|vpisi|vpisite|zapisi|zapisite|spremi|spremite|save|save it|speichern|salva|salvare)( prosim| hvala| molim| please| bitte| grazie)?$/;
const PREKLICI =
  /^(zapri|zaprite|zapri obrazec|preklici|preklicite|pozabi|pusti|opusti|odustani|zatvori|cancel|close|abbrechen|schliessen|annulla|chiudi)( prosim| hvala| to| please| bitte)?$/;

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
  if (SHRANI.test(s) || jePotrditev(s)) return 'shrani';
  if (PREKLICI.test(s) || jeZavrnitev(s)) return 'preklici';
  return null;
}

export function javiStanjeObrazca(odprt: boolean): void {
  window.dispatchEvent(new CustomEvent(DOGODEK_STANJE, { detail: { odprt } }));
}

export function posljiUkazObrazcu(ukaz: UkazObrazcu): void {
  window.dispatchEvent(new CustomEvent(DOGODEK_UKAZ, { detail: { ukaz } }));
}

/** `pot` je brez jezika, npr. "/koledar?termin=OB-1&datum=2026-11-13". */
export function posljiPojdi(pot: string): void {
  window.dispatchEvent(new CustomEvent(DOGODEK_POJDI, { detail: { pot } }));
}
