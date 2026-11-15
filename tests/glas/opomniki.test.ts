// Osebni opomniki: čas v pasu podjetja (tudi poletni/zimski), vezava na termin, omejitev,
// potrditev, seznam in brisanje samo svojih.
import { describe, expect, it } from 'vitest';
import { obdelajUkaz, potrdiPredlog } from '@/lib/glas/jedro';
import { casVPasu } from '@/lib/glas/opomniki/cas';
import { prekliciOpomnik, mojiOpomniki, novOpomnik, ujemanjeOpomnikov } from '@/lib/glas/orodja/opomniki';
import { orodjaZa } from '@/lib/glas/orodja/registry';
import { jePredogled, type OkoljeOrodja } from '@/lib/glas/orodja/tipi';
import type { Kontekst, Predogled } from '@/lib/glas/tipi';
import { DANES, kontekst, okolje, opomnikiLazni, podatkiPomnilnik, SALONI, VSE_PRAVICE_STAFF } from './pomoc';

type V = Parameters<typeof novOpomnik.predogled>[0];
const vhod = (p: Partial<V> = {}): V => ({
  besedilo: 'pokliči dobavitelja', datum: 'jutri', ura: '9:00', del_dneva: null, cez_minut: null,
  ob_terminu: false, stranka: null, stranka_id: null, termin_id: null, za: null, ...p,
});
function o(k: Partial<Kontekst> = {}, opomniki = opomnikiLazni()): OkoljeOrodja & { opomniki: ReturnType<typeof opomnikiLazni> } {
  return { k: kontekst(k), podatki: podatkiPomnilnik('A1'), danes: DANES, uraZdaj: '10:00', ukazId: null, opomniki };
}
const kotPredlog = (x: unknown): Predogled => {
  if (!jePredogled(x as Predogled)) throw new Error(JSON.stringify(x));
  return x as Predogled;
};
const sporocilo = (x: unknown) => (x as { sporocilo: string }).sporocilo;

describe('čas v pasu podjetja', () => {
  it.each([
    ['2026-11-13', '09:00', '2026-11-13T08:00:00.000Z'], // zimski
    ['2026-07-01', '09:00', '2026-07-01T07:00:00.000Z'], // poletni
    ['2026-10-25', '12:00', '2026-10-25T11:00:00.000Z'], // dan prehoda na zimski
    ['2027-03-28', '12:00', '2027-03-28T10:00:00.000Z'], // dan prehoda na poletni
    ['2026-10-24', '23:30', '2026-10-24T21:30:00.000Z'],
  ])('%s %s → %s', (d, u, iso) => {
    expect(casVPasu(d, u, 'Europe/Ljubljana').toISOString()).toBe(iso);
  });
});

describe('nov_opomnik', () => {
  it('jutri ob devetih: točen čas pred shranjevanjem', async () => {
    const p = kotPredlog(await novOpomnik.predogled(vhod(), o()));
    expect(p.povzetek).toMatch(/^Opomnik jutri, petek, 13\. 11\. ob 09:00: pokliči dobavitelja$/);
    expect(p.parametri.ob).toBe('2026-11-13T08:00:00.000Z');
  });

  it('čez 90 minut, del dneva, manjkajoča ura, preteklost', async () => {
    expect(kotPredlog(await novOpomnik.predogled(vhod({ datum: null, ura: null, cez_minut: 90 }), o())).parametri.ob).toBe('2026-11-12T10:30:00.000Z');
    expect(kotPredlog(await novOpomnik.predogled(vhod({ datum: 'v petek', ura: null, del_dneva: 'popoldne' }), o())).parametri.ob).toBe('2026-11-13T13:00:00.000Z');
    const brez = await novOpomnik.predogled(vhod({ ura: null }), o());
    expect((brez as { vprasanje?: unknown }).vprasanje).toBeTruthy();
    expect(sporocilo(await novOpomnik.predogled(vhod({ datum: null, ura: '08:00' }), o()))).toBe('Ta čas je že mimo.');
  });

  it('ob terminu stranke: čas termina, ID termina', async () => {
    const p = kotPredlog(await novOpomnik.predogled(vhod({ besedilo: 'povej ji za novo barvo', datum: null, ura: null, ob_terminu: true, stranka: 'Mateja' }), o()));
    expect(p.parametri).toMatchObject({ idTermina: 't1', datumTermina: '2026-11-13', idStranke: '101', ob: '2026-11-13T08:00:00.000Z' });
    expect(p.povzetek).toContain('ob terminu stranke Mateja Kovačič');
    expect(sporocilo(await novOpomnik.predogled(vhod({ ob_terminu: true }), o()))).toMatch(/katere stranke/);
    expect(sporocilo(await novOpomnik.predogled(vhod({ ob_terminu: true, stranka: 'Špela' }), o()))).toMatch(/nima prihodnjega termina/);
  });

  it('potrditev shrani za uporabnika; brez pusha opozori; odpovedan termin ne shrani', async () => {
    const env = o({}, opomnikiLazni(false));
    const p = kotPredlog(await novOpomnik.predogled(vhod(), env));
    const r = await novOpomnik.potrdi(p.parametri, env);
    expect(r.sporocilo).toMatch(/^Opomnik je shranjen\. Push obvestila niso vklopljena/);
    expect(env.opomniki.vrstice[0]).toMatchObject({ userId: 'u-lastnik', podjetje: 'A1', podjetjeUuid: 'uuid-a1', besedilo: 'pokliči dobavitelja', casovniPas: 'Europe/Ljubljana', jezik: 'sl' });

    const vezan = kotPredlog(await novOpomnik.predogled(vhod({ ob_terminu: true, stranka: 'Mateja', datum: null, ura: null }), env));
    const t1 = SALONI.A1.termini.find((t) => t.id === 't1')!;
    t1.status = 'cancelled';
    try {
      expect(await novOpomnik.potrdi(vezan.parametri, env)).toMatchObject({ neuspeh: true, sporocilo: 'Termina ni več. Opomnik ni shranjen.' });
    } finally {
      t1.status = 'scheduled';
    }
  });

  it('za sodelavca: samo lastnik/admin, oseba z računom, shrani za prejemnika s podpisom', async () => {
    const env = o({}, opomnikiLazni(true, { o2: 'u-urska' }));
    const p = kotPredlog(await novOpomnik.predogled(vhod({ besedilo: 'naroči barve', za: 'Urško' }), env));
    expect(p.povzetek).toBe('Opomnik za Urška Bele jutri, petek, 13. 11. ob 09:00: naroči barve');
    expect(p.parametri.zaOsebo).toBe('o2');
    const r = await novOpomnik.potrdi(p.parametri, env);
    expect(r.sporocilo).toBe('Opomnik za Urška Bele je shranjen. Vidi in prekliče ga lahko samo Urška Bele.');
    expect(env.opomniki.vrstice[0]).toMatchObject({ userId: 'u-urska', besedilo: 'naroči barve — Tina' });
    // Lastnikovi opomniki ostanejo ločeni.
    expect(await env.opomniki.cakajoci('A1', 'u-lastnik')).toHaveLength(0);

    // Sebe po imenu = navaden opomnik.
    expect(kotPredlog(await novOpomnik.predogled(vhod({ za: 'Tina' }), env)).parametri.zaOsebo).toBeNull();
    // Brez računa, neznana oseba.
    expect(sporocilo(await novOpomnik.predogled(vhod({ za: 'Urška' }), o()))).toBe('Urška Bele nima računa v aplikaciji, zato je ne morem opomniti.');
    expect(sporocilo(await novOpomnik.predogled(vhod({ za: 'Marjeta' }), env))).toMatch(/ne najdem/);
    // Zaposleni ne sme opomniti sodelavca, niti s ponarejenimi parametri ob potrditvi.
    const staff = o({ vloga: 'staff', userId: 'u-urska', osebaId: 'o2', pravice: VSE_PRAVICE_STAFF }, opomnikiLazni(true, { o1: 'u-lastnik' }));
    expect(sporocilo(await novOpomnik.predogled(vhod({ za: 'Tina' }), staff))).toMatch(/^Opomnim lahko samo vas\./);
    expect(await novOpomnik.potrdi({ ...p.parametri, zaOsebo: 'o1' }, staff)).toMatchObject({ neuspeh: true });
    expect(staff.opomniki.vrstice).toHaveLength(0);
  });

  it('največ 50 čakajočih', async () => {
    const env = o();
    for (let i = 0; i < 50; i++) await env.opomniki.dodaj({ ...env.opomniki.vrstice[0], podjetje: 'A1', podjetjeUuid: 'uuid-a1', userId: 'u-lastnik', besedilo: `o${i}`, ob: '2026-12-01T08:00:00.000Z', idTermina: null, idStranke: null, casovniPas: 'Europe/Ljubljana', jezik: 'sl', ukazId: null });
    expect(sporocilo(await novOpomnik.predogled(vhod(), env))).toMatch(/že 50 opomnikov/);
  });
});

describe('moji_opomniki in izbrisi_opomnik', () => {
  async function dva() {
    const env = o();
    for (const v of [vhod(), vhod({ besedilo: 'naroči barve', datum: 'v ponedeljek', ura: '8:30' })]) {
      await novOpomnik.potrdi(kotPredlog(await novOpomnik.predogled(v, env)).parametri, env);
    }
    return env;
  }

  it('seznam po času; prazno', async () => {
    expect(sporocilo(await mojiOpomniki.izvedi({}, o()))).toBe('Nimate čakajočih opomnikov.');
    const r = await mojiOpomniki.izvedi({}, await dva());
    expect(r.sporocilo).toBe('Vaši opomniki (2):\n• jutri, petek, 13. 11. ob 09:00 — pokliči dobavitelja\n• ponedeljek, 16. 11. ob 08:30 — naroči barve');
    expect(r.govor).toMatch(/^Imate 2 opomnika: /);
  });

  it('brisanje po besedah (sklon), dvoumno vpraša, tujih ne vidi', async () => {
    const env = await dva();
    expect(ujemanjeOpomnikov('za dobavitelja', await env.opomniki.cakajoci('A1', 'u-lastnik')).map((x) => x.besedilo)).toEqual(['pokliči dobavitelja']);
    const p = kotPredlog(await prekliciOpomnik.predogled({ opis: 'opomnik za dobavitelja', opomnik_id: null }, env));
    expect(p.povzetek).toMatch(/Izbrišem opomnik: jutri.*pokliči dobavitelja/);
    expect((await prekliciOpomnik.potrdi(p.parametri, env)).sporocilo).toBe('Opomnik je izbrisan.');
    expect((await prekliciOpomnik.potrdi(p.parametri, env)).neuspeh).toBe(true);

    await novOpomnik.potrdi(kotPredlog(await novOpomnik.predogled(vhod({ besedilo: 'naroči barve za Ano' }), env)).parametri, env);
    expect((await prekliciOpomnik.predogled({ opis: 'barve', opomnik_id: null }, env) as { vprasanje?: { moznosti?: unknown[] } }).vprasanje?.moznosti).toHaveLength(2);

    const drug = { ...env, k: kontekst({ userId: 'u-drug' }) };
    expect(sporocilo(await prekliciOpomnik.predogled({ opis: 'barve', opomnik_id: null }, drug))).toBe('Nimate čakajočih opomnikov.');
  });

  it('jedro: predlog, potrditev shrani enkrat; orodja ima vsak z glasovnim asistentom', async () => {
    const env = okolje({ llm: [{ klici: [{ id: 'k1', ime: 'nov_opomnik', vhod: vhod() }] }] });
    const k = kontekst();
    const r = await obdelajUkaz({ k, vhod: 'besedilo', besedilo: 'Opomni me jutri ob devetih, da pokličem dobavitelja.' }, env.d);
    if (!r.ok || !r.predlog) throw new Error(JSON.stringify(r));
    expect(env.opomniki.vrstice).toHaveLength(0);
    const p = await potrdiPredlog({ k, predlogId: r.predlog.id, zeton: r.predlog.zeton }, env.d);
    expect(p).toMatchObject({ ok: true });
    expect(env.opomniki.vrstice).toHaveLength(1);
    const ima = (x: Partial<Kontekst>) => orodjaZa(kontekst(x)).some((t) => t.ime === 'nov_opomnik');
    expect(ima({ vloga: 'staff', pravice: VSE_PRAVICE_STAFF })).toBe(true);
    expect(ima({ vloga: 'staff', pravice: { ...VSE_PRAVICE_STAFF, can_access_asistent_plus: false } })).toBe(false);
  });
});
