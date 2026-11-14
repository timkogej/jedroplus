// lib/glas/sporocila/tipi.ts
//
// Pošiljanje sporočila stranki (SMS ali e-pošta) po potrditvi. Produkcija:
// omejitev v SQL (jp_glas_rezerviraj_sporocilo, service role) in n8n tok
// glas-sporocilo (HMAC, kvota SMS, message_outbox, sms-send / SES). Testi: pomnilnik.

export type Kanal = 'sms' | 'email';

/** Timova odločitev O1 (14. 11. 2026). */
export const OMEJITEV_NA_STRANKO = 3;
export const OMEJITEV_NA_PODJETJE = 30;

export type RezervacijaSporocila =
  | { ok: true; id: string }
  | { ok: false; koda: 'stranka' | 'podjetje' };

export interface ZahtevaPosiljanja {
  id: string;
  /** companies.company_id */
  podjetje: string;
  kanal: Kanal;
  /** Telefon ali e-naslov, prebran na strežniku z uporabnikovo sejo (RLS). Nikoli od modela. */
  prejemnik: string;
  besedilo: string;
  /** Samo e-pošta. */
  zadeva: string | null;
  /** Ime salona za pošiljatelja e-pošte. */
  imeSalona: string;
  jezik: 'sl' | 'en' | 'de' | 'it' | 'hr';
  idStranke: string;
  idTermina: string;
}

/**
 * poslano: ponudnik je sprejel sporočilo.
 * neznano: n8n ni odgovoril pravočasno — morda je bilo poslano, zato NE pošiljamo znova.
 */
export type IzidPosiljanja =
  | { status: 'poslano' }
  | { status: 'kvota' | 'blokirano' | 'napaka' | 'neznano'; razlog: string };

export interface PosiljateljSporocil {
  rezerviraj(p: {
    podjetje: string; userId: string; ukazId: string | null; idStranke: string; idTermina: string; kanal: Kanal; dolzina: number;
  }): Promise<RezervacijaSporocila>;
  poslji(z: ZahtevaPosiljanja): Promise<IzidPosiljanja>;
}
