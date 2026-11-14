// Jeziki Asistent+: vsak ključ jt('…')/kt('…') iz kode ima prevod v vsakem katalogu
// z enakimi parametri; slovenščina ostane nespremenjena; datumi, ure, števke in
// sistemski poziv so v izbranem jeziku.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KATALOGI_ZA_TEST, jt, parametriPredloge, prevedi } from '@/lib/glas/jeziki/t';
import { oblikaMnozine, zJezikom, type Jezik } from '@/lib/glas/jeziki/jezik';
import { datumZaGovor, emailZaGovor, razponZaGovor, telefonZaGovor, trajanjeZaGovor, uraZaGovor, vprasanjeZaGovor, zaGovor } from '@/lib/glas/govor';
import { opisDatuma, razberiDatumTuj } from '@/lib/glas/razresevanje/datumi';
import { sistemZaJezik, SISTEM } from '@/lib/glas/jedro';

function datoteke(mapa: string): string[] {
  return readdirSync(mapa).flatMap((ime) => {
    const pot = join(mapa, ime);
    return statSync(pot).isDirectory() ? datoteke(pot) : /\.tsx?$/.test(ime) ? [pot] : [];
  });
}

/** Vsi ključi iz kode strežnika (lib/glas brez odjemalca, ki ima svoj slovar). */
function kljuciIzKode(): string[] {
  const kljuci = new Set<string>();
  for (const f of datoteke('lib/glas').filter((x) => !x.includes('/odjemalec/') && !x.includes('/jeziki/'))) {
    const vsebina = readFileSync(f, 'utf8');
    for (const m of vsebina.matchAll(/\b(?:jt|kt)\(\s*'((?:[^'\\]|\\.)*)'/g)) kljuci.add(m[1].replace(/\\'/g, "'"));
  }
  return [...kljuci].sort();
}

const TUJI = ['en', 'de', 'it', 'hr'] as const;

describe('katalogi prevodov', () => {
  const kljuci = kljuciIzKode();

  it('v kodi je več kot 200 ključev (pregled deluje)', () => {
    expect(kljuci.length).toBeGreaterThan(200);
  });

  for (const j of TUJI) {
    it(`${j}: vsak ključ ima prevod z enakimi parametri`, () => {
      const k = KATALOGI_ZA_TEST[j];
      const manjka = kljuci.filter((x) => !(x in k));
      expect(manjka).toEqual([]);
      const napacni = kljuci.filter((x) => x in k && parametriPredloge(x).join() !== parametriPredloge(k[x]).join());
      expect(napacni).toEqual([]);
    });

    it(`${j}: brez odvečnih ključev in praznih prevodov`, () => {
      const k = KATALOGI_ZA_TEST[j];
      const kodni = new Set(kljuci);
      expect(Object.keys(k).filter((x) => !kodni.has(x))).toEqual([]);
      expect(Object.entries(k).filter(([, v]) => !v.trim()).map(([x]) => x)).toEqual([]);
    });
  }
});

describe('t()', () => {
  it('slovenščina vrne ključ s parametri, mestnikom in množino', () => {
    expect(jt('Te stranke ne najdem.')).toBe('Te stranke ne najdem.');
    expect(prevedi('sl', 'pri {oseba:mestnik}', { oseba: 'Luka' })).toBe('pri Luki');
    expect(prevedi('sl', '{n} {n|termin|termina|termine|terminov}', { n: 3 })).toBe('3 termine');
    expect(prevedi('sl', '{n} {n|termin|termina|termine|terminov}', { n: 102 })).toBe('102 termina');
  });

  it('tuji jezik: prevod, brez mestnika, množina po pravilih jezika', () => {
    expect(prevedi('en', 'pri {oseba:mestnik}', { oseba: 'Luka' })).toBe('with Luka');
    const K = '{datum}: {n} {n|termin|termina|termini|terminov}.';
    expect(prevedi('en', K, { datum: 'Today', n: 1 })).toBe('Today: 1 appointment.');
    expect(prevedi('en', K, { datum: 'Today', n: 3 })).toBe('Today: 3 appointments.');
    expect(prevedi('en', '{n} {n|neprihod|neprihoda|neprihodi|neprihodov}', { n: 2 })).toBe('2 no-shows');
    expect(prevedi('hr', '{n} {n|neprihod|neprihoda|neprihodi|neprihodov}', { n: 3 })).toMatch(/^3 /);
  });

  it('jezik velja v zJezikom (tudi v asinhronih vejah)', async () => {
    expect(await zJezikom('de', async () => {
      await new Promise((r) => setTimeout(r, 1));
      return jt('Te stranke ne najdem.');
    })).not.toBe('Te stranke ne najdem.');
    expect(jt('Te stranke ne najdem.')).toBe('Te stranke ne najdem.');
  });

  it('množinska pravila', () => {
    const p = (j: Jezik, n: number) => oblikaMnozine(j, n);
    expect([1, 2, 3, 5, 101, 102].map((n) => p('sl', n))).toEqual([0, 1, 2, 3, 0, 1]);
    expect([1, 2, 4, 5, 11, 12, 21, 22, 25].map((n) => p('hr', n))).toEqual([0, 1, 1, 2, 2, 2, 0, 1, 2]);
    expect([0, 1, 2].map((n) => p('en', n))).toEqual([1, 0, 1]);
  });
});

describe('datumi, ure in števke po jezikih', () => {
  const danes = '2026-11-14'; // sobota
  const v = <T>(j: Jezik, f: () => T) => zJezikom(j, f);

  it('slovenščina nespremenjena', () => {
    expect(datumZaGovor('2026-11-15', danes)).toBe('jutri, v nedeljo');
    expect(uraZaGovor('14:30')).toBe('ob pól treh');
    expect(opisDatuma('2026-11-16', danes)).toBe('ponedeljek, 16. 11.');
  });

  it('angleščina', () => {
    expect(v('en', () => datumZaGovor('2026-11-15', danes))).toBe('tomorrow, Sunday');
    expect(v('en', () => datumZaGovor('2026-11-18', danes))).toBe('on Wednesday, November 18');
    expect(v('en', () => uraZaGovor('14:30'))).toBe('at 2:30 pm');
    expect(v('en', () => uraZaGovor('09:00'))).toBe('at 9 am');
    expect(v('en', () => razponZaGovor('09:00', '10:30'))).toBe('from 9 am to 10:30 am');
    expect(v('en', () => trajanjeZaGovor(90))).toBe('an hour and a half');
    expect(v('en', () => opisDatuma('2026-11-16', danes))).toBe('Monday, 16 Nov');
    expect(v('en', () => telefonZaGovor('041234567'))).toBe('zero four one, two three four, five six seven');
    expect(v('en', () => emailZaGovor('a.b@x.si'))).toBe('a dot b at x dot si');
    expect(v('en', () => zaGovor('Next: Monday at 10:30.'))).toBe('Next: Monday at 10:30 am.');
    expect(v('en', () => vprasanjeZaGovor({ besedilo: 'Which client?', moznosti: [{ oznaka: 'Ana (x)' }, { oznaka: 'Ane' }] }))).toBe('Which client: Ana or Ane?');
  });

  it('nemščina, italijanščina, hrvaščina', () => {
    expect(v('de', () => datumZaGovor('2026-11-18', danes))).toBe('am Mittwoch, 18. November');
    expect(v('de', () => uraZaGovor('14:30'))).toBe('um 14 Uhr 30');
    expect(v('it', () => uraZaGovor('14:30'))).toBe('alle 14 e mezza');
    expect(v('it', () => uraZaGovor('13:00'))).toBe('alle 13');
    expect(v('it', () => datumZaGovor('2026-11-15', danes))).toBe('domani, domenica');
    expect(v('hr', () => datumZaGovor('2026-11-18', danes))).toBe('u srijedu, 18. studenoga');
    expect(v('hr', () => uraZaGovor('09:15'))).toBe('u 9 i 15');
  });

  it('besede za datum v tujem jeziku', () => {
    expect(razberiDatumTuj('tomorrow', danes)).toBe('2026-11-15');
    expect(razberiDatumTuj('übermorgen', danes)).toBe('2026-11-16');
    expect(razberiDatumTuj('venerdì', danes)).toBe('2026-11-20');
    expect(razberiDatumTuj('u srijedu', danes)).toBe('2026-11-18');
    expect(razberiDatumTuj('nekaj', danes)).toBeNull();
  });
});

describe('sistemski poziv', () => {
  it('slovenščina je nespremenjen SISTEM (predpomnilnik)', () => {
    expect(sistemZaJezik('sl')).toBe(SISTEM);
    expect(sistemZaJezik(undefined)).toBe(SISTEM);
  });
  it('tuji jezik doda navodilo za jezik in ISO datume', () => {
    const s = sistemZaJezik('de');
    expect(s).toContain('v jeziku Deutsch, brez oblikovanja');
    expect(s).toContain('YYYY-MM-DD');
    expect(s.startsWith(SISTEM.slice(0, 40))).toBe(true);
  });
});
