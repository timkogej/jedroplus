// lib/glas/orodja/stranke.ts
//
// Razreševanje stranke po imenu za vsa orodja. Pri več podobnih imenih ne
// ugibamo: vrnemo vprašanje z možnostmi (ime + zadnji obisk, brez telefona).

import { poisci } from '../razresevanje/imena';
import { opisDatuma } from '../razresevanje/datumi';
import type { RezultatOrodja, StrankaPovzetek } from '../tipi';
import type { OkoljeOrodja } from './tipi';

/**
 * ID stranke: številke (1234567) ali s predpono (AB-123456, ABC-12345).
 * V bazi je oboje; preverjanje mora sprejeti obe obliki.
 */
export const ID_STRANKE = /^[A-Za-z0-9][A-Za-z0-9-]{0,23}$/;

export function oznakaStranke(s: StrankaPovzetek, danes: string): string {
  const ime = `${s.ime} ${s.priimek}`.trim() || `stranka ${s.id}`;
  // Pri istoimenskih strankah mora biti razlika vidna tudi brez obiska.
  return s.zadnjaInterakcija ? `${ime} (zadnjič ${opisDatuma(s.zadnjaInterakcija, danes)})` : `${ime} (še brez obiska)`;
}

export type RazresenaStranka = { stranka: StrankaPovzetek } | { odgovor: RezultatOrodja };

export async function razresiStranko(
  poizvedba: string,
  idStranke: string | null,
  o: OkoljeOrodja
): Promise<RazresenaStranka> {
  if (idStranke) {
    // Preverjeno z uporabnikovo sejo (RLS): tuj ID vrne null.
    const s = await o.podatki.stranka(idStranke);
    if (s) return { stranka: s };
    return { odgovor: { sporocilo: 'Te stranke ne najdem.' } };
  }
  const vse = await o.podatki.stranke();
  const izid = poisci(poizvedba, vse, (s) => [s.ime, s.priimek]);
  if (izid.izid === 'enolicno') return { stranka: izid.najden };
  if (izid.izid === 'nic') {
    return { odgovor: { sporocilo: `Stranke z imenom »${poizvedba}« ne najdem.` } };
  }
  return {
    odgovor: {
      sporocilo: `Najdenih je več strank za »${poizvedba}«. Katero imate v mislih?`,
      vprasanje: {
        besedilo: 'Katero stranko?',
        moznosti: izid.kandidati.map((k) => ({ id: k.vrednost.id, oznaka: oznakaStranke(k.vrednost, o.danes) })),
      },
      podatki: izid.kandidati.map((k) => ({ id: k.vrednost.id, ime: k.vrednost.ime, priimek: k.vrednost.priimek })),
    },
  };
}
