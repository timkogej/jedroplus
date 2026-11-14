// Sporoči stranki: samo o terminu, brez ponudb, en SMS, potrditev, omejitve, pravice, zasebnost.
import { describe, expect, it } from 'vitest';
import { obdelajUkaz, potrdiPredlog } from '@/lib/glas/jedro';
import { zJezikom } from '@/lib/glas/jeziki/jezik';
import { orodjaZa } from '@/lib/glas/orodja/registry';
import { sporociStranki } from '@/lib/glas/orodja/sporocila';
import { jePredogled, type OkoljeOrodja } from '@/lib/glas/orodja/tipi';
import { ocistiSms, preveriBesedilo, skritTelefon, zPodpisom } from '@/lib/glas/sporocila/besedilo';
import { izidIzOdgovora, podpisi } from '@/lib/glas/sporocila/protokol';
import type { Kontekst, PodatkiSalona, Predogled } from '@/lib/glas/tipi';
import { DANES, kontekst, okolje, podatkiPomnilnik, posiljateljLazni, VSE_PRAVICE_STAFF } from './pomoc';

type Vhod = Parameters<typeof sporociStranki.predogled>[0];
const vhod = (p: Partial<Vhod> = {}): Vhod => ({
  stranka: 'Mateja', stranka_id: null, termin_id: null, datum_termina: null,
  besedilo: 'Pozdravljeni, jutri zamujamo približno 15 minut.', jezik_besedila: 'sl', o_odpovedi: false, podpis: true, ...p,
});
function o(k: Partial<Kontekst> = {}, podatki: PodatkiSalona = podatkiPomnilnik('A1'), sporocila = posiljateljLazni()): OkoljeOrodja & { sporocila: ReturnType<typeof posiljateljLazni> } {
  return { k: kontekst(k), podatki, danes: DANES, uraZdaj: '10:00', ukazId: null, sporocila };
}
async function predogled(p: Partial<Vhod> = {}, okolje = o()) {
  return sporociStranki.predogled(vhod(p), okolje);
}
function kotPredlog(x: unknown): Predogled {
  if (!jePredogled(x as Predogled)) throw new Error(`ni predlog: ${JSON.stringify(x)}`);
  return x as Predogled;
}

describe('besedilo sporočila', () => {
  it('SMS brez šumnikov in posebnih znakov, kot sms-send', () => {
    expect(ocistiSms('Žal zamujamo — „15 minut“…\nHvala!')).toBe('Zal zamujamo - 15 minut... Hvala!');
    expect(ocistiSms('Grüße, Đurđa')).toBe('Gruesse, Durda');
  });

  it('podpis doda strežnik, enkrat', () => {
    expect(zPodpisom('Zamujamo 15 minut', 'Salon Lepota')).toBe('Zamujamo 15 minut. Salon Lepota');
    expect(zPodpisom('Zamujamo! Salon Lepota', 'Salon Lepota')).toBe('Zamujamo! Salon Lepota');
    expect(zPodpisom('Zamujamo.', '')).toBe('Zamujamo.');
  });

  it.each([
    '20 % popusta na barvanje',
    'Akcija ta teden!',
    'Brezplačna kava ob obisku',
    'Get 10% off your next visit',
    'Free coffee today',
    'Rabatt auf Färben',
    'Kostenlose Pflege',
    'Sconto del 10 sul colore',
    'Offerta speciale',
    'Besplatna njega kose',
    'Nova ponuda u salonu',
    'Več na www.salon.si',
    'Cena je 30 €',
  ])('ponudba zavrnjena: %s', (b) => {
    expect(preveriBesedilo(b)).toBe('ponudba');
  });

  it.each([
    'Pozdravljeni, danes zamujamo približno 15 minut.',
    'Ali lahko pridete v petek ob 10:30?',
    'Ihr Termin am 16. 11. 2026 um 10:30 ist abgesagt.',
    "We're running 15 minutes late, sorry.",
    'Siamo in ritardo di 15 minuti.',
    'Kasnimo 15 minuta, ispričavamo se.',
  ])('obvestilo dovoljeno: %s', (b) => {
    expect(preveriBesedilo(b)).toBeNull();
  });

  it('telefonska številka v besedilu je zavrnjena', () => {
    expect(preveriBesedilo('Pokličite nas na 041 234 567.')).toBe('telefon');
    expect(preveriBesedilo('Call +386 31 555 111')).toBe('telefon');
  });

  it('skrit telefon', () => {
    expect(skritTelefon('041 234 567')).toBe('041 … 567');
    expect(skritTelefon('+386 31 555 111')).toBe('+386 … 111');
  });
});

describe('sporoci_stranki: predogled', () => {
  it('SMS za termin: podpis, en SMS, skrit telefon, nič ni poslano', async () => {
    const x = o();
    const p = kotPredlog(await predogled({}, x));
    expect(p.parametri).toMatchObject({ idStranke: '101', idTermina: 't1', kanal: 'sms', jezik: 'sl' });
    expect(p.parametri.besedilo).toBe('Pozdravljeni, jutri zamujamo priblizno 15 minut. Salon Lepota');
    expect(JSON.stringify(p.parametri)).not.toContain('234');
    expect(p.povzetek).toContain('SMS za Mateja Kovačič');
    expect(p.podrobnosti?.find((v) => v.oznaka === 'Prejemnik')?.vrednost).toBe('Mateja Kovačič, 041 … 567');
    expect(p.sporocil).toBe(1);
    expect(x.sporocila.poslana).toHaveLength(0);
  });

  it('dva termina → vprašanje; jezik stranke (angleščina) → model napiše znova', async () => {
    const x = await predogled({ stranka: 'Ana Novak' });
    expect(x).toMatchObject({ vprasanje: { moznosti: [{ id: 't5' }, { id: 't2' }] } });
    const y = await predogled({ stranka: 'Ana Novak', termin_id: 't5' });
    expect('sporocilo' in y && y.sporocilo).toContain('angleščina');
    const z = kotPredlog(await predogled({ stranka: 'Ana Novak', termin_id: 't5', besedilo: "Hi, we're running 15 minutes late.", jezik_besedila: 'en' }));
    expect(z.parametri).toMatchObject({ idTermina: 't5', jezik: 'en', besedilo: "Hi, we're running 15 minutes late. Salon Lepota" });
  });

  it('ponudba, predolgo in brez termina', async () => {
    expect(await predogled({ besedilo: 'Jutri imamo 20 % popust!' })).toMatchObject({ sporocilo: expect.stringContaining('ponudb') });
    expect(await predogled({ besedilo: 'Pozdravljeni, '.repeat(12) })).toMatchObject({ sporocilo: expect.stringContaining('predolgo') });
    expect(await predogled({ stranka: 'Ana Novinc' })).toMatchObject({ sporocilo: expect.stringContaining('samo o terminu') });
  });

  it('brez podpisa, če uporabnik tako reče', async () => {
    const p = kotPredlog(await predogled({ podpis: false }));
    expect(p.parametri.besedilo).toBe('Pozdravljeni, jutri zamujamo priblizno 15 minut.');
  });

  it('pretekel datum termina ne', async () => {
    expect(await predogled({ datum_termina: '2026-10-20' })).toMatchObject({ sporocilo: expect.stringContaining('današnjem ali prihodnjem') });
  });

  it('obvestilo o odpovedi samo za termin, ki je res odpovedan', async () => {
    expect(await predogled({ o_odpovedi: true, besedilo: 'Vaš termin jutri ob 9.00 je odpovedan.' })).toMatchObject({ sporocilo: expect.stringContaining('še ni odpovedan') });
    const podatki: PodatkiSalona = {
      ...podatkiPomnilnik('A1'),
      podrobnostiStranke: async () => ({ telefon: '040 999 888', email: null, jezik: 'slo', opombe: null, interneOpombe: null, marketing: null, obiski: 0, neprihodi: 0 }),
    };
    const p = kotPredlog(await predogled({ stranka: 'Špela', o_odpovedi: true, besedilo: 'Vaš termin jutri ob 12.00 je odpovedan. Za nov termin nas pokličite.' }, o({}, podatki)));
    expect(p.parametri).toMatchObject({ idTermina: 't3', oOdpovedi: true });
    expect(p.podrobnosti?.find((v) => v.oznaka === 'Termin')?.vrednost).toContain('odpovedan');
  });

  it('brez telefona in e-pošte: ne; brez telefona: e-pošta v jeziku stranke', async () => {
    expect(await predogled({ stranka: 'Špela' })).toMatchObject({ sporocilo: expect.stringContaining('nima telefona ne e-pošte') });
    const podatki: PodatkiSalona = {
      ...podatkiPomnilnik('A1'),
      podrobnostiStranke: async () => ({ telefon: null, email: 'mateja.k@gmail.com', jezik: 'de', opombe: null, interneOpombe: null, marketing: null, obiski: 0, neprihodi: 0 }),
    };
    const p = kotPredlog(await predogled({ besedilo: 'Guten Tag, wir verspäten uns um 15 Minuten.', jezik_besedila: 'de' }, o({}, podatki)));
    expect(p.parametri).toMatchObject({ kanal: 'email', zadeva: 'Zu Ihrem Termin', besedilo: 'Guten Tag, wir verspäten uns um 15 Minuten. Salon Lepota' });
    expect(p.podrobnosti?.find((v) => v.oznaka === 'Prejemnik')?.vrednost).toBe('Mateja Kovačič, m…@gmail.com');
  });

  it('zaposleni s "samo svoji" ne piše strankam tujih terminov', async () => {
    const k = { vloga: 'staff' as const, osebaId: 'o2', pravice: { ...VSE_PRAVICE_STAFF, can_edit_all_appointments: false, can_edit_only_own_appointments: true } };
    expect(await predogled({}, o(k))).toMatchObject({ sporocilo: expect.stringContaining('samo strankam svojih terminov') });
  });

  it('brez pošiljatelja: ni nastavljeno', async () => {
    expect(await sporociStranki.predogled(vhod(), { ...o(), sporocila: undefined })).toMatchObject({ sporocilo: 'Pošiljanje sporočil ni nastavljeno.' });
  });

  it('v nemškem pogovoru', async () => {
    const x = await zJezikom('de', () => predogled({ stranka: 'Ana Novak', termin_id: 't5' }, o({ jezik: 'de' })));
    expect('sporocilo' in x && x.sporocilo).toContain('Englisch');
  });
});

describe('sporoci_stranki: potrditev', () => {
  async function potrdi(okolje = o(), p: Partial<Vhod> = {}) {
    const pr = kotPredlog(await predogled(p, okolje));
    return sporociStranki.potrdi(pr.parametri, okolje);
  }

  it('pošlje enkrat; telefon prebere strežnik', async () => {
    const x = o();
    const r = await potrdi(x);
    expect(r).toMatchObject({ sporocilo: 'SMS je poslan.' });
    expect(r.neuspeh).toBeUndefined();
    expect(x.sporocila.poslana).toHaveLength(1);
    expect(x.sporocila.poslana[0]).toMatchObject({ kanal: 'sms', prejemnik: '041 234 567', idTermina: 't1', podjetje: 'A1', imeSalona: 'Salon Lepota' });
  });

  it('kvota, blokirana država, ni odgovora, paket brez SMS', async () => {
    for (const [izid, besedilo] of [
      [{ status: 'kvota', razlog: 'quota_exceeded' }, 'Mesečni SMS-i so porabljeni'],
      [{ status: 'blokirano', razlog: 'blocked_country' }, 'v državo te številke'],
      [{ status: 'neznano', razlog: 'cas' }, 'Ne vem, ali je bilo poslano'],
      [{ status: 'napaka', razlog: 'sms_disabled' }, 'niso vklopljeni'],
    ] as const) {
      const r = await potrdi(o({}, podatkiPomnilnik('A1'), posiljateljLazni(izid)));
      expect(r.neuspeh).toBe(true);
      expect(r.sporocilo).toContain(besedilo);
    }
  });

  it('omejitev 3 na stranko na dan; neuspešna se ne štejejo', async () => {
    const x = o();
    x.sporocila.izid = { status: 'kvota', razlog: 'quota_exceeded' };
    await potrdi(x);
    x.sporocila.izid = { status: 'poslano' };
    for (let i = 0; i < 3; i++) expect((await potrdi(x)).neuspeh).toBeUndefined();
    const r = await potrdi(x);
    expect(r.neuspeh).toBe(true);
    expect(r.sporocilo).toContain('dnevna omejitev');
    expect(x.sporocila.poslana).toHaveLength(4);
  });

  it('termin izbrisan ali stranka izgubi kontakt med predlogom in potrditvijo → ni poslano', async () => {
    const x = o();
    const pr = kotPredlog(await predogled({}, x));
    const brezTermina = { ...x, podatki: { ...x.podatki, termini: async () => [] } };
    expect(await sporociStranki.potrdi(pr.parametri, brezTermina)).toMatchObject({ neuspeh: true, sporocilo: expect.stringContaining('Termina ni več') });
    const brezKontakta = { ...x, podatki: { ...x.podatki, podrobnostiStranke: async () => null } };
    expect(await sporociStranki.potrdi(pr.parametri, brezKontakta)).toMatchObject({ neuspeh: true, sporocilo: expect.stringContaining('Kontakta') });
    expect(x.sporocila.poslana).toHaveLength(0);
  });
});

describe('sporoci_stranki v jedru', () => {
  const klic = (vhodLlm: Partial<Vhod> = {}) => ({ klici: [{ id: 'k1', ime: 'sporoci_stranki', vhod: vhod(vhodLlm) }] });

  it('predlog: "Pošljem?", model ne vidi telefona, potrditev pošlje enkrat', async () => {
    const env = okolje({ llm: [klic()] });
    const k = kontekst();
    const r = await obdelajUkaz({ k, vhod: 'besedilo', besedilo: 'Sporoči Mateji, da jutri zamujamo 15 minut.' }, env.d);
    expect(r).toMatchObject({ ok: true, status: 'predlog' });
    if (!r.ok || !r.predlog) throw new Error();
    expect(r.govor).toMatch(/Pošljem\?$/);
    expect(r.predlog.sporocil).toBe(1);
    expect(JSON.stringify(env.llm.zahteve)).not.toContain('234 567');
    expect(env.sporocila.poslana).toHaveLength(0);

    const [a, b] = await Promise.all([
      potrdiPredlog({ k, predlogId: r.predlog.id, zeton: r.predlog.zeton }, env.d),
      potrdiPredlog({ k, predlogId: r.predlog.id, zeton: r.predlog.zeton }, env.d),
    ]);
    expect([a, b].some((x) => x.ok && !x.ponovljeno)).toBe(true);
    expect(env.sporocila.poslana).toHaveLength(1);
    // Revizija: samo ID-ji in kode, brez telefona in besedila.
    expect(JSON.stringify(env.shramba.revizije)).not.toMatch(/234 567|zamujamo/);
  });

  it('predlog postavi fokus na termin (za "spremeni besedilo", "brez podpisa")', async () => {
    const env = okolje({ llm: [klic()] });
    const r = await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: 'Sporoči Mateji, da zamujamo.' }, env.d);
    if (!r.ok) throw new Error();
    const u = env.shramba.ukazi.get(r.ukazId!);
    expect(u?.zakljucen?.kontekst).toMatchObject({ stranka_id: '101', termin_id: 't1', termin_datum: '2026-11-13' });
  });

  it('orodje vidijo lastnik, admin in zaposleni z urejanjem terminov; brez urejanja ne', () => {
    const ima = (k: Partial<Kontekst>) => orodjaZa(kontekst(k)).some((x) => x.ime === 'sporoci_stranki');
    expect(ima({})).toBe(true);
    expect(ima({ vloga: 'admin' })).toBe(true);
    expect(ima({ vloga: 'staff', pravice: VSE_PRAVICE_STAFF })).toBe(true);
    expect(ima({ vloga: 'staff', pravice: { ...VSE_PRAVICE_STAFF, can_edit_all_appointments: false, can_edit_only_own_appointments: false } })).toBe(false);
  });

  it('pravica odvzeta po predlogu → potrditev ne pošlje', async () => {
    const env = okolje({ llm: [klic()] });
    const k = kontekst({ vloga: 'staff', pravice: VSE_PRAVICE_STAFF });
    const r = await obdelajUkaz({ k, vhod: 'besedilo', besedilo: 'Sporoči Mateji, da zamujamo.' }, env.d);
    if (!r.ok || !r.predlog) throw new Error(JSON.stringify(r));
    const brez = { ...k, pravice: { ...VSE_PRAVICE_STAFF, can_edit_all_appointments: false } };
    const p = await potrdiPredlog({ k: brez, predlogId: r.predlog.id, zeton: r.predlog.zeton }, env.d);
    expect(p).toMatchObject({ ok: false, koda: 'ni_pravice' });
    expect(env.sporocila.poslana).toHaveLength(0);
  });
});

describe('n8n: podpis in odgovor', () => {
  it('podpis HMAC kot v toku glas-sporocilo', () => {
    expect(podpisi('k', '1700000000', '{"a":1}')).toMatch(/^[0-9a-f]{64}$/);
    expect(podpisi('k', '1700000000', '{"a":1}')).not.toBe(podpisi('k', '1700000001', '{"a":1}'));
  });
  it('odgovor → izid', () => {
    expect(izidIzOdgovora({ success: true })).toEqual({ status: 'poslano' });
    expect(izidIzOdgovora({ success: false, error: 'quota_exceeded' })).toMatchObject({ status: 'kvota' });
    expect(izidIzOdgovora({ success: false, error: 'blocked_country' })).toMatchObject({ status: 'blokirano' });
    expect(izidIzOdgovora(null)).toMatchObject({ status: 'napaka' });
  });
});
