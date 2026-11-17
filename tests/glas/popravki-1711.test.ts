// Popravki po Timovem testu 17. 11.: »ta teden«, potrditev »a ja, lahko, pošljem«, kratice na glas.
import { describe, expect, it } from 'vitest';
import { hitraPot } from '@/lib/glas/hitraPot';
import { koledarDan, obdobjeIzIzraza } from '@/lib/glas/orodja/branje';
import { jePotrditev, jeZavrnitev } from '@/lib/glas/odjemalec/besede';
import { ukazObrazcu } from '@/lib/glas/odjemalec/obrazecGlas';
import { kraticeZaGovor, uglajenGovor } from '@/lib/glas/govor';
import type { OkoljeOrodja } from '@/lib/glas/orodja/tipi';
import { DANES, kontekst, podatkiPomnilnik, posiljateljLazni } from './pomoc';

const o = (): OkoljeOrodja => ({ k: kontekst({ podjetje: 'A1', osebaId: null }), podatki: podatkiPomnilnik('A1'), danes: DANES, uraZdaj: '10:00', ukazId: null, sporocila: posiljateljLazni() });

describe('obdobje v koledarju', () => {
  it('ta teden, naslednji teden, ta mesec (pon–ned, koledarski mesec)', () => {
    expect(obdobjeIzIzraza('v tem tednu', '2026-11-17')).toEqual({ od: '2026-11-16', do: '2026-11-22', kljuc: 'ta_teden' });
    expect(obdobjeIzIzraza('naslednji teden', '2026-11-17')).toEqual({ od: '2026-11-23', do: '2026-11-29', kljuc: 'naslednji_teden' });
    expect(obdobjeIzIzraza('ta mesec', '2026-12-05')).toEqual({ od: '2026-12-01', do: '2026-12-31', kljuc: 'ta_mesec' });
    expect(obdobjeIzIzraza('naslednji mesec', '2026-12-05')).toEqual({ od: '2027-01-01', do: '2027-01-31', kljuc: 'naslednji_mesec' });
    expect(obdobjeIzIzraza('jutri', '2026-11-17')).toBeNull();
  });

  it('»koliko terminov imamo v tem tednu« gre po hitri poti v koledar', () => {
    expect(hitraPot('Koliko terminov imamo v tem tednu?')).toEqual({ orodje: 'koledar_dan', vhod: { datum: 'tem tednu', samo_moji: false } });
    expect(hitraPot('Kaj imam naslednji teden?')).toEqual({ orodje: 'koledar_dan', vhod: { datum: 'naslednji teden', samo_moji: true } });
  });

  it('koledar_dan z »ta teden« vrne število in dneve, ne »ne razumem«', async () => {
    const r = await koledarDan.izvedi({ datum: 'ta teden', samo_moji: false }, o());
    expect(r.sporocilo).toMatch(/^Ta teden: \d+ termin/);
    expect(r.sporocilo).not.toContain('ne razumem');
    expect(r.govor).toMatch(/^Ta teden je \d+ termin/);
    expect((r.podatki as { od: string }).od <= DANES).toBe(true);
  });
});

describe('potrditev po besedah', () => {
  it.each(['A ja, lahko, pošljem, ja.', 'Ja, shrani, super.', 'ja pošlji', 'Ja, tako.', 'Super, ja, super.', 'okej, pošlji'])('%s = ja', (s) => {
    expect(jePotrditev(s)).toBe(true);
    expect(ukazObrazcu(s)).toBe('shrani');
  });
  it.each(['ja, ampak spremeni na 7.1', 'Ja, storitev mu da isto kot je imel danes, a ne?', 'Okej, super. Daj mi pa povej še, am.', 'a lahko pošlješ jutri'])('%s ni potrditev', (s) => {
    expect(jePotrditev(s)).toBe(false);
    expect(jeZavrnitev(s)).toBe(false);
  });
  it('zavrnitev z dodatki, vsebina ni zavrnitev', () => {
    expect(jeZavrnitev('ne, ni treba, hvala')).toBe(true);
    expect(jeZavrnitev('Ne, ne pošiljaj ga.')).toBe(true);
    expect(jeZavrnitev('ne, gre za recept')).toBe(false);
  });
});

describe('kratice na glas', () => {
  it('d.o.o., s.p., SMS po črkah; JedroPlus kot dve besedi', () => {
    expect(kraticeZaGovor('JedroPlus d.o.o.')).toBe('Jedro plus de o o.');
    expect(kraticeZaGovor('Ana d.o.o. Pošljem?')).toBe('Ana de o o. Pošljem?');
    expect(kraticeZaGovor('Frizerstvo Ana, s.p.')).toBe('Frizerstvo Ana, es pe.');
    expect(kraticeZaGovor('SMS poslan.')).toBe('es em es poslan.');
    expect(kraticeZaGovor('OK, pošljem.')).toBe('OK, pošljem.');
    expect(uglajenGovor('SMS — Anja: »Pridite prej. JedroPlus d.o.o.«')).not.toMatch(/d\.o\.o|SMS|JedroPlus/);
  });
});
