// lib/glas/orodja/pomoc.ts
//
// Faza 2 — pomoč pri uporabi aplikacije in premikanje po njej. Odgovori so
// vnaprej napisani (preverjeni na vmesniku 13. 11. 2026), AI samo izbere temo,
// zato si navodil ne more izmisliti. `pojdi` odjemalec odpre kot povezavo;
// dostop do strani še vedno preveri stran sama (vloge, paket).

import { z } from 'zod';
import { razresiStranko } from './stranke';
import type { BralnoOrodje } from './tipi';

/** Strani, ki jih asistent zna odpreti (pot brez jezika). */
export const STRANI = {
  nadzorna_plosca: { pot: '/dashboard', naziv: 'Nadzorna plošča' },
  koledar: { pot: '/koledar', naziv: 'Koledar' },
  termini: { pot: '/termini', naziv: 'Termini' },
  stranke: { pot: '/clients', naziv: 'Stranke' },
  storitve: { pot: '/storitve', naziv: 'Storitve' },
  zaposleni: { pot: '/staff', naziv: 'Zaposleni' },
  resursi: { pot: '/resursi', naziv: 'Resursi' },
  opomniki: { pot: '/reminders', naziv: 'Opomniki' },
  rezervacije: { pot: '/rezervacije', naziv: 'Spletne rezervacije' },
  komunikacija: { pot: '/komunikacija', naziv: 'Komunikacija' },
  obvestila: { pot: '/obvestila', naziv: 'Obvestila' },
  nastavitve: { pot: '/nastavitve', naziv: 'Nastavitve' },
  podjetje: { pot: '/nastavitve/podjetje', naziv: 'Nastavitve podjetja' },
  ekipa: { pot: '/nastavitve/clani', naziv: 'Ekipa in dostop' },
  paketi: { pot: '/nastavitve/paketi', naziv: 'Paketi' },
} as const;
type Stran = keyof typeof STRANI;

/** Navodila: kratka, za glas; `stran` = kam peljemo. */
export const TEME = {
  nov_termin: {
    besedilo: 'Nov termin vpišete z gumbom Nov termin na nadzorni plošči ali v koledarju, ali pa v koledarju kliknete na prosto polje. Izberete stranko, storitev in čas; novo stranko lahko dodate kar sproti.',
    stran: 'koledar',
  },
  zakljuci_termin: {
    besedilo: 'Termin zaključite na strani Termini: odprete termin in izberete Zaključi. Po želji dodate sporočilo stranki.',
    stran: 'termini',
  },
  nova_stranka: {
    besedilo: 'Novo stranko dodate na strani Stranke z gumbom za novo stranko, ali pa kar med vpisom termina.',
    stran: 'stranke',
  },
  odsotnost: {
    besedilo: 'Odsotnost vpišete v koledarju z gumbom Odsotnost: izberete zaposlenega ter dneve ali ure.',
    stran: 'koledar',
  },
  delovni_cas_salona: {
    besedilo: 'Delovni čas salona nastavite v Nastavitvah, pod Podjetje, v razdelku Delovni čas.',
    stran: 'podjetje',
  },
  urnik_zaposlenega: {
    besedilo: 'Urnik zaposlenega nastavite na strani Zaposleni: odprete zaposlenega in nastavite prilagojen delovni čas. Vsak dan ima lahko več intervalov.',
    stran: 'zaposleni',
  },
  povabi_sodelavca: {
    besedilo: 'Sodelavca povabite v Nastavitvah, pod Ekipa in dostop, z možnostjo Povabi v ekipo. Tam nastavite tudi, kaj zaposleni smejo videti.',
    stran: 'ekipa',
  },
  storitve: {
    besedilo: 'Storitve urejate na strani Storitve: naziv, trajanje in cena. Iz njih se izračunata trajanje in cena termina.',
    stran: 'storitve',
  },
  resursi: {
    besedilo: 'Resurse, na primer stole, sobe ali aparate, urejate na strani Resursi in jih povežete s storitvami. Termin potem zasede resurs svoje storitve.',
    stran: 'resursi',
  },
  opomniki: {
    besedilo: 'Opomniki so samodejna sporočila strankam pred terminom in po njem. Nastavite jih na strani Opomniki.',
    stran: 'opomniki',
  },
  spletne_rezervacije: {
    besedilo: 'Spletno naročanje strank urejate na strani Spletne rezervacije.',
    stran: 'rezervacije',
  },
  paket: {
    besedilo: 'Paket in dodatke vidite v Nastavitvah, pod Paketi.',
    stran: 'paketi',
  },
  jezik: {
    besedilo: 'Jezik aplikacije zamenjate v meniju profila zgoraj desno.',
    stran: null,
  },
  vodic: {
    besedilo: 'Vodič po aplikaciji ponovite v meniju profila zgoraj desno, z možnostjo Vodič po aplikaciji.',
    stran: null,
  },
  asistent: {
    besedilo: 'Lahko vprašate, kaj imate danes ali jutri, kdo je naslednja stranka, kdaj imate prosto, kdo dela, katero barvo je imela stranka in kdaj je bila zadnjič. Zapišete lahko recepturo ali opombo na kartico stranke; vsako spremembo potrdite z ja. Lahko vas tudi peljem na stran, na primer: odpri koledar.',
    stran: null,
  },
} as const satisfies Record<string, { besedilo: string; stran: Stran | null }>;
type Tema = keyof typeof TEME;

// ───────────────────────────────────────────────────────────────────────────
export const pomocAplikacija: BralnoOrodje<{ tema: Tema }> = {
  ime: 'pomoc_aplikacija',
  opis: 'Kako se kaj naredi v aplikaciji Jedro+ (navodila za uporabo) in kaj zna asistent. Izberi najbližjo temo.',
  razred: 'branje',
  pravica: 'glas.uporaba',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: { tema: { type: 'string', enum: Object.keys(TEME) } },
    required: ['tema'],
    additionalProperties: false,
  },
  vhod: z.object({ tema: z.enum(Object.keys(TEME) as [Tema, ...Tema[]]) }),
  async izvedi({ tema }) {
    const t = TEME[tema];
    return { sporocilo: t.besedilo, govor: t.besedilo, podatki: { tema, stran: t.stran ? STRANI[t.stran].pot : null } };
  },
};

// ───────────────────────────────────────────────────────────────────────────
export const odpriStran: BralnoOrodje<{ stran: Stran; stranka: string | null; stranka_id: string | null }> = {
  ime: 'odpri_stran',
  opis: 'Odpre stran v aplikaciji ("odpri koledar", "pojdi na nastavitve"). Z imenom stranke odpre njeno kartico ("odpri kartico Ane Novak").',
  razred: 'branje',
  pravica: 'glas.uporaba',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      stran: { type: 'string', enum: Object.keys(STRANI), description: 'Za kartico stranke: "stranke".' },
      stranka: { type: ['string', 'null'], description: 'Ime stranke, če naj se odpre njena kartica; sicer null.' },
      stranka_id: { type: ['string', 'null'], description: 'ID stranke, če je že znan, sicer null.' },
    },
    required: ['stran', 'stranka', 'stranka_id'],
    additionalProperties: false,
  },
  vhod: z.object({
    stran: z.enum(Object.keys(STRANI) as [Stran, ...Stran[]]),
    stranka: z.string().trim().min(1).max(80).nullable(),
    stranka_id: z.string().regex(/^\d{1,12}$/).nullable(),
  }),
  async izvedi({ stran, stranka, stranka_id }, o) {
    if (stranka || stranka_id) {
      const r = await razresiStranko(stranka ?? '', stranka_id, o);
      if ('odgovor' in r) return r.odgovor;
      const ime = `${r.stranka.ime} ${r.stranka.priimek}`.trim();
      return {
        sporocilo: `Odpiram kartico: ${ime}.`,
        govor: `Odpiram kartico, ${ime}.`,
        pojdi: `/clients?stranka=${encodeURIComponent(r.stranka.id)}`,
        podatki: { stranka_id: r.stranka.id },
      };
    }
    const s = STRANI[stran];
    return { sporocilo: `Odpiram: ${s.naziv}.`, govor: `Odpiram ${s.naziv}.`, pojdi: s.pot };
  },
};
