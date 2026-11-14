// Preizkus s PRAVIM modelom v jezikih en/de/it/hr na lažnem salonu. Navaden `vitest run` ga preskoči.
//
//   set -a; . ./.env.local; set +a; GLAS_EVAL=1 npx vitest run tests/glas/eval-jeziki.test.ts
//
// Preverjamo končni obrazec in da odgovor (zaslon + govor) ni v slovenščini.
// Imena storitev in strank ostanejo, kot so zapisana v salonu ("Barvanje", "Ana Novak").
import { describe, expect, it } from 'vitest';
import { obdelajUkaz, type OdprtObrazec } from '@/lib/glas/jedro';
import { llmAnthropic } from '@/lib/glas/ponudniki/llm';
import { ukazObrazcu } from '@/lib/glas/odjemalec/obrazecGlas';
import { nastaviJezikOdjemalca } from '@/lib/glas/odjemalec/jezikOdjemalca';
import type { JezikAsistenta } from '@/lib/glas/paket';
import { kontekst, NASTAVITVE, okolje } from './pomoc';

const VKLOP = process.env.GLAS_EVAL === '1' && Boolean(process.env.ANTHROPIC_API_KEY);

/** Tipične slovenske besede, ki jih v tujem odgovoru ne sme biti. */
const SLOVENSKO = /\b(shranim|jutri|ponedeljek|katero|katerega|prosim|zapisal[a]?|prestavil[a]?|stranko|storitev|ob (\d|desetih|enajstih))\b/i;

const NOV = { stranka: '102', storitev: 's1', dan: '2026-11-13', ura: '11:00' };
const PRESTAVI = { idt: 't1', dan: '2026-11-16', ura: '12:00' };

type Pogovor = { ukazi: string[]; konec: Record<string, string>; shrani?: boolean };
const POGOVORI: Record<Exclude<JezikAsistenta, 'sl'>, Pogovor[]> = {
  en: [
    { ukazi: ['Book Ana Novak tomorrow at eleven for Barvanje.'], konec: NOV },
    { ukazi: ['New appointment for Ana Novak', 'Barvanje', 'tomorrow at 11 am'], konec: NOV },
    { ukazi: ['Move Mateja to Monday at twelve.', 'Yes, save it.'], konec: PRESTAVI, shrani: true },
    { ukazi: ['Uh, book a new appointment for', 'Ana Novak, Barvanje, tomorrow at eleven', 'yes'], konec: NOV, shrani: true },
    { ukazi: ['When is Ana Novak coming in next?'], konec: {} },
    { ukazi: ['What does tomorrow look like?'], konec: {} },
  ],
  de: [
    { ukazi: ['Trag Ana Novak morgen um elf Uhr für Barvanje ein.'], konec: NOV },
    { ukazi: ['Neuer Termin für Ana Novak', 'Barvanje', 'morgen um 11'], konec: NOV },
    { ukazi: ['Verschieb Mateja auf Montag um zwölf.', 'Ja, speichern.'], konec: PRESTAVI, shrani: true },
    { ukazi: ['Ähm, trag einen neuen Termin ein für', 'Ana Novak, Barvanje, morgen um elf', 'ja'], konec: NOV, shrani: true },
    { ukazi: ['Wann kommt Ana Novak das nächste Mal?'], konec: {} },
    { ukazi: ['Wie sieht der morgige Tag aus?'], konec: {} },
  ],
  it: [
    { ukazi: ['Segna Ana Novak domani alle undici per Barvanje.'], konec: NOV },
    { ukazi: ['Nuovo appuntamento per Ana Novak', 'Barvanje', 'domani alle 11'], konec: NOV },
    { ukazi: ['Sposta Mateja a lunedì alle dodici.', 'Sì, salva.'], konec: PRESTAVI, shrani: true },
    { ukazi: ['Ehm, segna un nuovo appuntamento per', 'Ana Novak, Barvanje, domani alle undici', 'sì'], konec: NOV, shrani: true },
    { ukazi: ['Quando viene Ana Novak la prossima volta?'], konec: {} },
    { ukazi: ["Com'è la giornata di domani?"], konec: {} },
  ],
  hr: [
    { ukazi: ['Upiši Anu Novak sutra u jedanaest na Barvanje.'], konec: NOV },
    { ukazi: ['Novi termin za Anu Novak', 'Barvanje', 'sutra u 11'], konec: NOV },
    { ukazi: ['Premjesti Mateju na ponedjeljak u podne.', 'Da, spremi.'], konec: PRESTAVI, shrani: true },
    { ukazi: ['Ovaj, upiši novi termin za', 'Ana Novak, Barvanje, sutra u jedanaest', 'da'], konec: NOV, shrani: true },
    { ukazi: ['Kada Ana Novak sljedeći put dolazi?'], konec: {} },
    { ukazi: ['Kako izgleda sutrašnji dan?'], konec: {} },
  ],
};

describe.skipIf(!VKLOP)('jeziki s pravim modelom', () => {
  for (const [jezik, pogovori] of Object.entries(POGOVORI) as [Exclude<JezikAsistenta, 'sl'>, Pogovor[]][]) {
    it(jezik, async () => {
      nastaviJezikOdjemalca(jezik);
      let uspesnih = 0;
      let slovenskih = 0;
      for (const p of pogovori) {
        const { d } = okolje({ nastavitve: structuredClone(NASTAVITVE) });
        const llm = llmAnthropic(process.env.GLAS_LLM_MODEL || 'claude-haiku-5-5', 15000);
        d.llm = () => llm;
        const zgodovina: string[] = [];
        let obrazec: OdprtObrazec | null = null;
        let shranjeno = false;
        let odgovorjeno = true;
        console.log(`\n════ ${jezik}`);
        for (const u of p.ukazi) {
          if (obrazec && ukazObrazcu(u) === 'shrani') {
            shranjeno = true;
            console.log(`» ${u}\n  (brskalnik: requestSubmit obrazca)`);
            continue;
          }
          const t = Date.now();
          const r = (await obdelajUkaz(
            { k: kontekst({ jezik }), vhod: 'besedilo', besedilo: u, prejsnjiUkazi: [...zgodovina], odprtObrazec: obrazec, izbira: null },
            d
          )) as { ukazId?: string; status?: string; odgovor?: string; govor?: string; obrazec?: OdprtObrazec };
          if (r.ukazId) zgodovina.push(r.ukazId);
          if (r.obrazec) obrazec = r.obrazec;
          if (!r.odgovor && !r.govor) odgovorjeno = false;
          const besedilo = `${r.odgovor ?? ''}\n${r.govor ?? ''}`;
          if (SLOVENSKO.test(besedilo)) {
            slovenskih++;
            console.log(`  ⚠ slovensko: ${besedilo.match(SLOVENSKO)?.[0]}`);
          }
          console.log(`» ${u}\n  ${Date.now() - t} ms | ${r.status} | ${r.odgovor}\n  🔊 ${r.govor}`);
        }
        const ok = odgovorjeno && Object.entries(p.konec).every(([k, v]) => obrazec?.polja[k] === v) && (!p.shrani || shranjeno);
        if (ok) uspesnih++;
        console.log(`  ${ok ? 'OK' : 'NAROBE'} obrazec=${JSON.stringify(obrazec?.polja ?? null)}`);
      }
      nastaviJezikOdjemalca('sl');
      console.log(`\n${jezik}: uspešnih ${uspesnih}/${pogovori.length}, slovenskih odgovorov ${slovenskih}`);
      expect(uspesnih).toBeGreaterThanOrEqual(pogovori.length - 1);
      expect(slovenskih).toBe(0);
    }, 600_000);
  }
});
