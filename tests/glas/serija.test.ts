// Ponavljajoči termini: datumi serije, preverjanje vsakega datuma s predlogi in orodje
// pripravi_serijo (odpre obrazec z »ponovi«, nič ne shrani).
import { describe, expect, it } from 'vitest';
import { razcleniUrnik } from '@/lib/glas/razresevanje/urnik';
import { pripraviSerijo } from '@/lib/glas/orodja/serija';
import { orodjaZa } from '@/lib/glas/orodja/registry';
import type { OkoljeOrodja } from '@/lib/glas/orodja/tipi';
import type { Kontekst, TerminPovzetek } from '@/lib/glas/tipi';
import { datumiSerije, preveriSerijo, type VhodPreverjanja } from '@/lib/termini/serija';
import { DANES, kontekst, podatkiPomnilnik, URNIK, VSE_PRAVICE_STAFF } from './pomoc';

describe('datumi serije', () => {
  it('vsakih šest tednov, šestkrat', () => {
    expect(datumiSerije('2026-11-13', { vsakihTednov: 6, stevilo: 6, doDatuma: null })).toEqual([
      '2026-11-13', '2026-12-25', '2027-02-05', '2027-03-19', '2027-04-30', '2027-06-11',
    ]);
  });
  it('vsak teden do datuma; največ 12 terminov in eno leto', () => {
    expect(datumiSerije('2026-12-01', { vsakihTednov: 1, stevilo: null, doDatuma: '2026-12-31' })).toEqual([
      '2026-12-01', '2026-12-08', '2026-12-15', '2026-12-22', '2026-12-29',
    ]);
    expect(datumiSerije('2026-11-13', { vsakihTednov: 1, stevilo: 40, doDatuma: null })).toHaveLength(12);
    const leto = datumiSerije('2026-11-13', { vsakihTednov: 8, stevilo: 12, doDatuma: null });
    expect(leto.at(-1)! <= '2027-11-14').toBe(true);
    expect(leto).toHaveLength(7);
  });
});

const t = (id: string, datum: string, od: string, doo: string, status: TerminPovzetek['status'] = 'scheduled'): TerminPovzetek => ({
  id, idStranke: '9', stranka: 'Ana', datum, zacetek: od, konec: doo, storitev: 'x', osebaId: 'o1', oseba: 'Tina', status, lokacijaId: null,
});
const vhod = (p: Partial<VhodPreverjanja>): VhodPreverjanja => ({
  datumi: [], ura: '10:00', trajanjeMin: 90, osebaId: 'o1', urnik: razcleniUrnik(URNIK), termini: [], odsotnosti: [],
  casovniPas: 'Europe/Ljubljana', odDatuma: DANES, ...p,
});

describe('preverjanje datumov', () => {
  it('prosto, zasedeno (predlog isti dan), sobota (predlog sosednji dan), ni prostega', () => {
    const r = preveriSerijo(vhod({
      datumi: ['2026-11-16', '2026-11-23', '2026-11-28', '2026-11-30'],
      termini: [
        t('a', '2026-11-23', '09:30', '11:00'),
        t('b', '2026-11-23', '11:00', '11:30', 'cancelled'), // odpovedan ne zaseda
        t('c', '2026-11-30', '08:00', '16:00'),
        t('d', '2026-12-01', '08:00', '16:00'),
        t('e', '2026-11-29', '08:00', '16:00'),
        t('f', '2026-12-02', '08:00', '16:00'),
        t('g', '2026-12-03', '08:00', '16:00'),
        t('h', '2026-11-27', '08:00', '16:00'),
      ],
    }));
    expect(r[0]).toEqual({ datum: '2026-11-16', ura: '10:00', stanje: 'ok' });
    expect(r[1]).toMatchObject({ datum: '2026-11-23', ura: '11:00', stanje: 'premaknjen', razlog: 'zaseden', zasedenZ: '09:30, Ana' });
    // sobota 28. 11.: petek 27. zaseden ves dan → nedelja ne dela → ponedeljek 30. je že datum serije → četrtek 26.
    expect(r[2]).toMatchObject({ datum: '2026-11-26', ura: '10:00', stanje: 'premaknjen', razlog: 'ne_dela' });
    expect(r[3]).toMatchObject({ stanje: 'tezava', razlog: 'zaseden', zeleno: { datum: '2026-11-30', ura: '10:00' } });
  });

  it('odsotnost in danes pred trenutno uro', () => {
    const r = preveriSerijo(vhod({
      datumi: ['2026-11-12', '2026-11-19'],
      odUre: '11:00',
      odsotnosti: [{ osebaId: 'o1', zacetek: '2026-11-19T07:00:00Z', konec: '2026-11-19T15:00:00Z' }],
    }));
    expect(r[0]).toMatchObject({ datum: '2026-11-12', ura: '11:00', stanje: 'premaknjen' });
    expect(r[1].stanje).not.toBe('ok');
    expect(r[1].datum).not.toBe('2026-11-19');
  });
});

describe('pripravi_serijo', () => {
  type V = Parameters<typeof pripraviSerijo.izvedi>[0];
  const p = (x: Partial<V> = {}): V => ({
    stranka: 'Mateja', stranka_id: null, storitev: 'barvanje', oseba: 'Tina', datum: '2026-11-13', ura: '10:00',
    lokacija: null, dodaj_storitve: null, jezik: null, opombe: null, interne_opombe: null, kot_zadnjic: null,
    vsakih_tednov: 6, stevilo: 6, do_datuma: null, ...x,
  });
  const o = (k: Partial<Kontekst> = {}): OkoljeOrodja => ({ k: kontekst(k), podatki: podatkiPomnilnik('A1'), danes: DANES, uraZdaj: '10:00', ukazId: null });

  it('odpre obrazec z »ponovi«, preveri vse datume, nič ne shrani', async () => {
    const r = await pripraviSerijo.izvedi(p(), o());
    expect(r.obrazec).toEqual({ vrsta: 'nov_termin', polja: expect.objectContaining({ stranka: '101', storitev: 's1', oseba: 'o1', dan: '2026-11-13', ura: '10:00', ponovi: '6:6' }) });
    expect(r.sporocilo).toContain('Serija: 6 terminov, vsakih 6 tednov.');
    expect(r.sporocilo).toMatch(/Prostih je 5 od 6\. Težave:\n• jutri, petek: zasedeno \(09:00, Mateja Kovačič\), predlog jutri, petek ob 10:30/);
    expect(r.sporocilo).toMatch(/Shranim\? Pred shranjevanjem boste videli vse datume\.$/);
    expect(r.govor).toMatch(/1 datum ni prost, predloge vidite na zaslonu\./);
    expect(r.pojdi).toBe('/koledar?glas=1');
  });

  it('do datuma, vsak teden, manjkajoča ura, brez števila', async () => {
    const r = await pripraviSerijo.izvedi(p({ vsakih_tednov: 1, stevilo: null, do_datuma: '2026-12-31', datum: '2026-12-01', ura: null }), o());
    expect(r.obrazec?.polja.ponovi).toBe('1:5');
    expect(r.sporocilo).toContain('Serija: 5 terminov, vsak teden.');
    expect(r.sporocilo).toContain('Datume preverim, ko bodo izpolnjeni dan, ura in zaposleni.');
    expect((await pripraviSerijo.izvedi(p({ stevilo: null }), o())).sporocilo).toBe('Kolikokrat ali do kdaj naj ponovim?');
    const vec = await pripraviSerijo.izvedi(p({ vsakih_tednov: 1, stevilo: 20 }), o());
    expect(vec.obrazec?.polja.ponovi).toBe('1:12');
    expect(vec.sporocilo).toContain('Največ 12 terminov naenkrat.');
  });

  it('pravice: brez ustvarjanja terminov orodja ni; »samo svoji« ne vpiše za drugega', async () => {
    const ima = (x: Partial<Kontekst>) => orodjaZa(kontekst(x)).some((y) => y.ime === 'pripravi_serijo');
    expect(ima({})).toBe(true);
    expect(ima({ vloga: 'staff', pravice: { ...VSE_PRAVICE_STAFF, can_create_appointments: false } })).toBe(false);
    const svoji = o({ vloga: 'staff', osebaId: 'o2', pravice: { ...VSE_PRAVICE_STAFF, can_view_all_appointments: false, can_view_only_own_appointments: true } });
    expect((await pripraviSerijo.izvedi(p(), svoji)).sporocilo).toBe('Vpisujete lahko samo svoje termine.');
  });
});
