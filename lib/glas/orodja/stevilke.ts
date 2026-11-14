// lib/glas/orodja/stevilke.ts
//
// Številke salona za lastnika: zaslužek po ceniku, termini, storitve, zaposleni,
// neprihodi in primerjava s prejšnjim obdobjem. Isti izračun kot stran Analitika
// (lib/analytics/izracun.ts), zato se številke ujemajo.
//
// Varovalke (Timove odločitve 14. 11. 2026):
//   * samo lastnik: pravica 'analitika.lastnik' (pravice.ts) — orodje drugim
//     modelu sploh ni ponujeno; tukaj vlogo preverimo še enkrat;
//   * številke samo na zaslonu: govor reče le, da so na zaslonu;
//   * zaslužek je po ceniku, ne dejanska plačila — to piše na zaslonu;
//   * številke ne gredo v dnevnik ukazov (zasebno) in ne modelu.

import { z } from 'zod';
import { izracunajObdobje, zgradiCenik, type IzracunObdobja } from '@/lib/analytics/izracun';
import { dodajDni, danVTednu } from '../razresevanje/datumi';
import { poisci } from '../razresevanje/imena';
import type { RezultatOrodja } from '../tipi';
import type { BralnoOrodje, OkoljeOrodja } from './tipi';
import { jt } from '../jeziki/t';
import { trenutniJezik } from '../jeziki/jezik';

export const OBDOBJA = ['danes', 'vceraj', 'ta_teden', 'prejsnji_teden', 'ta_mesec', 'prejsnji_mesec', 'mesec', 'zadnjih_30', 'letos', 'lani', 'od_do'] as const;
export type Obdobje = (typeof OBDOBJA)[number];
const KAJ = ['pregled', 'zasluzek', 'termini', 'storitve', 'zaposleni', 'neprihodi'] as const;
type Kaj = (typeof KAJ)[number];

export interface Razpon {
  od: string;
  do: string;
  /** Primerjalno obdobje: prejšnje enako dolgo; pri tekočem obdobju do istega dne. */
  prej: { od: string; do: string };
  /** Obdobje še teče (vsebuje danes). */
  tece: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const zadnjiDanMeseca = (l: number, m: number) => new Date(Date.UTC(l, m, 0)).getUTCDate();
const datum = (l: number, m: number, d: number) => `${l}-${pad(m)}-${pad(Math.min(d, zadnjiDanMeseca(l, m)))}`;
const razlika = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/** Mesec [l, m] in prejšnji, pri tekočem do istega dne v mesecu. */
function mesecRazpon(l: number, m: number, danes: string): Razpon {
  const od = datum(l, m, 1);
  const doo = datum(l, m, 31);
  const tece = od <= danes && danes <= doo;
  const [pl, pm] = m === 1 ? [l - 1, 12] : [l, m - 1];
  const dan = tece ? Number(danes.slice(8, 10)) : 31;
  return { od, do: doo, tece, prej: { od: datum(pl, pm, 1), do: datum(pl, pm, dan) } };
}

/** Obdobje v pasu salona. `mesec` (1–12) in `leto` samo pri obdobju 'mesec'. */
export function razponObdobja(o: { obdobje: Obdobje; mesec?: number | null; leto?: number | null; od?: string | null; do?: string | null }, danes: string): Razpon | null {
  const [l, m] = [Number(danes.slice(0, 4)), Number(danes.slice(5, 7))];
  const zamik = (od: string, doo: string): Razpon => {
    const dni = razlika(od, doo) + 1;
    const tece = od <= danes && danes <= doo;
    const prejOd = dodajDni(od, -dni);
    return { od, do: doo, tece, prej: { od: prejOd, do: tece ? dodajDni(prejOd, razlika(od, danes)) : dodajDni(od, -1) } };
  };
  switch (o.obdobje) {
    case 'danes':
      return zamik(danes, danes);
    case 'vceraj':
      return zamik(dodajDni(danes, -1), dodajDni(danes, -1));
    case 'ta_teden': {
      const pon = dodajDni(danes, -danVTednu(danes));
      return zamik(pon, dodajDni(pon, 6));
    }
    case 'prejsnji_teden': {
      const pon = dodajDni(danes, -danVTednu(danes) - 7);
      return zamik(pon, dodajDni(pon, 6));
    }
    case 'ta_mesec':
      return mesecRazpon(l, m, danes);
    case 'prejsnji_mesec':
      return m === 1 ? mesecRazpon(l - 1, 12, danes) : mesecRazpon(l, m - 1, danes);
    case 'mesec': {
      if (!o.mesec || o.mesec < 1 || o.mesec > 12) return null;
      // "oktober" brez leta: zadnji tak mesec, ki ni v prihodnosti.
      const leto = o.leto ?? (o.mesec > m ? l - 1 : l);
      return mesecRazpon(leto, o.mesec, danes);
    }
    case 'zadnjih_30':
      return zamik(dodajDni(danes, -29), danes);
    case 'letos': {
      const r: Razpon = { od: `${l}-01-01`, do: `${l}-12-31`, tece: true, prej: { od: `${l - 1}-01-01`, do: `${l - 1}${danes.slice(4)}` } };
      if (r.prej.do.endsWith('02-29')) r.prej.do = `${l - 1}-02-28`;
      return r;
    }
    case 'lani':
      return { od: `${l - 1}-01-01`, do: `${l - 1}-12-31`, tece: false, prej: { od: `${l - 2}-01-01`, do: `${l - 2}-12-31` } };
    case 'od_do': {
      const ok = (x: string | null | undefined) => Boolean(x && /^\d{4}-\d{2}-\d{2}$/.test(x));
      if (!ok(o.od) || !ok(o.do) || o.od! > o.do! || razlika(o.od!, o.do!) > 366) return null;
      return zamik(o.od!, o.do!);
    }
  }
}

const LOKALE: Record<string, string> = { sl: 'sl-SI', en: 'en-GB', de: 'de-DE', it: 'it-IT', hr: 'hr-HR' };
const lokale = () => LOKALE[trenutniJezik()] ?? 'sl-SI';
const evri = (n: number) => new Intl.NumberFormat(lokale(), { style: 'currency', currency: 'EUR' }).format(n).replace(/[\u00a0\u202f]/g, ' ');
const dm = (d: string) => `${Number(d.slice(8, 10))}. ${Number(d.slice(5, 7))}.`;

/** "november 2026" za cel mesec, sicer "1. 11.–14. 11. 2026". */
export function oznakaObdobja(od: string, doo: string): string {
  if (od.slice(8) === '01' && doo.slice(0, 7) === od.slice(0, 7) && Number(doo.slice(8)) === zadnjiDanMeseca(Number(od.slice(0, 4)), Number(od.slice(5, 7)))) {
    return new Intl.DateTimeFormat(lokale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${od}T12:00:00Z`));
  }
  if (od === doo) return `${dm(od)} ${od.slice(0, 4)}`;
  return `${dm(od)}–${dm(doo)} ${doo.slice(0, 4)}`;
}

function sprememba(zdaj: number, prej: number): string | null {
  if (prej <= 0) return null;
  const p = Math.round(((zdaj - prej) / prej) * 100);
  return p === 0 ? jt('enako') : `${p > 0 ? '+' : '−'}${Math.abs(p)} %`;
}

export function besediloStevilk(r: IzracunObdobja, prej: IzracunObdobja | null, raz: Razpon, kaj: Kaj, lokacija: string | null): RezultatOrodja {
  const vrstice: string[] = [];
  const naslov = `${oznakaObdobja(raz.od, raz.do)}${lokacija ? ` · ${lokacija}` : ''}`;
  vrstice.push(naslov);
  const zasluzek = `${jt('Zaslužek po ceniku')}: ${evri(r.zasluzek)}${r.zakljuceni < r.opravljeni ? ` (${jt('od tega zaključeni')}: ${evri(r.zasluzekZakljuceni)})` : ''}`;
  const termini = `${jt('Opravljeni termini')}: ${r.opravljeni}${r.zakljuceni < r.opravljeni ? ` (${jt('zaključenih')}: ${r.zakljuceni})` : ''}`;
  const neprihodi = `${jt('Neprihodi')}: ${r.neprihodi} · ${jt('Odpovedani')}: ${r.odpovedani}`;
  const storitve = r.storitve.length
    ? `${jt('Najbolj prodajane storitve')}: ${r.storitve.slice(0, 3).map((s) => `${s.naziv} ${s.stevilo}× (${evri(s.znesek)})`).join(', ')}`
    : `${jt('Najbolj prodajane storitve')}: —`;
  const osebe = r.osebe.length
    ? `${jt('Najbolj zasedeni')}: ${r.osebe.slice(0, 3).map((o) => `${o.ime} ${o.stevilo}×`).join(', ')}`
    : `${jt('Najbolj zasedeni')}: —`;
  const prvi: Record<Kaj, string> = { pregled: zasluzek, zasluzek, termini, storitve, zaposleni: osebe, neprihodi };
  vrstice.push(prvi[kaj], ...[zasluzek, termini, storitve, osebe, neprihodi].filter((x) => x !== prvi[kaj]));
  if (prej) {
    const z = sprememba(r.zasluzek, prej.zasluzek);
    const t = sprememba(r.opravljeni, prej.opravljeni);
    const opis = `${oznakaObdobja(prej.od, prej.do)}${raz.tece ? `, ${jt('do istega dne')}` : ''}`;
    vrstice.push(
      `${jt('Primerjava z obdobjem {obdobje}', { obdobje: opis })}: ${jt('zaslužek')} ${evri(prej.zasluzek)}${z ? ` (${z})` : ''}, ${jt('termini')} ${prej.opravljeni}${t ? ` (${t})` : ''}`
    );
  }
  vrstice.push(jt('Po ceniku storitev, ne dejanska plačila. Šteti so zaključeni in že končani termini, ki niso odpovedani.'));
  return {
    sporocilo: vrstice.join('\n'),
    govor: jt('Številke so na zaslonu.'),
    // Številke ne gredo v dnevnik ukazov in ne modelu (samo lastnik jih vidi na zaslonu).
    zasebno: { dnevnik: `stevilke ${raz.od}..${raz.do} (${kaj})` },
    podatki: { obdobje: { od: raz.od, do: raz.do } },
  };
}

type Vhod = {
  obdobje: Obdobje;
  mesec: number | null;
  leto: number | null;
  od: string | null;
  do: string | null;
  kaj: Kaj | null;
  lokacija: string | null;
};

export const stevilkeSalona: BralnoOrodje<Vhod> = {
  ime: 'stevilke_salona',
  opis:
    'Številke salona za lastnika: zaslužek po ceniku, število opravljenih terminov, najbolj prodajane storitve, najbolj zasedeni zaposleni, neprihodi in primerjava s prejšnjim obdobjem ("koliko sem zaslužila ta mesec", "koliko terminov je bilo prejšnji teden", "katera storitev gre najbolj", "kako je oktober v primerjavi s septembrom"). Številke se pokažejo samo na zaslonu.',
  razred: 'branje',
  pravica: 'analitika.lastnik',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      obdobje: { type: 'string', enum: [...OBDOBJA], description: 'mesec = imenovan mesec (podaj mesec in po potrebi leto); od_do = poljubno obdobje (podaj od in do).' },
      mesec: { type: ['integer', 'null'], description: 'Pri obdobju "mesec": 1–12.' },
      leto: { type: ['integer', 'null'], description: 'Pri obdobju "mesec", če je povedano.' },
      od: { type: ['string', 'null'], description: 'Pri od_do: YYYY-MM-DD.' },
      do: { type: ['string', 'null'], description: 'Pri od_do: YYYY-MM-DD.' },
      kaj: { type: ['string', 'null'], enum: [...KAJ, null], description: 'Kaj uporabnika najbolj zanima; null = pregled.' },
      lokacija: { type: ['string', 'null'], description: 'Ime lokacije, če jo je povedal; sicer null (vse lokacije).' },
    },
    required: ['obdobje', 'mesec', 'leto', 'od', 'do', 'kaj', 'lokacija'],
    additionalProperties: false,
  },
  vhod: z.object({
    obdobje: z.enum(OBDOBJA),
    mesec: z.number().int().min(1).max(12).nullable(),
    leto: z.number().int().min(2000).max(2100).nullable(),
    od: z.string().max(10).nullable(),
    do: z.string().max(10).nullable(),
    kaj: z.enum(KAJ).nullable(),
    lokacija: z.string().max(80).nullable(),
  }),
  async izvedi(p, o: OkoljeOrodja) {
    // Druga varovalka: orodje drugim sploh ni ponujeno, a vlogo preverimo še enkrat.
    if (o.k.vloga !== 'owner') return { sporocilo: jt('Številke salona vidi samo lastnik.') };
    const raz = razponObdobja(p, o.danes);
    if (!raz) return { sporocilo: jt('Obdobja ne razumem. Povejte npr. »ta mesec« ali »oktober«.') };
    if (raz.od > o.danes) return { sporocilo: jt('To obdobje je še v prihodnosti.') };

    let lokacijaId: string | null = null;
    let lokacija: string | null = null;
    if (p.lokacija?.trim()) {
      const L = await o.podatki.lokacije();
      const izid = poisci(p.lokacija, L.seznam, (x) => [x.naziv]);
      if (izid.izid !== 'enolicno') {
        return { sporocilo: jt('Lokacije »{lokacija}« ne najdem. Lokacije: {lokacije}.', { lokacija: p.lokacija, lokacije: L.seznam.map((x) => x.naziv).join(', ') }) };
      }
      lokacijaId = izid.najden.id;
      lokacija = izid.najden.naziv;
    }

    const od = raz.prej.od < raz.od ? raz.prej.od : raz.od;
    const v = await o.podatki.analitika(od, raz.do);
    const cenik = zgradiCenik(v.storitve, v.osebe);
    const vrstice = lokacijaId ? v.termini.filter((r) => r['lokacija_id'] === lokacijaId) : v.termini;
    const zdaj = `${o.danes} ${o.uraZdaj}`;
    const r = izracunajObdobje(vrstice, cenik, { od: raz.od, do: raz.do, zdaj });
    const prej = izracunajObdobje(vrstice, cenik, { od: raz.prej.od, do: raz.prej.do, zdaj });
    return besediloStevilk(r, prej.termini > 0 ? prej : null, raz, p.kaj ?? 'pregled', lokacija);
  },
};
