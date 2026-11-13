// Fokus pogovora: aktivna stranka in termin se prenašata med izjavami (samo ID-ji,
// samo isti uporabnik in podjetje), ID znova preveri RLS.
import { describe, expect, it } from 'vitest';
import { obdelajUkaz } from '@/lib/glas/jedro';
import { preberiKontekst } from '@/lib/glas/shramba/tipi';
import { kontekst, okolje } from './pomoc';

type Env = ReturnType<typeof okolje>;

async function ukaz(env: Env, besedilo: string, prejsnji: string[], dodatno: Record<string, unknown> = {}, k = kontekst()) {
  const r = await obdelajUkaz({ k, vhod: 'besedilo', besedilo, prejsnjiUkazi: prejsnji, ...dodatno }, env.d);
  if (!r.ok) throw new Error(`napaka: ${JSON.stringify(r)}`);
  prejsnji.push(r.ukazId);
  return r;
}

const zadnjaZahteva = (env: Env) => {
  const z = env.llm.zahteve[env.llm.zahteve.length - 1];
  const s = z.sporocila[z.sporocila.length - 1];
  return 'besedilo' in s ? String(s.besedilo) : '';
};

describe('fokus stranke', () => {
  it('dva Tima → izbira → naslednja izjava ve, za katerega Tima gre', async () => {
    const env = okolje({
      llm: [
        { klici: [{ id: 'a', ime: 'kartica_stranke', vhod: { stranka: 'Tim', stranka_id: null } }] },
        { besedilo: 'Tim Zupančič ima termin v petek.' },
        { besedilo: 'V redu.' },
      ],
    });
    const zg: string[] = [];
    const r1 = await ukaz(env, 'povej mi o Timu', zg);
    expect(r1.status).toBe('vprasanje');
    expect(r1.vprasanje?.moznosti?.map((m) => m.id).sort()).toEqual(['AB-123456', 'ABC-12345']);

    await ukaz(env, 'tega', zg, { izbira: { id: 'AB-123456', oznaka: 'Tim Zupančič (še brez obiska)' } });
    expect(env.shramba.ukazi.get(zg[1])?.zakljucen?.kontekst).toEqual({ stranka_id: 'AB-123456' });

    await ukaz(env, 'kakšen telefon ima', zg);
    expect(zadnjaZahteva(env)).toContain('Aktivna stranka: Tim Zupančič (ID AB-123456).');
  });

  it('novo ime zamenja fokus; termin iz prestavitve postane aktiven', async () => {
    const env = okolje({
      llm: [
        { klici: [{ id: 'a', ime: 'kartica_stranke', vhod: { stranka: 'Mateja', stranka_id: null } }] },
        { klici: [{ id: 'b', ime: 'prestavi_termin', vhod: { stranka: 'Ana Novak', stranka_id: null, termin_id: null, datum_zdaj: 'jutri', nov_datum: null, nova_ura: null } }] },
        { besedilo: 'V redu.' },
      ],
    });
    const zg: string[] = [];
    await ukaz(env, 'kdaj pride Mateja', zg);
    expect(env.shramba.ukazi.get(zg[0])?.zakljucen?.kontekst).toEqual({ stranka_id: '101' });

    await ukaz(env, 'prestavi Ano Novak, ki pride jutri', zg);
    expect(zadnjaZahteva(env)).toContain('Aktivna stranka: Mateja Kovačič (ID 101).');
    expect(env.shramba.ukazi.get(zg[1])?.zakljucen?.kontekst).toEqual({ stranka_id: '102', termin_id: 't2', termin_datum: '2026-11-13' });

    await ukaz(env, 'ji pošlji kaj', zg);
    const uvod = zadnjaZahteva(env);
    expect(uvod).toContain('Aktivna stranka: Ana Novak (ID 102).');
    expect(uvod).toMatch(/Aktiven termin: .*ob 11:00, Moško striženje/);
    expect(uvod).not.toContain('Mateja');
  });

  it('fokus se prenese tudi čez hitro pot (brez LLM)', async () => {
    const env = okolje({ llm: [{ klici: [{ id: 'a', ime: 'kartica_stranke', vhod: { stranka: 'Mateja', stranka_id: null } }] }, { besedilo: 'V redu.' }] });
    const zg: string[] = [];
    await ukaz(env, 'povej o Mateji', zg);
    await ukaz(env, 'kaj imam jutri', zg);
    expect(env.shramba.ukazi.get(zg[1])?.zakljucen?.kontekst).toEqual({ stranka_id: '101' });
    await ukaz(env, 'kaj ima rada', zg);
    expect(zadnjaZahteva(env)).toContain('Aktivna stranka: Mateja Kovačič (ID 101).');
  });

  it('ID stranke tujega podjetja v shranjenem fokusu se ne uporabi', async () => {
    const env = okolje({ llm: [{ besedilo: 'V redu.' }] });
    const zg: string[] = [];
    await ukaz(env, 'pozdravljena', zg);
    // Kot da bi bil v bazi tuj ID (napaka ali podtaknjen zapis): RLS ga ne vrne.
    env.shramba.ukazi.get(zg[0])!.zakljucen!.kontekst = { stranka_id: '201' };
    await ukaz(env, 'kakšen telefon ima', zg);
    expect(zadnjaZahteva(env)).not.toContain('Aktivna stranka');
    expect(env.shramba.ukazi.get(zg[1])?.zakljucen?.kontekst).toBeNull();
  });

  it('fokus drugega uporabnika ali podjetja se ne prebere', async () => {
    const env = okolje({
      llm: [{ klici: [{ id: 'a', ime: 'kartica_stranke', vhod: { stranka: 'Mateja', stranka_id: null } }] }, { besedilo: 'V redu.' }, { besedilo: 'V redu.' }],
    });
    const zg: string[] = [];
    await ukaz(env, 'povej o Mateji', zg);
    // Drug uporabnik istega podjetja pošlje tuj ID ukaza.
    await ukaz(env, 'kakšen telefon ima', [...zg], {}, kontekst({ userId: 'u-drug' }));
    expect(zadnjaZahteva(env)).not.toContain('Aktivna stranka');
    // Isti uporabnik v drugem podjetju.
    expect(await env.shramba.prejsnjiUkaz(zg[0], 'u-lastnik', 'B2')).toBeNull();
  });

  it('kontekst iz baze: samo znana polja in varni ID-ji', () => {
    expect(preberiKontekst({ stranka_id: '101', ime: 'Mateja', termin_id: 't1', termin_datum: '2026-11-13' })).toEqual({
      stranka_id: '101', termin_id: 't1', termin_datum: '2026-11-13',
    });
    expect(preberiKontekst({ stranka_id: "1' or 1=1" })).toBeNull();
    expect(preberiKontekst({ termin_datum: '2026-11-13' })).toBeNull();
    expect(preberiKontekst('101')).toBeNull();
  });
});
