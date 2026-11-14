// Odjemalec v jeziku pogovora: da/ne, konec govora, lokalni odzivi, sporočila (lib/glas/odjemalec).
import { afterEach, describe, expect, it } from 'vitest';
import { jePotrditev, jeZavrnitev } from '@/lib/glas/odjemalec/besede';
import { BESEDE, BESEDILA, besedila, nastaviJezikOdjemalca, jezikOdjemalca } from '@/lib/glas/odjemalec/jezikOdjemalca';
import { cakanjePoKoncu, CAKANJE, jePrekinitev, lokalniOdziv, namigiCakanja, napakaZaGovor } from '@/lib/glas/odjemalec/tok';

afterEach(() => nastaviJezikOdjemalca('sl'));

describe('nastaviJezikOdjemalca', () => {
  it('neznan ali prazen jezik je slovenščina', () => {
    for (const j of [null, undefined, '', 'fr', 'EN']) {
      nastaviJezikOdjemalca(j);
      expect(jezikOdjemalca()).toBe('sl');
    }
    nastaviJezikOdjemalca('hr');
    expect(jezikOdjemalca()).toBe('hr');
  });
});

describe('da/ne po jezikih', () => {
  const primeri = {
    sl: { da: ['Ja.', 'ja, hvala', 'Potrdi'], ne: ['Ne.', 'Prekliči', 'ne hvala'], ni: ['ja, ampak ob desetih', 'yes'] },
    en: { da: ['Yes.', 'Yes, please.', 'okay', 'Yes, thanks', 'Go ahead.'], ne: ['No.', 'Cancel', 'No, thank you.', "Don't save."], ni: ['yes but at ten', 'ja'] },
    de: { da: ['Ja.', 'Ja bitte', 'Bestätigen', 'In Ordnung.', 'ja danke'], ne: ['Nein.', 'Abbrechen', 'Nein, danke.'], ni: ['ja aber um zehn', 'yes'] },
    it: { da: ['Sì.', 'Sì, grazie.', 'Va bene', 'Conferma', "D'accordo."], ne: ['No.', 'Annulla', 'No, grazie.', 'Lascia stare.'], ni: ['sì ma alle dieci', 'ja'] },
    hr: { da: ['Da.', 'Može.', 'U redu', 'Potvrđujem', 'da, hvala'], ne: ['Ne.', 'Otkaži', 'Ne, hvala.'], ni: ['da ali u deset', 'yes'] },
  } as const;
  for (const [j, p] of Object.entries(primeri)) {
    it(j, () => {
      nastaviJezikOdjemalca(j);
      for (const x of p.da) expect(jePotrditev(x), x).toBe(true);
      for (const x of p.ne) expect(jeZavrnitev(x), x).toBe(true);
      for (const x of p.ni) expect(jePotrditev(x), x).toBe(false);
      for (const x of p.da) expect(jeZavrnitev(x), x).toBe(false);
    });
  }
});

describe('konec govora po jezikih', () => {
  const nedokoncano = {
    en: ['Book a new appointment for Anna at', 'Move Maria to', 'Um, book', 'Tomorrow at half'],
    de: ['Trag einen Termin für Anna um', 'Verschieb Maria auf', 'Ähm, morgen um halb'],
    it: ['Segna un appuntamento per Anna alle', 'Sposta Maria a', 'Ehm, domani alle'],
    hr: ['Upiši novi termin za Anu u', 'Premjesti Mariju na', 'Ovaj, sutra u pola'],
  };
  for (const [j, stavki] of Object.entries(nedokoncano)) {
    it(`${j}: nedokončan stavek čaka dlje`, () => {
      nastaviJezikOdjemalca(j);
      for (const s of stavki) expect(cakanjePoKoncu(s), s).toBe(CAKANJE.nedokoncano);
    });
  }
  it('samo mašilo', () => {
    nastaviJezikOdjemalca('en');
    expect(cakanjePoKoncu('Uhm.')).toBe(CAKANJE.samoMasilo);
    nastaviJezikOdjemalca('de');
    expect(cakanjePoKoncu('Ähm')).toBe(CAKANJE.samoMasilo);
  });
  it('dokončan stavek in "da" v hrvaščini ne čakata', () => {
    nastaviJezikOdjemalca('hr');
    expect(cakanjePoKoncu('Da.')).toBeLessThan(CAKANJE.nedokoncano);
    nastaviJezikOdjemalca('en');
    expect(cakanjePoKoncu('Book Anna tomorrow at ten.')).toBeLessThan(CAKANJE.nedokoncano);
    nastaviJezikOdjemalca('it');
    expect(cakanjePoKoncu('No.')).toBeLessThan(CAKANJE.nedokoncano);
  });
});

describe('lokalni odzivi po jezikih', () => {
  const primeri = {
    en: { konec: "Thanks, that's all.", zahvala: 'Thank you!', ponovi: 'Say that again?', pocasneje: 'Slower, please.' },
    de: { konec: 'Danke, das wars.', zahvala: 'Vielen Dank!', ponovi: 'Wie bitte?', pocasneje: 'Bitte langsamer.' },
    it: { konec: 'Grazie, è tutto.', zahvala: 'Grazie mille!', ponovi: 'Puoi ripetere?', pocasneje: 'Più piano, per favore.' },
    hr: { konec: 'Hvala, to je sve.', zahvala: 'Hvala lijepa!', ponovi: 'Ponovi, molim.', pocasneje: 'Malo sporije.' },
  } as const;
  for (const [j, p] of Object.entries(primeri)) {
    it(j, () => {
      nastaviJezikOdjemalca(j);
      const B = BESEDILA[j as keyof typeof BESEDILA];
      expect(lokalniOdziv(p.konec)).toEqual({ vrsta: 'konec', govor: B.konec });
      expect(lokalniOdziv(p.zahvala)).toEqual({ vrsta: 'zahvala', govor: B.zahvala });
      expect(lokalniOdziv(p.ponovi)?.vrsta).toBe('ponovi');
      expect(lokalniOdziv(p.pocasneje)?.vrsta).toBe('pocasneje');
      expect(lokalniOdziv('Book Anna tomorrow')).toBeNull();
    });
  }
  it('slovenščina ostane enaka', () => {
    expect(lokalniOdziv('Hvala, to je vse.')).toEqual({ vrsta: 'konec', govor: 'Prav. Lep dan.' });
    expect(lokalniOdziv('Hvala.')).toEqual({ vrsta: 'zahvala', govor: 'Prosim.' });
  });
});

describe('prekinitev z eno besedo', () => {
  it('v jeziku pogovora', () => {
    nastaviJezikOdjemalca('de');
    expect(jePrekinitev({ slisano: 'Stopp', govor: new Set(), glasnost: 1 })).toBe(true);
    nastaviJezikOdjemalca('it');
    expect(jePrekinitev({ slisano: 'Aspetta', govor: new Set(), glasnost: 1 })).toBe(true);
  });
});

describe('sporočila odjemalca', () => {
  it('vsi jeziki imajo vsa besedila, neprazna', () => {
    const kljuci = Object.keys(BESEDILA.sl).sort();
    for (const [j, b] of Object.entries(BESEDILA)) {
      expect(Object.keys(b).sort(), j).toEqual(kljuci);
      for (const [k, v] of Object.entries(b)) {
        if (typeof v === 'string') expect(v.trim(), `${j}.${k}`).not.toBe('');
        else if (Array.isArray(v)) expect(v.length, `${j}.${k}`).toBeGreaterThan(0);
        else expect(Object.keys(v).sort(), `${j}.${k}`).toEqual(Object.keys(BESEDILA.sl.uspeh).sort());
      }
    }
  });
  it('vsi jeziki imajo vse množice besed', () => {
    const kljuci = Object.keys(BESEDE.en).sort();
    for (const [j, b] of Object.entries(BESEDE)) {
      expect(Object.keys(b).sort(), j).toEqual(kljuci);
      for (const [k, v] of Object.entries(b)) expect(v.length, `${j}.${k}`).toBeGreaterThan(0);
    }
  });
  it('namigi in napaka sledijo jeziku', () => {
    expect(namigiCakanja()).toEqual(['Moment.', 'Samo trenutek.', 'Preverim.']);
    nastaviJezikOdjemalca('en');
    expect(namigiCakanja()).toEqual(BESEDILA.en.namigi);
    expect(napakaZaGovor('')).toBe('Something went wrong.');
    expect(besedila().shranjeno).toBe('Saved.');
  });
});
