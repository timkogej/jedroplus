// lib/glas/orodja/stranke.ts
//
// Razreševanje stranke po imenu za vsa orodja. Pri več podobnih imenih ne
// ugibamo: vrnemo vprašanje z možnostmi (ime + zadnji obisk, brez telefona).

import { poisci } from '../razresevanje/imena';
import { opisDatuma } from '../razresevanje/datumi';
import type { RezultatOrodja, StrankaPovzetek } from '../tipi';
import type { OkoljeOrodja } from './tipi';
import { jt } from '../jeziki/t';

/**
 * ID stranke: številke (1234567) ali s predpono (AB-123456, ABC-12345).
 * V bazi je oboje; preverjanje mora sprejeti obe obliki.
 */
export const ID_STRANKE = /^[A-Za-z0-9][A-Za-z0-9-]{0,23}$/;

export function oznakaStranke(s: StrankaPovzetek, danes: string): string {
  const ime = `${s.ime} ${s.priimek}`.trim() || jt('stranka {id}', { id: s.id });
  // Pri istoimenskih strankah mora biti razlika vidna tudi brez obiska.
  return s.zadnjaInterakcija
    ? jt('{ime} (zadnjič {datum})', { ime, datum: opisDatuma(s.zadnjaInterakcija, danes) })
    : jt('{ime} (še brez obiska)', { ime });
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
    if (!s) return { odgovor: { sporocilo: jt('Te stranke ne najdem.') } };
    // ID je lahko iz fokusa (aktivna stranka), ime pa novo ("ne, za Ano Novak"):
    // če ime nedvoumno pomeni drugo stranko, velja ime. Zaimek ("ona") ali isto ime → ID.
    const izid = poizvedba.trim() ? poisci(poizvedba, await o.podatki.stranke(), (x) => [x.ime, x.priimek]) : null;
    if (izid?.izid === 'enolicno' && izid.najden.id !== s.id) return { stranka: izid.najden };
    if (izid?.izid === 'vec' && !izid.kandidati.some((k) => k.vrednost.id === s.id)) return vecStrank(poizvedba, izid.kandidati.map((k) => k.vrednost), o);
    return { stranka: s };
  }
  const vse = await o.podatki.stranke();
  const izid = poisci(poizvedba, vse, (s) => [s.ime, s.priimek]);
  if (izid.izid === 'enolicno') return { stranka: izid.najden };
  if (izid.izid === 'nic') {
    return { odgovor: { sporocilo: jt('Stranke z imenom »{ime}« ne najdem.', { ime: poizvedba }) } };
  }
  return vecStrank(poizvedba, izid.kandidati.map((k) => k.vrednost), o);
}

function vecStrank(poizvedba: string, kandidati: StrankaPovzetek[], o: OkoljeOrodja): RazresenaStranka {
  return {
    odgovor: {
      sporocilo: jt('Najdenih je več strank za »{ime}«. Katero imate v mislih?', { ime: poizvedba }),
      vprasanje: {
        besedilo: jt('Katero stranko?'),
        moznosti: kandidati.map((k) => ({ id: k.id, oznaka: oznakaStranke(k, o.danes) })),
      },
      podatki: kandidati.map((k) => ({ id: k.id, ime: k.ime, priimek: k.priimek })),
    },
  };
}
