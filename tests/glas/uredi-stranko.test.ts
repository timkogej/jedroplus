// uredi_stranko: telefon, e-pošta, jezik, opombe prek obrazca stranke; privolitve ne spreminja.
import { describe, expect, it } from 'vitest';
import { obdelajUkaz, SISTEM } from '@/lib/glas/jedro';
import { brezKontaktov } from '@/lib/glas/govor';
import { urediStranko } from '@/lib/glas/orodja/obrazci';
import { DANES, kontekst, okolje, podatkiPomnilnik, VSE_PRAVICE_STAFF } from './pomoc';
import { orodjaZa } from '@/lib/glas/orodja/registry';

const o = () => ({ k: kontekst(), podatki: podatkiPomnilnik('A1'), danes: DANES, uraZdaj: '10:00', ukazId: 'u' });
const prazno = { stranka_id: null, telefon: null, email: null, jezik: null, opombe: null, interne_opombe: null };

describe('uredi_stranko', () => {
  it('nov telefon: obrazec stranke, govor po števkah, dnevnik brez številke', async () => {
    const r = await urediStranko.izvedi(urediStranko.vhod.parse({ ...prazno, stranka: 'Ana Novak', telefon: '041 999 888' }), o());
    expect(r.obrazec).toEqual({ vrsta: 'uredi_stranko', polja: { id: '102', telefon: '041999888' } });
    expect(r.pojdi).toBe('/clients?glas=1');
    expect(r.govor).toBe('Ana Novak: telefon nič štiri ena, devet devet devet, osem osem osem. Shranim?');
    expect(r.zasebno?.dnevnik).not.toMatch(/999/);
    expect(JSON.stringify(r.podatki)).not.toMatch(/999/);
  });

  it('jezik, e-pošta in opomba', async () => {
    const r = await urediStranko.izvedi(
      urediStranko.vhod.parse({ ...prazno, stranka: 'Mateja', email: 'Mateja@Salon.si', jezik: 'de', opombe: 'Rada ima čaj.' }),
      o()
    );
    expect(r.obrazec?.polja).toEqual({ id: '101', email: 'mateja@salon.si', jezik: 'de', opombe: 'Rada ima čaj.' });
    expect(r.govor).toContain('mateja afna salon pika si');
  });

  it('nerazumljiv telefon ali e-pošta: vpraša znova, obrazca ne odpre', async () => {
    const a = await urediStranko.izvedi(urediStranko.vhod.parse({ ...prazno, stranka: 'Ana Novak', telefon: '12' }), o());
    expect(a.obrazec).toBeUndefined();
    const b = await urediStranko.izvedi(urediStranko.vhod.parse({ ...prazno, stranka: 'Ana Novak', email: 'ana pri gmailu' }), o());
    expect(b.obrazec).toBeUndefined();
  });

  it('privolitve ni v shemi; model ve, da je ne spreminja', () => {
    expect(Object.keys(urediStranko.shema.properties)).not.toContain('privolitev');
    expect(urediStranko.vhod.safeParse({ ...prazno, stranka: 'Ana', marketing: true }).data).not.toHaveProperty('marketing');
    expect(SISTEM).toContain('marketinške privolitve');
  });

  it('brez pravice urejanja strank orodje ni ponujeno', () => {
    const k = kontekst({ vloga: 'staff', pravice: { ...VSE_PRAVICE_STAFF, can_edit_clients: false } });
    expect(orodjaZa(k).map((x) => x.ime)).not.toContain('uredi_stranko');
  });

  it('tuja stranka se ne najde', async () => {
    const r = await urediStranko.izvedi(urediStranko.vhod.parse({ ...prazno, stranka: 'Mateja Tuja', stranka_id: '201', jezik: 'eng' }), o());
    expect(r.obrazec).toBeUndefined();
  });
});

describe('dnevnik brez kontaktov', () => {
  it('brezKontaktov zamenja telefone in e-pošto, ure in datume pusti', () => {
    expect(brezKontaktov('Ani spremeni telefon na 041 999 888 in mail ana@x.si, jutri ob 10:30, 15. 11.')).toBe(
      'Ani spremeni telefon na (telefon) in mail (e-pošta), jutri ob 10:30, 15. 11.'
    );
    expect(brezKontaktov('mail je ana afna gmail pika com')).toBe('mail je (e-pošta)');
  });

  it('jedro: prepis in odgovor v glas_ukazi brez nove številke', async () => {
    const env = okolje({
      llm: [{ klici: [{ id: 'a', ime: 'uredi_stranko', vhod: { ...prazno, stranka: 'Ana Novak', telefon: '041 999 888' } }] }],
    });
    const r = await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'Ani Novak spremeni telefon na 041 999 888' }, env.d);
    if (!r.ok) throw new Error();
    expect(r.obrazec?.polja.telefon).toBe('041999888');
    const z = env.shramba.ukazi.get(r.ukazId)?.zakljucen;
    expect(z?.prepis).not.toMatch(/999/);
    expect(z?.odgovor).not.toMatch(/999/);
  });
});
