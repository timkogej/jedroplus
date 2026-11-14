// Skupni izračun Analitike in Asistent+ (lib/analytics/izracun.ts).
import { describe, expect, it } from 'vitest';
import { izracunajObdobje, jeOpravljen, vrednostTermina, zdajVPasuSalona, zgradiCenik, type Vrstica } from '@/lib/analytics/izracun';

const cenik = zgradiCenik(
  [
    { id: 11, 'ID storitve': 'S-1', Naziv: 'Barvanje', cena: 50, Barva: '#f00' },
    { id: 12, 'ID storitve': 'S-2', Naziv: 'Striženje', cena: 20 },
    { id: 13, 'ID storitve': 'S-3', Naziv: 'Fen', cena: '10,5' },
  ],
  [
    { id: 1, 'ID osebe': 'O-1', Ime: 'Tina', Priimek: 'Kos' },
    { id: 2, 'ID osebe': 'O-2', Ime: 'Urška', Priimek: 'Bele' },
  ]
);

const t = (p: Partial<Vrstica>): Vrstica => ({ 'ID termina': 'x', Datum: '2026-11-10', 'Čas': '09:00', Konec: '10:00', Status: 'scheduled', 'ID storitve': 'S-1', 'ID Osebe': 'O-1', ...p });
const ZDAJ = '2026-11-12 10:00';

describe('jeOpravljen', () => {
  it('zaključen vedno, tudi v prihodnosti', () => {
    expect(jeOpravljen(t({ Status: 'completed', Datum: '2026-12-01' }), ZDAJ)).toBe(true);
  });
  it('nezaključen pretekli šteje, prihodnji ne', () => {
    expect(jeOpravljen(t({}), ZDAJ)).toBe(true);
    expect(jeOpravljen(t({ Datum: '2026-11-12', 'Čas': '09:00', Konec: '10:00' }), ZDAJ)).toBe(true);
    expect(jeOpravljen(t({ Datum: '2026-11-12', 'Čas': '09:30', Konec: '10:30' }), ZDAJ)).toBe(false);
  });
  it('odpovedan in neprihod nikoli', () => {
    expect(jeOpravljen(t({ Status: 'cancelled' }), ZDAJ)).toBe(false);
    expect(jeOpravljen(t({ Status: 'no_show' }), ZDAJ)).toBe(false);
    expect(jeOpravljen(t({ Status: 'Odpovedan' }), ZDAJ)).toBe(false);
  });
});

describe('vrednostTermina', () => {
  it('Final cena ima prednost, nato cena, nato cenik', () => {
    expect(vrednostTermina(t({ 'Final cena': 45, cena: 60 }), cenik).skupaj).toBe(45);
    expect(vrednostTermina(t({ cena: 60 }), cenik).skupaj).toBe(60);
    expect(vrednostTermina(t({}), cenik).skupaj).toBe(50);
  });
  it('več storitev po ceniku, storitev po id ali besedilnem ID', () => {
    const v = vrednostTermina(t({ 'ID storitve': '11', 'ID storitve 2': 'S-2', add_on_storitev_id: 'S-3' }), cenik);
    expect(v.skupaj).toBe(80.5);
    expect(v.deli.reduce((a, d) => a + d.znesek, 0)).toBe(80.5);
  });
  it('zapisana cena se razdeli: dodatne po ceniku, glavna ostanek', () => {
    const v = vrednostTermina(t({ 'Final cena': 60, 'ID storitve 2': 'S-2' }), cenik);
    expect(v.deli).toEqual([{ id: 'S-1', znesek: 40 }, { id: 'S-2', znesek: 20 }]);
  });
});

describe('izracunajObdobje', () => {
  const vrstice: Vrstica[] = [
    t({ 'ID termina': 'a', Status: 'completed' }),
    t({ 'ID termina': 'b' }), // pretekel, ni zaključen → šteje
    t({ 'ID termina': 'c', Status: 'cancelled' }),
    t({ 'ID termina': 'd', Status: 'no_show', 'ID Osebe': 'O-2' }),
    t({ 'ID termina': 'e', deleted_at: '2026-11-11T10:00:00Z' }), // izbrisan
    t({ 'ID termina': 'f', belezi_termin: false }),
    t({ 'ID termina': 'g', Datum: '2026-11-20' }), // prihodnji
    t({ 'ID termina': 'h', Datum: '2026-10-31', Status: 'completed' }), // izven obdobja
    t({ 'ID termina': 'i', 'ID storitve': '12', 'ID Osebe': '2' }),
  ];
  const r = izracunajObdobje(vrstice, cenik, { od: '2026-11-01', do: '2026-11-30', zdaj: ZDAJ });

  it('štetje', () => {
    expect(r.termini).toBe(6); // a b c d g i
    expect(r.opravljeni).toBe(3); // a b i
    expect(r.zakljuceni).toBe(1);
    expect(r.odpovedani).toBe(1);
    expect(r.neprihodi).toBe(1);
  });
  it('zaslužek po ceniku in od tega zaključeni', () => {
    expect(r.zasluzek).toBe(120);
    expect(r.zasluzekZakljuceni).toBe(50);
  });
  it('storitve in osebe (ključ po id ali besedilnem ID)', () => {
    expect(r.storitve.map((s) => [s.naziv, s.stevilo, s.znesek])).toEqual([['Barvanje', 2, 100], ['Striženje', 1, 20]]);
    expect(r.osebe.map((o) => [o.ime, o.stevilo])).toEqual([['Tina Kos', 2], ['Urška Bele', 1]]);
  });
});

describe('zdajVPasuSalona', () => {
  it('poletni in zimski čas', () => {
    expect(zdajVPasuSalona(new Date('2026-07-01T10:00:00Z'))).toBe('2026-07-01 12:00');
    expect(zdajVPasuSalona(new Date('2026-11-12T23:30:00Z'))).toBe('2026-11-13 00:30');
  });
});
