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
  /** Fokus pogovora po tem ukazu (samo ID-ji). */
  kontekst?: KontekstPogovora | null;
}

/** Aktivna stranka in termin pogovora. Samo ID-ji; orodja jih znova preberejo prek RLS. */
export interface KontekstPogovora {
  stranka_id?: string;
  termin_id?: string;
  termin_datum?: string;
  /** Zadnja luknja iz kandidati_za_luknjo (za »pošlji vsem«, »pošlji ji predlog«). */
  luknja?: { datum: string; od: string; oseba_id: string };
}

export interface PrejsnjiUkaz {
  prepis: string;
  odgovor: string;
  kontekst: KontekstPogovora | null;
  /** Kaj se je zgodilo s predlogom tega ukaza (potrjen z »ja«, preklican …); brez = ni bilo predloga. */
  izid?: IzidPredloga | null;
}

export interface IzidPredloga {
  status: 'caka' | 'izvaja' | 'izvedeno' | 'napaka' | 'zavrnjeno' | 'poteklo';
  /** rezultat.sporocilo potrditve (npr. »Opomnik je shranjen.«) */
  sporocilo: string | null;
  /** ID-ji iz rezultata (npr. opomnik_id), da se »ta opomnik« da najti. */
  idji: Record<string, string>;
}

/** Iz rezultata potrditve vzame samo sporočilo in kratke ID-je. */
export function preberiIzid(status: unknown, rezultat: unknown): IzidPredloga | null {
  const statusi = ['caka', 'izvaja', 'izvedeno', 'napaka', 'zavrnjeno', 'poteklo'] as const;
  if (!statusi.includes(status as (typeof statusi)[number])) return null;
  const r = (rezultat && typeof rezultat === 'object' ? rezultat : {}) as { sporocilo?: unknown; podatki?: unknown };
  const idji: Record<string, string> = {};
  if (r.podatki && typeof r.podatki === 'object' && !Array.isArray(r.podatki)) {
    for (const [k, v] of Object.entries(r.podatki as Record<string, unknown>)) {
      if (/_id$/.test(k) && typeof v === 'string' && /^[\w-]{1,64}$/.test(v)) idji[k] = v;
    }
  }
  return { status: status as IzidPredloga['status'], sporocilo: typeof r.sporocilo === 'string' ? r.sporocilo.slice(0, 300) : null, idji };
}

/** Iz zapisa v bazi vzame samo znana, kratka polja. */
export function preberiKontekst(x: unknown): KontekstPogovora | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const id = (v: unknown) => (typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : undefined);
  const k: KontekstPogovora = {
    stranka_id: id(o.stranka_id),
    termin_id: id(o.termin_id),
    termin_datum: typeof o.termin_datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.termin_datum) ? o.termin_datum : undefined,
  };
  if (!k.termin_id) delete k.termin_datum;
  const l = o.luknja as Record<string, unknown> | undefined;
  if (l && typeof l === 'object' && typeof l.datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(l.datum)
    && typeof l.od === 'string' && /^\d{2}:\d{2}$/.test(l.od) && id(l.oseba_id)) {
    k.luknja = { datum: l.datum, od: l.od, oseba_id: id(l.oseba_id)! };
  }
  for (const kljuc of Object.keys(k) as (keyof KontekstPogovora)[]) if (k[kljuc] === undefined) delete k[kljuc];
  return Object.keys(k).length ? k : null;
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
  prejsnjiUkaz(ukazId: string, userId: string, podjetje: string): Promise<PrejsnjiUkaz | null>;
  ustvariPredlog(p: NovPredlog): Promise<string>;
  zacniPotrditev(predlogId: string, userId: string, zetonHash: string): Promise<ZacetekPotrditve>;
  zakljuciPotrditev(predlogId: string, status: 'izvedeno' | 'napaka', rezultat: unknown, napaka: string | null): Promise<void>;
  zavrniPredlog(predlogId: string, userId: string): Promise<boolean>;
  revizija(z: ZapisRevizije): Promise<void>;
}
