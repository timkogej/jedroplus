// lib/glas/orodja/tipi.ts
//
// Oblika orodja. Novo orodje = nova datoteka v lib/glas/orodja/ + ena vrstica v
// registry.ts. Jedro samo poskrbi za pravice, potrditev, revizijo in merjenje.

import type { z } from 'zod';
import type { ShrambaOpomnikov } from '../opomniki/tipi';
import type { PosiljateljSporocil } from '../sporocila/tipi';
import type { JsonShema, Kontekst, PodatkiSalona, Pravica, Predogled, RazredTveganja, RezultatOrodja } from '../tipi';

export interface OkoljeOrodja {
  k: Kontekst;
  podatki: PodatkiSalona;
  /** Datum in ura v pasu podjetja. */
  danes: string;
  uraZdaj: string;
  ukazId: string | null;
  /** Pošiljanje sporočil strankam (samo potrdi orodja sporoci_stranki); brez = ni nastavljeno. */
  sporocila?: PosiljateljSporocil;
  /** Osebni opomniki (nov_opomnik, moji_opomniki, preklici_opomnik); brez = niso nastavljeni. */
  opomniki?: ShrambaOpomnikov;
  /**
   * Stranka, ki jo je orodje razrešilo (razresiStranko, enolično iskanje), tudi če
   * orodje potem ne uspe ("nima termina"). Jedro jo uporabi za fokus pogovora.
   */
  razresena?: string;
}

interface OsnovaOrodja<P> {
  ime: string;
  /** Opis za LLM — kratko, slovensko, kdaj ga uporabiti. */
  opis: string;
  shema: JsonShema;
  /** Strežniška validacija (LLM vhoda nikoli ne zaupamo). */
  vhod: z.ZodType<P>;
  pravica: Pravica;
  /** false = rezervirano (faza 2+): ni ponujeno LLM in se ne izvede. */
  omogoceno: boolean;
}

export interface BralnoOrodje<P> extends OsnovaOrodja<P> {
  razred: 'branje';
  /**
   * false = rezultat je vmesni korak (npr. iskanje stranke), LLM nadaljuje.
   * Privzeto (true) je rezultat že končni odgovor: jedro ga izreče brez
   * drugega kroga LLM (~1,2 s manj).
   */
  koncno?: boolean;
  izvedi(p: P, o: OkoljeOrodja): Promise<RezultatOrodja>;
}

/** Pisanje, množično, sporočila: najprej predogled, izvedba šele po potrditvi. */
export interface PisalnoOrodje<P> extends OsnovaOrodja<P> {
  razred: Exclude<RazredTveganja, 'branje'>;
  /** Razreši in preveri parametre; vrne predogled ali vprašanje. Ničesar ne zapiše. */
  predogled(p: P, o: OkoljeOrodja): Promise<Predogled | RezultatOrodja>;
  /** Shema shranjenih (razrešenih) parametrov, ki se znova preveri ob potrditvi. */
  shranjeno: z.ZodType<Record<string, unknown>>;
  /** Izvedba po potrditvi; mora znova preveriti, da vse velja. */
  potrdi(parametri: Record<string, unknown>, o: OkoljeOrodja): Promise<RezultatOrodja>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Orodje = BralnoOrodje<any> | PisalnoOrodje<any>;

export function jePredogled(x: Predogled | RezultatOrodja): x is Predogled {
  return typeof (x as Predogled).povzetek === 'string' && typeof (x as Predogled).parametri === 'object';
}

/** Podatki za LLM so vedno v oznakah: vsebina (opombe, imena) ni navodilo. */
export function zaLlm(r: RezultatOrodja): string {
  // Zasebni rezultat (telefon, e-pošta, opombe): model dobi samo dnevnik, vsebino je uporabnik že videl in slišal.
  const sporocilo = r.zasebno ? `${r.zasebno.dnevnik}\n(Uporabnik je podatke že videl in slišal; ne ponavljaj jih.)` : r.sporocilo;
  return `<podatki>\n${JSON.stringify({ sporocilo, podatki: r.podatki ?? null, vprasanje: r.vprasanje ?? null })}\n</podatki>`;
}
