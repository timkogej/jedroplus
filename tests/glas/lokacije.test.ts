// Nov termin pri podjetju z več lokacijami: lokacija po zaposlenem in storitvi,
// vprašanje, ko zaposleni dela na več lokacijah.
import { describe, expect, it } from 'vitest';
import { pripraviTermin } from '@/lib/glas/orodja/obrazci';
import type { OkoljeOrodja } from '@/lib/glas/orodja/tipi';
import type { Kontekst } from '@/lib/glas/tipi';
import { DANES, kontekst, podatkiPomnilnik } from './pomoc';

function o(podjetje = 'L3', k: Partial<Kontekst> = {}): OkoljeOrodja {
  return { k: kontekst({ podjetje, osebaId: null, ...k }), podatki: podatkiPomnilnik(podjetje), danes: DANES, uraZdaj: '10:00', ukazId: null };
}
const vhod = { stranka: 'Nika', stranka_id: null, storitev: 'barvanje', oseba: null as string | null, datum: 'jutri', ura: '11:00', lokacija: null as string | null };

describe('lokacija novega termina', () => {
  it('zaposleni na eni lokaciji → ta lokacija, brez vprašanja', async () => {
    const r = await pripraviTermin.izvedi({ ...vhod, oseba: 'Maja' }, o());
    expect(r.obrazec?.polja.lokacija).toBe('l-siska');
    expect(r.vprasanje).toBeUndefined();
  });

  it('zaposleni na več lokacijah → vpraša, na kateri, in obrazca še ne odpre', async () => {
    const r = await pripraviTermin.izvedi({ ...vhod, oseba: 'Luka' }, o());
    expect(r.obrazec).toBeUndefined();
    expect(r.vprasanje?.besedilo).toBe('Na kateri lokaciji?');
    expect(r.vprasanje?.moznosti?.map((m) => m.oznaka)).toEqual(['Center', 'Šiška']);
    expect(r.govor).toBe('Na kateri lokaciji, Center ali Šiška?');
  });

  it('zaposleni brez povezav dela povsod → vpraša med vsemi', async () => {
    const r = await pripraviTermin.izvedi({ ...vhod, oseba: 'Tina' }, o());
    expect(r.vprasanje?.moznosti?.map((m) => m.oznaka)).toEqual(['Center', 'Šiška', 'Bežigrad']);
  });

  it('odgovor z imenom ali izbrano možnostjo (ID) → obrazec z lokacijo', async () => {
    const poImenu = await pripraviTermin.izvedi({ ...vhod, oseba: 'Luka', lokacija: 'Šiški' }, o());
    expect(poImenu.obrazec?.polja.lokacija).toBe('l-siska');
    const poId = await pripraviTermin.izvedi({ ...vhod, oseba: 'Luka', lokacija: 'l-center' }, o());
    expect(poId.obrazec?.polja.lokacija).toBe('l-center');
  });

  it('storitev samo na eni lokaciji izbere lokacijo', async () => {
    const r = await pripraviTermin.izvedi({ ...vhod, oseba: 'Luka', storitev: 'pedikura' }, o());
    expect(r.obrazec?.polja.lokacija).toBe('l-center');
  });

  it('zaposleni na povedani lokaciji ne dela → pove, kje dela', async () => {
    const r = await pripraviTermin.izvedi({ ...vhod, oseba: 'Maja', lokacija: 'Center' }, o());
    expect(r.obrazec).toBeUndefined();
    expect(r.sporocilo).toBe('Maja na lokaciji Center ne dela (dela: Šiška).');
  });

  it('storitve na povedani lokaciji ni / nobena lokacija ne ustreza', async () => {
    const a = await pripraviTermin.izvedi({ ...vhod, oseba: 'Tina', storitev: 'pedikura', lokacija: 'Bežigrad' }, o());
    expect(a.sporocilo).toBe('Pedikura na lokaciji Bežigrad ni na voljo.');
    const b = await pripraviTermin.izvedi({ ...vhod, oseba: 'Maja', storitev: 'pedikura' }, o());
    expect(b.sporocilo).toBe('Maja ne dela na nobeni lokaciji, kjer je Pedikura.');
  });

  it('neznana lokacija → pove, katere obstajajo', async () => {
    const r = await pripraviTermin.izvedi({ ...vhod, oseba: 'Luka', lokacija: 'Koper' }, o());
    expect(r.sporocilo).toBe('Lokacije »Koper« ne najdem. Lokacije: Center, Šiška, Bežigrad.');
  });

  it('brez zaposlenega → lokacijo izbere obrazec kot pri ročnem vnosu', async () => {
    const r = await pripraviTermin.izvedi(vhod, o());
    expect(r.vprasanje).toBeUndefined();
    expect(r.obrazec?.polja.lokacija).toBeUndefined();
  });

  it('podjetje z eno lokacijo: nič se ne spremeni', async () => {
    const r = await pripraviTermin.izvedi({ stranka: 'Mateja', stranka_id: null, storitev: 'barvanje', oseba: 'Tina', datum: 'jutri', ura: '11:00' }, o('A1'));
    expect(r.obrazec?.polja).toEqual({ stranka: '101', storitev: 's1', oseba: 'o1', dan: '2026-11-13', ura: '11:00' });
  });
});
