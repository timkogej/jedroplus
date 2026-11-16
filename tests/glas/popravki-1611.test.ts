// Popravki po Timovih testih 16. 11.: iskanje terminov stranke, fokus pogovora, uglajen govor, datumi.
import { describe, expect, it } from 'vitest';
import { obdelajUkaz } from '@/lib/glas/jedro';
import { brezIdjev, datumZaGovor, stevilaZaGovor, uglajenGovor, uglajenoBesedilo } from '@/lib/glas/govor';
import { opisDatuma } from '@/lib/glas/razresevanje/datumi';
import { iskanjeStranke } from '@/lib/glas/orodja/branje';
import { sporociStranki } from '@/lib/glas/orodja/sporocila';
import { terminJeStranke } from '@/lib/glas/orodja/stranke';
import { jePredogled, type OkoljeOrodja } from '@/lib/glas/orodja/tipi';
import type { PodatkiSalona, TerminPovzetek } from '@/lib/glas/tipi';
import { DANES, kontekst, okolje, podatkiPomnilnik, posiljateljLazni } from './pomoc';

const termin = (p: Partial<TerminPovzetek>): TerminPovzetek => ({
  id: 'tx', vrstica: 'v-tx', idStranke: null, stranka: 'Ana Novinc', datum: '2026-11-13', zacetek: '15:00', konec: '16:00',
  storitev: 'Barvanje', osebaId: 'o1', oseba: 'Tina', status: 'scheduled', lokacijaId: null, ...p,
});

describe('uglajeno besedilo in govor', () => {
  it('brez ID-jev termina, stranke in UUID', () => {
    expect(brezIdjev('Termin (ID: 48213) je jutri.')).toBe('Termin je jutri.');
    expect(brezIdjev('Našla sem termin ID termina 7LHB28-9 ob desetih.')).toBe('Našla sem termin ob desetih.');
    expect(brezIdjev('Opomnik (opomnik_id: 3f2a) je shranjen.')).toBe('Opomnik je shranjen.');
    expect(brezIdjev('Shranjeno 0b5c9a7e-1d2f-4a3b-9c8d-112233445566.')).toBe('Shranjeno.');
    // Imena in navadne besede ostanejo.
    expect(brezIdjev('Ida Novak pride ob desetih.')).toBe('Ida Novak pride ob desetih.');
  });

  it('pogovorne besede zamenja z vljudnimi', () => {
    expect(uglajenoBesedilo('Važi, nastavim.')).toBe('Velja, nastavim.');
    expect(uglajenoBesedilo('Okej, pošljem.')).toBe('V redu, pošljem.');
  });

  it('števniki za glas: en termin, sta dva termina, so trije termini', () => {
    expect(stevilaZaGovor('Danes imate 1 termin.')).toBe('Danes imate en termin.');
    expect(stevilaZaGovor('Jutri je 2 termina.')).toBe('Jutri sta dva termina.');
    expect(stevilaZaGovor('Jutri je 3 termine.')).toBe('Jutri so trije termini.');
    expect(stevilaZaGovor('Imate 1 opomnik in 2 sporočili.')).toBe('Imate en opomnik in dve sporočili.');
    expect(stevilaZaGovor('Ob 1 uri.')).toBe('Ob 1 uri.');
    expect(uglajenGovor('danes imate 1 termin')).toBe('Danes imate en termin');
  });

  it('ta teden samo dan, naslednji teden z datumom (danes je četrtek 12. 11.)', () => {
    expect(datumZaGovor('2026-11-12', DANES)).toBe('danes');
    expect(datumZaGovor('2026-11-13', DANES)).toBe('jutri, v petek');
    expect(datumZaGovor('2026-11-17', DANES)).toBe('v torek');
    expect(datumZaGovor('2026-11-19', DANES)).toBe('v četrtek, 19. novembra');
    expect(opisDatuma('2026-11-12', DANES)).toBe('danes');
    expect(opisDatuma('2026-11-16', DANES)).toBe('ponedeljek');
    expect(opisDatuma('2026-11-19', DANES)).toBe('četrtek, 19. 11.');
  });
});

describe('termin stranke', () => {
  const ana = { id: '103', ime: 'Ana', priimek: 'Novinc', zadnjaInterakcija: null };
  it('po ID-ju ali (brez ID-ja) po enakem imenu; tuj ID ni njen', () => {
    expect(terminJeStranke(termin({ idStranke: '103' }), ana)).toBe(true);
    expect(terminJeStranke(termin({ idStranke: null, stranka: 'Novinc Ana' }), ana)).toBe(true);
    expect(terminJeStranke(termin({ idStranke: null, stranka: 'Ana Novak' }), ana)).toBe(false);
    expect(terminJeStranke(termin({ idStranke: '999' }), ana)).toBe(false);
  });

  function o(dodatni: TerminPovzetek[]): OkoljeOrodja {
    const p = podatkiPomnilnik('A1');
    const podatki: PodatkiSalona = {
      ...p,
      termini: async (od, doo, m) => [...(await p.termini(od, doo, m)), ...dodatni.filter((t) => t.datum >= od && t.datum <= doo)],
      podrobnostiStranke: async (id, d) => (id === '103' ? { telefon: '041 000 111', email: null, jezik: 'slo', opombe: null, marketing: null } as never : p.podrobnostiStranke(id, d)),
    };
    return { k: kontekst(), podatki, danes: DANES, uraZdaj: '10:00', ukazId: null, sporocila: posiljateljLazni() };
  }

  it('sporočilo najde termin brez ID stranke po imenu', async () => {
    const p = await sporociStranki.predogled(
      { stranka: 'Ana Novinc', stranka_id: null, termin_id: null, datum_termina: null, besedilo: 'Pozdravljeni, parkirajte pri Lidlu.', jezik_besedila: 'sl', o_odpovedi: false, podpis: true },
      o([termin({ id: 'tx', idStranke: null })])
    );
    if (!jePredogled(p)) throw new Error(JSON.stringify(p));
    expect(p.parametri).toMatchObject({ idTermina: 'tx', idStranke: '103' });
  });

  it('iskanje vrne naslednji termin iz koledarja, ne »zadnje interakcije«', async () => {
    const r = await iskanjeStranke.izvedi({ ime: 'Mateja Kovačič' }, o([]));
    expect(r.podatki).toMatchObject([{ id: '101', naslednji_termin: { termin_id: 't1', datum: '2026-11-13' }, zadnji_termin: { datum: '2026-10-20' } }]);
    expect(r.sporocilo).toBe('Najdena: Mateja Kovačič (naslednjič jutri, petek).');
  });
});

describe('fokus pogovora', () => {
  it('nova stranka postane aktivna, tudi če orodje ne uspe (»nima termina«)', async () => {
    const klic = (stranka: string) => ({
      klici: [{ id: 'k', ime: 'sporoci_stranki', vhod: { stranka, stranka_id: null, termin_id: null, datum_termina: null, besedilo: 'Pozdravljeni.', jezik_besedila: 'sl', o_odpovedi: false, podpis: true } }],
    });
    const env = okolje({ llm: [klic('Mateja'), klic('Ana Novinc'), { besedilo: 'Ana Novinc nima termina.' }] });
    const zg: string[] = [];
    const r1 = await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'Sporoči Mateji, da zamujamo.', prejsnjiUkazi: zg }, env.d);
    if (!r1.ok) throw new Error();
    zg.push(r1.ukazId!);
    const r2 = await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'Sporoči Ani Novinc, naj parkira pri Lidlu.', prejsnjiUkazi: zg }, env.d);
    if (!r2.ok) throw new Error();
    // Mateja (in njen termin) ni več aktivna: »uredi besedilo« gre na Ano.
    expect(env.shramba.ukazi.get(r2.ukazId!)?.zakljucen?.kontekst).toEqual({ stranka_id: '103' });
  });
});
