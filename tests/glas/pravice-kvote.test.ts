// Pravice, register orodij, kvote, strošek in potrditveni žetoni.
import { describe, expect, it } from 'vitest';
import { imaPravico, samoSvojiTermini } from '@/lib/glas/pravice';
import { orodjaZa, preveriRegister, VSA_ORODJA } from '@/lib/glas/orodja/registry';
import { opozoriloKvote, strosekMikroUsd, PRAZNA_PORABA } from '@/lib/glas/poraba';
import { hashParametrov, hashZetona, kanonicnoJson, novZeton } from '@/lib/glas/potrditev';
import { obdelajUkaz } from '@/lib/glas/jedro';
import { NapakaPonudnika } from '@/lib/glas/ponudniki/skupno';
import { kontekst, okolje, VSE_PRAVICE_STAFF, ZVOK } from './pomoc';

describe('pravice', () => {
  it('lastnik in skrbnik smeta vse', () => {
    for (const vloga of ['owner', 'admin'] as const) {
      expect(imaPravico({ vloga, pravice: null }, 'glas.uporaba')).toBe(true);
      expect(imaPravico({ vloga, pravice: null }, 'stranke.urejanje')).toBe(true);
    }
  });

  it('zaposleni brez vrstice pravic: kot v vmesniku, a glas ne', () => {
    expect(imaPravico({ vloga: 'staff', pravice: null }, 'glas.uporaba')).toBe(false);
    expect(imaPravico({ vloga: 'staff', pravice: null }, 'stranke.branje')).toBe(true);
  });

  it('zaposleni po vrstici pravic', () => {
    const p = { ...VSE_PRAVICE_STAFF, can_edit_clients: false, can_view_all_appointments: false, can_view_only_own_appointments: true };
    expect(imaPravico({ vloga: 'staff', pravice: p }, 'glas.uporaba')).toBe(true);
    expect(imaPravico({ vloga: 'staff', pravice: p }, 'stranke.urejanje')).toBe(false);
    expect(imaPravico({ vloga: 'staff', pravice: p }, 'termini.branje')).toBe(true);
    expect(samoSvojiTermini({ vloga: 'staff', pravice: p })).toBe(true);
    expect(samoSvojiTermini({ vloga: 'owner', pravice: p })).toBe(false);
  });

  it('neznana vloga nima pravic', () => {
    expect(imaPravico({ vloga: 'gost' as never, pravice: null }, 'stranke.branje')).toBe(false);
  });
});

describe('register orodij', () => {
  it('je veljaven (unikatna imena, pisalna imajo potrditev)', () => {
    expect(() => preveriRegister()).not.toThrow();
    expect(new Set(VSA_ORODJA.map((o) => o.ime)).size).toBe(VSA_ORODJA.length);
  });

  it('orodja faze 2 niso izpostavljena nikomur', () => {
    const imena = orodjaZa({ vloga: 'owner', pravice: null }).map((o) => o.ime);
    expect(imena).toEqual(expect.arrayContaining(['iskanje_stranke', 'zadnji_obisk', 'koledar_dan', 'prvi_prosti_termin', 'dodaj_zapisek']));
    for (const prepovedano of ['ustvari_termin', 'premakni_termin', 'preklici_termin']) expect(imena).not.toContain(prepovedano);
    expect(imena.some((i) => /izbris|brisi|placil|racun|cena|pravic/.test(i))).toBe(false);
  });

  it('zaposleni brez urejanja strank ne dobi pisalnega orodja', () => {
    const imena = orodjaZa({ vloga: 'staff', pravice: { ...VSE_PRAVICE_STAFF, can_edit_clients: false } }).map((o) => o.ime);
    expect(imena).not.toContain('dodaj_zapisek');
    expect(imena).toContain('iskanje_stranke');
  });
});

describe('potrditveni žetoni', () => {
  it('žeton je naključen in shranjen samo kot hash', () => {
    const a = novZeton();
    const b = novZeton();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(hashZetona(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashZetona(a)).not.toContain(a);
  });

  it('hash parametrov ni odvisen od vrstnega reda ključev', () => {
    expect(kanonicnoJson({ b: 1, a: { d: 2, c: 3 } })).toBe(kanonicnoJson({ a: { c: 3, d: 2 }, b: 1 }));
    expect(hashParametrov('x', { a: 1, b: 2 })).toBe(hashParametrov('x', { b: 2, a: 1 }));
    expect(hashParametrov('x', { a: 1 })).not.toBe(hashParametrov('y', { a: 1 }));
    expect(hashParametrov('x', { a: 1 })).not.toBe(hashParametrov('x', { a: 2 }));
  });
});

describe('strošek in kvota', () => {
  it('tipičen ukaz brez TTS je pod 0,3 centa', () => {
    const mikro = strosekMikroUsd({
      ...PRAZNA_PORABA,
      sttPonudnik: 'elevenlabs', sttSekunde: 6, sttZNamigi: true,
      llmModel: 'claude-haiku-5-5', llmVhod: 1200, llmVhodPredpomnjen: 1500, llmIzhod: 150,
    });
    expect(mikro).toBeGreaterThan(0);
    expect(mikro).toBeLessThan(3000); // 0,3 centa = 3000 mikro USD
  });

  it('opozorilo pri 80 % in 100 %', () => {
    expect(opozoriloKvote(100, 400)).toBeNull();
    expect(opozoriloKvote(320, 400)).toMatch(/320 od 400/);
    expect(opozoriloKvote(400, 400)).toMatch(/porabljena/);
    expect(opozoriloKvote(5, 0)).toBeNull();
  });

  it('nad kvoto ukaz zavrne s 402 in ne kliče ponudnikov', async () => {
    const { d, sttKlici, llm } = okolje({ nastavitve: { A1: { vklopljeno: true, kvota: 1, naMinuto: 10 } }, stt: ['kaj imam jutri'] });
    const k = kontekst();
    expect((await obdelajUkaz({ k, vhod: 'aplikacija', zvok: ZVOK }, d)).ok).toBe(true);
    const r = await obdelajUkaz({ k, vhod: 'aplikacija', zvok: ZVOK }, d);
    expect(r).toMatchObject({ ok: false, koda: 'kvota', http: 402 });
    expect(sttKlici.n).toBe(1);
    expect(llm.zahteve.length).toBe(0);
  });

  it('omejitev na minuto', async () => {
    const { d, ura } = okolje({ nastavitve: { A1: { vklopljeno: true, kvota: 100, naMinuto: 2 } } });
    const k = kontekst();
    const ukaz = () => obdelajUkaz({ k, vhod: 'besedilo', besedilo: 'kaj imam jutri' }, d);
    await ukaz();
    await ukaz();
    expect(await ukaz()).toMatchObject({ ok: false, koda: 'prehitro', http: 429 });
    ura.zdaj += 61_000;
    expect((await ukaz()).ok).toBe(true);
  });

  it('izklopljeno podjetje ali uporabnik', async () => {
    const a = okolje({ nastavitve: { A1: { vklopljeno: false, kvota: 400, naMinuto: 10 } } });
    expect(await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'kaj imam' }, a.d)).toMatchObject({ ok: false, http: 403 });
    const b = okolje({ nastavitve: { A1: { vklopljeno: true, kvota: 400, naMinuto: 10, izklopljeni: ['u-lastnik'] } } });
    expect(await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'kaj imam' }, b.d)).toMatchObject({ ok: false, koda: 'uporabnik_izklopljen' });
  });

  it('napaka STT: jasno sporočilo, kvota vrnjena, nič spremenjeno', async () => {
    const { d, shramba, llm, podatki } = okolje({
      stt: { ime: 'lazni', prepisi: async () => { throw new NapakaPonudnika('elevenlabs', 'casovna_omejitev'); } },
    });
    const r = await obdelajUkaz({ k: kontekst(), vhod: 'aplikacija', zvok: ZVOK }, d);
    expect(r).toMatchObject({ ok: false, koda: 'stt_ni_na_voljo', http: 503 });
    if (!r.ok) expect(r.sporocilo).toMatch(/Nič ni bilo spremenjeno/);
    expect(shramba.poraba.get('A1')).toBe(0);
    expect(llm.zahteve.length).toBe(0);
    expect(podatki.zapiski.length).toBe(0);
    const u = [...shramba.ukazi.values()][0];
    expect(u.zakljucen?.napaka_koda).toBe('stt_ni_na_voljo:casovna_omejitev');
  });

  it('napaka LLM: kvota vrnjena, brez predloga', async () => {
    const { d, shramba } = okolje({ llm: new NapakaPonudnika('anthropic', 'streznik', 529) });
    const r = await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'zapiši pri Mateji barvo 6.3' }, d);
    expect(r).toMatchObject({ ok: false, koda: 'llm_ni_na_voljo', http: 503 });
    expect(shramba.poraba.get('A1')).toBe(0);
    expect(shramba.predlogi.size).toBe(0);
  });

  it('nerazumljiv posnetek se ne šteje v kvoto', async () => {
    const { d, shramba } = okolje({ stt: ['  ...  '] });
    const r = await obdelajUkaz({ k: kontekst(), vhod: 'aplikacija', zvok: ZVOK }, d);
    expect(r).toMatchObject({ ok: false, koda: 'nerazumljivo' });
    expect(shramba.poraba.get('A1')).toBe(0);
  });

  it('vsak ukaz ima zapisan strošek, trajanje in revizijo', async () => {
    const { d, shramba } = okolje({ stt: ['kdaj je bila Mateja Kovačič zadnjič'], llm: [
      { klici: [{ id: 'a', ime: 'zadnji_obisk', vhod: { stranka: 'Mateja Kovačič', stranka_id: null } }] },
      { besedilo: 'Mateja je bila zadnjič 20. 10.' },
    ] });
    const r = await obdelajUkaz({ k: kontekst(), vhod: 'aplikacija', zvok: ZVOK }, d);
    expect(r.ok).toBe(true);
    const u = [...shramba.ukazi.values()][0].zakljucen!;
    expect(u.status).toBe('odgovor');
    expect(u.stt_sekunde).toBe(3);
    expect(u.llm_vhod).toBe(200);
    expect(u.orodja).toEqual(['zadnji_obisk']);
    expect(Object.keys(u.trajanje_ms)).toEqual(expect.arrayContaining(['stt', 'llm0', 'llm1', 'skupaj']));
    expect(shramba.revizije.some((x) => x.dogodek === 'ukaz')).toBe(true);
    // Revizija ne vsebuje prepisa ali imen.
    expect(JSON.stringify(shramba.revizije)).not.toMatch(/Mateja/);
  });
});
