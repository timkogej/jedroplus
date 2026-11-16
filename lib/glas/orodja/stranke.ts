// lib/glas/orodja/stranke.ts
//
// Razreševanje stranke po imenu za vsa orodja. Pri več podobnih imenih ne
// ugibamo: vrnemo vprašanje z možnostmi (ime + zadnji obisk, brez telefona).

import { poisci } from '../razresevanje/imena';
import { dodajDni, opisDatuma, vMinute } from '../razresevanje/datumi';
import { brezSumnikov } from '../razresevanje/besedilo';
import type { RezultatOrodja, StrankaPovzetek, TerminPovzetek } from '../tipi';
import type { OkoljeOrodja } from './tipi';
import { jt } from '../jeziki/t';

/**
 * ID stranke: številke (1234567) ali s predpono (AB-123456, ABC-12345).
 * V bazi je oboje; preverjanje mora sprejeti obe obliki.
 */
export const ID_STRANKE = /^[A-Za-z0-9][A-Za-z0-9-]{0,23}$/;

/** Zadnji in naslednji termin stranke iz koledarja (ne iz zastarele »Zadnje interakcije«). */
export interface TerminiStranke {
  zadnji: TerminPovzetek | null;
  naslednji: TerminPovzetek | null;
}

export function oznakaStranke(s: StrankaPovzetek, danes: string, t?: TerminiStranke): string {
  const ime = `${s.ime} ${s.priimek}`.trim() || jt('stranka {id}', { id: s.id });
  if (t) {
    // Naslednji termin je za uporabnika najbolj prepoznaven (»Ana, ki pride jutri«).
    if (t.naslednji) return jt('{ime} (naslednjič {datum})', { ime, datum: opisDatuma(t.naslednji.datum, danes) });
    if (t.zadnji) return jt('{ime} (zadnjič {datum})', { ime, datum: opisDatuma(t.zadnji.datum, danes) });
  }
  // Pri istoimenskih strankah mora biti razlika vidna tudi brez obiska.
  return s.zadnjaInterakcija
    ? jt('{ime} (zadnjič {datum})', { ime, datum: opisDatuma(s.zadnjaInterakcija, danes) })
    : jt('{ime} (še brez obiska)', { ime });
}

/** Termin se je že začel (danes je ura mimo začetka) — za govor je pretekel, ne »naslednji«. */
export function zeMinil(t: TerminPovzetek, danes: string, uraZdaj: string): boolean {
  return t.datum < danes || (t.datum === danes && vMinute(t.zacetek) <= vMinute(uraZdaj));
}

/**
 * Zadnji in naslednji termin glede na TRENUTNO uro (Tim, 16. 11.: ob 18.53 je termin ob 11.00
 * zadnji, ne »naslednjič danes ob 11.00«). Baza loči samo po dnevu, današnje razdelimo po uri.
 */
export async function zadnjiInNaslednji(o: OkoljeOrodja, s: StrankaPovzetek, danasnji?: TerminPovzetek[]): Promise<TerminiStranke> {
  const [zadnji, naslednji, dan] = await Promise.all([
    o.podatki.zadnjiTermin(s.id, o.danes),
    o.podatki.naslednjiTermin(s.id, o.danes),
    danasnji ? Promise.resolve(danasnji) : o.podatki.termini(o.danes, o.danes),
  ]);
  const zacetek = (t: TerminPovzetek) => vMinute(t.zacetek);
  const moji = dan
    .filter((t) => terminJeStranke(t, s) && t.status !== 'cancelled' && t.status !== 'no_show')
    .sort((a, b) => zacetek(a) - zacetek(b));
  const minuli = moji.filter((t) => zeMinil(t, o.danes, o.uraZdaj));
  const prihajajoci = moji.filter((t) => !zeMinil(t, o.danes, o.uraZdaj) && (t.status === 'scheduled' || t.status === 'confirmed'));
  let nasl = naslednji;
  if (nasl && nasl.datum === o.danes) {
    nasl = prihajajoci[0] ?? (await o.podatki.naslednjiTermin(s.id, dodajDni(o.danes, 1)));
  }
  return { zadnji: minuli[minuli.length - 1] ?? zadnji, naslednji: nasl };
}

/**
 * Vzorec za »isto kot zadnjič / kot danes / ponovi termin«: današnji termin stranke (tudi
 * kasneje danes; že začet ima prednost), sicer zadnji pretekli, sicer prvi prihodnji.
 * Prej je veljal samo termin PRED današnjim dnem (Tim, 16. 11.: »enako kot je imel danes« → ni storitve).
 */
export async function vzorcniTermin(o: OkoljeOrodja, s: StrankaPovzetek): Promise<TerminPovzetek | null> {
  const [dan, zadnji] = await Promise.all([o.podatki.termini(o.danes, o.danes), o.podatki.zadnjiTermin(s.id, o.danes)]);
  const danes = dan
    .filter((t) => terminJeStranke(t, s) && t.status !== 'cancelled' && t.status !== 'no_show')
    .sort((a, b) => vMinute(a.zacetek) - vMinute(b.zacetek));
  const zacet = danes.filter((t) => zeMinil(t, o.danes, o.uraZdaj));
  return zacet[zacet.length - 1] ?? danes[0] ?? zadnji ?? (await o.podatki.naslednjiTermin(s.id, o.danes));
}

/** Zadnji in naslednji termin za nekaj strank hkrati (iskanje, izbira med istoimenskimi). */
export async function terminiStrank(o: OkoljeOrodja, stranke: StrankaPovzetek[]): Promise<Map<string, TerminiStranke>> {
  const danasnji = await o.podatki.termini(o.danes, o.danes);
  const pari = await Promise.all(stranke.slice(0, 6).map(async (s) => [s.id, await zadnjiInNaslednji(o, s, danasnji)] as const));
  return new Map(pari);
}

const polnoIme = (x: string) => brezSumnikov(x).replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');

/**
 * Ali je termin od te stranke: po ID-ju, ali (termin brez ID stranke, npr. star
 * ali vnesen ročno) po enakem imenu in priimku. Termin, vezan na drugo stranko, ni njen.
 */
export function terminJeStranke(t: TerminPovzetek, s: StrankaPovzetek): boolean {
  if (t.idStranke) return t.idStranke === s.id;
  const ime = polnoIme(`${s.ime} ${s.priimek}`);
  return ime.includes(' ') && polnoIme(t.stranka) === ime;
}

export type RazresenaStranka = { stranka: StrankaPovzetek } | { odgovor: RezultatOrodja };

export async function razresiStranko(
  poizvedba: string,
  idStranke: string | null,
  o: OkoljeOrodja
): Promise<RazresenaStranka> {
  const r = await razresi(poizvedba, idStranke, o);
  // O tej stranki se pogovarjamo naprej, tudi če orodje potem ne uspe.
  if ('stranka' in r) o.razresena = r.stranka.id;
  return r;
}

async function razresi(poizvedba: string, idStranke: string | null, o: OkoljeOrodja): Promise<RazresenaStranka> {
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

async function vecStrank(poizvedba: string, kandidati: StrankaPovzetek[], o: OkoljeOrodja): Promise<RazresenaStranka> {
  const termini = await terminiStrank(o, kandidati);
  // Dvojnik iste stranke (isto ime in priimek): velja zapis, ki ima prihodnji termin, če je tak en sam.
  const imena = new Set(kandidati.map((k) => polnoIme(`${k.ime} ${k.priimek}`)));
  if (imena.size === 1 && [...imena][0].includes(' ')) {
    const sTerminom = kandidati.filter((k) => termini.get(k.id)?.naslednji);
    if (sTerminom.length === 1) return { stranka: sTerminom[0] };
  }
  return {
    odgovor: {
      sporocilo: jt('Najdenih je več strank za »{ime}«. Katero imate v mislih?', { ime: poizvedba }),
      vprasanje: {
        besedilo: jt('Katero stranko?'),
        moznosti: kandidati.map((k) => ({ id: k.id, oznaka: oznakaStranke(k, o.danes, termini.get(k.id)) })),
      },
      podatki: kandidati.map((k) => ({ id: k.id, ime: k.ime, priimek: k.priimek })),
    },
  };
}
