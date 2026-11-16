// uredi_termin: sprememba obstoječega termina prek obrazca za urejanje (nič se ne shrani samo).
import { beforeAll, describe, expect, it } from 'vitest';
import { obdelajUkaz, preberiOdprtObrazec } from '@/lib/glas/jedro';
import { mestnik } from '@/lib/glas/govor';
import { urediTermin } from '@/lib/glas/orodja/obrazci';
import { DANES, kontekst, okolje, podatkiPomnilnik, SALONI, VSE_PRAVICE_STAFF } from './pomoc';

const o = (podjetje = 'A1', k = kontekst()) => ({ k, podatki: podatkiPomnilnik(podjetje), danes: DANES, uraZdaj: '10:00', ukazId: 'u' });
const prazno = {
  stranka_id: null, termin_id: null, datum_zdaj: null, storitev: null, dodaj_storitve: null, oseba: null, jezik: null,
  opombe: null, interne_opombe: null, lokacija: null, nov_datum: null, nova_ura: null,
} as const;
const vhod = (x: Record<string, unknown>) => urediTermin.vhod.parse({ ...prazno, ...x });

beforeAll(() => {
  SALONI.L3.termini.push({
    id: 't31', vrstica: 'v-t31', idStranke: '301', stranka: 'Nika Horvat', datum: '2026-11-13', zacetek: '10:00', konec: '11:30',
    storitev: 'Barvanje', osebaId: 'o31', oseba: 'Luka', status: 'scheduled', lokacijaId: 'l-center',
  });
});

describe('sklanjanje imen zaposlenih', () => {
  it('pri Luki, pri Tini, pri Marku, pri Timu, pri Mateju, pri Petru', () => {
    expect(['Luka', 'Tina', 'Marko', 'Tim', 'Matej', 'Peter', 'Maja Zorc', 'Jure'].map(mestnik)).toEqual([
      'Luki', 'Tini', 'Marku', 'Timu', 'Mateju', 'Petru', 'Maji Zorc', 'Juretu',
    ]);
  });
});

describe('uredi_termin', () => {
  it('jezik v angleščino: obrazec za urejanje, nič ni shranjeno', async () => {
    const r = await urediTermin.izvedi(vhod({ stranka: 'Ana Novak', datum_zdaj: 'jutri', jezik: 'eng' }), o());
    expect(r.obrazec).toEqual({ vrsta: 'uredi_termin', polja: { idt: 't2', dan_prej: '2026-11-13', jezik: 'eng' } });
    expect(r.pojdi).toBe('/koledar?glas=1');
    expect(r.govor).toBe('Ana Novak: jezik angleščina. Shranim?');
    expect(r.podatki).toMatchObject({ termin_id: 't2', stranka_id: '102' });
  });

  it('dodaj še barvanje, opomba in interna opomba', async () => {
    const r = await urediTermin.izvedi(
      vhod({ stranka: 'Ana Novak', datum_zdaj: 'jutri', dodaj_storitve: ['barvanje'], opombe: 'Bo zamujala 10 minut.', interne_opombe: 'Plača z gotovino' }),
      o()
    );
    expect(r.obrazec?.polja).toMatchObject({ dodaj1: 's1', opombe: 'Bo zamujala 10 minut.', interne: 'Plača z gotovino' });
    expect(r.sporocilo).toContain('dodana storitev Barvanje');
    expect(r.govor).toMatch(/Shranim\?$/);
  });

  it('daj ga k Urški: zaposleni, opozorilo ob zasedenosti', async () => {
    const r = await urediTermin.izvedi(vhod({ stranka: 'Mateja', oseba: 'Urška' }), o());
    expect(r.obrazec?.polja).toMatchObject({ idt: 't1', oseba: 'o2' });
    expect(r.sporocilo).toContain('pri Urški');
  });

  it('prestavi v Šiško: lokacija preverjena (Luka dela v Šiški)', async () => {
    const r = await urediTermin.izvedi(vhod({ stranka: 'Nika', lokacija: 'Šiška' }), o('L3', kontekst({ podjetje: 'L3' })));
    expect(r.obrazec?.polja).toMatchObject({ idt: 't31', lokacija: 'l-siska' });
    const ne = await urediTermin.izvedi(vhod({ stranka: 'Nika', lokacija: 'Bežigrad' }), o('L3', kontekst({ podjetje: 'L3' })));
    expect(ne.obrazec).toBeUndefined();
    expect(ne.sporocilo).toContain('Luka na lokaciji Bežigrad ne dela');
  });

  it('brez sprememb: vpraša, kaj naj spremeni, termin postane aktiven', async () => {
    const r = await urediTermin.izvedi(vhod({ stranka: 'Mateja' }), o());
    expect(r.obrazec).toBeUndefined();
    expect(r.govor).toMatch(/Kaj naj spremenim\?$/);
    expect(r.podatki).toMatchObject({ termin_id: 't1', termin_datum: '2026-11-13' });
  });

  it('zaposleni s pravico "samo svoji" ne ureja tujih terminov in ne dodeli drugim', async () => {
    const k = kontekst({ vloga: 'staff', osebaId: 'o2', pravice: { ...VSE_PRAVICE_STAFF, can_edit_all_appointments: false, can_edit_only_own_appointments: true } });
    const tuj = await urediTermin.izvedi(vhod({ stranka: 'Mateja', jezik: 'eng' }), o('A1', k));
    expect(tuj.obrazec).toBeUndefined();
    expect(tuj.sporocilo).toContain('samo svoje');
    const drugemu = await urediTermin.izvedi(vhod({ stranka: 'Ana Novak', datum_zdaj: 'jutri', oseba: 'Tina' }), o('A1', k));
    expect(drugemu.obrazec).toBeUndefined();
  });

  it('tuj termin (drugo podjetje) se ne najde', async () => {
    const r = await urediTermin.izvedi(vhod({ stranka: 'Mateja Tuja', stranka_id: '201', jezik: 'eng' }), o());
    expect(r.obrazec).toBeUndefined();
  });

  it('neveljaven jezik se zavrne', () => {
    expect(urediTermin.vhod.safeParse({ ...prazno, stranka: 'Ana', jezik: 'klingonščina' }).success).toBe(false);
  });
});

describe('odprt obrazec za urejanje', () => {
  it('opombe z ločili ostanejo, nevarni znaki ne', () => {
    const x = preberiOdprtObrazec({ vrsta: 'uredi_termin', polja: { idt: 't2', opombe: 'Bo zamujala, 10 min (avto)!', interne: '<script>', jezik: 'eng' } });
    expect(x).toEqual({ vrsta: 'uredi_termin', polja: { idt: 't2', opombe: 'Bo zamujala, 10 min (avto)!', jezik: 'eng' } });
  });

  it('jedro: obrazec je odprt → uvod pove, naj pokliče uredi_termin', async () => {
    const env = okolje({ llm: [{ besedilo: 'V redu.' }] });
    await obdelajUkaz(
      { k: kontekst(), vhod: 'besedilo', besedilo: 'dodaj še barvanje', odprtObrazec: { vrsta: 'uredi_termin', polja: { idt: 't2', jezik: 'eng' } } },
      env.d
    );
    const z = env.llm.zahteve[0].sporocila.at(-1);
    expect(z && 'besedilo' in z ? z.besedilo : '').toContain('pokliči uredi_termin');
  });
});

describe('pripravi_termin: jezik, opombe, dodatne storitve', () => {
  it('jezik in opombe le, če ju uporabnik pove', async () => {
    const { pripraviTermin } = await import('@/lib/glas/orodja/obrazci');
    const osnova = { stranka: 'Mateja', stranka_id: null, storitev: 'barvanje', oseba: null, datum: 'jutri', ura: '11:00', lokacija: null };
    const brez = await pripraviTermin.izvedi(pripraviTermin.vhod.parse(osnova), o());
    expect(brez.obrazec?.polja.jezik).toBeUndefined();
    const z = await pripraviTermin.izvedi(
      pripraviTermin.vhod.parse({ ...osnova, jezik: 'eng', opombe: 'Prvič pri nas.', interne_opombe: 'Občutljivo lasišče', dodaj_storitve: ['moško striženje'] }),
      o()
    );
    expect(z.obrazec?.polja).toMatchObject({ jezik: 'eng', opombe: 'Prvič pri nas.', interne: 'Občutljivo lasišče', dodaj1: 's2' });
    expect(z.govor).toContain('še Moško striženje, jezik angleščina, z opombo');
  });
});
