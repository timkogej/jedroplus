// lib/glas/odjemalec/predizpolnitev.ts
//
// Asistent+ odpre obstoječi obrazec že izpolnjen (nov termin, prestavitev,
// odsotnost, nova stranka). Podatki gredo prek sessionStorage, NE prek URL-ja:
// naslovi strani se zapisujejo v dnevnike strežnika in zgodovino brskalnika,
// imena, telefoni in razlogi odsotnosti pa tja ne sodijo. URL nosi samo ?glas=1.

export type VrstaObrazca = 'nov_termin' | 'prestavi_termin' | 'uredi_termin' | 'odsotnost' | 'nova_stranka' | 'uredi_stranko';

export interface Obrazec {
  vrsta: VrstaObrazca;
  polja: Record<string, string>;
}

const KLJUC = 'asistent-obrazec';
/** Starejša predizpolnitev se ne uporabi (npr. zavihek, odprt naslednji dan). */
const VELJA_MS = 2 * 60_000;

export function shraniObrazec(o: Obrazec): void {
  try {
    sessionStorage.setItem(KLJUC, JSON.stringify({ ...o, cas: Date.now() }));
  } catch {
    /* zasebni način: obrazec se odpre prazen */
  }
}

/** Prebere in pobriše (enkratna uporaba). Samo pričakovane vrste. */
export function vzemiObrazec(vrste: VrstaObrazca[]): Obrazec | null {
  try {
    const surovo = sessionStorage.getItem(KLJUC);
    if (!surovo) return null;
    const o = JSON.parse(surovo) as Obrazec & { cas?: number };
    if (!vrste.includes(o.vrsta)) return null;
    sessionStorage.removeItem(KLJUC);
    if (!o.cas || Date.now() - o.cas > VELJA_MS) return null;
    const polja: Record<string, string> = {};
    for (const [k, v] of Object.entries(o.polja ?? {})) if (typeof v === 'string') polja[k] = v.slice(0, 200);
    return { vrsta: o.vrsta, polja };
  } catch {
    return null;
  }
}
