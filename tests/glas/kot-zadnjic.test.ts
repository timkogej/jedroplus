// »Isto kot zadnjič« in »čez šest tednov«; »pokliči jo« samo pokaže gumb.
import { beforeAll, describe, expect, it } from 'vitest';
import { obdelajUkaz } from '@/lib/glas/jedro';
import { razberiDatum } from '@/lib/glas/razresevanje/datumi';
import { pripraviTermin } from '@/lib/glas/orodja/obrazci';
import { DANES, kontekst, okolje, podatkiPomnilnik, SALONI } from './pomoc';

const o = (podjetje = 'A1') => ({ k: kontekst({ podjetje }), podatki: podatkiPomnilnik(podjetje), danes: DANES, uraZdaj: '10:00', ukazId: 'u' });
const osnova = { stranka_id: null, storitev: null, oseba: null, datum: null, ura: null, lokacija: null };

beforeAll(() => {
  SALONI.L3.termini.push({
    id: 't32', vrstica: 'v-t32', idStranke: '301', stranka: 'Nika Horvat', datum: '2026-10-01', zacetek: '09:00', konec: '10:30',
    storitev: 'Barvanje', osebaId: 'o31', oseba: 'Luka', status: 'completed', lokacijaId: 'l-siska',
  });
});

describe('čez N dni, tednov, mesecev', () => {
  it.each([
    ['čez šest tednov', '2026-12-24'],
    ['čez 2 tedna', '2026-11-26'],
    ['čez teden', '2026-11-19'],
    ['čez tri dni', '2026-11-15'],
    ['čez en mesec', '2026-12-12'],
  ])('%s → %s', (izraz, datum) => {
    expect(razberiDatum(izraz, DANES)?.datum).toBe(datum);
  });
});

describe('isto kot zadnjič', () => {
  it('storitev in zaposleni iz zadnjega termina', async () => {
    const r = await pripraviTermin.izvedi(pripraviTermin.vhod.parse({ ...osnova, stranka: 'Mateja', datum: 'čez šest tednov', kot_zadnjic: true }), o());
    expect(r.obrazec?.polja).toMatchObject({ stranka: '101', storitev: 's1', oseba: 'o1', dan: '2026-12-24' });
    expect(r.govor).toContain('Barvanje, pri Tini');
    expect(r.govor).toMatch(/Ob kateri uri\?$/);
  });

  it('povedano posebej ima prednost', async () => {
    const r = await pripraviTermin.izvedi(pripraviTermin.vhod.parse({ ...osnova, stranka: 'Mateja', storitev: 'moško striženje', oseba: 'Urška', kot_zadnjic: true }), o());
    expect(r.obrazec?.polja).toMatchObject({ storitev: 's2', oseba: 'o2' });
  });

  it('lokacija zadnjega termina, če zaposleni tam še dela', async () => {
    const r = await pripraviTermin.izvedi(pripraviTermin.vhod.parse({ ...osnova, stranka: 'Nika', kot_zadnjic: true }), o('L3'));
    expect(r.obrazec?.polja).toMatchObject({ storitev: 's31', oseba: 'o31', lokacija: 'l-siska' });
  });

  it('brez prejšnjega termina: pove in odpre obrazec', async () => {
    const r = await pripraviTermin.izvedi(pripraviTermin.vhod.parse({ ...osnova, stranka: 'Špela', kot_zadnjic: true }), o());
    expect(r.sporocilo).toContain('Prejšnjega termina nima.');
    expect(r.obrazec?.vrsta).toBe('nov_termin');
  });
});

describe('pokliči jo', () => {
  it('aktivna stranka → gumb Pokliči, nič se ne pokliče samo', async () => {
    const env = okolje({
      llm: [
        { klici: [{ id: 'a', ime: 'kartica_stranke', vhod: { stranka: 'Mateja', stranka_id: null } }] },
        { klici: [{ id: 'b', ime: 'podatki_stranke', vhod: { stranka: 'Mateja Kovačič', stranka_id: '101', polja: ['telefon'] } }] },
      ],
    });
    const r1 = await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'povej o Mateji' }, env.d);
    if (!r1.ok) throw new Error();
    const r2 = await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'pokliči jo', prejsnjiUkazi: [r1.ukazId] }, env.d);
    if (!r2.ok) throw new Error();
    expect(r2.akcije).toEqual([{ vrsta: 'klic', href: 'tel:041234567' }]);
    expect(r2.status).toBe('odgovor');
    expect(r2.predlog).toBeUndefined();
  });
});
