// lib/glas/tipi.ts
//
// Skupni tipi glasovnega asistenta. Jedro (jedro.ts) je neodvisno od vhoda
// (aplikacija, pozneje Telnyx klic), ponudnikov (ponudniki/) in baze (shramba/),
// zato so tu samo opisi oblik, brez odvisnosti.

import type { StaffPermissions } from '@/types/roles';

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
}

export type Pravica =
  | 'glas.uporaba'
  | 'stranke.branje'
  | 'stranke.urejanje'
  | 'stranke.ustvarjanje'
  | 'termini.branje'
  | 'termini.urejanje'
  | 'termini.ustvarjanje';

export type RazredTveganja = 'branje' | 'pisanje' | 'mnozicno' | 'sporocila';

/** JSON shema za LLM (podmnožica, ki jo potrebujemo). */
export type JsonShema = {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
};

/** Kar orodje vrne jedru po branju ali izvedbi. */
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
  /** Zadnji zaključen/pretekli termin stranke. */
  zadnjiTermin(idStranke: string, predDatumom: string): Promise<TerminPovzetek | null>;
  naslednjiTermin(idStranke: string, odDatuma: string): Promise<TerminPovzetek | null>;
  urnikPodjetja(): Promise<unknown>;
  odsotnosti(od: string, doo: string): Promise<OdsotnostPovzetek[]>;
  dodajZapisek(z: NovZapisek): Promise<{ id: string }>;
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
  id: string; // "ID osebe" — enako kot Termini."ID Osebe"
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
