// lib/glas/orodja/rezervirano.ts
//
// Faza 2 (ustvari / premakni / prekliči termin): oblika je rezervirana, orodja
// so ONEMOGOČENA (omogoceno: false) — LLM jih ne vidi, jedro jih ne izvede.
//
// Pred vklopom (glej docs/glasovni-asistent-nacrt.md §14):
//   * izvedba prek obstoječih n8n dogodkov (NOV_TERMIN, POSODOBITEV_TERMINA +
//     PRESTAVITEV_TERMINA_OBVESTILO, ODPOVED_TERMINA) s strežnika, z istim
//     preverjanjem lokacije kot app/api/webhook/route.ts in čakanjem na zapis
//     (lib/confirmWrite.ts);
//   * preverjanje prekrivanja in resursov pred predlogom;
//   * ODPOVED_TERMINA danes ne pošlje SMS-a — obvestilo je treba dodati;
//   * dva termina isti dan = namenoma dva SMS (ne združuj);
//   * tvoja potrditev.

import { z } from 'zod';
import type { PisalnoOrodje } from './tipi';
import { jt } from '../jeziki/t';

const NEIZVEDENO = async () => ({ sporocilo: jt('To dejanje še ni na voljo.') });

function rezervirano<P>(ime: string, opis: string, pravica: PisalnoOrodje<P>['pravica'], shema: PisalnoOrodje<P>['shema'], vhod: z.ZodType<P>): PisalnoOrodje<P> {
  return {
    ime,
    opis,
    razred: 'sporocila',
    pravica,
    omogoceno: false,
    shema,
    vhod,
    shranjeno: z.record(z.string(), z.unknown()),
    predogled: NEIZVEDENO,
    potrdi: NEIZVEDENO,
  };
}

export const ustvariTermin = rezervirano(
  'ustvari_termin',
  'Ustvari termin za stranko (pošlje potrdilo stranki).',
  'termini.ustvarjanje',
  {
    type: 'object',
    properties: {
      stranka: { type: 'string' },
      stranka_id: { type: ['string', 'null'] },
      storitev: { type: 'string' },
      datum: { type: 'string' },
      ura: { type: 'string' },
      oseba: { type: ['string', 'null'] },
    },
    required: ['stranka', 'stranka_id', 'storitev', 'datum', 'ura', 'oseba'],
    additionalProperties: false,
  },
  z.object({
    stranka: z.string(), stranka_id: z.string().nullable(), storitev: z.string(),
    datum: z.string(), ura: z.string(), oseba: z.string().nullable(),
  })
);

export const premakniTermin = rezervirano(
  'premakni_termin',
  'Premakne obstoječi termin na drug čas (obvesti stranko).',
  'termini.urejanje',
  {
    type: 'object',
    properties: { termin_id: { type: 'string' }, datum: { type: 'string' }, ura: { type: 'string' } },
    required: ['termin_id', 'datum', 'ura'],
    additionalProperties: false,
  },
  z.object({ termin_id: z.string(), datum: z.string(), ura: z.string() })
);

export const prekliciTermin = rezervirano(
  'preklici_termin',
  'Prekliče termin (obvesti stranko).',
  'termini.urejanje',
  {
    type: 'object',
    properties: { termin_id: { type: 'string' }, razlog: { type: ['string', 'null'] } },
    required: ['termin_id', 'razlog'],
    additionalProperties: false,
  },
  z.object({ termin_id: z.string(), razlog: z.string().nullable() })
);
