// lib/glas/opomniki/tipi.ts
//
// Osebni opomniki Asistent+ (§5). Zapis po potrditvi in branje svojih opomnikov.
// Produkcija: SQL funkcije s service role (lib/glas/opomniki/supabase.ts), vedno
// omejeno na uporabnika in podjetje iz seje. Testi: pomnilnik.

/** Timova odločitev (načrt §5): največ toliko čakajočih na uporabnika. */
export const NAJVEC_OPOMNIKOV = 50;

export interface Opomnik {
  id: string;
  besedilo: string;
  /** ISO čas ali null (vezan na termin, čas pride iz termina). */
  ob: string | null;
  idTermina: string | null;
  idStranke: string | null;
}

export interface NovOpomnik {
  podjetje: string;
  podjetjeUuid: string;
  userId: string;
  besedilo: string;
  ob: string | null;
  idTermina: string | null;
  idStranke: string | null;
  casovniPas: string;
  jezik: 'sl' | 'en' | 'de' | 'it' | 'hr';
  ukazId: string | null;
}

export interface ShrambaOpomnikov {
  dodaj(o: NovOpomnik): Promise<{ ok: true; id: string } | { ok: false; koda: 'omejitev' }>;
  /** Čakajoči opomniki tega uporabnika v tem podjetju, po času. */
  cakajoci(podjetje: string, userId: string): Promise<Opomnik[]>;
  /** Prekliče samo svoj čakajoči opomnik. */
  preklici(podjetje: string, userId: string, id: string): Promise<boolean>;
  /** Ali ima uporabnik vklopljena push obvestila na vsaj eni napravi. */
  imaPush(podjetjeUuid: string, userId: string): Promise<boolean>;
}
