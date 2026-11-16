// lib/glas/tipi.ts
//
// Skupni tipi glasovnega asistenta. Jedro (jedro.ts) je neodvisno od vhoda
// (aplikacija, pozneje Telnyx klic), ponudnikov (ponudniki/) in baze (shramba/),
// zato so tu samo opisi oblik, brez odvisnosti.

import type { StaffPermissions } from '@/types/roles';
import type { JezikAsistenta } from './paket';

export type Vloga = 'owner' | 'admin' | 'staff';

/** Kdo daje ukaz. Vse je razrešeno na strežniku iz seje, nič iz zahteve. */
export interface Kontekst {
  /** companies.company_id (besedilni, npr. "7LHB28") */
  podjetje: string;
  /** companies.id */
  podjetjeUuid: string;
  userId: string;
  email: string | null;
  vloga: Vloga;
  /** staff_role_permissions podjetja; null = ni vrstice */
  pravice: StaffPermissions | null;
  /** company_members.person_id — primerja se s Termini."ID Osebe" */
  osebaId: string | null;
  casovniPas: string;
  /** Trenutni čas (vbrizgan zaradi testov). */
  zdaj: Date;
  /** Jezik pogovora Asistent+ (stran AI); brez = slovenščina. */
  jezik?: JezikAsistenta;
}

export type Pravica =
  | 'glas.uporaba'
  | 'stranke.branje'
  | 'stranke.urejanje'
  | 'stranke.ustvarjanje'
  | 'termini.branje'
  | 'termini.urejanje'
  | 'termini.ustvarjanje'
  /** Številke salona (zaslužek, statistika): samo lastnik (Timova odločitev 14. 11. 2026). */
  | 'analitika.lastnik'
  /** Sporočilo stranki o njenem terminu (isto kot urejanje terminov; ločeno ime za morebitno zaostritev). */
  | 'sporocila.stranke';

export type RazredTveganja = 'branje' | 'pisanje' | 'mnozicno' | 'sporocila';

/** JSON shema za LLM (podmnožica, ki jo potrebujemo). */
export type JsonShema = {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
};

/** Kar orodje vrne jedru po branju ali izvedbi. */
export type VrstaObrazcaGlas = 'nov_termin' | 'prestavi_termin' | 'uredi_termin' | 'odsotnost' | 'nova_stranka' | 'uredi_stranko';

export interface RezultatOrodja {
  /** Kratko besedilo za uporabnika (slovensko), za zaslon. */
  sporocilo: string;
  /** Isto za glas (ure z besedami, brez seznamov); brez = izpeljano iz sporočila. */
  govor?: string;
  /** Strukturirani podatki za zaslon in za LLM (brez telefonov/e-pošte). */
  podatki?: unknown;
  /** Orodje potrebuje odgovor uporabnika (npr. več strank z istim imenom). */
  vprasanje?: { besedilo: string; moznosti?: { id: string; oznaka: string }[] };
  /** Ob potrditvi: dejanje se ni izvedlo (npr. stranke ni več), nič ni zapisano. */
  neuspeh?: boolean;
  /** Pot v aplikaciji, ki naj jo odjemalec odpre (brez jezika, npr. "/clients?stranka=101"). */
  pojdi?: string;
  /** Predizpolnitev obstoječega obrazca (odjemalec jo da v sessionStorage, ne v URL). */
  obrazec?: { vrsta: VrstaObrazcaGlas; polja: Record<string, string> };
  /**
   * Sporočilo in govor vsebujeta osebne podatke (telefon, e-pošta, opombe): gresta samo
   * na zaslon in v glas. Modelu AI in v dnevnik (glas_ukazi.odgovor) gre `dnevnik`.
   */
  zasebno?: { dnevnik: string };
  /** Gumbi na zaslonu (Pokliči, Piši). Nikoli se ne sprožijo sami. */
  akcije?: AkcijaStranke[];
  /** Pregleden prikaz za zaslon (ploščice, vrstice) namesto dolgega besedila. */
  prikaz?: Prikaz;
}

/**
 * Kartica z odgovorom: kratek naslov, ploščice s številkami in skupine vrstic.
 * Sporočilo ostane za zgodovino in model; vmesnik pokaže to, če obstaja.
 */
export interface Prikaz {
  naslov: string;
  podnaslov?: string;
  ploscice?: { oznaka: string; vrednost: string; sprememba?: string; smer?: 'gor' | 'dol' | 'enako' }[];
  skupine?: { naslov?: string; vrstice: VrsticaPrikaza[]; se?: number }[];
  opomba?: string;
}

export interface VrsticaPrikaza {
  /** Leva kolona, npr. "09:00–10:30" ali "jutri 9:00". */
  cas?: string;
  glavno: string;
  drugo?: string;
  ton?: 'opozorilo';
}

export interface AkcijaStranke {
  vrsta: 'klic' | 'pisi';
  /** tel:+38641… ali mailto:… */
  href: string;
  /** Ime stranke na gumbu, ko je gumbov več (kandidati za luknjo). */
  oznaka?: string;
}

/** Podatki s kartice stranke za glasovni odgovor. Telefon, e-pošta in opombe ne gredo modelu AI. */
export interface PodrobnostiStranke {
  telefon: string | null;
  email: string | null;
  /** Koda jezika sporočil ('slo', 'eng', …) ali null. */
  jezik: string | null;
  opombe: string | null;
  interneOpombe: string | null;
  /** true = privolitev; false = odjava ali zavrnitev; null = ni odgovora (šteje kot ne). */
  marketing: boolean | null;
  /** Pretekli termini, ki niso odpovedani ali neprihodi. */
  obiski: number;
  neprihodi: number;
}

/** Kar pisalno orodje pokaže pred potrditvijo. */
export interface Predogled {
  /** Npr. "Dodam zapisek (barva) na kartico Ana Novak (zadnjič 3. 11.)". */
  povzetek: string;
  /** Razrešeni, preverjeni parametri — to se shrani in izvede ob potrditvi. */
  parametri: Record<string, unknown>;
  /** Vrstice za kartico. */
  podrobnosti?: { oznaka: string; vrednost: string }[];
  /** Koliko SMS/e-pošt bi se poslalo (faza 3). */
  sporocil?: number;
}

export class NapakaVhoda extends Error {
  constructor(sporocilo: string) {
    super(sporocilo);
    this.name = 'NapakaVhoda';
  }
}

/** Dostop do podatkov salona. Produkcija: uporabnikova seja (RLS). Testi: pomnilnik. */
export interface PodatkiSalona {
  stranke(): Promise<StrankaPovzetek[]>;
  stranka(idStranke: string): Promise<StrankaPovzetek | null>;
  storitve(): Promise<StoritevPovzetek[]>;
  osebe(): Promise<OsebaPovzetek[]>;
  /**
   * Termini med datumoma (vključno), brez izbrisanih; največ 2000.
   * `padajoce`: najnovejši najprej (pri omejitvi se odrežejo najstarejši).
   */
  termini(od: string, doo: string, moznosti?: { padajoce?: boolean }): Promise<TerminPovzetek[]>;
  /** Vsi neizbrisani termini v obdobju (po straneh, za ritem obiskov; brez omejitve 2000). */
  zgodovinaTerminov(od: string, doo: string): Promise<TerminPovzetek[]>;
  /** Zadnji zaključen/pretekli termin stranke. */
  zadnjiTermin(idStranke: string, predDatumom: string): Promise<TerminPovzetek | null>;
  naslednjiTermin(idStranke: string, odDatuma: string): Promise<TerminPovzetek | null>;
  urnikPodjetja(): Promise<unknown>;
  odsotnosti(od: string, doo: string): Promise<OdsotnostPovzetek[]>;
  dodajZapisek(z: NovZapisek): Promise<{ id: string }>;
  /** Zapiski s kartice stranke, najnovejši najprej. */
  zapiskiStranke(idStranke: string, najvec: number): Promise<ZapisekPovzetek[]>;
  /** Interne opombe s kartice stranke (brez kontaktov). */
  interneOpombe(idStranke: string): Promise<string | null>;
  /** Kontakt, jezik, opombe, privolitev in štetje obiskov (RLS). */
  podrobnostiStranke(idStranke: string, danes: string): Promise<PodrobnostiStranke | null>;
  resursi(): Promise<ResursPovzetek[]>;
  /** Povezave termin ↔ resurs za dane vrstice terminov (TerminPovzetek.vrstica). */
  resursiTerminov(vrstice: string[]): Promise<{ vrstica: string; resursId: string }[]>;
  /** Aktivne lokacije, do katerih ima uporabnik dostop, in kdo/kaj je kje (samo pri več lokacijah). */
  lokacije(): Promise<LokacijePovzetek>;
  /** Število zahtev za rezervacijo, ki čakajo na salon (zahteve_termini, status v_pregledu). */
  zahteveVPregledu(): Promise<number>;
  /** Med danimi strankami tiste, ki imajo pred datumom vsaj en neodpovedan, neizbrisan termin. */
  strankeSPreteklimTerminom(idStrank: string[], predDatumom: string): Promise<Set<string>>;
  /** Opombe s kartic strank (samo opombe, brez kontaktov); ID → opomba. */
  opombeStrank(idStrank: string[]): Promise<Record<string, string>>;
  /**
   * Surove vrstice za številke lastnika (lib/analytics/izracun.ts, isti izračun kot stran
   * Analitika): Termini z datumom v [od, doo], Storitve, Osebe. Z uporabnikovo sejo (RLS).
   */
  analitika(od: string, doo: string): Promise<{ termini: Record<string, unknown>[]; storitve: Record<string, unknown>[]; osebe: Record<string, unknown>[] }>;
  /** Ime salona za podpis sporočil strankam (companies.name); prazno, če ga ni. */
  imePodjetja(): Promise<string>;
}

export interface LokacijaPovzetek {
  id: string; // Lokacije.id (uuid) — kot Termini.lokacija_id
  naziv: string;
  glavna: boolean;
}

/**
 * Lokacije podjetja. `osebe`/`storitve`: ID → lokacije; osebe ali storitve
 * brez vrstice delajo oz. so na voljo povsod (enako kot app/location-context).
 */
export interface LokacijePovzetek {
  seznam: LokacijaPovzetek[];
  osebe: Record<string, string[]>;
  storitve: Record<string, string[]>;
}

export interface ZapisekPovzetek {
  kategorija: 'barva' | 'preferenca' | 'opomba';
  besedilo: string;
  podrobnosti: { odtenki?: string[]; gramov?: number; oksidant_pct?: number; cas_min?: number };
  datum: string; // yyyy-MM-dd (v pasu podjetja ni nujno; za govor zadošča)
}

export interface ResursPovzetek {
  id: string; // Resursi.id (številčni, kot Termini_Resursi.resurs_id)
  naziv: string;
  kolicina: number;
  aktivna: boolean;
}

export interface StrankaPovzetek {
  id: string; // "ID stranke"
  ime: string;
  priimek: string;
  zadnjaInterakcija: string | null; // yyyy-MM-dd
}

export interface StoritevPovzetek {
  id: string;
  naziv: string;
  trajanjeMin: number;
  aktivna: boolean;
}

export interface OsebaPovzetek {
  /**
   * Osebe.id (številčni) — enako kot Termini."ID Osebe", absences.employee_id in
   * company_members.person_id. (Preverjeno na bazi 16. 11.: vsi termini.)
   */
  id: string;
  /** Osebe."ID osebe" (besedilni) — samo Osebe_Lokacije in »ref« v koledarju. */
  sifra?: string;
  ime: string;
  priimek: string;
  aktivna: boolean;
  urnik: unknown; // UrnikData | IzmenicenUrnik | null
  imaUrnikPodjetja: boolean;
  opravljaVse: boolean;
  storitve: string[]; // ID storitev
}

export interface TerminPovzetek {
  id: string; // "ID termina"
  /** Termini.id (številčni) — Termini_Resursi.termin_id. */
  vrstica?: string;
  idStranke: string | null;
  stranka: string;
  datum: string; // yyyy-MM-dd
  zacetek: string; // HH:MM
  konec: string | null; // HH:MM
  storitev: string;
  osebaId: string | null;
  oseba: string;
  status: string; // normaliziran: scheduled/confirmed/completed/cancelled/no_show
  lokacijaId: string | null;
}

export interface OdsotnostPovzetek {
  osebaId: string | null;
  zacetek: string; // ISO
  konec: string; // ISO
}

export interface NovZapisek {
  podjetje: string;
  idStranke: string;
  kategorija: 'barva' | 'preferenca' | 'opomba';
  besedilo: string;
  podrobnosti: Record<string, unknown>;
  ukazId: string | null;
  avtorIme: string | null;
}

/** Ena izvedba orodja v jedru (za revizijo in testiranje). */
export interface KlicOrodja {
  ime: string;
  vhod: unknown;
  izid: 'ok' | 'napaka' | 'predlog' | 'ni_pravice' | 'vprasanje';
}
