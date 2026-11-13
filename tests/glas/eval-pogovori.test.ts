// Preizkus s PRAVIM modelom (Anthropic) na lažnem salonu: večkrožni pogovori,
// kot jih je Tim imel v brskalniku. Navaden `vitest run` ga preskoči.
//
//   set -a; . ./.env.local; set +a; GLAS_EVAL=1 npx vitest run tests/glas/eval-pogovori.test.ts
//
// Stane nekaj centov na zagon. Izpiše odgovore; pričakovanja so ohlapna
// (model ni determinističen), preverjamo samo končni obrazec.
import { describe, expect, it } from 'vitest';
import { obdelajUkaz, type OdprtObrazec } from '@/lib/glas/jedro';
import { llmAnthropic } from '@/lib/glas/ponudniki/llm';
import { kontekst, okolje, SALONI } from './pomoc';

const VKLOP = process.env.GLAS_EVAL === '1' && Boolean(process.env.ANTHROPIC_API_KEY);

const POGOVORI: { ukazi: string[]; konec: Record<string, string> }[] = [
  {
    ukazi: ['Uh, zapiši nov termin za', 'Za Anja Novak.', 'Pedikura za Luka— za Lukata, no, se pravi Luka je zaposleni, in pa ob 10 zjutraj.', 'Ne danes. Za ponedeljek.'],
    konec: { stranka: '201', storitev: 's9', oseba: 'o9', dan: '2026-11-16', ura: '10:00' },
  },
  {
    ukazi: ['Zapiši nov termin za Anjo Novak', 'pedikura', 'pri Luki', 'v ponedeljek ob desetih'],
    konec: { stranka: '201', storitev: 's9', oseba: 'o9', dan: '2026-11-16', ura: '10:00' },
  },
  { ukazi: ['Vpiši Anjo Novak v ponedeljek ob desetih na pedikuro pri Luki'], konec: { stranka: '201', storitev: 's9', oseba: 'o9', dan: '2026-11-16', ura: '10:00' } },
  { ukazi: ['Prestavi Matejo', 'na ponedeljek', 'ob dvanajstih'], konec: { idt: 't1', dan: '2026-11-16', ura: '12:00' } },
  { ukazi: ['Zapiši termin za Anjo', 'ne, za Ano Novak', 'barvanje jutri ob enajstih'], konec: { stranka: '102', storitev: 's1', dan: '2026-11-13', ura: '11:00' } },
];

describe.skipIf(!VKLOP)('pogovori s pravim modelom', () => {
  it('končni obrazec je pravilen', async () => {
    const A = SALONI.A1;
    A.stranke.push(
      { id: '201', ime: 'Anja', priimek: 'Novak', zadnjaInterakcija: '2026-10-01' },
      { id: 'LZ-000001', ime: 'Luka', priimek: 'Zupančič', zadnjaInterakcija: '2026-08-01' },
      { id: 'LZ-000002', ime: 'Luka', priimek: 'Zupančič', zadnjaInterakcija: null }
    );
    A.storitve.push({ id: 's9', naziv: 'Pedikura', trajanjeMin: 60, aktivna: true });
    A.osebe.push({ ...A.osebe[0], id: 'o9', ime: 'Luka', priimek: 'Kranjc' });

    let uspesnih = 0;
    for (const p of POGOVORI) {
      const { d } = okolje();
      const llm = llmAnthropic(process.env.GLAS_LLM_MODEL || 'claude-haiku-5-5', 15000);
      d.llm = () => llm;
      const zgodovina: string[] = [];
      let obrazec: OdprtObrazec | null = null;
      console.log('\n════════');
      for (const u of p.ukazi) {
        const t = Date.now();
        const r = (await obdelajUkaz({ k: kontekst(), vhod: 'besedilo', besedilo: u, prejsnjiUkazi: [...zgodovina], odprtObrazec: obrazec }, d)) as {
          ukazId?: string; status?: string; odgovor?: string; obrazec?: OdprtObrazec;
        };
        if (r.ukazId) zgodovina.push(r.ukazId);
        if (r.obrazec) obrazec = r.obrazec;
        console.log(`» ${u}\n  ${Date.now() - t} ms | ${r.status} | ${r.odgovor}`);
      }
      const ok = Object.entries(p.konec).every(([k, v]) => obrazec?.polja[k] === v);
      if (ok) uspesnih++;
      console.log(`  ${ok ? 'OK' : 'NAROBE'} obrazec=${JSON.stringify(obrazec?.polja ?? null)}`);
    }
    console.log(`\nuspešnih ${uspesnih}/${POGOVORI.length}`);
    expect(uspesnih).toBeGreaterThanOrEqual(POGOVORI.length - 1);
  }, 300_000);
});
