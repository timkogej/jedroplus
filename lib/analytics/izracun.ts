// lib/analytics/izracun.ts
//
// En izračun prihodkov in štetja terminov za stran Analitika IN za Asistent+
// (številke za lastnika), da sta številki vedno enaki. Čista funkcija: dobi
// vrstice tabel Termini, Storitve in Osebe, nič ne bere iz baze.
//
// Pravila (Timova odločitev 14. 11. 2026):
//   * šteje termin, ki je ZAKLJUČEN, ali termin, ki se je že končal in ni
//     odpovedan ali neprihod ("opravljen") — saloni, ki terminov ne zaključujejo,
//     sicer vidijo 0 €;
//   * izločeni: izbrisani (deleted_at), "ne beleži" (belezi_termin = false),
//     odpovedani in neprihodi;
//   * vrednost termina: "Final cena" → "cena" → cenik vseh storitev termina
//     (glavna, 2., 3. in dodatna). To je cena po ceniku, NE dejansko plačilo.
//   * Termini."ID storitve" / "ID osebe" se poiščeta po obeh možnih ključih
//     (id ali "ID storitve" / "ID osebe"), ker stara koda uporablja oba.

import { normalizeAppointmentStatus } from '@/lib/appointments/status';

export type Vrstica = Record<string, unknown>;

export interface StoritevCenika {
  id: string;
  naziv: string;
  cena: number;
  barva: string;
}

export interface OsebaCenika {
  id: string;
  ime: string;
  barva: string;
}

export interface Cenik {
  storitve: Map<string, StoritevCenika>;
  osebe: Map<string, OsebaCenika>;
}

const niz = (v: unknown) => (v === null || v === undefined ? '' : String(v)).trim();
const stevilo = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(niz(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const prvo = (r: Vrstica, imena: string[]) => {
  for (const i of imena) {
    const v = niz(r[i]);
    if (v && v !== 'null') return v;
  }
  return '';
};

/** Cenik iz vrstic Storitve in Osebe; vsak zapis je dosegljiv po id in po besedilnem ID. */
export function zgradiCenik(storitve: Vrstica[], osebe: Vrstica[] = []): Cenik {
  const s = new Map<string, StoritevCenika>();
  for (const r of storitve) {
    const id = prvo(r, ['id', 'ID storitve', 'ID_storitve']);
    if (!id) continue;
    const x: StoritevCenika = {
      id,
      naziv: prvo(r, ['Naziv', 'naziv', 'name']) || 'Neznana storitev',
      cena: stevilo(r['cena'] ?? r['Cena'] ?? r['price']),
      barva: prvo(r, ['Barva', 'barva', 'color']) || '#8B5CF6',
    };
    for (const k of [r['id'], r['ID storitve'], r['ID_storitve']]) if (niz(k)) s.set(niz(k), x);
  }
  const o = new Map<string, OsebaCenika>();
  for (const r of osebe) {
    const id = prvo(r, ['id', 'ID osebe']);
    if (!id) continue;
    const x: OsebaCenika = {
      id,
      ime: `${prvo(r, ['Ime', 'ime'])} ${prvo(r, ['Priimek', 'priimek'])}`.trim() || 'Neznan zaposleni',
      barva: prvo(r, ['Barva', 'barva', 'color']) || '#8B5CF6',
    };
    for (const k of [r['id'], r['ID osebe']]) if (niz(k)) o.set(niz(k), x);
  }
  return { storitve: s, osebe: o };
}

export const datumTermina = (r: Vrstica) => prvo(r, ['Datum', 'datum', 'date']).slice(0, 10);
const zacetekTermina = (r: Vrstica) => prvo(r, ['Čas', 'cas_zacetek', 'Čas začetka', 'time_start', 'Ura']).slice(0, 5);
const konecTermina = (r: Vrstica) => prvo(r, ['Konec', 'cas_konec', 'Čas konca', 'time_end']).slice(0, 5);
export const statusVrstice = (r: Vrstica) => normalizeAppointmentStatus(r['Status'] ?? r['status']);
export const storitevTermina = (r: Vrstica) => prvo(r, ['ID storitve', 'ID storitev', 'storitev_id', 'service_id', 'ID_storitve']);
export const osebaTermina = (r: Vrstica) => prvo(r, ['ID Osebe', 'ID osebe', 'ID osebja', 'zaposleni_id', 'employee_id', 'oseba_id']);

/** Termin, ki ga analitika sploh upošteva (ni izbrisan in se beleži). */
export function seUposteva(r: Vrstica): boolean {
  if (r['belezi_termin'] === false) return false;
  if (niz(r['deleted_at'])) return false;
  return Boolean(datumTermina(r));
}

/**
 * Zaključen ali že končan in ne odpovedan / neprihod. `zdaj` je "YYYY-MM-DD HH:MM"
 * v pasu salona (datumi in ure v Termini so lokalni).
 */
export function jeOpravljen(r: Vrstica, zdaj: string): boolean {
  const s = statusVrstice(r);
  if (s === 'completed') return true;
  if (s === 'cancelled' || s === 'no_show') return false;
  const konec = konecTermina(r) || zacetekTermina(r) || '23:59';
  return `${datumTermina(r)} ${konec}` <= zdaj;
}

/** Vrednost termina po ceniku in razdelitev po storitvah (vsota delov = skupaj). */
export function vrednostTermina(r: Vrstica, cenik: Cenik): { skupaj: number; deli: { id: string; znesek: number }[] } {
  const ids = [
    storitevTermina(r),
    prvo(r, ['ID storitve 2']),
    prvo(r, ['ID storitve 3']),
    prvo(r, ['add_on_storitev_id', 'add_on_service_id']),
  ];
  const cena = (id: string) => (id ? (cenik.storitve.get(id)?.cena ?? 0) : 0);
  const poCeniku = ids.reduce((v, id) => v + cena(id), 0);
  const zapisana = stevilo(r['Final cena']) || stevilo(r['cena'] ?? r['Cena'] ?? r['price']);
  const skupaj = zapisana > 0 ? zapisana : poCeniku;
  // Glavna storitev dobi ostanek, dodatne svojo ceno po ceniku.
  const dodatne = ids.slice(1).filter(Boolean).map((id) => ({ id, znesek: cena(id) }));
  const glavna = Math.max(0, skupaj - dodatne.reduce((v, d) => v + d.znesek, 0));
  const deli = [...(ids[0] ? [{ id: ids[0], znesek: glavna }] : []), ...dodatne];
  return { skupaj, deli };
}

export interface PostavkaStoritve {
  id: string;
  naziv: string;
  barva: string;
  stevilo: number;
  znesek: number;
}

export interface PostavkaOsebe {
  id: string;
  ime: string;
  barva: string;
  stevilo: number;
  znesek: number;
}

export interface IzracunObdobja {
  od: string;
  do: string;
  /** Vsi upoštevani termini z datumom v obdobju (tudi prihodnji in odpovedani). */
  termini: number;
  /** Zaključeni + že končani neodpovedani. */
  opravljeni: number;
  zakljuceni: number;
  odpovedani: number;
  neprihodi: number;
  /** Vrednost opravljenih po ceniku. */
  zasluzek: number;
  /** Od tega zaključeni. */
  zasluzekZakljuceni: number;
  storitve: PostavkaStoritve[];
  osebe: PostavkaOsebe[];
}

/** Izračun za obdobje [od, do] (YYYY-MM-DD, vključno). */
export function izracunajObdobje(vrstice: Vrstica[], cenik: Cenik, o: { od: string; do: string; zdaj: string }): IzracunObdobja {
  const out: IzracunObdobja = {
    od: o.od, do: o.do, termini: 0, opravljeni: 0, zakljuceni: 0, odpovedani: 0, neprihodi: 0, zasluzek: 0, zasluzekZakljuceni: 0, storitve: [], osebe: [],
  };
  const st = new Map<string, PostavkaStoritve>();
  const os = new Map<string, PostavkaOsebe>();
  for (const r of vrstice) {
    if (!seUposteva(r)) continue;
    const d = datumTermina(r);
    if (d < o.od || d > o.do) continue;
    out.termini++;
    const s = statusVrstice(r);
    if (s === 'cancelled') out.odpovedani++;
    if (s === 'no_show') out.neprihodi++;
    if (s === 'completed') out.zakljuceni++;
    if (!jeOpravljen(r, o.zdaj)) continue;
    out.opravljeni++;
    const v = vrednostTermina(r, cenik);
    out.zasluzek += v.skupaj;
    if (s === 'completed') out.zasluzekZakljuceni += v.skupaj;
    for (const del of v.deli) {
      const c = cenik.storitve.get(del.id);
      const kljuc = c?.id ?? del.id;
      const x = st.get(kljuc) ?? { id: kljuc, naziv: c?.naziv ?? 'Neznana storitev', barva: c?.barva ?? '#8B5CF6', stevilo: 0, znesek: 0 };
      x.stevilo++;
      x.znesek += del.znesek;
      st.set(kljuc, x);
    }
    const oid = osebaTermina(r);
    if (oid) {
      const c = cenik.osebe.get(oid);
      const kljuc = c?.id ?? oid;
      const x = os.get(kljuc) ?? { id: kljuc, ime: c?.ime ?? 'Neznan zaposleni', barva: c?.barva ?? '#8B5CF6', stevilo: 0, znesek: 0 };
      x.stevilo++;
      x.znesek += v.skupaj;
      os.set(kljuc, x);
    }
  }
  out.zasluzek = zaokrozi(out.zasluzek);
  out.zasluzekZakljuceni = zaokrozi(out.zasluzekZakljuceni);
  out.storitve = [...st.values()].map((x) => ({ ...x, znesek: zaokrozi(x.znesek) })).sort((a, b) => b.stevilo - a.stevilo || b.znesek - a.znesek);
  out.osebe = [...os.values()].map((x) => ({ ...x, znesek: zaokrozi(x.znesek) })).sort((a, b) => b.stevilo - a.stevilo || b.znesek - a.znesek);
  return out;
}

const zaokrozi = (n: number) => Math.round(n * 100) / 100;

/** "YYYY-MM-DD HH:MM" v danem časovnem pasu (za `zdaj`). */
export function zdajVPasuSalona(trenutek: Date, casovniPas = 'Europe/Ljubljana'): string {
  const deli = new Intl.DateTimeFormat('en-CA', {
    timeZone: casovniPas, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(trenutek);
  const g = (t: string) => deli.find((p) => p.type === t)?.value ?? '00';
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}`;
}
