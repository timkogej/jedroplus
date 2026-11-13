// lib/glas/orodja/kartica.ts
//
// Faza 2 — branje o strankah: povzetek kartice, zadnja barva (receptura iz
// glasovnih zapiskov), neaktivne stranke. Brez telefonov in e-pošte.
//
// Rezultati so končni (en krog AI), zato vsebina zapiskov in internih opomb
// ne gre nazaj ponudniku AI — samo na zaslon in v glas.

import { z } from 'zod';
import { datumZaGovor, NAJVEC_NA_GLAS, uraZaGovor } from '../govor';
import { dodajDni, opisDatuma } from '../razresevanje/datumi';
import type { ZapisekPovzetek } from '../tipi';
import { cap, sklon } from './branje';
import { razresiStranko, ID_STRANKE } from './stranke';
import type { BralnoOrodje } from './tipi';

const vhodStranke = z.object({ stranka: z.string().trim().min(1).max(80), stranka_id: z.string().regex(ID_STRANKE).nullable() });
const shemaStranke = {
  type: 'object' as const,
  properties: {
    stranka: { type: 'string', description: 'Ime stranke, kot je bilo izgovorjeno.' },
    stranka_id: { type: ['string', 'null'], description: 'ID stranke, če je že znan iz prejšnjega iskanja ali izbire, sicer null.' },
  },
  required: ['stranka', 'stranka_id'],
  additionalProperties: false as const,
};

/** Receptura za zaslon: "6.3 + 7.1, 30 g, oksidant 6 %, 35 min". */
export function recepturaBesedilo(p: ZapisekPovzetek['podrobnosti']): string {
  const deli: string[] = [];
  if (p.odtenki?.length) deli.push(p.odtenki.join(' + '));
  if (typeof p.gramov === 'number') deli.push(`${p.gramov} g`);
  if (typeof p.oksidant_pct === 'number') deli.push(`oksidant ${p.oksidant_pct} %`);
  if (typeof p.cas_min === 'number') deli.push(`${p.cas_min} min`);
  return deli.join(', ');
}

/** Receptura za glas: "6 3 in 7 1, 30 gramov, oksidant 6 odstotkov, 35 minut" (odtenke beremo kot v salonu). */
export function recepturaGovor(p: ZapisekPovzetek['podrobnosti']): string {
  const deli: string[] = [];
  if (p.odtenki?.length) {
    const o = p.odtenki.map((x) => x.replace(/[.,/]/g, ' '));
    deli.push(o.length > 1 ? `${o.slice(0, -1).join(', ')} in ${o.at(-1)}` : o[0]);
  }
  if (typeof p.gramov === 'number') deli.push(`${p.gramov} gramov`);
  if (typeof p.oksidant_pct === 'number') deli.push(`oksidant ${p.oksidant_pct} odstotkov`);
  if (typeof p.cas_min === 'number') deli.push(`${p.cas_min} minut`);
  return deli.join(', ');
}

// ───────────────────────────────────────────────────────────────────────────
export const karticaStranke: BralnoOrodje<z.infer<typeof vhodStranke>> = {
  ime: 'kartica_stranke',
  opis: 'Vse o stranki na kratko: zadnji in naslednji obisk, zadnji zapiski in interne opombe ("povej mi vse o Ani Novak", "kaj vemo o …").',
  razred: 'branje',
  pravica: 'stranke.branje',
  omogoceno: true,
  shema: shemaStranke,
  vhod: vhodStranke,
  async izvedi({ stranka, stranka_id }, o) {
    const r = await razresiStranko(stranka, stranka_id, o);
    if ('odgovor' in r) return r.odgovor;
    const s = r.stranka;
    const [zadnji, naslednji, zapiski, opombe] = await Promise.all([
      o.podatki.zadnjiTermin(s.id, o.danes),
      o.podatki.naslednjiTermin(s.id, o.danes),
      o.podatki.zapiskiStranke(s.id, 3),
      o.podatki.interneOpombe(s.id),
    ]);
    const ime = `${s.ime} ${s.priimek}`.trim();
    const zaslon: string[] = [ime];
    const govor: string[] = [];
    if (zadnji) {
      zaslon.push(`Zadnjič: ${opisDatuma(zadnji.datum, o.danes)}${zadnji.storitev ? `, ${zadnji.storitev}` : ''}${zadnji.oseba ? ` (${zadnji.oseba})` : ''}`);
      govor.push(`${ime} je bila zadnjič ${datumZaGovor(zadnji.datum, o.danes)}${zadnji.storitev ? `, ${zadnji.storitev}` : ''}.`);
    } else {
      zaslon.push('Še brez preteklega termina');
      govor.push(`${ime} še nima preteklega termina.`);
    }
    if (naslednji) {
      zaslon.push(`Naslednjič: ${opisDatuma(naslednji.datum, o.danes)} ob ${naslednji.zacetek}${naslednji.storitev ? `, ${naslednji.storitev}` : ''}`);
      govor.push(`Naslednjič pride ${datumZaGovor(naslednji.datum, o.danes)} ${uraZaGovor(naslednji.zacetek)}.`);
    } else {
      govor.push('Naslednjega termina nima.');
    }
    for (const z of zapiski) {
      const rec = recepturaBesedilo(z.podrobnosti);
      zaslon.push(`Zapisek (${z.kategorija}, ${opisDatuma(z.datum, o.danes)}): ${z.besedilo}${rec && !z.besedilo.includes(rec) ? ` — ${rec}` : ''}`);
    }
    if (zapiski[0]) govor.push(`Zadnji zapisek: ${zapiski[0].besedilo.replace(/(\d)[.,/](\d)/g, '$1 $2')}.`);
    if (opombe) {
      zaslon.push(`Interne opombe: ${opombe}`);
      govor.push(`Interne opombe: ${opombe.slice(0, 200)}.`);
    }
    return {
      sporocilo: zaslon.join('\n'),
      govor: govor.join(' ').replace(/\.\./g, '.'),
      podatki: {
        stranka_id: s.id,
        zadnji: zadnji ? { datum: zadnji.datum, storitev: zadnji.storitev, oseba: zadnji.oseba } : null,
        naslednji: naslednji ? { datum: naslednji.datum, ura: naslednji.zacetek, storitev: naslednji.storitev } : null,
        zapiski: zapiski.length,
      },
    };
  },
};

// ───────────────────────────────────────────────────────────────────────────
export const zadnjaBarva: BralnoOrodje<z.infer<typeof vhodStranke>> = {
  ime: 'zadnja_barva',
  opis: 'Zadnja zapisana barva oziroma receptura stranke (odtenki, gramaža, oksidant, čas): "katero barvo je imela Ana".',
  razred: 'branje',
  pravica: 'stranke.branje',
  omogoceno: true,
  shema: shemaStranke,
  vhod: vhodStranke,
  async izvedi({ stranka, stranka_id }, o) {
    const r = await razresiStranko(stranka, stranka_id, o);
    if ('odgovor' in r) return r.odgovor;
    const s = r.stranka;
    const ime = `${s.ime} ${s.priimek}`.trim();
    const barva = (await o.podatki.zapiskiStranke(s.id, 20)).find((z) => z.kategorija === 'barva');
    if (!barva) {
      return {
        sporocilo: `Za ${ime} ni zapisane barve. Zapišete jo lahko z glasom, npr. »${s.ime}, barva 6.3 z 7.1, 30 gramov«.`,
        govor: `Za ${ime} nimam zapisane barve.`,
        podatki: { stranka_id: s.id, barva: null },
      };
    }
    const rec = recepturaBesedilo(barva.podrobnosti);
    const recGovor = recepturaGovor(barva.podrobnosti);
    return {
      sporocilo: `Zadnja barva — ${ime}, ${opisDatuma(barva.datum, o.danes)}:\n${rec || barva.besedilo}${rec && barva.besedilo !== rec ? `\n${barva.besedilo}` : ''}`,
      govor: `Zadnja barva za ${ime}, ${datumZaGovor(barva.datum, o.danes)}: ${recGovor || barva.besedilo.replace(/(\d)[.,/](\d)/g, '$1 $2')}.`,
      podatki: { stranka_id: s.id, barva: { datum: barva.datum, ...barva.podrobnosti } },
    };
  },
};

// ───────────────────────────────────────────────────────────────────────────
export const neaktivneStranke: BralnoOrodje<{ mesecev: number | null }> = {
  ime: 'neaktivne_stranke',
  opis: 'Stranke, ki že dolgo niso bile v salonu in nimajo naročenega termina ("kdo ni bil več kot 3 mesece").',
  razred: 'branje',
  pravica: 'stranke.branje',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: { mesecev: { type: ['integer', 'null'], description: 'Koliko mesecev brez obiska; null = 3.' } },
    required: ['mesecev'],
    additionalProperties: false,
  },
  vhod: z.object({ mesecev: z.number().int().min(1).max(36).nullable() }),
  async izvedi({ mesecev }, o) {
    const m = mesecev ?? 3;
    const meja = dodajDni(o.danes, -Math.round(m * 30.4));
    const [stranke, prihodnji] = await Promise.all([o.podatki.stranke(), o.podatki.termini(o.danes, dodajDni(o.danes, 365))]);
    const narocene = new Set(prihodnji.filter((t) => t.status === 'scheduled' || t.status === 'confirmed').map((t) => t.idStranke));
    const seznam = stranke
      .filter((s) => s.zadnjaInterakcija && s.zadnjaInterakcija < meja && !narocene.has(s.id))
      .sort((a, b) => b.zadnjaInterakcija!.localeCompare(a.zadnjaInterakcija!));
    const mes = `${m} ${sklon(m, 'mesec', 'meseca', 'mesece', 'mesecev')}`;
    if (seznam.length === 0) {
      return { sporocilo: `Ni strank, ki ne bi bile več kot ${mes} (in nimajo termina).`, podatki: { mesecev: m, stevilo: 0, stranke: [] } };
    }
    const ime = (s: (typeof seznam)[number]) => `${s.ime} ${s.priimek}`.trim();
    const naGlas = seznam.slice(0, NAJVEC_NA_GLAS).map((s) => `${ime(s)}, ${datumZaGovor(s.zadnjaInterakcija!, o.danes).replace(/^v \S+, /, '')}`);
    const n = seznam.length;
    return {
      sporocilo: `${n} ${sklon(n, 'stranka', 'stranki', 'stranke', 'strank')} brez obiska več kot ${mes} in brez termina:\n${seznam
        .slice(0, 30)
        .map((s) => `${ime(s)} — zadnjič ${opisDatuma(s.zadnjaInterakcija!, o.danes)}`)
        .join('\n')}${n > 30 ? `\n… in še ${n - 30}` : ''}`,
      govor: `${cap(`${n}`)} ${sklon(n, 'stranka ni bila', 'stranki nista bili', 'stranke niso bile', 'strank ni bilo')} več kot ${mes}. ${n === 1 ? 'To je' : 'Nazadnje so bile'} ${naGlas.join('; ')}.${n > NAJVEC_NA_GLAS ? ' Ostale so na zaslonu.' : ''}`,
      podatki: { mesecev: m, stevilo: n, stranke: seznam.slice(0, 30).map((s) => ({ id: s.id, ime: ime(s), zadnjic: s.zadnjaInterakcija })) },
    };
  },
};
