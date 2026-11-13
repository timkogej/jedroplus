// lib/glas/orodja/kartica.ts
//
// Faza 2 — branje o strankah: povzetek kartice, zadnja barva (receptura iz
// glasovnih zapiskov), neaktivne stranke. Brez telefonov in e-pošte.
//
// Rezultati so končni (en krog AI), zato vsebina zapiskov in internih opomb
// ne gre nazaj ponudniku AI — samo na zaslon in v glas.

import { z } from 'zod';
import { datumZaGovor, emailZaGovor, NAJVEC_NA_GLAS, povezavaKontakta, telefonZaGovor, telefonZaZaslon, uraZaGovor } from '../govor';
import { normalizeCommunicationLanguage } from '@/lib/communicationLanguage';
import { dodajDni, opisDatuma } from '../razresevanje/datumi';
import type { AkcijaStranke, ZapisekPovzetek } from '../tipi';
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
      // Zapiski in interne opombe ne gredo modelu AI niti v dnevnik.
      ...(zapiski.length || opombe
        ? { zasebno: { dnevnik: [...zaslon.filter((x) => !/^(Zapisek|Interne opombe)/.test(x)), zapiski.length ? '(zapiski prikazani)' : '', opombe ? '(interne opombe prikazane)' : ''].filter(Boolean).join('\n') } }
        : {}),
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

// ───────────────────────────────────────────────────────────────────────────
// Podatki s kartice: telefon, e-pošta, opombe, jezik, privolitev, obiski.
// Telefon, e-pošta in opombe gredo samo na zaslon in v glas (zasebno), modelu AI
// in v dnevnik gre le "(telefon prikazan)" ipd.

export const POLJA_STRANKE = ['telefon', 'email', 'opombe', 'interne_opombe', 'jezik', 'privolitev', 'obiski', 'naslednji'] as const;
type PoljeStranke = (typeof POLJA_STRANKE)[number];

const JEZIKI: Record<string, string> = { slo: 'slovenščina', eng: 'angleščina', de: 'nemščina', it: 'italijanščina', hr: 'hrvaščina' };

const stevilo = (n: number, ena: string, dve: string, tri: string, vec: string) =>
  `${n} ${n % 100 === 1 ? ena : n % 100 === 2 ? dve : n % 100 === 3 || n % 100 === 4 ? tri : vec}`;

const vhodPodatkov = vhodStranke.extend({
  polja: z.array(z.enum(POLJA_STRANKE)).max(8).nullable(),
});

export const podatkiStranke: BralnoOrodje<z.infer<typeof vhodPodatkov>> = {
  ime: 'podatki_stranke',
  opis:
    'Posamezni podatki s kartice stranke: telefon, e-pošta, opombe, interne opombe, jezik sporočil, marketinška privolitev, število obiskov in neprihodov, naslednji termin ("kakšen telefon ima", "ima Ana kakšno opombo", "v katerem jeziku ji pišemo", "ali sme dobiti novice", "kolikokrat je že bila", "pokliči jo"). Za "pokliči jo" zahtevaj telefon (na zaslonu se pokaže gumb Pokliči).',
  razred: 'branje',
  pravica: 'stranke.branje',
  omogoceno: true,
  shema: {
    type: 'object' as const,
    properties: {
      ...shemaStranke.properties,
      polja: {
        type: ['array', 'null'],
        items: { type: 'string', enum: [...POLJA_STRANKE] },
        description: 'Katere podatke uporabnik želi; null = vse.',
      },
    },
    required: ['stranka', 'stranka_id', 'polja'],
    additionalProperties: false as const,
  },
  vhod: vhodPodatkov,
  async izvedi({ stranka, stranka_id, polja }, o) {
    const r = await razresiStranko(stranka, stranka_id, o);
    if ('odgovor' in r) return r.odgovor;
    const s = r.stranka;
    const ime = `${s.ime} ${s.priimek}`.trim();
    const zelja = new Set<PoljeStranke>(polja?.length ? polja : POLJA_STRANKE);
    const [p, naslednji] = await Promise.all([
      o.podatki.podrobnostiStranke(s.id, o.danes),
      zelja.has('naslednji') ? o.podatki.naslednjiTermin(s.id, o.danes) : Promise.resolve(null),
    ]);
    if (!p) return { sporocilo: 'Te stranke ne najdem.' };

    const zaslon: string[] = [ime];
    const govor: string[] = [];
    const dnevnik: string[] = [ime];
    const akcije: AkcijaStranke[] = [];
    let zasebno = false;

    if (zelja.has('telefon')) {
      const href = p.telefon ? povezavaKontakta('klic', p.telefon) : null;
      if (p.telefon && href) {
        zaslon.push(`Telefon: ${telefonZaZaslon(p.telefon)}`);
        govor.push(`Telefon: ${telefonZaGovor(p.telefon)}.`);
        dnevnik.push('(telefon prikazan)');
        akcije.push({ vrsta: 'klic', href });
        zasebno = true;
      } else {
        zaslon.push('Telefon: ni vpisan');
        govor.push('Telefona nima vpisanega.');
        dnevnik.push('Telefon: ni vpisan');
      }
    }
    if (zelja.has('email')) {
      const href = p.email ? povezavaKontakta('pisi', p.email) : null;
      if (p.email && href) {
        zaslon.push(`E-pošta: ${p.email}`);
        govor.push(`E-pošta: ${emailZaGovor(p.email)}.`);
        dnevnik.push('(e-pošta prikazana)');
        akcije.push({ vrsta: 'pisi', href });
        zasebno = true;
      } else {
        zaslon.push('E-pošta: ni vpisana');
        govor.push('E-pošte nima vpisane.');
        dnevnik.push('E-pošta: ni vpisana');
      }
    }
    if (zelja.has('opombe')) {
      if (p.opombe) {
        zaslon.push(`Opombe: ${p.opombe}`);
        govor.push(`Opombe: ${p.opombe.slice(0, 200)}.`);
        dnevnik.push('(opombe prikazane)');
        zasebno = true;
      } else if (polja?.length) {
        zaslon.push('Opombe: ni');
        govor.push('Opomb nima.');
        dnevnik.push('Opombe: ni');
      }
    }
    if (zelja.has('interne_opombe')) {
      if (p.interneOpombe) {
        zaslon.push(`Interne opombe: ${p.interneOpombe}`);
        govor.push(`Interne opombe: ${p.interneOpombe.slice(0, 200)}.`);
        dnevnik.push('(interne opombe prikazane)');
        zasebno = true;
      } else if (polja?.length) {
        zaslon.push('Interne opombe: ni');
        govor.push('Internih opomb nima.');
        dnevnik.push('Interne opombe: ni');
      }
    }
    if (zelja.has('jezik')) {
      const j = p.jezik ? JEZIKI[normalizeCommunicationLanguage(p.jezik, 'slo')] : null;
      const t = j ? `Jezik sporočil: ${j}` : 'Jezik sporočil: ni nastavljen (velja jezik podjetja)';
      zaslon.push(t);
      govor.push(j ? `Sporočila dobiva v jeziku ${j}.`.replace('v jeziku slovenščina', 'v slovenščini') : 'Jezik ni nastavljen, velja jezik podjetja.');
      dnevnik.push(t);
    }
    if (zelja.has('privolitev')) {
      const t =
        p.marketing === true
          ? 'Marketinška privolitev: da'
          : p.marketing === false
            ? 'Marketinška privolitev: ne'
            : 'Marketinška privolitev: ni odgovora (šteje kot ne)';
      zaslon.push(t);
      govor.push(
        p.marketing === true
          ? 'Za novice in akcije ima privolitev.'
          : p.marketing === false
            ? 'Novic in akcij ne želi.'
            : 'Privolitve za novice ni, zato jih ne pošiljamo.'
      );
      dnevnik.push(t);
    }
    if (zelja.has('obiski')) {
      const t = `Obiskov: ${p.obiski}, neprihodov: ${p.neprihodi}`;
      zaslon.push(t);
      govor.push(
        `${p.obiski === 0 ? 'Obiskov še ni bilo' : `Obiskov: ${p.obiski}`}, ${
          p.neprihodi ? stevilo(p.neprihodi, 'neprihod', 'neprihoda', 'neprihodi', 'neprihodov') : 'brez neprihodov'
        }.`
      );
      dnevnik.push(t);
    }
    if (zelja.has('naslednji')) {
      const t = naslednji
        ? `Naslednji termin: ${opisDatuma(naslednji.datum, o.danes)} ob ${naslednji.zacetek}${naslednji.storitev ? `, ${naslednji.storitev}` : ''}`
        : 'Naslednji termin: ni';
      zaslon.push(t);
      govor.push(naslednji ? `Naslednjič pride ${datumZaGovor(naslednji.datum, o.danes)} ${uraZaGovor(naslednji.zacetek)}.` : 'Naslednjega termina nima.');
      dnevnik.push(t);
    }
    if (govor.length === 0) govor.push(`${ime}: nič od tega ni vpisano.`);
    return {
      sporocilo: zaslon.join('\n'),
      govor: govor.join(' '),
      podatki: {
        stranka_id: s.id,
        ...(naslednji ? { termin_id: naslednji.id, termin_datum: naslednji.datum } : {}),
        ima_telefon: Boolean(p.telefon),
        ima_email: Boolean(p.email),
      },
      ...(zasebno ? { zasebno: { dnevnik: dnevnik.join('\n') } } : {}),
      ...(akcije.length ? { akcije } : {}),
    };
  },
};
