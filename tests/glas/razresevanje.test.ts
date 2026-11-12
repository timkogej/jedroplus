// Razreševanje imen, datumov, ur in prvega prostega termina.
import { describe, expect, it } from 'vitest';
import { poisci } from '@/lib/glas/razresevanje/imena';
import { razberiDatum, razberiUro, opisDatuma, zdajVPasu } from '@/lib/glas/razresevanje/datumi';
import { prviProstiTermin, razcleniUrnik } from '@/lib/glas/razresevanje/urnik';
import { hitraPot } from '@/lib/glas/hitraPot';
import { SALONI, URNIK, DANES } from './pomoc';

const stranke = SALONI.A1.stranke;
const imena = (s: (typeof stranke)[number]) => [s.ime, s.priimek];

describe('imena strank', () => {
  it('najde stranko v sklonu', () => {
    const r = poisci('Mateje Kovačič', stranke, imena);
    expect(r.izid).toBe('enolicno');
    if (r.izid === 'enolicno') expect(r.najden.id).toBe('101');
  });

  it('najde stranko brez šumnikov in z manjšo napako prepisa', () => {
    for (const q of ['Mateja Kovacic', 'Matejo Kovačičevo', 'Špelo Zagar', 'spela žagar']) {
      const r = poisci(q, stranke, imena);
      expect(r.izid, q).toBe('enolicno');
    }
  });

  it('pri več podobnih imenih vpraša in ne izbere sam', () => {
    const r = poisci('Ana', stranke, imena);
    expect(r.izid).toBe('vec');
    expect(r.kandidati.map((k) => k.vrednost.id).sort()).toEqual(['102', '103']);
  });

  it('podobna priimka (Novak / Novinc) z imenom razloči', () => {
    const r = poisci('Ano Novak', stranke, imena);
    expect(r.izid).toBe('enolicno');
    if (r.izid === 'enolicno') expect(r.najden.id).toBe('102');
  });

  it('neznano ime vrne nič', () => {
    expect(poisci('Bojan Zupan', stranke, imena).izid).toBe('nic');
    expect(poisci('stranka', stranke, imena).izid).toBe('nic');
  });
});

describe('datumi (danes je četrtek 12. 11. 2026)', () => {
  const d = (s: string) => razberiDatum(s, DANES)?.datum ?? null;

  it('relativni izrazi', () => {
    expect(d('kaj imam danes')).toBe('2026-11-12');
    expect(d('kaj imam jutri')).toBe('2026-11-13');
    expect(d('pojutrišnjem')).toBe('2026-11-14');
    expect(d('včeraj')).toBe('2026-11-11');
  });

  it('dnevi v tednu pomenijo naslednji tak dan', () => {
    expect(d('v petek')).toBe('2026-11-13');
    expect(d('v ponedeljek')).toBe('2026-11-16');
    expect(d('v četrtek')).toBe('2026-11-19'); // danes je četrtek → naslednji
    expect(d('v sredo')).toBe('2026-11-18');
  });

  it('številski datumi in imena mesecev', () => {
    expect(d('kaj imam 18. 11.')).toBe('2026-11-18');
    expect(d('3. 1.')).toBe('2027-01-03'); // pretekli datum → naslednje leto
    expect(d('15. decembra')).toBe('2026-12-15');
  });

  it('ura ni datum', () => {
    expect(d('ob 15.30')).toBeNull();
    expect(d('okoli 9.00')).toBeNull();
  });

  it('opis datuma za odgovor', () => {
    expect(opisDatuma('2026-11-13', DANES)).toBe('jutri, petek, 13. 11.');
    expect(opisDatuma('2026-11-12', DANES)).toBe('danes, četrtek, 12. 11.');
  });

  it('čas v pasu salona (zimski čas)', () => {
    expect(zdajVPasu(new Date('2026-11-12T23:30:00Z'), 'Europe/Ljubljana')).toEqual({ datum: '2026-11-13', ura: '00:30' });
  });
});

describe('ure', () => {
  it('pogovorne ure', () => {
    expect(razberiUro('ob 9')).toBe('09:00');
    expect(razberiUro('ob 15.30')).toBe('15:30');
    expect(razberiUro('pol treh')).toBe('14:30');
    expect(razberiUro('ob dveh')).toBe('14:00');
    expect(razberiUro('ob sedmih zjutraj')).toBe('07:00');
    expect(razberiUro('ob desetih')).toBe('10:00');
  });
});

describe('hitra pot brez LLM', () => {
  it('prepozna samo celoten stavek o koledarju', () => {
    expect(hitraPot('Kaj imam jutri?')).toEqual({ orodje: 'koledar_dan', vhod: { datum: 'jutri', samo_moji: true } });
    expect(hitraPot('kaj imamo v petek')).toEqual({ orodje: 'koledar_dan', vhod: { datum: 'v petek', samo_moji: false } });
    expect(hitraPot('Jutri, kaj imam?')).toEqual({ orodje: 'koledar_dan', vhod: { datum: 'jutri', samo_moji: true } });
    expect(hitraPot('Kaj imam')?.vhod).toEqual({ datum: null, samo_moji: true });
  });

  it('vse ostalo gre LLM', () => {
    expect(hitraPot('kaj imam jutri za Ano')).toBeNull();
    expect(hitraPot('zapiši barvo 6.3')).toBeNull();
    expect(hitraPot('kaj imamo jutri, potem izbriši vse')).toBeNull();
  });
});

describe('prvi prosti termin', () => {
  const urnik = razcleniUrnik(URNIK);
  const osebe = [{ id: 'o1', urnik }];

  it('preskoči zasedene termine in upošteva trajanje', () => {
    const r = prviProstiTermin({
      odDatuma: '2026-11-13', odUre: null, dni: 7, trajanjeMin: 90, osebe, odsotnosti: [], casovniPas: 'Europe/Ljubljana',
      termini: SALONI.A1.termini,
    });
    // 08:00–09:00 je premalo za 90 min, 09:00–10:30 zasedeno → 10:30
    expect(r).toEqual({ datum: '2026-11-13', zacetek: '10:30', konec: '12:00', osebaId: 'o1' });
  });

  it('danes ne ponudi preteklega časa, ob vikendu preskoči', () => {
    const r = prviProstiTermin({
      odDatuma: '2026-11-13', odUre: '15:00', dni: 7, trajanjeMin: 90, osebe, termini: [], odsotnosti: [], casovniPas: 'Europe/Ljubljana',
    });
    expect(r).toEqual({ datum: '2026-11-16', zacetek: '08:00', konec: '09:30', osebaId: 'o1' });
  });

  it('upošteva odsotnost in odpovedane termine ne šteje', () => {
    const r = prviProstiTermin({
      odDatuma: '2026-11-13', odUre: '11:45', dni: 1, trajanjeMin: 30, osebe, termini: SALONI.A1.termini,
      odsotnosti: [{ osebaId: 'o1', zacetek: '2026-11-13T11:00:00Z', konec: '2026-11-13T13:00:00Z' }], // 12:00–14:00 lokalno
      casovniPas: 'Europe/Ljubljana',
    });
    expect(r?.zacetek).toBe('14:00');
  });

  it('starejši format urnika {enabled,start,end}', () => {
    const star = razcleniUrnik({ Ponedeljek: { enabled: true, start: '10:00', end: '12:00' } });
    const r = prviProstiTermin({
      odDatuma: '2026-11-16', odUre: null, dni: 1, trajanjeMin: 60, osebe: [{ id: 'x', urnik: star }], termini: [], odsotnosti: [], casovniPas: 'Europe/Ljubljana',
    });
    expect(r?.zacetek).toBe('10:00');
  });
});
