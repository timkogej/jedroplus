// lib/glas/orodja/registry.ts
//
// Seznam vseh orodij asistenta. Novo orodje: nova datoteka v lib/glas/orodja/
// in ena vrstica tukaj. Jedro iz registra samo izbere orodja, ki jih uporabnik
// sme uporabljati in so omogočena.

import { imaPravico } from '../pravice';
import type { Kontekst } from '../tipi';
import { iskanjeStranke, koledarDan, prviProsti, zadnjiObisk } from './branje';
import { prekliciTermin, premakniTermin, ustvariTermin } from './rezervirano';
import type { Orodje } from './tipi';
import { dodajZapisek } from './zapiski';
import { karticaStranke, neaktivneStranke, podatkiStranke, zadnjaBarva } from './kartica';
import { kdoDela, naslednjaStranka, prosteLuknjeOrodje, resursiDan } from './pregled';
import { povzetekDneva } from './povzetek';
import { stevilkeSalona } from './stevilke';
import { sporociStranki } from './sporocila';
import { kandidatiZaLuknjo, ponudiProstiTermin } from './zapolnitev';
import { prekliciOpomnik, mojiOpomniki, novOpomnik } from './opomniki';
import { odpriStran, pomocAplikacija } from './pomoc';
import { novaStranka, prestaviTermin, pripraviTermin, statusTermina, urediStranko, urediTermin, vpisiOdsotnost } from './obrazci';
import { pripraviSerijo } from './serija';

export const VSA_ORODJA: readonly Orodje[] = [
  iskanjeStranke,
  zadnjiObisk,
  koledarDan,
  povzetekDneva,
  stevilkeSalona,
  sporociStranki,
  kandidatiZaLuknjo,
  ponudiProstiTermin,
  novOpomnik,
  mojiOpomniki,
  prekliciOpomnik,
  prviProsti,
  naslednjaStranka,
  prosteLuknjeOrodje,
  kdoDela,
  resursiDan,
  karticaStranke,
  podatkiStranke,
  zadnjaBarva,
  neaktivneStranke,
  pomocAplikacija,
  odpriStran,
  pripraviTermin,
  pripraviSerijo,
  prestaviTermin,
  urediTermin,
  urediStranko,
  statusTermina,
  vpisiOdsotnost,
  novaStranka,
  dodajZapisek,
  // faza 2 — onemogočeno
  ustvariTermin,
  premakniTermin,
  prekliciTermin,
];

/** Preveri register ob zagonu: unikatna imena, pisalna orodja imajo predogled in potrditev. */
export function preveriRegister(orodja: readonly Orodje[] = VSA_ORODJA): void {
  const imena = new Set<string>();
  for (const o of orodja) {
    if (imena.has(o.ime)) throw new Error(`Podvojeno orodje: ${o.ime}`);
    imena.add(o.ime);
    if (!/^[a-z_]{3,40}$/.test(o.ime)) throw new Error(`Neveljavno ime orodja: ${o.ime}`);
    if (o.razred !== 'branje' && (typeof o.predogled !== 'function' || typeof o.potrdi !== 'function')) {
      throw new Error(`Pisalno orodje brez predogleda/potrditve: ${o.ime}`);
    }
    if (o.shema.additionalProperties !== false) throw new Error(`Shema mora prepovedati dodatna polja: ${o.ime}`);
  }
}

/** Orodja, ki jih ta uporabnik lahko uporabi zdaj. */
export function orodjaZa(k: Pick<Kontekst, 'vloga' | 'pravice'>, orodja: readonly Orodje[] = VSA_ORODJA): Orodje[] {
  return orodja.filter((o) => o.omogoceno && imaPravico(k, o.pravica));
}

export function poImenu(ime: string, orodja: readonly Orodje[] = VSA_ORODJA): Orodje | undefined {
  return orodja.find((o) => o.ime === ime);
}
