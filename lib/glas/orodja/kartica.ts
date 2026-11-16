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

import { razresiStranko, zadnjiInNaslednji, ID_STRANKE } from './stranke';
import type { BralnoOrodje } from './tipi';
import { jt, kt } from '../jeziki/t';

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
  if (typeof p.oksidant_pct === 'number') deli.push(jt('oksidant {n} %', { n: p.oksidant_pct }));
  if (typeof p.cas_min === 'number') deli.push(`${p.cas_min} min`);
  return deli.join(', ');
}

/** Receptura za glas: "6 3 in 7 1, 30 gramov, oksidant 6 odstotkov, 35 minut" (odtenke beremo kot v salonu). */
export function recepturaGovor(p: ZapisekPovzetek['podrobnosti']): string {
  const deli: string[] = [];
  if (p.odtenki?.length) {
    const o = p.odtenki.map((x) => x.replace(/[.,/]/g, ' '));
    deli.push(o.length > 1 ? jt('{prvi} in {zadnji}', { prvi: o.slice(0, -1).join(', '), zadnji: o.at(-1) }) : o[0]);
  }
  if (typeof p.gramov === 'number') deli.push(jt('{n} gramov', { n: p.gramov }));
  if (typeof p.oksidant_pct === 'number') deli.push(jt('oksidant {n} odstotkov', { n: p.oksidant_pct }));
  if (typeof p.cas_min === 'number') deli.push(jt('{n} minut', { n: p.cas_min }));
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
    const [{ zadnji, naslednji }, zapiski, opombe] = await Promise.all([
      // Po trenutni uri: današnji minuli termin je zadnji, ne naslednji.
      zadnjiInNaslednji(o, s),
      o.podatki.zapiskiStranke(s.id, 3),
      o.podatki.interneOpombe(s.id),
    ]);
    const ime = `${s.ime} ${s.priimek}`.trim();
    const zaslon: string[] = [ime];
    const govor: string[] = [];
    if (zadnji) {
      zaslon.push(jt('Zadnjič: {datum}', { datum: opisDatuma(zadnji.datum, o.danes) }) + `${zadnji.storitev ? `, ${zadnji.storitev}` : ''}${zadnji.oseba ? ` (${zadnji.oseba})` : ''}`);
      // Brez »je bila«: spola stranke ne poznamo.
      govor.push(
        (zadnji.datum === o.danes
          ? jt('{ime}, zadnji obisk danes {ura}', { ime, ura: uraZaGovor(zadnji.zacetek) })
          : jt('{ime}, zadnji obisk {datum}', { ime, datum: datumZaGovor(zadnji.datum, o.danes) })) + `${zadnji.storitev ? `, ${zadnji.storitev}` : ''}.`
      );
    } else {
      zaslon.push(jt('Še brez preteklega termina'));
      govor.push(jt('{ime} še nima preteklega termina.', { ime }));
    }
    if (naslednji) {
      zaslon.push(jt('Naslednjič: {datum} ob {ura}', { datum: opisDatuma(naslednji.datum, o.danes), ura: naslednji.zacetek }) + `${naslednji.storitev ? `, ${naslednji.storitev}` : ''}`);
      govor.push(jt('Naslednji termin je {datum} {ura}.', { datum: datumZaGovor(naslednji.datum, o.danes), ura: uraZaGovor(naslednji.zacetek) }));
    } else {
      govor.push(jt('Naslednjega termina še ni.'));
    }
    for (const z of zapiski) {
      const rec = recepturaBesedilo(z.podrobnosti);
      zaslon.push(jt('Zapisek ({kategorija}, {datum}): {besedilo}', { kategorija: z.kategorija, datum: opisDatuma(z.datum, o.danes), besedilo: z.besedilo }) + `${rec && !z.besedilo.includes(rec) ? ` — ${rec}` : ''}`);
    }
    if (zapiski[0]) govor.push(jt('Zadnji zapisek: {besedilo}.', { besedilo: zapiski[0].besedilo.replace(/(\d)[.,/](\d)/g, '$1 $2') }));
    if (opombe) {
      zaslon.push(jt('Interne opombe: {opombe}', { opombe }));
      govor.push(jt('Interne opombe: {opombe}.', { opombe: opombe.slice(0, 200) }));
    }
    return {
      sporocilo: zaslon.join('\n'),
      govor: govor.join(' ').replace(/\.\./g, '.'),
      podatki: {
        stranka_id: s.id,
        // Naslednji termin postane aktiven ("prestavi ga", "spremeni jezik termina").
        ...(naslednji ? { termin_id: naslednji.id, termin_datum: naslednji.datum } : {}),
        zadnji: zadnji ? { datum: zadnji.datum, storitev: zadnji.storitev, oseba: zadnji.oseba } : null,
        naslednji: naslednji ? { datum: naslednji.datum, ura: naslednji.zacetek, storitev: naslednji.storitev } : null,
        zapiski: zapiski.length,
      },
      // Zapiski in interne opombe ne gredo modelu AI niti v dnevnik.
      ...(zapiski.length || opombe
        ? { zasebno: { dnevnik: [...zaslon.filter((x) => !x.startsWith(jt('Zapisek ({kategorija}, {datum}): {besedilo}').split(' (')[0]) && !x.startsWith(jt('Interne opombe: {opombe}', { opombe: '' }))), zapiski.length ? '(zapiski prikazani)' : '', opombe ? '(interne opombe prikazane)' : ''].filter(Boolean).join('\n') } }
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
        sporocilo: jt('Za {ime} ni zapisane barve. Zapišete jo lahko z glasom, npr. »{kratko}, barva 6.3 z 7.1, 30 gramov«.', { ime, kratko: s.ime }),
        govor: jt('Za {ime} nimam zapisane barve.', { ime }),
        podatki: { stranka_id: s.id, barva: null },
      };
    }
    const rec = recepturaBesedilo(barva.podrobnosti);
    const recGovor = recepturaGovor(barva.podrobnosti);
    return {
      sporocilo: jt('Zadnja barva — {ime}, {datum}:', { ime, datum: opisDatuma(barva.datum, o.danes) }) + `\n${rec || barva.besedilo}${rec && barva.besedilo !== rec ? `\n${barva.besedilo}` : ''}`,
      govor: jt('Zadnja barva za {ime}, {datum}: {receptura}.', { ime, datum: datumZaGovor(barva.datum, o.danes), receptura: recGovor || barva.besedilo.replace(/(\d)[.,/](\d)/g, '$1 $2') }),
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
    const mes = jt('{m} {m|mesec|meseca|mesece|mesecev}', { m });
    if (seznam.length === 0) {
      return { sporocilo: jt('Ni strank, ki ne bi bile več kot {mes} (in nimajo termina).', { mes }), podatki: { mesecev: m, stevilo: 0, stranke: [] } };
    }
    const ime = (s: (typeof seznam)[number]) => `${s.ime} ${s.priimek}`.trim();
    const naGlas = seznam.slice(0, NAJVEC_NA_GLAS).map((s) => `${ime(s)}, ${datumZaGovor(s.zadnjaInterakcija!, o.danes).replace(/^v \S+, /, '')}`);
    const n = seznam.length;
    return {
      sporocilo: `${jt('{n} {n|stranka|stranki|stranke|strank} brez obiska več kot {mes} in brez termina:', { n, mes })}\n${seznam
        .slice(0, 30)
        .map((s) => jt('{ime} — zadnjič {datum}', { ime: ime(s), datum: opisDatuma(s.zadnjaInterakcija!, o.danes) }))
        .join('\n')}${n > 30 ? `\n${jt('… in še {n}', { n: n - 30 })}` : ''}`,
      govor: `${jt('{n} {n|stranka ni bila|stranki nista bili|stranke niso bile|strank ni bilo} več kot {mes}.', { n, mes })} ${n === 1 ? jt('To je') : jt('Nazadnje so bile')} ${naGlas.join('; ')}.${n > NAJVEC_NA_GLAS ? ` ${jt('Ostale so na zaslonu.')}` : ''}`,
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

const JEZIKI: Record<string, string> = { slo: kt('slovenščina'), eng: kt('angleščina'), de: kt('nemščina'), it: kt('italijanščina'), hr: kt('hrvaščina') };

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
      zelja.has('naslednji') ? zadnjiInNaslednji(o, s).then((x) => x.naslednji) : Promise.resolve(null),
    ]);
    if (!p) return { sporocilo: jt('Te stranke ne najdem.') };

    const zaslon: string[] = [ime];
    const govor: string[] = [];
    const dnevnik: string[] = [ime];
    const akcije: AkcijaStranke[] = [];
    let zasebno = false;

    if (zelja.has('telefon')) {
      const href = p.telefon ? povezavaKontakta('klic', p.telefon) : null;
      if (p.telefon && href) {
        zaslon.push(jt('Telefon: {telefon}', { telefon: telefonZaZaslon(p.telefon) }));
        govor.push(jt('Telefon: {telefon}.', { telefon: telefonZaGovor(p.telefon) }));
        dnevnik.push('(telefon prikazan)');
        akcije.push({ vrsta: 'klic', href });
        zasebno = true;
      } else {
        zaslon.push(jt('Telefon: ni vpisan'));
        govor.push(jt('Telefona nima vpisanega.'));
        dnevnik.push('Telefon: ni vpisan');
      }
    }
    if (zelja.has('email')) {
      const href = p.email ? povezavaKontakta('pisi', p.email) : null;
      if (p.email && href) {
        zaslon.push(jt('E-pošta: {email}', { email: p.email }));
        govor.push(jt('E-pošta: {email}.', { email: emailZaGovor(p.email) }));
        dnevnik.push('(e-pošta prikazana)');
        akcije.push({ vrsta: 'pisi', href });
        zasebno = true;
      } else {
        zaslon.push(jt('E-pošta: ni vpisana'));
        govor.push(jt('E-pošte nima vpisane.'));
        dnevnik.push('E-pošta: ni vpisana');
      }
    }
    if (zelja.has('opombe')) {
      if (p.opombe) {
        zaslon.push(jt('Opombe: {opombe}', { opombe: p.opombe }));
        govor.push(jt('Opombe: {opombe}.', { opombe: p.opombe.slice(0, 200) }));
        dnevnik.push('(opombe prikazane)');
        zasebno = true;
      } else if (polja?.length) {
        zaslon.push(jt('Opombe: ni'));
        govor.push(jt('Opomb nima.'));
        dnevnik.push('Opombe: ni');
      }
    }
    if (zelja.has('interne_opombe')) {
      if (p.interneOpombe) {
        zaslon.push(jt('Interne opombe: {opombe}', { opombe: p.interneOpombe }));
        govor.push(jt('Interne opombe: {opombe}.', { opombe: p.interneOpombe.slice(0, 200) }));
        dnevnik.push('(interne opombe prikazane)');
        zasebno = true;
      } else if (polja?.length) {
        zaslon.push(jt('Interne opombe: ni'));
        govor.push(jt('Internih opomb nima.'));
        dnevnik.push('Interne opombe: ni');
      }
    }
    if (zelja.has('jezik')) {
      const kljucJezika = p.jezik ? JEZIKI[normalizeCommunicationLanguage(p.jezik, 'slo')] : null;
      const j = kljucJezika ? jt(kljucJezika) : null;
      const t = j ? jt('Jezik sporočil: {jezik}', { jezik: j }) : jt('Jezik sporočil: ni nastavljen (velja jezik podjetja)');
      zaslon.push(t);
      govor.push(j ? jt('Sporočila dobiva v jeziku {jezik}.', { jezik: j }).replace('v jeziku slovenščina', 'v slovenščini') : jt('Jezik ni nastavljen, velja jezik podjetja.'));
      dnevnik.push(t);
    }
    if (zelja.has('privolitev')) {
      const t =
        p.marketing === true
          ? jt('Marketinška privolitev: da')
          : p.marketing === false
            ? jt('Marketinška privolitev: ne')
            : jt('Marketinška privolitev: ni odgovora (šteje kot ne)');
      zaslon.push(t);
      govor.push(
        p.marketing === true
          ? jt('Za novice in akcije ima privolitev.')
          : p.marketing === false
            ? jt('Novic in akcij ne želi.')
            : jt('Privolitve za novice ni, zato jih ne pošiljamo.')
      );
      dnevnik.push(t);
    }
    if (zelja.has('obiski')) {
      const t = jt('Obiskov: {obiski}, neprihodov: {neprihodi}', { obiski: p.obiski, neprihodi: p.neprihodi });
      zaslon.push(t);
      govor.push(
        `${p.obiski === 0 ? jt('Obiskov še ni bilo') : jt('Obiskov: {n}', { n: p.obiski })}, ${
          p.neprihodi ? jt('{n} {n|neprihod|neprihoda|neprihodi|neprihodov}', { n: p.neprihodi }) : jt('brez neprihodov')
        }.`
      );
      dnevnik.push(t);
    }
    if (zelja.has('naslednji')) {
      const t = naslednji
        ? jt('Naslednji termin: {datum} ob {ura}', { datum: opisDatuma(naslednji.datum, o.danes), ura: naslednji.zacetek }) + `${naslednji.storitev ? `, ${naslednji.storitev}` : ''}`
        : jt('Naslednji termin: ni');
      zaslon.push(t);
      govor.push(naslednji ? jt('Naslednji termin je {datum} {ura}.', { datum: datumZaGovor(naslednji.datum, o.danes), ura: uraZaGovor(naslednji.zacetek) }) : jt('Naslednjega termina še ni.'));
      dnevnik.push(t);
    }
    if (govor.length === 0) govor.push(jt('{ime}: nič od tega ni vpisano.', { ime }));
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
