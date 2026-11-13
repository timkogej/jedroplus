// Faza 3: dejanja prek obstoječih obrazcev (nič se ne zapiše na strežniku).
import { afterEach, describe, expect, it } from 'vitest';
import { obdelajUkaz } from '@/lib/glas/jedro';
import { novaStranka, prestaviTermin, pripraviTermin, statusTermina, uraIzParametra, vpisiOdsotnost } from '@/lib/glas/orodja/obrazci';
import { shraniObrazec, vzemiObrazec } from '@/lib/glas/odjemalec/predizpolnitev';
import type { OkoljeOrodja } from '@/lib/glas/orodja/tipi';
import type { Kontekst } from '@/lib/glas/tipi';
import { DANES, kontekst, okolje, podatkiPomnilnik, VSE_PRAVICE_STAFF } from './pomoc';

function o(k: Partial<Kontekst> = {}): OkoljeOrodja {
  return { k: kontekst(k), podatki: podatkiPomnilnik('A1'), danes: DANES, uraZdaj: '10:00', ukazId: null };
}
const samoSvoji = { ...VSE_PRAVICE_STAFF, can_view_all_appointments: false, can_view_only_own_appointments: true, can_edit_all_appointments: false, can_edit_only_own_appointments: true };

describe('ure iz parametra', () => {
  it('številke in besede', () => {
    expect(uraIzParametra('10:00')).toBe('10:00');
    expect(uraIzParametra('9.30')).toBe('09:30');
    expect(uraIzParametra('ob desetih')).toBe('10:00');
    expect(uraIzParametra('pol enajstih')).toBe('10:30');
    expect(uraIzParametra('kdaj')).toBeNull();
  });
});

describe('pripravi_termin', () => {
  const vhod = { stranka: 'Mateja', stranka_id: null, storitev: 'barvanje', oseba: 'Tina', datum: 'jutri', ura: '11:00' };

  it('prost čas: obrazec z ID-ji, nič zapisano, podatki niso v URL', async () => {
    const r = await pripraviTermin.izvedi(vhod, o());
    expect(r.pojdi).toBe('/koledar?glas=1');
    expect(r.obrazec).toEqual({ vrsta: 'nov_termin', polja: { stranka: '101', storitev: 's1', oseba: 'o1', dan: '2026-11-13', ura: '11:00' } });
    expect(r.sporocilo).not.toContain('Pozor');
    expect(r.govor).toBe('Odpiram nov termin za Mateja Kovačič, jutri, v petek ob enajstih, Barvanje, pri Tina. Preverite in shranite.');
  });

  it('zaseden čas: opozori, a vseeno odpre obrazec', async () => {
    const r = await pripraviTermin.izvedi({ ...vhod, ura: 'ob devetih' }, o());
    expect(r.sporocilo).toContain('Pozor: Tina ima takrat že termin (09:00, Mateja Kovačič).');
    expect(r.obrazec?.polja.ura).toBe('09:00');
  });

  it('neznana stranka: predlaga novo', async () => {
    const r = await pripraviTermin.izvedi({ ...vhod, stranka: 'Bojan Horvat' }, o());
    expect(r.sporocilo).toContain('dodaj novo stranko');
    expect(r.pojdi).toBeUndefined();
  });

  it('za nazaj ne', async () => {
    const r = await pripraviTermin.izvedi({ ...vhod, datum: 'včeraj' }, o());
    expect(r.sporocilo).toBe('Termina za nazaj ne vpisujem.');
  });

  it('manjkajoče pove, obrazec vseeno odpre', async () => {
    const r = await pripraviTermin.izvedi({ ...vhod, storitev: null, datum: null, ura: null }, o());
    expect(r.sporocilo).toContain('V obrazcu izberite še dan, uro, storitev.');
    expect(r.obrazec?.polja).toEqual({ stranka: '101', oseba: 'o1' });
  });

  it('zaposleni "samo svoji" ne vpisuje drugim', async () => {
    const r = await pripraviTermin.izvedi({ ...vhod, oseba: 'Urška' }, o({ vloga: 'staff', pravice: samoSvoji }));
    expect(r.sporocilo).toBe('Vpisujete lahko samo svoje termine.');
  });
});

describe('prestavi_termin', () => {
  it('več terminov → vprašanje', async () => {
    const r = await prestaviTermin.izvedi({ stranka: 'Ana Novak', stranka_id: null, termin_id: null, datum_zdaj: null, nov_datum: 'v ponedeljek', nova_ura: null }, o());
    expect(r.vprasanje?.moznosti?.map((m) => m.id)).toEqual(['t5', 't2']);
  });

  it('izbran termin: nov dan, ista ura; opozori na odsotnost', async () => {
    const r = await prestaviTermin.izvedi({ stranka: 'Ana Novak', stranka_id: null, termin_id: 't2', datum_zdaj: null, nov_datum: 'v ponedeljek', nova_ura: null }, o());
    expect(r.obrazec).toEqual({ vrsta: 'prestavi_termin', polja: { idt: 't2', dan_prej: '2026-11-13', dan: '2026-11-16', ura: '11:00' } });
    expect(r.sporocilo).toContain('Urška takrat po urniku ne dela ali je odsotna');
  });

  it('zaposleni "samo svoji" ne prestavlja tujih', async () => {
    const r = await prestaviTermin.izvedi({ stranka: 'Ana Novak', stranka_id: null, termin_id: 't2', datum_zdaj: null, nov_datum: null, nova_ura: '12:00' }, o({ vloga: 'staff', pravice: samoSvoji }));
    expect(r.sporocilo).toBe('Urejate lahko samo svoje termine.');
  });
});

describe('status_termina', () => {
  it('ni prišla: današnji termin, odpre obstoječo povezavo koledarja', async () => {
    const r = await statusTermina.izvedi({ stranka: 'Ana Novak', stranka_id: null, termin_id: null, datum_zdaj: null, akcija: 'ni_prisla' }, o());
    expect(r.pojdi).toBe('/koledar?termin=t5&datum=2026-11-12');
    expect(r.govor).toContain('Tapnite Ni prišla.');
  });
});

describe('vpisi_odsotnost', () => {
  it('zame, del dneva', async () => {
    const r = await vpisiOdsotnost.izvedi({ oseba: null, od: 'jutri', do: null, ura_od: '14:00', ura_do: 'ob štirih', razlog: 'zdravnik' }, o());
    expect(r.obrazec).toEqual({ vrsta: 'odsotnost', polja: { oseba: 'o1', dan: '2026-11-13', do_dan: '2026-11-13', ura: '14:00', do_ura: '16:00', razlog: 'zdravnik' } });
    expect(r.govor).toBe('Odpiram odsotnost za vas, jutri, v petek od dveh do štirih. Preverite in shranite.');
  });

  it('zaposleni "samo svoji" samo zase', async () => {
    const r = await vpisiOdsotnost.izvedi({ oseba: 'Urška', od: 'jutri', do: null, ura_od: null, ura_do: null, razlog: null }, o({ vloga: 'staff', pravice: samoSvoji }));
    expect(r.sporocilo).toBe('Odsotnost lahko vpišete samo zase.');
  });
});

describe('nova_stranka', () => {
  it('opozori na dvojnico, telefon brez presledkov', async () => {
    const r = await novaStranka.izvedi({ ime: 'Ana', priimek: 'Novak', telefon: '041 123 456', email: null }, o());
    expect(r.sporocilo).toContain('Pozor: stranka Ana Novak že obstaja.');
    expect(r.obrazec).toEqual({ vrsta: 'nova_stranka', polja: { ime: 'Ana', priimek: 'Novak', telefon: '041123456' } });
    expect(r.pojdi).toBe('/clients?glas=1');
  });
});

describe('jedro', () => {
  it('obrazec in pot gresta odjemalcu, en krog, nič zapisano', async () => {
    const { d, llm, podatki } = okolje({
      llm: [{ klici: [{ id: 'a', ime: 'pripravi_termin', vhod: { stranka: 'Mateja', stranka_id: null, storitev: 'barvanje', oseba: null, datum: 'jutri', ura: '11:00' } }] }],
    });
    const r = await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'vpiši Matejo jutri ob enajstih na barvanje' }, d);
    expect(llm.zahteve).toHaveLength(1);
    expect(r).toMatchObject({ ok: true, status: 'odgovor', pojdi: '/koledar?glas=1', obrazec: { vrsta: 'nov_termin' } });
    expect(podatki.zapiski).toHaveLength(0);
  });

  it('status: pot z dvema parametroma gre skozi', async () => {
    const { d } = okolje({ llm: [{ klici: [{ id: 'a', ime: 'status_termina', vhod: { stranka: 'Ana Novak', stranka_id: null, termin_id: null, datum_zdaj: null, akcija: 'zakljuci' } }] }] });
    const r = await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'zaključi Ano Novak' }, d);
    expect(r).toMatchObject({ ok: true, pojdi: '/koledar?termin=t5&datum=2026-11-12' });
  });

  it('brez pravice za ustvarjanje orodje ni ponujeno', async () => {
    const { d, llm } = okolje({ llm: [{ besedilo: 'Tega ne morem.' }] });
    await obdelajUkaz({ k: kontekst({ vloga: 'staff', pravice: { ...VSE_PRAVICE_STAFF, can_create_appointments: false } }), vhod: 'besedilo', besedilo: 'vpiši termin' }, d);
    const imena = llm.zahteve[0].orodja.map((x) => x.ime);
    expect(imena).not.toContain('pripravi_termin');
    expect(imena).toContain('prestavi_termin');
  });
});

describe('predizpolnitev v brskalniku', () => {
  const shramba = new Map<string, string>();
  (globalThis as { sessionStorage?: unknown }).sessionStorage = {
    getItem: (k: string) => shramba.get(k) ?? null,
    setItem: (k: string, v: string) => void shramba.set(k, v),
    removeItem: (k: string) => void shramba.delete(k),
  };
  afterEach(() => shramba.clear());

  it('enkratna uporaba, samo pričakovana vrsta', () => {
    shraniObrazec({ vrsta: 'nova_stranka', polja: { ime: 'Ana' } });
    expect(vzemiObrazec(['nov_termin'])).toBeNull();
    expect(vzemiObrazec(['nova_stranka'])).toEqual({ vrsta: 'nova_stranka', polja: { ime: 'Ana' } });
    expect(vzemiObrazec(['nova_stranka'])).toBeNull();
  });

  it('star obrazec se ne uporabi', () => {
    shramba.set('asistent-obrazec', JSON.stringify({ vrsta: 'odsotnost', polja: {}, cas: Date.now() - 3 * 60_000 }));
    expect(vzemiObrazec(['odsotnost'])).toBeNull();
  });
});
