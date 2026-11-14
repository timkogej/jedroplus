// Asistent+ v obliki plusa: geometrija (plus → krog).
import { describe, expect, it } from 'vitest';
import { NASTAVITVE, parametri, polmer, potPlusa } from '@/components/glas/ui/plusOblika';

describe('plus oblika', () => {
  for (const [ime, n] of Object.entries(NASTAVITVE)) {
    it(`${ime}: napihnjen plus je krog`, () => {
      const p = parametri(n, 1, { gor: 0.3, desno: -0.2, dol: 0.1, levo: 0 });
      for (let i = 0; i < 64; i++) expect(polmer(p, (i / 64) * Math.PI * 2)).toBeCloseTo(n.krog, 5);
    });

    it(`${ime}: plus ima kraka do konca in ožji pas med njima`, () => {
      const p = parametri(n, 0);
      expect(polmer(p, 0)).toBeCloseTo(n.krak, 5);
      expect(polmer(p, Math.PI / 2)).toBeCloseTo(n.krak, 5);
      // Diagonala gre skozi notranji kot: precej bližje središču kot konec kraka.
      expect(polmer(p, Math.PI / 4)).toBeLessThan(n.krak * 0.75);
    });
  }

  it('raztezek podaljša samo svoj krak', () => {
    const n = NASTAVITVE.mehak;
    const p = parametri(n, 0, { gor: 0, desno: 0.1, dol: 0, levo: 0 });
    expect(polmer(p, 0)).toBeCloseTo(n.krak * 1.1, 5);
    expect(polmer(p, Math.PI)).toBeCloseTo(n.krak, 5);
  });

  it('pot je zaprta in ostane v okvirju 144', () => {
    const d = potPlusa(parametri(NASTAVITVE.zele, 0.4, { gor: 0.2, desno: 0.2, dol: 0.2, levo: 0.2 }));
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    const st = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(Math.min(...st)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...st)).toBeLessThanOrEqual(144);
  });
});
