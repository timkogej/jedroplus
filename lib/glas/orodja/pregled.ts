// lib/glas/orodja/pregled.ts
//
// Faza 2 — bralna orodja za pregled dneva: naslednja stranka, proste luknje,
// kdo dela, zasedenost resursov. Vse gre z uporabnikovo sejo (RLS); "samo svoji
// termini" za zaposlene vsilimo tukaj (kot v koledar_dan).

import { z } from 'zod';
import { samoSvojiTermini } from '../pravice';
import { dodajDni, izMinut, vMinute } from '../razresevanje/datumi';
import { poisci } from '../razresevanje/imena';
import { delovniBrezOdsotnosti, prosteLuknje, razcleniUrnik, urnikOsebe } from '../razresevanje/urnik';
import { datumZaGovor, NAJVEC_NA_GLAS, razponZaGovor, uraZaGovor } from '../govor';
import type { OsebaPovzetek, RezultatOrodja, TerminPovzetek } from '../tipi';
import { cap, datumIzParametra } from './branje';
import type { BralnoOrodje, OkoljeOrodja } from './tipi';

const aktiven = (t: TerminPovzetek) => t.status !== 'cancelled' && t.status !== 'no_show';
const razpon = (a: number, b: number) => `${izMinut(a)}–${izMinut(b)}`;
const imeOsebe = (p: OsebaPovzetek) => `${p.ime} ${p.priimek}`.trim();

/** Ali uporabnik gleda samo svoje termine; null + napaka, če mora, a ni povezan z zaposlenim. */
function svojiAliNapaka(o: OkoljeOrodja, zelja: boolean | null): { svoji: boolean } | { napaka: RezultatOrodja } {
  const vsili = samoSvojiTermini(o.k);
  if (vsili && !o.k.osebaId) return { napaka: { sporocilo: 'Vaš račun ni povezan z zaposlenim, zato ne vidim vaših terminov.' } };
  return { svoji: Boolean(o.k.osebaId) && (vsili || (zelja ?? true)) };
}

/** Datum iz parametra; null = danes. Napačen izraz → napaka za uporabnika. */
function dan(datum: string | null, o: OkoljeOrodja): string | RezultatOrodja {
  const d = datumIzParametra(datum, o.danes) ?? (datum ? null : o.danes);
  return d ?? { sporocilo: `Datuma »${datum}« ne razumem. Povejte npr. »jutri« ali »v petek«.` };
}

/** Zaposleni po imenu (ali vsi aktivni). */
function izberiOsebe(
  oseba: string | null,
  osebe: OsebaPovzetek[],
  o: OkoljeOrodja
): OsebaPovzetek[] | RezultatOrodja {
  const aktivne = osebe.filter((p) => p.aktivna);
  if (oseba) {
    const izid = poisci(oseba, aktivne, (p) => [p.ime, p.priimek]);
    if (izid.izid === 'nic') return { sporocilo: `Zaposlenega »${oseba}« ne najdem.` };
    if (izid.izid === 'vec') {
      return {
        sporocilo: `Koga imate v mislih? ${izid.kandidati.map((k) => imeOsebe(k.vrednost)).join(', ')}.`,
        vprasanje: { besedilo: 'Katerega zaposlenega?', moznosti: izid.kandidati.map((k) => ({ id: k.vrednost.id, oznaka: imeOsebe(k.vrednost) })) },
      };
    }
    if (samoSvojiTermini(o.k) && izid.najden.id !== o.k.osebaId) return { sporocilo: 'Vidite lahko samo svoj urnik.' };
    return [izid.najden];
  }
  return aktivne;
}

// ───────────────────────────────────────────────────────────────────────────
export const naslednjaStranka: BralnoOrodje<{ samo_moji: boolean | null }> = {
  ime: 'naslednja_stranka',
  opis: 'Kdo je naslednja stranka (prvi termin od zdaj naprej, danes ali v naslednjih dneh).',
  razred: 'branje',
  pravica: 'termini.branje',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      samo_moji: { type: ['boolean', 'null'], description: 'true = moji termini ("kdo je moja naslednja"), false = celoten salon; null = privzeto.' },
    },
    required: ['samo_moji'],
    additionalProperties: false,
  },
  vhod: z.object({ samo_moji: z.boolean().nullable() }),
  async izvedi({ samo_moji }, o) {
    const s = svojiAliNapaka(o, samo_moji);
    if ('napaka' in s) return s.napaka;
    const termini = (await o.podatki.termini(o.danes, dodajDni(o.danes, 7)))
      .filter(aktiven)
      .filter((t) => t.status !== 'completed')
      .filter((t) => !s.svoji || t.osebaId === o.k.osebaId)
      .filter((t) => t.datum > o.danes || vMinute(t.zacetek) >= vMinute(o.uraZdaj))
      .sort((a, b) => a.datum.localeCompare(b.datum) || vMinute(a.zacetek) - vMinute(b.zacetek));
    const n = termini[0];
    if (!n) {
      const kdo = s.svoji ? 'Nimate' : 'Ni';
      return { sporocilo: `${kdo} terminov v naslednjih 7 dneh.`, podatki: { termin: null } };
    }
    const ime = n.stranka || 'stranka';
    const pri = !s.svoji && n.oseba ? `, pri ${n.oseba}` : '';
    const danesNi = n.datum !== o.danes ? `${s.svoji ? 'Danes nimate več terminov' : 'Danes ni več terminov'}. ` : '';
    return {
      sporocilo: `${danesNi}Naslednja: ${ime}, ${n.datum === o.danes ? 'danes' : datumZaGovor(n.datum, o.danes)} ob ${n.zacetek}${n.storitev ? `, ${n.storitev}` : ''}${pri}.`,
      govor: `${danesNi}Naslednja je ${ime}, ${n.datum === o.danes ? '' : `${datumZaGovor(n.datum, o.danes)} `}${uraZaGovor(n.zacetek)}${n.storitev ? `, ${n.storitev}` : ''}${pri}.`,
      podatki: { termin: { id: n.id, datum: n.datum, od: n.zacetek, do: n.konec, stranka: n.stranka, storitev: n.storitev, oseba: n.oseba } },
    };
  },
};

// ───────────────────────────────────────────────────────────────────────────
export const prosteLuknjeOrodje: BralnoOrodje<{ datum: string | null; oseba: string | null; najmanj_min: number | null }> = {
  ime: 'proste_luknje',
  opis: 'Prosti časi (luknje) v urniku na en dan: "kdaj imam danes prosto", "kje so luknje jutri", "ali ima Tina v petek kaj prostega". Okvirno, brez resursov.',
  razred: 'branje',
  pravica: 'termini.branje',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      datum: { type: ['string', 'null'], description: 'Izraz uporabnika ali YYYY-MM-DD; null = danes.' },
      oseba: { type: ['string', 'null'], description: 'Ime zaposlenega; null = uporabnik (če je zaposleni) ali vsi.' },
      najmanj_min: { type: ['integer', 'null'], description: 'Najkrajša luknja v minutah; null = 30.' },
    },
    required: ['datum', 'oseba', 'najmanj_min'],
    additionalProperties: false,
  },
  vhod: z.object({
    datum: z.string().max(60).nullable(),
    oseba: z.string().max(80).nullable(),
    najmanj_min: z.number().int().min(5).max(480).nullable(),
  }),
  async izvedi({ datum, oseba, najmanj_min }, o) {
    const d = dan(datum, o);
    if (typeof d !== 'string') return d;
    if (d < o.danes) return { sporocilo: 'Luknje iščem samo za danes in naprej.' };
    const [osebe, urnikSurov, termini, odsotnosti] = await Promise.all([
      o.podatki.osebe(),
      o.podatki.urnikPodjetja(),
      o.podatki.termini(d, d),
      o.podatki.odsotnosti(d, d),
    ]);
    let izbrane = izberiOsebe(oseba, osebe, o);
    if (!Array.isArray(izbrane)) return izbrane;
    if (!oseba && o.k.osebaId) {
      const jaz = izbrane.find((p) => p.id === o.k.osebaId);
      if (jaz) izbrane = [jaz];
    }
    if (!oseba && samoSvojiTermini(o.k) && !izbrane.some((p) => p.id === o.k.osebaId)) {
      return { sporocilo: 'Vaš račun ni povezan z zaposlenim.' };
    }
    const urnikPodjetja = razcleniUrnik(urnikSurov);
    const najmanj = najmanj_min ?? 30;
    const odMinute = d === o.danes ? Math.ceil(vMinute(o.uraZdaj) / 15) * 15 : 0;
    const zaOsebo = izbrane.map((p) => ({
      p,
      luknje: prosteLuknje({
        osebaId: p.id, urnik: urnikOsebe(p, urnikPodjetja), datum: d, odMinute, najmanjMin: najmanj,
        termini: termini.filter(aktiven), odsotnosti, casovniPas: o.k.casovniPas,
      }),
    }));
    const zLuknjami = zaOsebo.filter((x) => x.luknje.length > 0);
    const jaz = izbrane.length === 1 && izbrane[0].id === o.k.osebaId;
    const kdaj = datumZaGovor(d, o.danes);
    const podatki = { datum: d, osebe: zaOsebo.map((x) => ({ oseba: imeOsebe(x.p), luknje: x.luknje.map(([a, b]) => ({ od: izMinut(a), do: izMinut(b) })) })) };
    if (zLuknjami.length === 0) {
      const kdo = jaz ? 'nimate' : izbrane.length === 1 ? `${izbrane[0].ime} nima` : 'ni';
      return { sporocilo: `${cap(kdaj)} ${kdo} prostih lukenj (vsaj ${najmanj} min).`, govor: `${cap(kdaj)} ${kdo} prostega časa.`, podatki };
    }
    const vrstice = zLuknjami.map((x) => `${izbrane.length > 1 ? `${imeOsebe(x.p)}: ` : ''}${x.luknje.map(([a, b]) => razpon(a, b)).join(', ')}`);
    let preostalo = NAJVEC_NA_GLAS;
    const deli: string[] = [];
    for (const x of zLuknjami) {
      if (preostalo <= 0) break;
      const l = x.luknje.slice(0, preostalo);
      preostalo -= l.length;
      const casi = l.map(([a, b]) => razponZaGovor(izMinut(a), izMinut(b)));
      const seznam = casi.length > 1 ? `${casi.slice(0, -1).join(', ')} in ${casi.at(-1)}` : casi[0];
      deli.push(izbrane.length > 1 ? `${x.p.ime} ${seznam}` : seznam);
    }
    const vseh = zLuknjami.reduce((n, x) => n + x.luknje.length, 0);
    const vec = vseh > NAJVEC_NA_GLAS ? ' Ostale so na zaslonu.' : '';
    const uvod = jaz ? `${cap(kdaj)} imate prosto` : izbrane.length === 1 ? `${cap(kdaj)} ima ${izbrane[0].ime} prosto` : `${cap(kdaj)} je prosto`;
    return {
      sporocilo: `Proste luknje ${kdaj} (vsaj ${najmanj} min, okvirno):\n${vrstice.join('\n')}`,
      govor: `${uvod} ${deli.join('; ')}.${vec}`,
      podatki,
    };
  },
};

// ───────────────────────────────────────────────────────────────────────────
export const kdoDela: BralnoOrodje<{ datum: string | null }> = {
  ime: 'kdo_dela',
  opis: 'Kdo dela na dan in od kdaj do kdaj (urnik in odsotnosti): "kdo dela jutri", "ali Urška dela v soboto".',
  razred: 'branje',
  pravica: 'termini.branje',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: { datum: { type: ['string', 'null'], description: 'Izraz uporabnika ali YYYY-MM-DD; null = danes.' } },
    required: ['datum'],
    additionalProperties: false,
  },
  vhod: z.object({ datum: z.string().max(60).nullable() }),
  async izvedi({ datum }, o) {
    const d = dan(datum, o);
    if (typeof d !== 'string') return d;
    const [osebe, urnikSurov, odsotnosti] = await Promise.all([o.podatki.osebe(), o.podatki.urnikPodjetja(), o.podatki.odsotnosti(d, d)]);
    const urnikPodjetja = razcleniUrnik(urnikSurov);
    const dela: { p: OsebaPovzetek; od: number; do: number }[] = [];
    const odsotni: OsebaPovzetek[] = [];
    for (const p of osebe.filter((x) => x.aktivna)) {
      const r = delovniBrezOdsotnosti(p.id, urnikOsebe(p, urnikPodjetja), d, odsotnosti, o.k.casovniPas);
      if (r.dela.length) dela.push({ p, od: r.dela[0][0], do: r.dela.at(-1)![1] });
      else if (r.delovni.length) odsotni.push(p);
    }
    dela.sort((a, b) => a.od - b.od);
    const kdaj = datumZaGovor(d, o.danes);
    const podatki = {
      datum: d,
      dela: dela.map((x) => ({ oseba: imeOsebe(x.p), od: izMinut(x.od), do: izMinut(x.do) })),
      odsotni: odsotni.map(imeOsebe),
    };
    const ods = odsotni.length ? ` Odsotni: ${odsotni.map((p) => p.ime).join(', ')}.` : '';
    if (dela.length === 0) {
      return { sporocilo: `${cap(kdaj)} ne dela nihče.${ods}`, govor: `${cap(kdaj)} ne dela nihče.${ods}`, podatki };
    }
    const vrstice = dela.map((x) => `${imeOsebe(x.p)} ${razpon(x.od, x.do)}`);
    const naGlas = dela.slice(0, 6).map((x) => `${x.p.ime} ${razponZaGovor(izMinut(x.od), izMinut(x.do))}`);
    return {
      sporocilo: `${cap(kdaj)} dela${dela.length > 1 ? 'jo' : ''}:\n${vrstice.join('\n')}${ods}`,
      govor: `${cap(kdaj)} ${dela.length === 1 ? 'dela' : dela.length === 2 ? 'delata' : 'delajo'} ${naGlas.join(', ')}.${dela.length > 6 ? ' Ostali so na zaslonu.' : ''}${ods}`,
      podatki,
    };
  },
};

/** Intervali, ko je resurs polno zaseden (sočasnih terminov ≥ količina). */
export function polnoZaseden(intervali: [number, number][], kolicina: number): [number, number][] {
  const tocke: [number, number][] = [];
  for (const [a, b] of intervali) {
    tocke.push([a, 1], [b, -1]);
  }
  tocke.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const out: [number, number][] = [];
  let n = 0;
  let od: number | null = null;
  for (const [t, d] of tocke) {
    n += d;
    if (n >= kolicina && od === null) od = t;
    else if (n < kolicina && od !== null) {
      if (t > od) {
        const zadnji = out.at(-1);
        if (zadnji && zadnji[1] === od) zadnji[1] = t;
        else out.push([od, t]);
      }
      od = null;
    }
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
export const resursiDan: BralnoOrodje<{ datum: string | null; resurs: string | null }> = {
  ime: 'resursi_dan',
  opis: 'Zasedenost resursov (stoli, sobe, aparati) na en dan: "kdaj je zasedena soba za masažo jutri", "kateri resursi so danes zasedeni".',
  razred: 'branje',
  pravica: 'termini.branje',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      datum: { type: ['string', 'null'], description: 'Izraz uporabnika ali YYYY-MM-DD; null = danes.' },
      resurs: { type: ['string', 'null'], description: 'Ime resursa; null = vsi.' },
    },
    required: ['datum', 'resurs'],
    additionalProperties: false,
  },
  vhod: z.object({ datum: z.string().max(60).nullable(), resurs: z.string().max(80).nullable() }),
  async izvedi({ datum, resurs }, o) {
    const d = dan(datum, o);
    if (typeof d !== 'string') return d;
    const vsi = (await o.podatki.resursi()).filter((r) => r.aktivna);
    if (vsi.length === 0) return { sporocilo: 'V salonu ni nastavljenih resursov.' };
    let izbrani = vsi;
    if (resurs) {
      const izid = poisci(resurs, vsi, (r) => r.naziv.split(/\s+/));
      if (izid.izid === 'nic') return { sporocilo: `Resursa »${resurs}« ne najdem.` };
      if (izid.izid === 'vec') {
        return {
          sporocilo: `Kateri resurs? ${izid.kandidati.map((k) => k.vrednost.naziv).join(', ')}.`,
          vprasanje: { besedilo: 'Kateri resurs?', moznosti: izid.kandidati.map((k) => ({ id: k.vrednost.id, oznaka: k.vrednost.naziv })) },
        };
      }
      izbrani = [izid.najden];
    }
    const termini = (await o.podatki.termini(d, d)).filter(aktiven);
    const povezave = await o.podatki.resursiTerminov(termini.map((t) => t.vrstica ?? '').filter(Boolean));
    const poVrstici = new Map(termini.filter((t) => t.vrstica).map((t) => [t.vrstica!, t]));
    const kdaj = datumZaGovor(d, o.danes);
    const rezultat = izbrani.map((r) => {
      const intervali = povezave
        .filter((p) => p.resursId === r.id)
        .map((p) => poVrstici.get(p.vrstica))
        .filter((t): t is TerminPovzetek => Boolean(t))
        .map((t) => [vMinute(t.zacetek), t.konec ? vMinute(t.konec) : vMinute(t.zacetek) + 60] as [number, number]);
      return { r, terminov: intervali.length, zaseden: polnoZaseden(intervali, r.kolicina) };
    });
    const podatki = {
      datum: d,
      resursi: rezultat.map((x) => ({ naziv: x.r.naziv, kolicina: x.r.kolicina, terminov: x.terminov, zaseden: x.zaseden.map(([a, b]) => ({ od: izMinut(a), do: izMinut(b) })) })),
    };
    const zasedeni = rezultat.filter((x) => x.zaseden.length > 0);
    if (zasedeni.length === 0) {
      const kaj = izbrani.length === 1 ? `${izbrani[0].naziv} je ${kdaj} prost ves dan` : `${cap(kdaj)} ni noben resurs polno zaseden`;
      return { sporocilo: `${cap(kaj)}.`, govor: `${cap(kaj)}.`, podatki };
    }
    const vrstice = rezultat.map((x) => `${x.r.naziv}${x.r.kolicina > 1 ? ` (${x.r.kolicina})` : ''}: ${x.zaseden.length ? `zaseden ${x.zaseden.map(([a, b]) => razpon(a, b)).join(', ')}` : 'prost'}`);
    const naGlas = zasedeni.slice(0, 3).map((x) => {
      const casi = x.zaseden.slice(0, 3).map(([a, b]) => razponZaGovor(izMinut(a), izMinut(b)));
      return `${x.r.naziv} je zaseden ${casi.length > 1 ? `${casi.slice(0, -1).join(', ')} in ${casi.at(-1)}` : casi[0]}`;
    });
    const prosti = rezultat.length - zasedeni.length;
    return {
      sporocilo: `Resursi ${kdaj}:\n${vrstice.join('\n')}`,
      govor: `${cap(kdaj)}: ${naGlas.join('. ')}.${prosti > 0 && izbrani.length > 1 ? ' Ostali so prosti.' : ''}`,
      podatki,
    };
  },
};
