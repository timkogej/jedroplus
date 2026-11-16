// Faza 1: en krog LLM (končni rezultati bralnih orodij), govor za glas, obračun sprotnega STT/TTS.
import { describe, expect, it } from 'vitest';
import { obdelajUkaz } from '@/lib/glas/jedro';
import { datumZaGovor, uraZaGovor, zaGovor } from '@/lib/glas/govor';
import { DANES, kontekst, klicZapiska, okolje } from './pomoc';

describe('govor', () => {
  it('ure z besedami', () => {
    expect(uraZaGovor('09:00')).toBe('ob devetih');
    expect(uraZaGovor('14:30')).toBe('ob pól treh');
    expect(uraZaGovor('12:30')).toBe('ob pól enih');
    expect(uraZaGovor('10:15')).toBe('ob četrt čez deset');
    expect(uraZaGovor('16:45')).toBe('ob tri četrt na pet');
    expect(uraZaGovor('14:10')).toBe('ob 14.10');
  });

  it('datumi vedno z dnevom v tednu', () => {
    expect(datumZaGovor('2026-11-12', DANES)).toBe('danes');
    expect(datumZaGovor('2026-11-13', DANES)).toBe('jutri, v petek');
    expect(datumZaGovor('2026-11-14', DANES)).toBe('pojutrišnjem, v soboto');
    expect(datumZaGovor('2026-11-18', DANES)).toBe('v sredo');
  });

  it('besedilo za zaslon → govor', () => {
    expect(zaGovor('Jutri: 2 termina.\n09:00–10:30 Mateja, Barvanje\n11:00–11:30 Ana')).toBe(
      'Jutri: 2 termina. ob devetih Mateja, Barvanje. ob enajstih Ana'
    );
    expect(zaGovor('Stranke »Bojan« ne najdem.')).toBe('Stranke Bojan ne najdem.');
  });
});

describe('en krog LLM', () => {
  it('končno bralno orodje: odgovor brez drugega klica LLM', async () => {
    const { d, llm } = okolje({ llm: [{ klici: [{ id: 'a', ime: 'zadnji_obisk', vhod: { stranka: 'Mateja Kovačič', stranka_id: null } }] }, { besedilo: 'NE SME' }] });
    const r = await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'kdaj je bila Mateja Kovačič zadnjič' }, d);
    expect(llm.zahteve).toHaveLength(1);
    expect(r).toMatchObject({ ok: true, status: 'odgovor' });
    if (!r.ok) return;
    expect(r.odgovor).toContain('Mateja Kovačič');
    expect(r.govor).toContain('Naslednjič pride jutri, v petek ob devetih');
    expect(r.govor).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it('iskanje stranke ni končno: LLM nadaljuje', async () => {
    const { d, llm } = okolje({ llm: [{ klici: [{ id: 'a', ime: 'iskanje_stranke', vhod: { ime: 'Mateja Kovačič' } }] }, { besedilo: 'Mateja je naša stranka.' }] });
    const r = await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'ali poznamo Matejo Kovačič' }, d);
    expect(llm.zahteve).toHaveLength(2);
    expect(r).toMatchObject({ ok: true, odgovor: 'Mateja je naša stranka.' });
  });

  it('več strank z istim imenom: vprašanje takoj, brez drugega kroga', async () => {
    const { d, llm } = okolje({ llm: [{ klici: [{ id: 'a', ime: 'iskanje_stranke', vhod: { ime: 'Ana' } }] }, { besedilo: 'NE SME' }] });
    const r = await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'poišči Ano' }, d);
    expect(llm.zahteve).toHaveLength(1);
    expect(r).toMatchObject({ ok: true, status: 'vprasanje', govor: 'Katero stranko: Ana Novak ali Ana Novinc?' });
  });

  it('napaka orodja (neveljavni parametri) gre nazaj LLM', async () => {
    const { d, llm } = okolje({ llm: [{ klici: [{ id: 'a', ime: 'zadnji_obisk', vhod: { stranka: '', stranka_id: null } }] }, { besedilo: 'Katero stranko?' }] });
    await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'kdaj je bila zadnjič' }, d);
    expect(llm.zahteve).toHaveLength(2);
  });

  it('koledar na glas: datum, število, ure z besedami', async () => {
    const { d } = okolje({ llm: [{ klici: [{ id: 'a', ime: 'koledar_dan', vhod: { datum: 'jutri', samo_moji: false } }] }] });
    const r = await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'kdo pride jutri' }, d);
    if (!r.ok) throw new Error(r.sporocilo);
    expect(r.govor).toBe('Jutri, v petek sta dva termina. Ob devetih Mateja Kovačič, Barvanje, Tina. Ob enajstih Ana Novak, Moško striženje, Urška.');
  });

  it('predlog: govor vpraša za potrditev, nič ni zapisano', async () => {
    const { d, podatki } = okolje({ llm: [klicZapiska()] });
    const r = await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'zapiši pri Mateji 6.3' }, d);
    expect(r).toMatchObject({ ok: true, status: 'predlog' });
    if (r.ok) expect(r.govor.endsWith('Potrdim?')).toBe(true);
    expect(podatki.zapiski).toHaveLength(0);
  });

  it('sprotni STT in glas v brskalniku se obračunata', async () => {
    const { d, shramba } = okolje({ llm: [{ besedilo: 'V redu.' }] });
    await obdelajUkaz({ k: kontekst(), vhod: 'aplikacija', besedilo: 'zdravo', stt: { ponudnik: 'soniox', sekunde: 4 }, glas: { ponudnik: 'soniox' } }, d);
    const u = [...shramba.ukazi.values()][0].zakljucen!;
    expect(u.stt_ponudnik).toBe('soniox');
    expect(u.stt_sekunde).toBe(4);
    expect(u.tts_znaki).toBe('V redu.'.length);
    expect(u.strosek_mikro_usd).toBeGreaterThan(0);
  });

  it('nesmiselne sekunde STT od odjemalca so omejene', async () => {
    const { d, shramba } = okolje({ llm: [{ besedilo: 'V redu.' }] });
    await obdelajUkaz({ k: kontekst(), vhod: 'aplikacija', besedilo: 'zdravo', stt: { ponudnik: 'soniox', sekunde: 1e9 } }, d);
    expect([...shramba.ukazi.values()][0].zakljucen!.stt_sekunde).toBe(120);
  });
});
