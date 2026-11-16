// Faza 2: bralna orodja (naslednja, luknje, kdo dela, resursi, kartica, barva,
// neaktivne), pomoč in premikanje po aplikaciji, hitre poti.
import { describe, expect, it } from 'vitest';
import { obdelajUkaz } from '@/lib/glas/jedro';
import { razponZaGovor, trajanjeZaGovor } from '@/lib/glas/govor';
import { hitraPot } from '@/lib/glas/hitraPot';
import { karticaStranke, neaktivneStranke, zadnjaBarva } from '@/lib/glas/orodja/kartica';
import { kdoDela, naslednjaStranka, polnoZaseden, prosteLuknjeOrodje, resursiDan } from '@/lib/glas/orodja/pregled';
import { odpriStran, pomocAplikacija } from '@/lib/glas/orodja/pomoc';
import { preveriRegister } from '@/lib/glas/orodja/registry';
import type { OkoljeOrodja } from '@/lib/glas/orodja/tipi';
import type { Kontekst } from '@/lib/glas/tipi';
import { DANES, kontekst, okolje, podatkiPomnilnik, VSE_PRAVICE_STAFF } from './pomoc';

function o(uraZdaj = '10:00', k: Partial<Kontekst> = {}): OkoljeOrodja {
  return { k: kontekst(k), podatki: podatkiPomnilnik('A1'), danes: DANES, uraZdaj, ukazId: null };
}

describe('govor (faza 2)', () => {
  it('razponi in trajanja', () => {
    expect(razponZaGovor('09:00', '10:30')).toBe('od devetih do pól enajstih');
    expect(trajanjeZaGovor(30)).toBe('pol ure');
    expect(trajanjeZaGovor(90)).toBe('uro in pol');
    expect(trajanjeZaGovor(120)).toBe('dve uri');
  });
});

describe('register', () => {
  it('nova orodja so veljavna', () => {
    expect(() => preveriRegister()).not.toThrow();
  });
});

describe('naslednja_stranka', () => {
  it('moja naslednja danes', async () => {
    const r = await naslednjaStranka.izvedi({ samo_moji: null }, o('10:00'));
    expect(r.govor).toBe('Naslednja je Ana Novak, ob enih, Barvanje.');
  });

  it('danes ni več → jutri, z dnevom', async () => {
    const r = await naslednjaStranka.izvedi({ samo_moji: null }, o('14:00'));
    expect(r.govor).toBe('Danes nimate več terminov. Naslednja je Mateja Kovačič, jutri, v petek ob devetih, Barvanje.');
  });

  it('za cel salon pove, pri kom', async () => {
    const r = await naslednjaStranka.izvedi({ samo_moji: false }, o('14:00'));
    expect(r.govor).toContain('pri Tini');
  });
});

describe('proste_luknje', () => {
  it('moje luknje danes od zdaj naprej', async () => {
    const r = await prosteLuknjeOrodje.izvedi({ datum: null, oseba: null, najmanj_min: null }, o('10:00'));
    expect(r.sporocilo).toContain('10:00–13:00, 14:00–16:00');
    expect(r.govor).toBe('Danes imate prosto od desetih do enih in od dveh do štirih.');
  });

  it('za drugega zaposlenega jutri', async () => {
    const r = await prosteLuknjeOrodje.izvedi({ datum: 'jutri', oseba: 'Urška', najmanj_min: null }, o());
    expect(r.govor).toBe('Jutri, v petek ima Urška prosto od osmih do enajstih in od pól dvanajstih do štirih.');
  });

  it('zaposleni s pravico "samo svoji" ne vidi tujega urnika', async () => {
    const pravice = { ...VSE_PRAVICE_STAFF, can_view_all_appointments: false, can_view_only_own_appointments: true };
    const r = await prosteLuknjeOrodje.izvedi({ datum: null, oseba: 'Urška', najmanj_min: null }, o('10:00', { vloga: 'staff', pravice }));
    expect(r.sporocilo).toBe('Vidite lahko samo svoj urnik.');
  });

  it('za nazaj ne išče', async () => {
    const r = await prosteLuknjeOrodje.izvedi({ datum: 'včeraj', oseba: null, najmanj_min: null }, o());
    expect(r.sporocilo).toContain('samo za danes in naprej');
  });
});

describe('kdo_dela', () => {
  it('odsotni so našteti posebej', async () => {
    const r = await kdoDela.izvedi({ datum: '2026-11-16' }, o());
    expect(r.govor).toBe('V ponedeljek dela Tina od osmih do štirih. Odsotni: Urška.');
  });

  it('ob sobotah nihče', async () => {
    const r = await kdoDela.izvedi({ datum: 'v soboto' }, o());
    expect(r.govor).toBe('Pojutrišnjem, v soboto ne dela nihče.');
  });
});

describe('resursi_dan', () => {
  it('zasedenost iz Termini_Resursi, odpovedani ne štejejo', async () => {
    const r = await resursiDan.izvedi({ datum: 'jutri', resurs: null }, o());
    expect(r.sporocilo).toContain('Umivalnik: zaseden 09:00–10:30, 11:00–11:30');
    expect(r.sporocilo).toContain('Masažna soba (2): prost');
    expect(r.govor).toBe('Jutri, v petek: Umivalnik je zaseden od devetih do pól enajstih in od enajstih do pól dvanajstih. Ostali so prosti.');
  });

  it('resurs s količino 2 je poln šele ob dveh hkratnih terminih', () => {
    expect(polnoZaseden([[0, 10], [5, 15]], 2)).toEqual([[5, 10]]);
    expect(polnoZaseden([[0, 10], [10, 20]], 1)).toEqual([[0, 20]]);
  });
});

describe('kartica_stranke in zadnja_barva', () => {
  it('kartica: obiski, zapiski, interne opombe', async () => {
    const r = await karticaStranke.izvedi({ stranka: 'Mateja', stranka_id: null }, o());
    expect(r.sporocilo).toContain('Zadnjič: torek, 20. 10.');
    expect(r.sporocilo).toContain('Interne opombe: Alergija na amonijak');
    expect(r.govor).toContain('Naslednjič pride jutri, v petek ob devetih.');
    expect(r.govor).toContain('Zadnji zapisek: Ima rada kratke konice.');
  });

  it('zadnja barva z recepturo za glas', async () => {
    const r = await zadnjaBarva.izvedi({ stranka: 'Mateja Kovačič', stranka_id: null }, o());
    expect(r.sporocilo).toContain('6.3 + 7.1, 30 g, oksidant 6 %, 35 min');
    expect(r.govor).toContain('6 3 in 7 1, 30 gramov, oksidant 6 odstotkov, 35 minut');
  });

  it('brez barve pove, kako jo zapisati', async () => {
    const r = await zadnjaBarva.izvedi({ stranka: 'Ana Novak', stranka_id: null }, o());
    expect(r.govor).toBe('Za Ana Novak nimam zapisane barve.');
  });

  it('tuj ID stranke ni viden (RLS)', async () => {
    const r = await karticaStranke.izvedi({ stranka: 'x', stranka_id: '201' }, o());
    expect(r.sporocilo).toBe('Te stranke ne najdem.');
  });
});

describe('neaktivne_stranke', () => {
  it('brez obiska več kot mesec in brez termina', async () => {
    const r = await neaktivneStranke.izvedi({ mesecev: 1 }, o());
    expect(r.podatki).toMatchObject({ stevilo: 2, stranke: [{ ime: 'Ana Novinc' }, { ime: 'Tim Zupančič' }] });
  });
});

describe('pomoč in premikanje', () => {
  it('pomoč vrne vnaprej napisano navodilo in stran', async () => {
    const r = await pomocAplikacija.izvedi({ tema: 'nov_termin' }, o());
    expect(r.govor).toContain('Nov termin');
    expect(r.podatki).toMatchObject({ stran: '/koledar' });
  });

  it('odpri stran in kartico stranke', async () => {
    expect((await odpriStran.izvedi({ stran: 'koledar', stranka: null, stranka_id: null }, o())).pojdi).toBe('/koledar');
    const r = await odpriStran.izvedi({ stran: 'stranke', stranka: 'Mateja', stranka_id: null }, o());
    expect(r.pojdi).toBe('/clients?stranka=101');
  });

  it('več strank z istim imenom → vprašanje, brez premika', async () => {
    const r = await odpriStran.izvedi({ stran: 'stranke', stranka: 'Ana', stranka_id: null }, o());
    expect(r.vprasanje?.moznosti).toHaveLength(2);
    expect(r.pojdi).toBeUndefined();
  });
});

describe('hitra pot (faza 2)', () => {
  it('prepozna cele stavke', () => {
    expect(hitraPot('Kdo je naslednja?')).toEqual({ orodje: 'naslednja_stranka', vhod: { samo_moji: null } });
    expect(hitraPot('kdo je moja naslednja stranka')).toEqual({ orodje: 'naslednja_stranka', vhod: { samo_moji: true } });
    expect(hitraPot('Kdo dela jutri?')).toEqual({ orodje: 'kdo_dela', vhod: { datum: 'jutri' } });
    expect(hitraPot('Kdaj imam danes prosto?')).toEqual({ orodje: 'proste_luknje', vhod: { datum: 'danes', oseba: null, najmanj_min: null } });
    expect(hitraPot('Odpri koledar.')).toEqual({ orodje: 'odpri_stran', vhod: { stran: 'koledar', stranka: null, stranka_id: null } });
    expect(hitraPot('pojdi na nastavitve')?.vhod).toMatchObject({ stran: 'nastavitve' });
  });

  it('ostalo gre AI', () => {
    expect(hitraPot('odpri kartico Ane Novak')).toBeNull();
    expect(hitraPot('kdo dela jutri in kdo v petek')).toBeNull();
  });

  it('"odpri koledar" brez AI vrne stran za odjemalca', async () => {
    const { d, llm } = okolje();
    const r = await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'odpri koledar' }, d);
    expect(llm.zahteve).toHaveLength(0);
    expect(r).toMatchObject({ ok: true, pojdi: '/koledar', govor: 'Odpiram Koledar.' });
  });

  it('kartica stranke prek AI v enem krogu, stran gre naprej', async () => {
    const { d, llm } = okolje({ llm: [{ klici: [{ id: 'a', ime: 'odpri_stran', vhod: { stran: 'stranke', stranka: 'Mateja', stranka_id: null } }] }] });
    const r = await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'odpri kartico Mateje' }, d);
    expect(llm.zahteve).toHaveLength(1);
    expect(r).toMatchObject({ ok: true, pojdi: '/clients?stranka=101' });
  });
});
