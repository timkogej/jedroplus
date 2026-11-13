// Potek pogovora: konec govora, prekinitev, odmev, lokalni odzivi (lib/glas/odjemalec/tok.ts).
import { describe, expect, it } from 'vitest';
import {
  besedeGovora,
  cakanjePoKoncu,
  CAKANJE,
  jeNadaljevanje,
  jePrekinitev,
  lokalniOdziv,
  napakaZaGovor,
  odstraniOdmev,
  rms,
  tujeBesede,
} from '@/lib/glas/odjemalec/tok';

describe('cakanjePoKoncu', () => {
  // Prepisi, kot jih je Soniox dal v meritvi 13. 11. 2026 ob premoru sredi stavka.
  it.each([
    'Zapiši nov termin za Anjo Novak ob.',
    'Prestavi Matejo na.',
    'Zapiši termin za.',
    'Zapiši termin za Anjo Novak in—',
    'Vpiši Ano Novak jutri,',
    'Zapiši termin pri',
    'Ob pol',
    'Uh, zapiši nov termin za',
    'Zapiši nov',
    'Jutri ob deseti, ehm',
  ])('nedokončano: %s', (s) => {
    expect(cakanjePoKoncu(s)).toBe(CAKANJE.nedokoncano);
  });

  it.each(['Uh.', 'Ehm', 'uh, ehm', ''])('samo mašilo: %s', (s) => {
    expect(cakanjePoKoncu(s)).toBe(CAKANJE.samoMasilo);
  });

  it.each(['Ja.', 'Shrani.', 'Ne.', 'Kaj imam jutri?', 'Za Anjo Novak.', 'Mhm.'])('kratko: %s', (s) => {
    expect(cakanjePoKoncu(s)).toBe(CAKANJE.kratko);
  });

  it.each(['Vpiši Ano Novak jutri ob desetih na barvanje pri Tini.', 'Kdo je naslednja stranka danes?', 'Prestavi Matejo na petek ob enajstih.'])(
    'končan stavek: %s',
    (s) => {
      expect(cakanjePoKoncu(s)).toBe(CAKANJE.obicajno);
    }
  );

  it('končan stavek je hitrejši od nedokončanega', () => {
    expect(CAKANJE.obicajno).toBeLessThan(500);
    expect(CAKANJE.nedokoncano).toBeGreaterThanOrEqual(2000);
  });
});

describe('jeNadaljevanje', () => {
  it('besede so nadaljevanje, mašila in šum ne', () => {
    expect(jeNadaljevanje('na barvanje')).toBe(true);
    expect(jeNadaljevanje('uh')).toBe(false);
    expect(jeNadaljevanje('')).toBe(false);
    expect(jeNadaljevanje('a')).toBe(false);
  });
});

describe('prekinitev in odmev', () => {
  const govor = besedeGovora('Jutri imate štiri stranke. Prva je Mateja Kovačič ob devetih.');

  it('lasten odmev ne prekine (tudi glasen, v drugem sklonu)', () => {
    expect(jePrekinitev({ slisano: 'jutri imate štiri stranke prva je', govor, glasnost: 0.2 })).toBe(false);
    expect(jePrekinitev({ slisano: 'Mateja Kovačiča ob devetih', govor, glasnost: 0.2 })).toBe(false);
  });

  it('dve tuji besedi prekineta', () => {
    expect(jePrekinitev({ slisano: 'prestavi Ano', govor, glasnost: 0.05 })).toBe(true);
    // odmev + uporabnik hkrati
    expect(jePrekinitev({ slisano: 'jutri imate kaj pa Ana', govor, glasnost: 0.05 })).toBe(true);
  });

  it('ena jasna beseda prekine, ena navadna ne', () => {
    expect(jePrekinitev({ slisano: 'stop', govor, glasnost: 0.05 })).toBe(true);
    expect(jePrekinitev({ slisano: 'Počakaj.', govor, glasnost: 0.05 })).toBe(true);
    expect(jePrekinitev({ slisano: 'ja', govor, glasnost: 0.05 })).toBe(true);
    expect(jePrekinitev({ slisano: 'barvanje', govor, glasnost: 0.05 })).toBe(false);
  });

  it('tih mikrofon (ostanek odmeva, šum) ne prekine', () => {
    expect(jePrekinitev({ slisano: 'prestavi Ano', govor, glasnost: 0.004 })).toBe(false);
  });

  it('mašila niso tuje besede', () => {
    expect(tujeBesede('uh ehm', govor)).toEqual([]);
    expect(jePrekinitev({ slisano: 'uh ehm', govor, glasnost: 0.3 })).toBe(false);
  });

  it('beseda, ki jo asistent sprašuje ("Shranim?"), ni prekinitev, "ja" pa je', () => {
    const g = besedeGovora('Ana Novak, jutri ob desetih. Shranim?');
    expect(jePrekinitev({ slisano: 'shranim', govor: g, glasnost: 0.1 })).toBe(false);
    expect(jePrekinitev({ slisano: 'ja', govor: g, glasnost: 0.1 })).toBe(true);
  });

  it('odstraniOdmev odreže odmev z začetka', () => {
    expect(odstraniOdmev('Prva je Mateja počakaj prestavi Ano', govor)).toBe('počakaj prestavi Ano');
    expect(odstraniOdmev('stop', govor)).toBe('stop');
    expect(odstraniOdmev('jutri imate', govor)).toBe('');
  });

  it('rms', () => {
    expect(rms(new Int16Array(160))).toBe(0);
    expect(rms(new Int16Array(160).fill(16384))).toBeCloseTo(0.5, 2);
  });
});

describe('lokalniOdziv', () => {
  it.each(['Hvala, to je vse.', 'to je vse', 'Nasvidenje!', 'Hvala, adijo.', 'Konec.'])('konec: %s', (s) => {
    expect(lokalniOdziv(s)?.vrsta).toBe('konec');
  });
  it('zahvala ne konča pogovora', () => {
    expect(lokalniOdziv('Hvala.')?.vrsta).toBe('zahvala');
    expect(lokalniOdziv('Super, hvala!')?.vrsta).toBe('zahvala');
  });
  it('ukazi niso lokalni', () => {
    expect(lokalniOdziv('hvala, prestavi še Ano')).toBeNull();
    expect(lokalniOdziv('kaj imam jutri')).toBeNull();
  });
});

describe('napakaZaGovor', () => {
  it('samo prvi stavek', () => {
    expect(napakaZaGovor('Povezava ni uspela. Nič ni bilo spremenjeno. Poskusite znova.')).toBe('Povezava ni uspela.');
    expect(napakaZaGovor('Neveljaven odgovor strežnika. (502)')).toBe('Neveljaven odgovor strežnika.');
  });
});
