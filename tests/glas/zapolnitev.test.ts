// Zapolnitev luknje 4a: kandidati (kasnejši termin, ritem, navada), izločitve, pravice,
// zasebnost (telefon samo v gumbu) in ponudba prostega termina samo s privolitvijo.
import { beforeEach, describe, expect, it } from 'vitest';
import { obdelajUkaz, potrdiPredlog } from '@/lib/glas/jedro';
import { orodjaZa } from '@/lib/glas/orodja/registry';
import { kandidatiZaLuknjo, ponudiProstiTermin } from '@/lib/glas/orodja/zapolnitev';
import { jePredogled, type OkoljeOrodja } from '@/lib/glas/orodja/tipi';
import { izberiKandidate } from '@/lib/glas/zapolnitev/kandidati';
import type { Kontekst, Predogled } from '@/lib/glas/tipi';
import { DANES, kontekst, okolje, podatkiPomnilnik, posiljateljLazni, SALONI, salonZapolnitev, terminZ5, VSE_PRAVICE_STAFF } from './pomoc';

const LUKNJA_DAN = '2026-11-13'; // petek, DANES je četrtek 12. 11.
const salon = () => { SALONI.Z5 = salonZapolnitev(); };
const t = terminZ5;

beforeEach(salon);

function o(k: Partial<Kontekst> = {}, sporocila = posiljateljLazni()): OkoljeOrodja & { sporocila: ReturnType<typeof posiljateljLazni> } {
  return { k: kontekst({ podjetje: 'Z5', ...k }), podatki: podatkiPomnilnik('Z5'), danes: DANES, uraZdaj: '10:00', ukazId: null, sporocila };
}
const vhod = (p: Partial<{ datum: string | null; ura: string | null; oseba: string | null; trajanje_min: number | null }> = {}) => ({
  datum: LUKNJA_DAN, ura: '10:30', oseba: 'Tina', trajanje_min: null, ...p,
});
type Kand = { stranka_id: string; ime: string; skupina: string; sms_dovoljen: boolean; termin_id?: string };

describe('izberiKandidate', () => {
  it('prednost: kasnejši termin, zapadla po ritmu, navada; izločitve', () => {
    const s = SALONI.Z5;
    const k = izberiKandidate({
      luknja: { datum: LUKNJA_DAN, osebaId: 'o1', od: 630, do: 960 },
      termini: s.termini, storitve: s.storitve, oseba: s.osebe[0], danes: DANES,
      stranke: new Map(s.stranke.map((x) => [x.id, `${x.ime} ${x.priimek}`])),
    });
    expect(k.map((x) => [x.idStranke, x.skupina])).toEqual([
      ['501', 'kasnejsi_termin'],
      ['506', 'kasnejsi_termin'],
      ['502', 'zapadla'],
      ['503', 'navada'],
    ]);
    expect(k[2].ritem).toMatchObject({ storitev: 'Barvanje', razmikDni: 42, odZadnjegaDni: 43 });
    // Petra (neprihodi), Eva (prihodnji termin), Lara (prekrivanje), Zala (termin na dan luknje pred luknjo, a ni kandidat)
    expect(k.map((x) => x.idStranke)).not.toContain('504');
    expect(k.map((x) => x.idStranke)).not.toContain('505');
    expect(k.map((x) => x.idStranke)).not.toContain('507');
  });

  it('kasnejši termin, ki je daljši od luknje, ne gre', () => {
    const s = SALONI.Z5;
    const k = izberiKandidate({
      luknja: { datum: LUKNJA_DAN, osebaId: 'o1', od: 630, do: 660 }, // 30 min
      termini: s.termini, storitve: s.storitve, oseba: s.osebe[0], danes: DANES,
      stranke: new Map(s.stranke.map((x) => [x.id, x.ime])),
    });
    expect(k.find((x) => x.idStranke === '501')).toBeUndefined(); // 60 min termin
    expect(k.find((x) => x.idStranke === '506')).toBeDefined(); // 30 min
    expect(k.find((x) => x.idStranke === '502')).toBeUndefined(); // barvanje 90 min
  });

  it('brez podatkov ni ugibanja', () => {
    const k = izberiKandidate({
      luknja: { datum: LUKNJA_DAN, osebaId: 'o1', od: 630, do: 960 },
      termini: [], storitve: [], oseba: SALONI.Z5.osebe[0], danes: DANES, stranke: new Map(),
    });
    expect(k).toEqual([]);
  });
});

describe('kandidati_za_luknjo', () => {
  it('imena z razlogi, gumbi za klic z imeni, model ne vidi telefona', async () => {
    const r = await kandidatiZaLuknjo.izvedi(vhod(), o());
    expect(r.sporocilo).toContain('Mateja Kos — ima termin');
    expect(r.sporocilo).toContain('Ana Novak — Barvanje na približno 42 dni');
    expect(r.sporocilo).toContain('Nina Bela — 2-krat');
    expect(r.sporocilo).not.toContain('Maja'); // brez telefona
    expect(r.sporocilo).toContain('samo strankam s privolitvijo: Ana Novak');
    const p = r.podatki as { kandidati: Kand[] };
    expect(p.kandidati.map((x) => [x.ime, x.sms_dovoljen])).toEqual([['Mateja Kos', true], ['Ana Novak', true], ['Nina Bela', false]]);
    expect(p.kandidati[0].termin_id).toBe('m1');
    expect(JSON.stringify(p)).not.toMatch(/041/);
    expect(r.sporocilo + r.govor).not.toMatch(/041/);
    expect(r.akcije?.map((a) => a.oznaka)).toEqual(['Mateja Kos', 'Ana Novak', 'Nina Bela']);
    expect(r.govor).toContain('Mateja ima kasnejši termin');
  });

  it('brez osebe in ob isti uri prosti dve osebi → vprašanje', async () => {
    const r = await kandidatiZaLuknjo.izvedi(vhod({ oseba: null }), o());
    expect(r.vprasanje?.moznosti?.map((m) => m.oznaka)).toEqual(['Tina Kos, 10:30–16:00', 'Urška Bele, 10:30–11:00']);
  });

  it('ob uri ni luknje → najprej odpovej v koledarju', async () => {
    const r = await kandidatiZaLuknjo.izvedi(vhod({ ura: '09:30' }), o());
    expect(r.sporocilo).toMatch(/nima proste luknje.*odpovejte termin v koledarju/);
  });

  it('preteklost in neznana ura', async () => {
    expect((await kandidatiZaLuknjo.izvedi(vhod({ datum: '2026-11-10' }), o())).sporocilo).toMatch(/za danes in naprej/);
    expect((await kandidatiZaLuknjo.izvedi(vhod({ datum: null, ura: '08:00' }), o())).sporocilo).toMatch(/že mimo/);
  });

  it('brez kandidatov pove iskreno', async () => {
    SALONI.Z5.termini = SALONI.Z5.termini.filter((x) => x.id === 'z1');
    const r = await kandidatiZaLuknjo.izvedi(vhod(), o());
    expect(r.sporocilo).toMatch(/ne najdem dobrih kandidatov/);
    expect(r.akcije).toBeUndefined();
  });

  it('zaposleni s "samo svoji" ne vidi tuje luknje in zgodovine', async () => {
    const svoji = { ...VSE_PRAVICE_STAFF, can_view_all_appointments: false, can_view_only_own_appointments: true };
    const k = { vloga: 'staff' as const, pravice: svoji, osebaId: 'o2' };
    expect((await kandidatiZaLuknjo.izvedi(vhod(), o(k))).sporocilo).toMatch(/samo svoj urnik/);
    // Svoja luknja: zgodovina samo njenih terminov (Ana je bila pri Urški).
    const r = await kandidatiZaLuknjo.izvedi(vhod({ oseba: null, ura: '10:30' }), o(k));
    const imena = ((r.podatki as { kandidati?: Kand[] }).kandidati ?? []).map((x) => x.ime);
    expect(imena).not.toContain('Mateja Kos');
    expect(imena).not.toContain('Nina Bela');
  });

  it('prek jedra: končni odgovor z gumbi z imeni (največ 5)', async () => {
    const env = okolje({ podjetje: 'Z5', nastavitve: { Z5: { vklopljeno: true, kvota: 400, naMinuto: 10 } }, llm: [{ klici: [{ id: 'k1', ime: 'kandidati_za_luknjo', vhod: vhod() }] }] });
    const r = await obdelajUkaz({ k: kontekst({ podjetje: 'Z5' }), vhod: 'besedilo', besedilo: 'Kdo bi lahko prišel jutri ob pol enajstih k Tini?' }, env.d);
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.akcije?.map((a) => a.oznaka)).toEqual(['Mateja Kos', 'Ana Novak', 'Nina Bela']);
    expect(r.akcije?.every((a) => /^tel:\+?\d+$/.test(a.href))).toBe(true);
    // Fokus za nadaljevanje: luknja in prva stranka s kasnejšim terminom (»pošlji ji predlog«).
    expect(env.shramba.ukazi.get(r.ukazId!)?.zakljucen?.kontekst).toEqual({
      stranka_id: '501', termin_id: 'm1', termin_datum: '2026-11-20', luknja: { datum: LUKNJA_DAN, od: '10:30', oseba_id: 'o1' },
    });
  });
});

describe('ponudi_prosti_termin', () => {
  type V = Parameters<typeof ponudiProstiTermin.predogled>[0];
  const vp = (p: Partial<V> = {}): V => ({
    stranka: 'Ana Novak', stranka_id: '502', datum: LUKNJA_DAN, ura: '10:30', oseba: 'Tina',
    besedilo: 'Pozdravljeni, jutri ob 10.30 se je sprostil termin pri Tini. Če vam ustreza, nas pokličite.', jezik_besedila: 'sl', podpis: true, ...p,
  });
  const kotPredlog = (x: unknown): Predogled => {
    if (!jePredogled(x as Predogled)) throw new Error(JSON.stringify(x));
    return x as Predogled;
  };

  it('stranka brez privolitve (false ali null) → ne pošlje, predlaga klic', async () => {
    for (const [ime, id] of [['Nina Bela', '503'], ['Mateja Kos', '501']]) {
      const r = await ponudiProstiTermin.predogled(vp({ stranka: ime, stranka_id: id }), o());
      expect(jePredogled(r as Predogled)).toBe(false);
      expect((r as { sporocilo: string }).sporocilo).toMatch(/nima privolitve/);
    }
  });

  it('s privolitvijo: predogled, en SMS, pošlje brez termina; ponovno preverjanje ob potrditvi', async () => {
    const env = o();
    const p = kotPredlog(await ponudiProstiTermin.predogled(vp(), env));
    expect(p.sporocil).toBe(1);
    expect(p.parametri).toMatchObject({ idStranke: '502', datum: LUKNJA_DAN, ura: '10:30', osebaId: 'o1', kanal: 'sms' });
    expect(String(p.parametri.besedilo)).toMatch(/Salon Z$/);
    const r = await ponudiProstiTermin.potrdi(p.parametri, env);
    expect(r.sporocilo).toBe('SMS je poslan.');
    expect(env.sporocila.poslana[0]).toMatchObject({ idTermina: null, prejemnik: '041 111 502', kanal: 'sms' });
  });

  it('ponudba s popustom ali ceno zavrnjena', async () => {
    const r = await ponudiProstiTermin.predogled(vp({ besedilo: 'Jutri ob 10.30 prost termin, 20 % popusta!' }), o());
    expect((r as { sporocilo: string }).sporocilo).toMatch(/ponudb, cen ali povezav/);
  });

  it('medtem zaseden čas ali preklicana privolitev → ne pošlje', async () => {
    const env = o();
    const p = kotPredlog(await ponudiProstiTermin.predogled(vp(), env));
    SALONI.Z5.termini.push(t('x1', LUKNJA_DAN, '10:30', '11:30', 'o1', '508', 'Striženje', 'scheduled'));
    expect(await ponudiProstiTermin.potrdi(p.parametri, env)).toMatchObject({ neuspeh: true, sporocilo: expect.stringMatching(/ni več prost/) });
    SALONI.Z5.termini.pop();
    SALONI.Z5.podrobnosti!['502'].marketing = null;
    expect(await ponudiProstiTermin.potrdi(p.parametri, env)).toMatchObject({ neuspeh: true, sporocilo: expect.stringMatching(/nima privolitve/) });
    expect(env.sporocila.poslana).toHaveLength(0);
  });

  it('jedro: "Pošljem?" in orodje imajo le, ki smejo pošiljati sporočila', async () => {
    const env = okolje({ podjetje: 'Z5', nastavitve: { Z5: { vklopljeno: true, kvota: 400, naMinuto: 10 } }, llm: [{ klici: [{ id: 'k1', ime: 'ponudi_prosti_termin', vhod: vp() }] }] });
    const r = await obdelajUkaz({ k: kontekst({ podjetje: 'Z5' }), vhod: 'besedilo', besedilo: 'Ani pošlji, da je jutri ob pol enajstih prosto.' }, env.d);
    if (!r.ok || !r.predlog) throw new Error(JSON.stringify(r));
    expect(r.govor).toMatch(/Pošljem\?$/);
    const p = await potrdiPredlog({ k: kontekst({ podjetje: 'Z5' }), predlogId: r.predlog.id, zeton: r.predlog.zeton }, env.d);
    expect(p).toMatchObject({ ok: true });
    expect(env.sporocila.poslana).toHaveLength(1);
    const ima = (k: Partial<Kontekst>) => orodjaZa(kontekst(k)).some((x) => x.ime === 'ponudi_prosti_termin');
    expect(ima({ vloga: 'staff', pravice: { ...VSE_PRAVICE_STAFF, can_edit_all_appointments: false, can_edit_only_own_appointments: false } })).toBe(false);
  });
});
