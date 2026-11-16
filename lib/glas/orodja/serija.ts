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
import { razresiStranko, vzorcniTermin } from './stranke';
import type { BralnoOrodje } from './tipi';

type VhodTermina = Parameters<typeof pripraviTermin.izvedi>[0];
type VhodSerije = VhodTermina & { vsakih_tednov: number; stevilo: number | null; do_datuma: string | null; brez_datumov?: string[] | null };

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
      datum: { type: ['string', 'null'], description: 'Dan PRVEGA termina: povedan dan ("začni v torek", "prvi jutri") ali dan v tednu iz ritma ("vsak torek" → "v torek") ali YYYY-MM-DD. Brez dneva null (orodje vzame en ritem po današnjem ali zadnjem terminu stranke): "ponovi termin", "enako kot danes", "za naslednje tri tedne" → null.' },
      vsakih_tednov: { type: 'integer', minimum: 1, maximum: 26, description: 'Na koliko tednov: "vsak teden"/"vsak torek" = 1, "vsakih 14 dni" = 2, "vsakih šest tednov" = 6, "enkrat na mesec" = 4.' },
      stevilo: { type: ['integer', 'null'], description: 'Koliko terminov skupaj, vključno s prvim ("šestkrat" = 6; "za tri tedne", "naslednje tri tedne" = 3, prvi čez en teden); null, če je povedan končni datum.' },
      do_datuma: { type: ['string', 'null'], description: 'Zadnji možen dan ("do konca leta" → YYYY-12-31, "do marca") kot YYYY-MM-DD ali izraz; null, če je povedano število.' },
      brez_datumov: {
        type: ['array', 'null'],
        items: { type: 'string' },
        description: 'Datumi serije, ki jih uporabnik noče ("7. decembra ne", "brez tistega pred božičem") kot YYYY-MM-DD; ob popravku pošlji vse izločene; sicer null.',
      },
    },
    required: [...(pripraviTermin.shema.required as string[]), 'vsakih_tednov', 'stevilo', 'do_datuma'],
    additionalProperties: false,
  },
  vhod: (pripraviTermin.vhod as unknown as z.ZodObject<z.ZodRawShape>).extend({
    vsakih_tednov: z.number().int().min(1).max(26),
    stevilo: z.number().int().min(1).max(100).nullable(),
    do_datuma: z.string().max(60).nullable(),
    brez_datumov: z.array(z.string().max(40)).max(12).nullable().optional(),
  }) as unknown as z.ZodType<VhodSerije>,
  async izvedi(p, o) {
    if (!p.stevilo && !p.do_datuma) return { sporocilo: jt('Kolikokrat ali do kdaj naj ponovim?') };
    const doDatuma = p.do_datuma ? datumIzParametra(p.do_datuma, o.danes) : null;
    if (p.do_datuma && !doDatuma) return { sporocilo: jt('Datuma »{datum}« ne razumem.', { datum: p.do_datuma }) };

    const { vsakih_tednov, stevilo } = p;
    // Serija je skoraj vedno »isto kot«: storitev, zaposleni (Tim, 16. 11.: »kar isti zaposleni«)
    // in ura iz današnjega ali zadnjega termina stranke; kar uporabnik pove posebej, ima prednost.
    // (Model pogosto pošlje kot_zadnjic false, ko uporabnik ne reče ničesar; zato vedno.)
    const vhodTermina = { ...p, kot_zadnjic: true } as VhodTermina;
    {
      const rs = await razresiStranko(p.stranka, p.stranka_id, o);
      const vz = 'stranka' in rs ? await vzorcniTermin(o, rs.stranka) : null;
      if ('stranka' in rs && vz) {
        vhodTermina.stranka_id = rs.stranka.id;
        if (!p.ura) vhodTermina.ura = vz.zacetek;
        // »Ponovi termin za naslednje tri tedne«: prvi je en ritem po vzorcu (ne danes).
        // Prvi na dan vzorca (»ponovi današnji termin« → model pošlje »danes«) bi bil vzorec sam.
        const povedan = p.datum ? datumIzParametra(p.datum, o.danes) : null;
        if (!p.datum || povedan === vz.datum) {
          let d = dodajDni(vz.datum, vsakih_tednov * 7);
          while (d <= o.danes) d = dodajDni(d, vsakih_tednov * 7);
          vhodTermina.datum = d;
        }
      }
    }
    // Dodatna polja (ritem) pripravi_termin prezre.
    const r = await pripraviTermin.izvedi(vhodTermina, o);
    if (!r.obrazec) return r;
    const polja = r.obrazec.polja;
    const prvi = polja.dan ?? null;
    const ura = polja.ura ?? null;

    // Brez prvega dne ne vemo, koliko jih bo do končnega datuma: privzeto največ.
    const datumi = datumiSerije(prvi ?? o.danes, { vsakihTednov: vsakih_tednov, stevilo, doDatuma });
    if (datumi.length < 2) return { sporocilo: jt('Do tega datuma je samo en termin. Za en termin recite »vpiši«.') };
    const omejeno = (stevilo ?? 0) > NAJVEC_TERMINOV || (doDatuma !== null && datumi.length === NAJVEC_TERMINOV && dodajDni(datumi[datumi.length - 1], vsakih_tednov * 7) <= doDatuma);
    polja.ponovi = `${vsakih_tednov}:${datumi.length}`;
    // »Ta datum ne«: datum ostane v pregledu, a odkljukan (ne shrani se).
    const brez = [...new Set((p.brez_datumov ?? []).map((d) => datumIzParametra(d, o.danes)).filter((d): d is string => !!d && datumi.includes(d)))];
    if (p.brez_datumov?.length && brez.length === 0) {
      return { sporocilo: jt('Tega datuma ni v seriji. Datumi: {datumi}.', { datumi: datumi.map((d) => opisDatuma(d, o.danes)).join('; ') }) };
    }
    if (brez.length >= datumi.length - 1) return { sporocilo: jt('Ostal bi samo en termin. Za en termin recite »vpiši«.') };
    if (brez.length) polja.ponovi_brez = brez.join(',');

    const tedni = vsakih_tednov === 1 ? jt('vsak teden') : jt('{t|vsak|vsaka|vsake|vsakih} {t} {t|teden|tedna|tedne|tednov}', { t: vsakih_tednov });
    const ritem = `${jt('{n} {n|termin|termina|termini|terminov}', { n: datumi.length - brez.length })}, ${tedni}`;
    const izloceni = brez.length ? ` ${jt('Brez: {datumi}.', { datumi: brez.map((d) => opisDatuma(d, o.danes)).join(', ') })}` : '';
    const izloceniGovor = brez.length ? ` ${jt('Brez: {datumi}.', { datumi: brez.map((d) => datumZaGovor(d, o.danes)).join(', ') })}` : '';
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
    // Izločeni datumi niso težava (se ne shranijo).
    const tezave = (preverjeno ?? []).filter((d) => d.stanje !== 'ok' && !brez.includes(d.zeleno?.datum ?? d.datum));
    const zadnji = datumi[datumi.length - 1];
    // »7. 12.« se že konča s piko: brez »7. 12..«.
    const obdobje = prvi ? ` ${jt('Zadnji {datum}.', { datum: opisDatuma(zadnji, o.danes) }).replace(/\.\.$/, '.')}` : '';
    const stanje = !preverjeno
      ? ` ${jt('Datume preverim, ko bodo izpolnjeni dan, ura in zaposleni.')}`
      : tezave.length
      ? ` ${jt('Prostih je {n} od {od}. Težave:', { n: preverjeno.length - brez.length - tezave.length, od: preverjeno.length - brez.length })}\n${tezave.map((d) => `• ${opisTezave(d, o.danes)}`).join('\n')}\n`
      : ` ${jt('Vsi datumi so prosti.')}`;
    const stanjeGovor = !preverjeno
      ? ` ${jt('Datume preverim, ko bodo izpolnjeni dan, ura in zaposleni.')}`
      : tezave.length
      ? ` ${jt('{n} {n|datum ni prost|datuma nista prosta|datumi niso prosti|datumov ni prostih}, predloge vidite na zaslonu.', { n: tezave.length })}`
      : ` ${jt('Vsi datumi so prosti.')}`;

    const out: RezultatOrodja = {
      ...r,
      sporocilo: `${osnova} ${jt('Serija: {ritem}.', { ritem })}${izloceni}${obdobje}${meja}${stanje}${stanje.endsWith('\n') ? '' : ' '}${sklep}`.replace(/\n /g, '\n'),
      govor: `${osnovaGovor} ${jt('Serija: {ritem}.', { ritem })}${izloceniGovor}${prvi ? ` ${jt('Zadnji {datum}.', { datum: datumZaGovor(zadnji, o.danes) }).replace(/\.\.$/, '.')}` : ''}${meja}${stanjeGovor} ${sklep}`,
      obrazec: { vrsta: 'nov_termin', polja },
      podatki: {
        ...(r.podatki ?? {}),
        serija: { vsakih_tednov, stevilo: datumi.length - brez.length, datumi, brez, zadnji, prostih: preverjeno ? preverjeno.length - brez.length - tezave.length : null },
      },
    };
    return out;
  },
};
