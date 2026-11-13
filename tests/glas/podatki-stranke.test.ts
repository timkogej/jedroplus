// Vse o stranki z glasom: telefon, e-pošta, opombe, jezik, privolitev, obiski.
// Telefon, e-pošta in opombe gredo samo na zaslon in v glas, nikoli modelu AI ali v dnevnik.
import { describe, expect, it } from 'vitest';
import { obdelajUkaz } from '@/lib/glas/jedro';
import { emailZaGovor, povezavaKontakta, telefonZaGovor, telefonZaZaslon } from '@/lib/glas/govor';
import { podatkiStranke } from '@/lib/glas/orodja/kartica';
import { DANES, kontekst, okolje, podatkiPomnilnik } from './pomoc';

const o = () => ({ k: kontekst(), podatki: podatkiPomnilnik('A1'), danes: DANES, uraZdaj: '10:00', ukazId: 'u' });
const klic = (vhod: Record<string, unknown>, id = 'a') => ({ klici: [{ id, ime: 'podatki_stranke', vhod: { stranka_id: null, polja: null, ...vhod } }] });

describe('govor kontaktov', () => {
  it('telefon po skupinah števk', () => {
    expect(telefonZaGovor('041 234 567')).toBe('nič štiri ena, dve tri štiri, pet šest sedem');
    expect(telefonZaGovor('+386 31 555 111')).toBe('plus tri osem šest, tri ena, pet pet pet, ena ena ena');
    expect(telefonZaZaslon('041234567')).toBe('041 234 567');
  });
  it('e-pošta s pikami in afno', () => {
    expect(emailZaGovor('Mateja.K@gmail.com')).toBe('mateja pika k afna gmail pika com');
    expect(emailZaGovor('ana_2@x-y.si')).toBe('ana podčrtaj dve afna x pomišljaj y pika si');
  });
  it('samo varne povezave', () => {
    expect(povezavaKontakta('klic', '041 234 567')).toBe('tel:041234567');
    expect(povezavaKontakta('klic', 'javascript:alert(1)')).toBeNull();
    expect(povezavaKontakta('pisi', 'a@b.si?subject=x')).toBeNull();
    expect(povezavaKontakta('pisi', 'ana@salon.si')).toBe('mailto:ana@salon.si');
  });
});

describe('podatki_stranke', () => {
  it('telefon: zaslon, glas, gumb Pokliči; dnevnik brez številke', async () => {
    const r = await podatkiStranke.izvedi({ stranka: 'Mateja', stranka_id: null, polja: ['telefon'] }, o());
    expect(r.sporocilo).toContain('Telefon: 041 234 567');
    expect(r.govor).toContain('nič štiri ena, dve tri štiri, pet šest sedem');
    expect(r.akcije).toEqual([{ vrsta: 'klic', href: 'tel:041234567' }]);
    expect(r.zasebno?.dnevnik).toContain('(telefon prikazan)');
    expect(r.zasebno?.dnevnik).not.toMatch(/234/);
    expect(JSON.stringify(r.podatki)).not.toMatch(/234|gmail/);
  });

  it('vse: jezik, privolitev, obiski, naslednji termin', async () => {
    const r = await podatkiStranke.izvedi({ stranka: 'Mateja Kovačič', stranka_id: null, polja: null }, o());
    expect(r.sporocilo).toContain('E-pošta: mateja.k@gmail.com');
    expect(r.sporocilo).toContain('Opombe: Pije kavo brez mleka');
    expect(r.sporocilo).toContain('Interne opombe: Alergija na amonijak');
    expect(r.sporocilo).toContain('Jezik sporočil: slovenščina');
    expect(r.sporocilo).toContain('Marketinška privolitev: da');
    expect(r.sporocilo).toContain('Obiskov: 1, neprihodov: 0');
    expect(r.sporocilo).toMatch(/Naslednji termin: jutri.* ob 09:00, Barvanje/);
    expect(r.akcije?.map((a) => a.vrsta)).toEqual(['klic', 'pisi']);
    expect(r.zasebno?.dnevnik).not.toMatch(/gmail|kavo|amonijak|041/);
    expect(r.podatki).toMatchObject({ stranka_id: '101', termin_id: 't1', termin_datum: '2026-11-13' });
  });

  it('privolitev null šteje kot ne; jezik angleščina', async () => {
    const r = await podatkiStranke.izvedi({ stranka: 'Ana Novak', stranka_id: null, polja: ['privolitev', 'jezik'] }, o());
    expect(r.sporocilo).toContain('ni odgovora (šteje kot ne)');
    expect(r.govor).toContain('ne pošiljamo');
    expect(r.govor).toContain('angleščina');
    expect(r.zasebno).toBeUndefined();
  });

  it('brez opombe: pove, da je ni', async () => {
    const r = await podatkiStranke.izvedi({ stranka: 'Špela', stranka_id: null, polja: ['opombe'] }, o());
    expect(r.govor).toContain('Opomb nima.');
  });

  it('tuja stranka (drugo podjetje) ni najdena', async () => {
    const r = await podatkiStranke.izvedi({ stranka: 'Mateja Tuja', stranka_id: '201', polja: ['telefon'] }, o());
    expect(r.sporocilo).not.toMatch(/Telefon/);
  });
});

describe('jedro: zasebni podatki ne gredo modelu ali v dnevnik', () => {
  it('en krog: telefon na zaslon in v glas, model ga ne vidi, glas_ukazi.odgovor brez številke', async () => {
    const env = okolje({ llm: [klic({ stranka: 'Mateja', polja: ['telefon'] })] });
    const r = await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'kakšen telefon ima Mateja' }, env.d);
    if (!r.ok) throw new Error();
    expect(env.llm.zahteve).toHaveLength(1);
    expect(r.odgovor).toContain('041 234 567');
    expect(r.govor).toContain('nič štiri ena');
    expect(r.akcije).toEqual([{ vrsta: 'klic', href: 'tel:041234567' }]);
    const zapis = env.shramba.ukazi.get(r.ukazId)?.zakljucen;
    expect(zapis?.odgovor).toContain('(telefon prikazan)');
    expect(zapis?.odgovor).not.toMatch(/041|234/);
  });

  it('mešan krog (z nekončnim orodjem): model dobi samo dnevnik, uporabnik vse', async () => {
    const env = okolje({
      llm: [
        { klici: [{ id: 'a', ime: 'iskanje_stranke', vhod: { ime: 'Mateja' } }, klic({ stranka: 'Mateja', polja: ['email', 'opombe'] }, 'b').klici[0]] },
        { besedilo: 'To je vse.' },
      ],
    });
    const r = await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'kakšen mail ima Mateja' }, env.d);
    if (!r.ok) throw new Error();
    const zaModel = JSON.stringify(env.llm.zahteve.map((z) => z.sporocila));
    expect(zaModel).not.toMatch(/gmail|kavo/);
    expect(zaModel).toContain('(e-pošta prikazana)');
    expect(r.odgovor).toContain('mateja.k@gmail.com');
    expect(r.govor).toContain('afna gmail pika com');
    expect(r.akcije).toEqual([{ vrsta: 'pisi', href: 'mailto:mateja.k@gmail.com' }]);
    expect(env.shramba.ukazi.get(r.ukazId)?.zakljucen?.odgovor).not.toMatch(/gmail|kavo/);
  });

  it('naslednja izjava: zgodovina modelu brez telefona', async () => {
    const env = okolje({ llm: [klic({ stranka: 'Mateja', polja: ['telefon'] }), { besedilo: 'V redu.' }] });
    const r1 = await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'kakšen telefon ima Mateja' }, env.d);
    if (!r1.ok) throw new Error();
    await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'in kaj še', prejsnjiUkazi: [r1.ukazId] }, env.d);
    const z = JSON.stringify(env.llm.zahteve[1].sporocila);
    expect(z).not.toMatch(/041|234/);
    expect(z).toContain('Aktivna stranka: Mateja Kovačič (ID 101).');
  });

  it('kartica stranke: opombe in zapiski ne gredo v dnevnik', async () => {
    const env = okolje({ llm: [{ klici: [{ id: 'a', ime: 'kartica_stranke', vhod: { stranka: 'Mateja', stranka_id: null } }] }] });
    const r = await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'povej mi vse o Mateji' }, env.d);
    if (!r.ok) throw new Error();
    expect(r.odgovor).toContain('Alergija na amonijak');
    const zapis = env.shramba.ukazi.get(r.ukazId)?.zakljucen?.odgovor ?? '';
    expect(zapis).not.toMatch(/amonijak|konice/);
    expect(zapis).toContain('(interne opombe prikazane)');
  });
});
