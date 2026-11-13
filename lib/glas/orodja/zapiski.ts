// lib/glas/orodja/zapiski.ts
//
// Faza 1: glasovni zapisek na kartici stranke ("Ana Novak, barva 6.3 z 7.1,
// 30 g, oksidant 6 %, 35 minut, naslednjič skrajšati konice").
//
// Zakaj nova tabela stranke_zapiski in ne Stranke."Interne opombe":
// n8n POSODOBITEV_STRANKE polja "Interne opombe" ne shrani in ob vsakem
// zapisu ponastavi Obvestimo/Status (docs/glasovni-asistent-analiza.md §7).
// Zapis gre z uporabnikovo sejo; RLS preveri članstvo, pravico urejanja strank
// in da stranka pripada podjetju.

import { z } from 'zod';
import type { Predogled, RezultatOrodja } from '../tipi';
import { oznakaStranke, razresiStranko, ID_STRANKE } from './stranke';
import type { PisalnoOrodje } from './tipi';

const KATEGORIJE = ['barva', 'preferenca', 'opomba'] as const;

const ODTENEK = /^\d{1,2}([.,/]\d{1,2}){0,2}$/;

const vhod = z.object({
  stranka: z.string().trim().min(1).max(80),
  stranka_id: z.string().regex(ID_STRANKE).nullable(),
  kategorija: z.enum(KATEGORIJE),
  besedilo: z.string().trim().min(1).max(1000),
  odtenki: z.array(z.string().trim().regex(ODTENEK)).max(6),
  gramov: z.number().min(0).max(1000).nullable(),
  oksidant_pct: z.number().min(0).max(12).nullable(),
  cas_min: z.number().int().min(0).max(240).nullable(),
});
type Vhod = z.infer<typeof vhod>;

const shranjeno = z.object({
  idStranke: z.string().regex(ID_STRANKE),
  imeStranke: z.string().max(160),
  kategorija: z.enum(KATEGORIJE),
  besedilo: z.string().min(1).max(1000),
  podrobnosti: z.object({
    odtenki: z.array(z.string()).max(6).optional(),
    gramov: z.number().optional(),
    oksidant_pct: z.number().optional(),
    cas_min: z.number().optional(),
  }),
});

export const dodajZapisek: PisalnoOrodje<Vhod> = {
  ime: 'dodaj_zapisek',
  opis:
    'Doda zapisek na kartico stranke: recepturo barve (odtenki, gramov, oksidant %, čas), preferenco ali opombo. ' +
    'Besedilo zapiši zgoščeno, kot ga je povedal uporabnik, brez dodajanja. Zahteva potrditev uporabnika.',
  razred: 'pisanje',
  pravica: 'stranke.urejanje',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      stranka: { type: 'string', description: 'Ime stranke, kot je bilo izgovorjeno.' },
      stranka_id: { type: ['string', 'null'], description: 'ID iz prejšnjega iskanja ali izbire, sicer null.' },
      kategorija: { type: 'string', enum: [...KATEGORIJE] },
      besedilo: { type: 'string', description: 'Vsebina zapiska v slovenščini.' },
      odtenki: { type: 'array', items: { type: 'string' }, description: 'Odtenki barve, npr. ["6.3","7.1"]; prazno, če ni barve.' },
      gramov: { type: ['number', 'null'] },
      oksidant_pct: { type: ['number', 'null'] },
      cas_min: { type: ['integer', 'null'] },
    },
    required: ['stranka', 'stranka_id', 'kategorija', 'besedilo', 'odtenki', 'gramov', 'oksidant_pct', 'cas_min'],
    additionalProperties: false,
  },
  vhod,
  shranjeno: shranjeno as unknown as z.ZodType<Record<string, unknown>>,

  async predogled(p, o): Promise<Predogled | RezultatOrodja> {
    const r = await razresiStranko(p.stranka, p.stranka_id, o);
    if ('odgovor' in r) return r.odgovor;
    const s = r.stranka;
    const podrobnosti: Record<string, unknown> = {};
    if (p.odtenki.length) podrobnosti.odtenki = p.odtenki.map((x) => x.replace(',', '.'));
    if (p.gramov !== null) podrobnosti.gramov = p.gramov;
    if (p.oksidant_pct !== null) podrobnosti.oksidant_pct = p.oksidant_pct;
    if (p.cas_min !== null) podrobnosti.cas_min = p.cas_min;

    const vrstice = [
      { oznaka: 'Stranka', vrednost: oznakaStranke(s, o.danes) },
      { oznaka: 'Vrsta', vrednost: p.kategorija },
      { oznaka: 'Zapisek', vrednost: p.besedilo },
    ];
    if (podrobnosti.odtenki) vrstice.push({ oznaka: 'Odtenki', vrednost: (podrobnosti.odtenki as string[]).join(' + ') });
    if (p.gramov !== null) vrstice.push({ oznaka: 'Količina', vrednost: `${p.gramov} g` });
    if (p.oksidant_pct !== null) vrstice.push({ oznaka: 'Oksidant', vrednost: `${p.oksidant_pct} %` });
    if (p.cas_min !== null) vrstice.push({ oznaka: 'Čas', vrednost: `${p.cas_min} min` });

    return {
      povzetek: `Dodam zapisek (${p.kategorija}) na kartico: ${`${s.ime} ${s.priimek}`.trim()}.`,
      parametri: {
        idStranke: s.id,
        imeStranke: `${s.ime} ${s.priimek}`.trim(),
        kategorija: p.kategorija,
        besedilo: p.besedilo,
        podrobnosti,
      },
      podrobnosti: vrstice,
    };
  },

  async potrdi(parametri, o) {
    const p = shranjeno.parse(parametri);
    // Znova preveri, da stranka obstaja in je vidna temu uporabniku (RLS).
    const s = await o.podatki.stranka(p.idStranke);
    if (!s) return { sporocilo: 'Stranke ni več mogoče najti. Zapisek ni bil dodan.', neuspeh: true };
    const { id } = await o.podatki.dodajZapisek({
      podjetje: o.k.podjetje,
      idStranke: p.idStranke,
      kategorija: p.kategorija,
      besedilo: p.besedilo,
      podrobnosti: p.podrobnosti,
      ukazId: o.ukazId,
      avtorIme: o.k.email,
    });
    return { sporocilo: `Zapisek je dodan na kartico ${p.imeStranke}.`, podatki: { zapisek_id: id, stranka_id: p.idStranke } };
  },
};
