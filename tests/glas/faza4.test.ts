// Faza 4: glasovni ukazi odprtemu obrazcu (shrani / prekliči), vse ostalo gre asistentu.
import { describe, expect, it } from 'vitest';
import { ukazObrazcu } from '@/lib/glas/odjemalec/obrazecGlas';

describe('ukaz odprtemu obrazcu', () => {
  it.each([
    ['Shrani.', 'shrani'],
    ['ja, shrani', 'shrani'],
    ['Ja', 'shrani'],
    ['potrdi prosim', 'shrani'],
    ['Okej shrani', 'shrani'],
    ['spremi', 'shrani'],
    ['Save', 'shrani'],
    ['speichern', 'shrani'],
    ['salva', 'shrani'],
    ['Prekliči', 'preklici'],
    ['ne', 'preklici'],
    ['zapri obrazec', 'preklici'],
    ['odustani', 'preklici'],
    ['cancel', 'preklici'],
  ])('%s → %s', (izjava, pricakovano) => {
    expect(ukazObrazcu(izjava)).toBe(pricakovano);
  });

  it.each(['spremeni uro na enajst', 'ja, ampak ob desetih', 'shrani in pošlji SMS Ani', 'kdo je naslednji', '', 'ne, ob enajstih'])(
    '"%s" ni ukaz obrazcu (gre asistentu)',
    (izjava) => {
      expect(ukazObrazcu(izjava)).toBeNull();
    }
  );
});
