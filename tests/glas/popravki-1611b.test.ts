// Popravki po Timovem 2. krogu testov 16. 11.: čas dneva (minuli termini), spol stranke,
// »kaj sem imel danes«, luknja po odpovedi brez ure, vzorec za serijo.
import { afterEach, describe, expect, it } from 'vitest';
import { hitraPot } from '@/lib/glas/hitraPot';
import { koledarDan, zadnjiObisk } from '@/lib/glas/orodja/branje';
import { vzorcniTermin, zadnjiInNaslednji } from '@/lib/glas/orodja/stranke';
import { kandidatiZaLuknjo } from '@/lib/glas/orodja/zapolnitev';
import type { OkoljeOrodja } from '@/lib/glas/orodja/tipi';
import { DANES, kontekst, podatkiPomnilnik, posiljateljLazni, SALONI, salonZapolnitev, terminZ5 } from './pomoc';

function o(uraZdaj: string, podjetje = 'A1'): OkoljeOrodja {
  return { k: kontekst({ podjetje, osebaId: null }), podatki: podatkiPomnilnik(podjetje), danes: DANES, uraZdaj, ukazId: null, sporocila: posiljateljLazni() };
}

describe('čas dneva: minuli termini', () => {
  it('»kaj imam danes« ob 15h: termin ob 13h je bil (preteklik), drugih ni', async () => {
    const r = await koledarDan.izvedi({ datum: null, samo_moji: null }, o('15:00'));
    expect(r.govor).toMatch(/^Danes je bil 1 termin\./);
    expect(r.govor).toContain('Drugih terminov danes ni.');
    expect(r.sporocilo).toContain('Že mimo: 1.');
    const zjutraj = await koledarDan.izvedi({ datum: null, samo_moji: null }, o('09:00'));
    expect(zjutraj.govor).toMatch(/^Danes je 1 termin\./);
  });

  it('»kdaj pride Ana« ob 15h: današnji ob 13h je zadnji obisk, naslednji je jutri; brez »je bila«', async () => {
    const r = await zadnjiObisk.izvedi({ stranka: 'Ana Novak', stranka_id: '102' }, o('15:00'));
    expect(r.sporocilo).toContain('Ana Novak: zadnji obisk danes ob 13:00 (Barvanje).');
    expect(r.sporocilo).toContain('Naslednji termin: jutri, petek ob 11:00.');
    expect(`${r.sporocilo} ${r.govor}`).not.toMatch(/je bila|je bil /);
    const prej = await zadnjiInNaslednji(o('10:00'), SALONI.A1.stranke[1]);
    expect(prej.naslednji?.id).toBe('t5');
  });

  it('vzorec za »enako kot danes«: današnji termin ima prednost pred starejšim', async () => {
    expect((await vzorcniTermin(o('10:00'), SALONI.A1.stranke[1]))?.id).toBe('t5');
    // Mateja danes nima termina: zadnji pretekli.
    expect((await vzorcniTermin(o('10:00'), SALONI.A1.stranke[0]))?.id).toBe('t4');
  });
});

describe('hitra pot: preteklik', () => {
  it.each([
    ['Kaj vse sem imel danes, katere termine?', true],
    ['Kaj sem imela danes?', true],
    ['koga smo imeli danes', false],
  ])('%s → koledar_dan', (stavek, moji) => {
    expect(hitraPot(stavek)).toEqual({ orodje: 'koledar_dan', vhod: { datum: 'danes', samo_moji: moji } });
  });
});

describe('luknja po odpovedi brez ure', () => {
  afterEach(() => {
    SALONI.Z5 = salonZapolnitev();
  });

  it('»kdo je kandidat za jutri« najde odpovedan termin sam in ga omeni', async () => {
    SALONI.Z5 = salonZapolnitev();
    // Tina ima jutri ob 12h odpovedan termin (Eva); luknja od 10.30 do 16.00.
    SALONI.Z5.termini.push(terminZ5('odp', '2026-11-13', '12:00', '13:00', 'o1', '505', 'Striženje', 'cancelled'));
    SALONI.Z5.termini.find((t) => t.id === 'odp')!.stranka = 'Eva Naprej';
    const r = await kandidatiZaLuknjo.izvedi({ datum: 'jutri', ura: null, oseba: null, trajanje_min: null, ob_stranki: null, glede: null }, o('10:00', 'Z5'));
    expect(r.vprasanje).toBeUndefined();
    expect(r.sporocilo).toMatch(/^Po odpovedi: Eva Naprej, 12:00\./);
    expect((r.podatki as { luknja: { od: string } }).luknja.od).toBe('12:00');
  });
});
