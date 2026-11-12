// lib/glas/shramba/tipi.ts
//
// Knjiga ukazov, predlogov, porabe in revizije. Produkcija: Supabase prek SQL
// funkcij (atomarno, samo service role). Testi: pomnilnik z enakim obnašanjem.

export type VhodUkaza = 'aplikacija' | 'telefon' | 'besedilo';

export type RezervacijaUkaza =
  | { ok: true; ukazId: string; porabljeno: number; kvota: number }
  | { ok: false; koda: 'izklopljeno' | 'uporabnik_izklopljen' | 'prehitro' | 'kvota'; porabljeno?: number; kvota?: number };

export interface ZakljucekUkaza {
  status: 'odgovor' | 'predlog' | 'vprasanje' | 'napaka';
  prepis: string | null;
  odgovor: string | null;
  orodja: string[];
  napaka_koda: string | null;
  stt_ponudnik: string | null;
  stt_sekunde: number;
  llm_ponudnik: string | null;
  llm_model: string | null;
  llm_vhod: number;
  llm_vhod_predpomnjen: number;
  llm_izhod: number;
  tts_znaki: number;
  strosek_mikro_usd: number;
  trajanje_ms: Record<string, number>;
}

export interface NovPredlog {
  podjetje: string;
  userId: string;
  ukazId: string | null;
  orodje: string;
  razred: 'pisanje' | 'mnozicno' | 'sporocila';
  parametri: Record<string, unknown>;
  parametriHash: string;
  zetonHash: string;
  povzetek: string;
  potece: Date;
}

export interface ShranjenPredlog {
  id: string;
  company_id: string;
  user_id: string;
  ukaz_id: string | null;
  orodje: string;
  parametri: Record<string, unknown>;
  parametri_hash: string;
  povzetek: string;
}

export type ZacetekPotrditve =
  | { ok: true; predlog: ShranjenPredlog }
  | { ok: false; koda: 'ni_najden' | 'poteklo' | 'zavrnjeno' | 'izvaja' | 'izvedeno' | 'napaka'; rezultat?: unknown; napaka?: string | null };

export interface ZapisRevizije {
  podjetje: string;
  userId: string | null;
  ukazId?: string | null;
  predlogId?: string | null;
  dogodek: 'ukaz' | 'predlog' | 'potrjeno' | 'izvedeno' | 'napaka' | 'zavrnjeno' | 'ni_pravice' | 'kvota';
  orodje?: string | null;
  /** Samo ID-ji in kode — nikoli imena, telefoni ali prepis. */
  podrobnosti?: Record<string, string | number | boolean | null>;
}

export interface ShrambaGlasa {
  rezervirajUkaz(podjetje: string, userId: string, vhod: VhodUkaza): Promise<RezervacijaUkaza>;
  zakljuciUkaz(ukazId: string, z: ZakljucekUkaza, vrniKvoto: boolean): Promise<void>;
  /** Prepis in odgovor prejšnjega ukaza istega uporabnika (≤5 min), za nadaljevanje pogovora. */
  prejsnjiUkaz(ukazId: string, userId: string): Promise<{ prepis: string; odgovor: string } | null>;
  ustvariPredlog(p: NovPredlog): Promise<string>;
  zacniPotrditev(predlogId: string, userId: string, zetonHash: string): Promise<ZacetekPotrditve>;
  zakljuciPotrditev(predlogId: string, status: 'izvedeno' | 'napaka', rezultat: unknown, napaka: string | null): Promise<void>;
  zavrniPredlog(predlogId: string, userId: string): Promise<boolean>;
  revizija(z: ZapisRevizije): Promise<void>;
}
