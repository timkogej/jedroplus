// Jutranji povzetek: vsebina, pravice, zasebnost opomb, hitra pot, jeziki.
import { describe, expect, it } from 'vitest';
import { obdelajUkaz } from '@/lib/glas/jedro';
import { hitraPot } from '@/lib/glas/hitraPot';
import { zJezikom } from '@/lib/glas/jeziki/jezik';
import { povzetekDneva } from '@/lib/glas/orodja/povzetek';
import { orodjaZa } from '@/lib/glas/orodja/registry';
import type { OkoljeOrodja } from '@/lib/glas/orodja/tipi';
import type { Kontekst, PodatkiSalona, TerminPovzetek } from '@/lib/glas/tipi';
import { DANES, kontekst, okolje, podatkiPomnilnik, VSE_PRAVICE_STAFF } from './pomoc';

function o(k: Partial<Kontekst> = {}, podatki: PodatkiSalona = podatkiPomnilnik('A1'), uraZdaj = '10:00'): OkoljeOrodja {
  return { k: kontekst(k), podatki, danes: DANES, uraZdaj, ukazId: null };
}

const termin = (id: string, datum: string, zacetek: string, osebaId: string, idStranke: string, status: TerminPovzetek['status'] = 'scheduled'): TerminPovzetek => ({
  id, vrstica: `v-${id}`, idStranke, stranka: idStranke === '101' ? 'Mateja Kovačič' : 'Ana Novak', datum, zacetek, konec: null,
  storitev: 'Barvanje', osebaId, oseba: osebaId === 'o1' ? 'Tina' : 'Urška', status, lokacijaId: null,
});

describe('povzetek_dneva', () => {
  it('lastnik s svojim koledarjem: termin, nova stranka, opomba, luknje', async () => {
    const r = await povzetekDneva.izvedi({ datum: null, samo_moji: null }, o());
    expect(r.govor).toBe(
      'Danes imate 1 termin, prvi ob enih, Ana Novak. Nova stranka: Ana Novak. Ana Novak ima opombo, je na zaslonu. Prosto je od desetih do enih in od dveh do štirih.'
    );
    expect(r.sporocilo).toContain('Ana Novak: Bo zamujala 10 minut');
    // Opomba gre samo na zaslon; modelu in v dnevnik samo število.
    expect(r.zasebno?.dnevnik).not.toContain('zamujala');
    expect(JSON.stringify(r.podatki)).not.toContain('zamujala');
  });

  it('cel salon jutri: prvi termin pri kom, brez opomb o luknjah za preteklost', async () => {
    const r = await povzetekDneva.izvedi({ datum: 'jutri', samo_moji: false }, o());
    expect(r.govor).toMatch(/^Jutri, v petek je 2 termina, prvi ob devetih, Mateja Kovačič, pri Tini\./);
    expect(r.sporocilo).toContain('11:00–11:30 Ana Novak, Moško striženje (Urška)');
    // Mateja ima pretekli termin, Ana ne (njen današnji je pred jutri) → Ana ni nova.
    expect(r.govor).not.toContain('Nova stranka');
  });

  it('odpovedani termini ne štejejo', async () => {
    const r = await povzetekDneva.izvedi({ datum: '2026-11-13', samo_moji: false }, o());
    expect(r.sporocilo).not.toContain('Špela');
  });

  it('zaposleni s "samo svoji" vidi samo svoje, tudi če prosi za salon', async () => {
    const pravice = { ...VSE_PRAVICE_STAFF, can_view_all_appointments: false, can_view_only_own_appointments: true };
    const r = await povzetekDneva.izvedi({ datum: 'jutri', samo_moji: false }, o({ vloga: 'staff', pravice, osebaId: 'o2' }));
    expect(r.govor).toMatch(/^Jutri, v petek imate 1 termin, prvi ob enajstih, Ana Novak\./);
    expect(r.sporocilo).not.toContain('Mateja');
  });

  it('zaposleni brez povezane osebe in s "samo svoji" dobi jasno napako', async () => {
    const pravice = { ...VSE_PRAVICE_STAFF, can_view_all_appointments: false, can_view_only_own_appointments: true };
    const r = await povzetekDneva.izvedi({ datum: null, samo_moji: null }, o({ vloga: 'staff', pravice, osebaId: null }));
    expect(r.sporocilo).toContain('ni povezan z zaposlenim');
  });

  it('zahteve za rezervacijo vidi lastnik, zaposleni brez pravice ne', async () => {
    const p: PodatkiSalona = { ...podatkiPomnilnik('A1'), zahteveVPregledu: async () => 2 };
    const lastnik = await povzetekDneva.izvedi({ datum: null, samo_moji: null }, o({}, p));
    expect(lastnik.govor).toContain('2 zahtevi za rezervacijo čakata.');
    const staff = await povzetekDneva.izvedi({ datum: null, samo_moji: null }, o({ vloga: 'staff', pravice: VSE_PRAVICE_STAFF }, p));
    expect(staff.govor).not.toContain('zahtev');
  });

  it('neoznačeni včerajšnji: samo, če salon termine sploh označuje', async () => {
    const vceraj = [termin('v1', '2026-11-11', '09:00', 'o1', '101'), termin('v2', '2026-11-11', '10:00', 'o1', '102')];
    const oznacuje: PodatkiSalona = {
      ...podatkiPomnilnik('A1'),
      async termini(od, doo) {
        return [...(await podatkiPomnilnik('A1').termini(od, doo)), ...vceraj.filter((t) => t.datum >= od && t.datum <= doo)];
      },
    };
    const r = await povzetekDneva.izvedi({ datum: null, samo_moji: null }, o({}, oznacuje));
    expect(r.govor).toContain('Včeraj 2 termina nista označena.');

    // Salon, ki nikoli ne zaključuje (kot NYCD5B): o tem molčimo.
    const neoznacuje: PodatkiSalona = {
      ...oznacuje,
      async termini(od, doo) {
        return (await oznacuje.termini(od, doo)).map((t) => (t.status === 'completed' ? { ...t, status: 'scheduled' } : t));
      },
    };
    const r2 = await povzetekDneva.izvedi({ datum: null, samo_moji: null }, o({}, neoznacuje));
    expect(r2.govor).not.toContain('Včeraj');
  });

  it('odsotnost: zaposleni, ki bi delal, je odsoten', async () => {
    const r = await povzetekDneva.izvedi({ datum: '2026-11-16', samo_moji: false }, o());
    expect(r.govor).toContain('Odsotni: Urška.');
  });

  it('prazen dan', async () => {
    const r = await povzetekDneva.izvedi({ datum: '2026-11-17', samo_moji: null }, o());
    expect(r.govor).toMatch(/^V torek, 17\. novembra nimate terminov\./);
  });

  it('nerazumljiv datum', async () => {
    const r = await povzetekDneva.izvedi({ datum: 'nekoč', samo_moji: null }, o());
    expect(r.sporocilo).toContain('ne razumem');
  });

  it('v angleščini', async () => {
    const r = await zJezikom('en', () => povzetekDneva.izvedi({ datum: null, samo_moji: null }, o({ jezik: 'en' })));
    expect(r.govor).toContain('you have 1 appointment');
    expect(r.govor).toContain('New client: Ana Novak.');
  });

  it('orodje je na voljo vsakemu, ki bere termine', () => {
    expect(orodjaZa(kontekst({ vloga: 'staff', pravice: VSE_PRAVICE_STAFF })).some((x) => x.ime === 'povzetek_dneva')).toBe(true);
  });
});

describe('hitra pot povzetka', () => {
  it.each([
    ['Kaj me danes čaka?', { datum: 'danes', samo_moji: true }],
    ['kaj me čaka jutri', { datum: 'jutri', samo_moji: true }],
    ['Kaj nas čaka v petek', { datum: 'v petek', samo_moji: false }],
    ['Povzetek dneva', { datum: null, samo_moji: null }],
    ['povzetek za jutri', { datum: 'jutri', samo_moji: null }],
    ['Kako izgleda moj dan?', { datum: null, samo_moji: true }],
  ])('%s', (stavek, vhod) => {
    expect(hitraPot(stavek)).toEqual({ orodje: 'povzetek_dneva', vhod });
  });

  it('"kaj imam jutri" ostane koledar', () => {
    expect(hitraPot('kaj imam jutri')?.orodje).toBe('koledar_dan');
  });

  it('cel ukaz prek jedra brez LLM', async () => {
    const { d, llm } = okolje({ stt: ['Kaj me danes čaka?'] });
    const r = await obdelajUkaz({ k: kontekst(), vhod: 'aplikacija', besedilo: 'Kaj me danes čaka?' }, d);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.govor).toContain('Danes imate 1 termin');
    expect(llm.zahteve.length).toBe(0);
  });
});
