// lib/glas/orodja/serija.ts
//
// Ponavljajoči termini (docs/glasovni-asistent-dodatne-funkcije-nacrt.md, §6):
// »Vpiši Ano vsakih šest tednov ob desetih, šestkrat.«
//
// Bralno orodje: razreši stranko, storitev, zaposleno in čas kot pripravi_termin, preveri
// VSE datume serije (delovni čas, odsotnosti, prekrivanje; predlog za zasedene) in odpre
// obstoječi obrazec za nov termin z vklopljenim »Ponovi«. Nič ne shrani: po »ja« koledar
// pokaže pregled vseh datumov, shrani pa uporabnik z gumbom (vsak termin po isti poti
// kot ročni, vsak s svojim potrdilom).

import { z } from 'zod';
import { datumZaGovor } from '../govor';
import { jt } from '../jeziki/t';
import { dodajDni, opisDatuma } from '../razresevanje/datumi';
import type { RezultatOrodja } from '../tipi';
import { datumiSerije, NAJVEC_TERMINOV, type DatumSerije } from '@/lib/termini/serija';
import { preveriSerijoSalona } from '@/lib/termini/preveriSerijoSalona';
import { datumIzParametra } from './branje';
import { pripraviTermin } from './obrazci';
import type { BralnoOrodje } from './tipi';

type VhodTermina = Parameters<typeof pripraviTermin.izvedi>[0];
type VhodSerije = VhodTermina & { vsakih_tednov: number; stevilo: number | null; do_datuma: string | null };

const SHRANI = 'Shranim?';
const lastnostiTermina = pripraviTermin.shema.properties as Record<string, unknown>;

function opisTezave(d: DatumSerije, danes: string): string {
  const kdaj = opisDatuma(d.zeleno!.datum, danes);
  if (d.stanje === 'premaknjen') {
    const predlog = `${opisDatuma(d.datum, danes)} ${jt('ob {ura}', { ura: d.ura })}`;
    return d.razlog === 'zaseden'
      ? jt('{kdaj}: zasedeno ({kdo}), predlog {predlog}', { kdaj, kdo: d.zasedenZ ?? '', predlog })
      : jt('{kdaj}: ne dela, predlog {predlog}', { kdaj, predlog });
  }
  return d.razlog === 'zaseden' ? jt('{kdaj}: zasedeno, v treh dneh ni prostega', { kdaj }) : jt('{kdaj}: ne dela, v treh dneh ni prostega', { kdaj });
}

export const pripraviSerijo: BralnoOrodje<VhodSerije> = {
  ime: 'pripravi_serijo',
  opis:
    'Ponavljajoči termin (serija): ista stranka in storitev v enakem ritmu ("vsakih šest tednov, šestkrat", "vsak torek ob 17h do konca leta"). ' +
    'Preveri vse datume in odpre obrazec za nov termin z vklopljenim »Ponovi«. Največ 12 terminov ali eno leto. Ničesar ne shrani. ' +
    'Za en sam termin uporabi pripravi_termin.',
  razred: 'branje',
  pravica: 'termini.ustvarjanje',
  omogoceno: true,
  shema: {
    type: 'object',
    properties: {
      ...lastnostiTermina,
      datum: { type: ['string', 'null'], description: 'Dan PRVEGA termina, ki ga je uporabnik izgovoril ("v torek", "jutri") ali YYYY-MM-DD; null, če ga ni povedal.' },
      vsakih_tednov: { type: 'integer', minimum: 1, maximum: 26, description: 'Na koliko tednov: "vsak teden"/"vsak torek" = 1, "vsakih 14 dni" = 2, "vsakih šest tednov" = 6, "enkrat na mesec" = 4.' },
      stevilo: { type: ['integer', 'null'], description: 'Koliko terminov skupaj, vključno s prvim ("šestkrat" = 6); null, če je povedan končni datum.' },
      do_datuma: { type: ['string', 'null'], description: 'Zadnji možen dan ("do konca leta" → YYYY-12-31, "do marca") kot YYYY-MM-DD ali izraz; null, če je povedano število.' },
    },
    required: [...(pripraviTermin.shema.required as string[]), 'vsakih_tednov', 'stevilo', 'do_datuma'],
    additionalProperties: false,
  },
  vhod: (pripraviTermin.vhod as unknown as z.ZodObject<z.ZodRawShape>).extend({
    vsakih_tednov: z.number().int().min(1).max(26),
    stevilo: z.number().int().min(1).max(100).nullable(),
    do_datuma: z.string().max(60).nullable(),
  }) as unknown as z.ZodType<VhodSerije>,
  async izvedi(p, o) {
    if (!p.stevilo && !p.do_datuma) return { sporocilo: jt('Kolikokrat ali do kdaj naj ponovim?') };
    const doDatuma = p.do_datuma ? datumIzParametra(p.do_datuma, o.danes) : null;
    if (p.do_datuma && !doDatuma) return { sporocilo: jt('Datuma »{datum}« ne razumem.', { datum: p.do_datuma }) };

    const { vsakih_tednov, stevilo } = p;
    // Dodatna polja (ritem) pripravi_termin prezre.
    const r = await pripraviTermin.izvedi(p as VhodTermina, o);
    if (!r.obrazec) return r;
    const polja = r.obrazec.polja;
    const prvi = polja.dan ?? null;
    const ura = polja.ura ?? null;

    // Brez prvega dne ne vemo, koliko jih bo do končnega datuma: privzeto največ.
    const datumi = datumiSerije(prvi ?? o.danes, { vsakihTednov: vsakih_tednov, stevilo, doDatuma });
    if (datumi.length < 2) return { sporocilo: jt('Do tega datuma je samo en termin. Za en termin recite »vpiši«.') };
    const omejeno = (stevilo ?? 0) > NAJVEC_TERMINOV || (doDatuma !== null && datumi.length === NAJVEC_TERMINOV && dodajDni(datumi[datumi.length - 1], vsakih_tednov * 7) <= doDatuma);
    polja.ponovi = `${vsakih_tednov}:${datumi.length}`;

    const tedni = vsakih_tednov === 1 ? jt('vsak teden') : jt('{t|vsak|vsaka|vsake|vsakih} {t} {t|teden|tedna|tedne|tednov}', { t: vsakih_tednov });
    const ritem = `${jt('{n} {n|termin|termina|termini|terminov}', { n: datumi.length })}, ${tedni}`;
    const meja = omejeno ? ` ${jt('Največ {n} terminov naenkrat.', { n: NAJVEC_TERMINOV })}` : '';
    const osnova = r.sporocilo.endsWith(` ${jt(SHRANI)}`) ? r.sporocilo.slice(0, -` ${jt(SHRANI)}`.length) : r.sporocilo;
    const osnovaGovor = r.govor && r.govor.endsWith(` ${jt(SHRANI)}`) ? r.govor.slice(0, -` ${jt(SHRANI)}`.length) : r.govor ?? osnova;
    const sklep = jt('Shranim? Pred shranjevanjem boste videli vse datume.');

    let preverjeno: DatumSerije[] | null = null;
    const oseba = polja.oseba ? (await o.podatki.osebe()).find((x) => x.id === polja.oseba) ?? null : null;
    if (prvi && ura && oseba) {
      const storitev = polja.storitev ? (await o.podatki.storitve()).find((x) => x.id === polja.storitev) ?? null : null;
      preverjeno = await preveriSerijoSalona(o.podatki, {
        oseba,
        prvi,
        ura,
        trajanjeMin: storitev?.trajanjeMin ?? 60,
        ritem: { vsakihTednov: vsakih_tednov, stevilo, doDatuma },
        casovniPas: o.k.casovniPas,
        danes: o.danes,
        uraZdaj: o.uraZdaj,
      });
    }
    const tezave = (preverjeno ?? []).filter((d) => d.stanje !== 'ok');
    const zadnji = datumi[datumi.length - 1];
    const obdobje = prvi ? ` ${jt('Zadnji {datum}.', { datum: opisDatuma(zadnji, o.danes) })}` : '';
    const stanje = !preverjeno
      ? ` ${jt('Datume preverim, ko bodo izpolnjeni dan, ura in zaposleni.')}`
      : tezave.length
      ? ` ${jt('Prostih je {n} od {od}. Težave:', { n: preverjeno.length - tezave.length, od: preverjeno.length })}\n${tezave.map((d) => `• ${opisTezave(d, o.danes)}`).join('\n')}\n`
      : ` ${jt('Vsi datumi so prosti.')}`;
    const stanjeGovor = !preverjeno
      ? ` ${jt('Datume preverim, ko bodo izpolnjeni dan, ura in zaposleni.')}`
      : tezave.length
      ? ` ${jt('{n} {n|datum ni prost|datuma nista prosta|datumi niso prosti|datumov ni prostih}, predloge vidite na zaslonu.', { n: tezave.length })}`
      : ` ${jt('Vsi datumi so prosti.')}`;

    const out: RezultatOrodja = {
      ...r,
      sporocilo: `${osnova} ${jt('Serija: {ritem}.', { ritem })}${obdobje}${meja}${stanje}${stanje.endsWith('\n') ? '' : ' '}${sklep}`.replace(/\n /g, '\n'),
      govor: `${osnovaGovor} ${jt('Serija: {ritem}.', { ritem })}${prvi ? ` ${jt('Zadnji {datum}.', { datum: datumZaGovor(zadnji, o.danes) })}` : ''}${meja}${stanjeGovor} ${sklep}`,
      obrazec: { vrsta: 'nov_termin', polja },
      podatki: {
        ...(r.podatki ?? {}),
        serija: { vsakih_tednov, stevilo: datumi.length, zadnji, prostih: preverjeno ? preverjeno.length - tezave.length : null },
      },
    };
    return out;
  },
};
