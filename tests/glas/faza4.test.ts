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

import { poisci } from '@/lib/glas/razresevanje/imena';

describe('iskanje: podobna imena in skloni', () => {
  const S = [
    { i: 'Ana', p: 'Novak' }, { i: 'Anja', p: 'Novak' }, { i: 'Ana', p: 'Novinc' },
    { i: 'Tim', p: 'Zupančič' }, { i: 'Tim', p: 'Zupančič' }, { i: 'Luka', p: 'Zupančič' },
  ];
  const najdi = (q: string) => {
    const r = poisci(q, S, (x) => [x.i, x.p]);
    return r.izid === 'enolicno' ? `${r.najden.i} ${r.najden.p}` : r.izid;
  };
  it.each([
    ['Anja Novak', 'Anja Novak'], ['Anjo Novak', 'Anja Novak'], ['Anji Novak', 'Anja Novak'], ['Anje Novak', 'Anja Novak'],
    ['Ana Novak', 'Ana Novak'], ['Ano Novak', 'Ana Novak'], ['Ani Novak', 'Ana Novak'], ['Ane Novak', 'Ana Novak'],
    ['Luko Zupančič', 'Luka Zupančič'],
  ])('%s → %s', (q, pricakovano) => expect(najdi(q)).toBe(pricakovano));

  it.each(['Tim Zupančič', 'Novak', 'Ana'])('%s ostane vprašanje', (q) => expect(najdi(q)).toBe('vec'));
});
