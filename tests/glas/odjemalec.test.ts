// Logika pogovora v brskalniku: izjave iz Soniox žetonov, ja/ne, izbira, pretvorba zvoka.
import { describe, expect, it } from 'vitest';
import { izberiMoznost, jePotrditev, jeZavrnitev, pcmVFloat, SestavljalecIzjave, v16kPcm } from '@/lib/glas/odjemalec/besede';

describe('izjave iz Soniox žetonov', () => {
  it('delni žetoni se zamenjajo, končni seštejejo, <end> zaključi izjavo', () => {
    const s = new SestavljalecIzjave();
    expect(s.dodaj([{ text: 'Kaj', is_final: false }])).toEqual({ izjava: null, imaGovor: true });
    expect(s.trenutno).toBe('Kaj');
    s.dodaj([{ text: 'Kaj', is_final: true }, { text: ' imam', is_final: false }]);
    expect(s.trenutno).toBe('Kaj imam');
    const r = s.dodaj([{ text: ' imam jutri?', is_final: true }, { text: '<end>', is_final: true }]);
    expect(r.izjava).toBe('Kaj imam jutri?');
    expect(s.trenutno).toBe('');
  });

  it('prazen konec (samo šum) ni izjava', () => {
    const s = new SestavljalecIzjave();
    expect(s.dodaj([{ text: '<end>', is_final: true }]).izjava).toBeNull();
  });

  it('sporočilo brez črk ni govor', () => {
    const s = new SestavljalecIzjave();
    expect(s.dodaj([{ text: ' ', is_final: false }]).imaGovor).toBe(false);
  });
});

describe('potrditev z glasom', () => {
  it('samo kratka cela izjava je ja/ne', () => {
    for (const x of ['Ja.', 'ja', 'Potrdi!', 'v redu', 'Ja, potrdi.', 'Okej']) expect(jePotrditev(x), x).toBe(true);
    for (const x of ['ja, ampak spremeni na 7.1', 'ne vem', 'jaz bi', 'janez', 'kaj imam jutri']) expect(jePotrditev(x), x).toBe(false);
    for (const x of ['Ne.', 'prekliči', 'Ne, hvala.', 'stop']) expect(jeZavrnitev(x), x).toBe(true);
    expect(jeZavrnitev('ne, zapiši 7.1')).toBe(false);
  });
});

describe('izbira možnosti po imenu', () => {
  const m = [
    { id: '102', oznaka: 'Ana Novak (zadnjič danes, četrtek, 2. 11.)' },
    { id: '103', oznaka: 'Ana Novinc' },
  ];
  it('ime v sklonu izbere eno možnost', () => {
    expect(izberiMoznost('Ano Novak', m)?.id).toBe('102');
    expect(izberiMoznost('tisto Novinc', m)).toBeNull(); // manjka ime
    expect(izberiMoznost('Ana Novinc', m)?.id).toBe('103');
  });
  it('dvoumno ali neznano → nič', () => {
    expect(izberiMoznost('Ana', m)).toBeNull();
    expect(izberiMoznost('Petra Zupan', m)).toBeNull();
  });
});

describe('zvok', () => {
  it('48 kHz → 16 kHz, 16-bitni PCM in nazaj', () => {
    const vhod = new Float32Array(4800).fill(0.5);
    const pcm = v16kPcm(vhod, 48000);
    expect(pcm.length).toBe(1600);
    expect(pcm[0]).toBe(Math.floor(0.5 * 0x7fff));
    const nazaj = pcmVFloat(new Uint8Array(pcm.buffer));
    expect(nazaj[10]).toBeCloseTo(0.5, 3);
  });
  it('44,1 kHz in omejitev na [-1, 1]', () => {
    const pcm = v16kPcm(new Float32Array(4410).fill(-2), 44100);
    expect(pcm.length).toBe(1600);
    expect(pcm[5]).toBe(-0x8000);
  });
});
