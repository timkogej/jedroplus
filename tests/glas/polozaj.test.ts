import { describe, expect, it } from 'vitest';
import { polozajKrogca, VELIKOST } from '@/lib/glas/odjemalec/polozaj';

const telefon = { w: 390, h: 844, zgoraj: 47, spodaj: 34 };
const racunalnik = { w: 1440, h: 900, zgoraj: 0, spodaj: 0 };

describe('polozajKrogca', () => {
  it('kot: spodaj desno, nad domačo vrstico', () => {
    const p = polozajKrogca('kot', telefon);
    expect(p.x + p.velikost).toBe(390 - 16);
    expect(p.y + p.velikost).toBe(844 - 16 - 34);
  });

  it('sredina: vodoravno na sredini, pod varnim robom', () => {
    const p = polozajKrogca('sredina', racunalnik);
    expect(p.x + p.velikost / 2).toBe(720);
    expect(p.velikost).toBe(VELIKOST.sredina);
    expect(polozajKrogca('sredina', { ...telefon, h: 300 }).y).toBeGreaterThanOrEqual(47 + 24);
  });

  it('obrazec na računalniku: nad zgornjim levim kotom lista, ne čez list', () => {
    const panel = { left: 470, top: 120, right: 970, bottom: 820 };
    const p = polozajKrogca('obrazec', racunalnik, panel);
    expect(p.x).toBe(478);
    expect(p.y + p.velikost).toBeLessThanOrEqual(panel.top);
  });

  it('obrazec na telefonu (list od dna, prostor nad njim): nad listom', () => {
    const panel = { left: 0, top: 120, right: 390, bottom: 844 };
    const p = polozajKrogca('obrazec', telefon, panel);
    expect(p.y + p.velikost).toBeLessThanOrEqual(120);
    expect(p.y).toBeGreaterThanOrEqual(47);
  });

  it('list do vrha: na kotu, pod zarezo, znotraj zaslona', () => {
    const panel = { left: 0, top: 0, right: 390, bottom: 844 };
    const p = polozajKrogca('obrazec', telefon, panel);
    expect(p.y).toBeGreaterThanOrEqual(47);
    expect(p.x).toBeGreaterThanOrEqual(6);
    expect(p.velikost).toBe(VELIKOST.obrazec);
  });

  it('brez lista: kot', () => {
    expect(polozajKrogca('obrazec', telefon, null)).toEqual(polozajKrogca('kot', telefon));
  });
});
