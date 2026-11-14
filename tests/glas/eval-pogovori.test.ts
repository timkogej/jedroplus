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
import { ukazObrazcu } from '@/lib/glas/odjemalec/obrazecGlas';
import { izberiMoznost } from '@/lib/glas/odjemalec/besede';
import { kontekst, NASTAVITVE, okolje, SALONI } from './pomoc';

const VKLOP = process.env.GLAS_EVAL === '1' && Boolean(process.env.ANTHROPIC_API_KEY);

/** Robotski stavki, ki jih v izgovorjenem odgovoru ne sme biti. */
const ROBOTSKO = /pritisnite|preverite in|v obrazcu izberite|kliknite|gumb shrani/i;

// `shrani`: zadnji "ja" je odgovor na "Shranim?" in ga obdela brskalnik (requestSubmit),
// ne strežnik — tu ga simuliramo kot odjemalec (components/glas/AsistentPlus lokalno).
// `#ID` v ukazih je dotik možnosti na zaslonu (izbira). `odgovor`: kaj mora vsebovati odgovor
// pri indeksu ukaza (zaslon ali govor); `ne`: česa ne sme (npr. ponovno vprašanje).
const POGOVORI: {
  ukazi: string[];
  konec: Record<string, string>;
  shrani?: boolean;
  podjetje?: string;
  odgovor?: Record<number, RegExp>;
  ne?: Record<number, RegExp>;
}[] = [
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
  // Nov tok: "Shranim?" → "ja".
  { ukazi: ['Zapiši Ano Novak jutri ob enajstih', 'barvanje', 'ja'], konec: { stranka: '102', storitev: 's1', dan: '2026-11-13', ura: '11:00' }, shrani: true },
  { ukazi: ['Prestavi Matejo na ponedeljek ob dvanajstih', 'Ja, shrani.'], konec: { idt: 't1', dan: '2026-11-16', ura: '12:00' }, shrani: true },
  // Premor sredi nareka: brskalnik zdaj pošlje združeno izjavo (z Sonioxovo piko sredi stavka).
  { ukazi: ['Zapiši nov termin za Anjo Novak ob. desetih na pedikuro pri Luki.', 'V ponedeljek.', 'ja'], konec: { stranka: '201', storitev: 's9', oseba: 'o9', dan: '2026-11-16', ura: '10:00' }, shrani: true },
  // Odrezan stavek (uporabnik je res nehal): vpraša, ne ugiba.
  { ukazi: ['Vpiši Ano Novak jutri ob', 'ob desetih, barvanje'], konec: { stranka: '102', storitev: 's1', dan: '2026-11-13', ura: '10:00' } },
  // Več lokacij (salon L3): Luka dela v Centru in Šiški, Maja samo v Šiški, pedikura samo v Centru.
  { podjetje: 'L3', ukazi: ['Vpiši Niko Horvat jutri ob enajstih na barvanje pri Luki', 'v Šiški'], konec: { stranka: '301', oseba: 'o31', lokacija: 'l-siska', dan: '2026-11-13', ura: '11:00' } },
  { podjetje: 'L3', ukazi: ['Zapiši Niko jutri ob desetih na barvanje pri Maji'], konec: { stranka: '301', oseba: 'o32', lokacija: 'l-siska' } },
  { podjetje: 'L3', ukazi: ['Nov termin za Niko Horvat pri Luki', 'pedikura, jutri ob devetih'], konec: { stranka: '301', storitev: 's32', oseba: 'o31', lokacija: 'l-center' } },
  { podjetje: 'L3', ukazi: ['Vpiši Niko Horvat jutri ob enajstih pri Luki v Centru', 'barvanje', 'ja'], konec: { stranka: '301', storitev: 's31', lokacija: 'l-center' }, shrani: true },
  // Fokus: dva Tima → izbira → "kakšen telefon ima" ne vpraša znova → prestavitev brez imena.
  {
    ukazi: ['Kaj vemo o Timu Zupančiču?', '#ABC-12345', 'Kakšen telefon ima?', 'Prestavi mu termin na petek.'],
    konec: { idt: 't9', dan: '2026-11-13' },
    odgovor: { 2: /040 111 222/ },
    ne: { 2: /katere|katerega|kateri tim/i, 3: /katere|katerega|kateri tim/i },
  },
  // Urejanje termina: jezik aktivnega termina, nato "ja".
  { ukazi: ['Kdaj pride Ana Novak?', 'Spremeni jezik termina v angleščino.', 'ja'], konec: { idt: 't5', jezik: 'eng' }, shrani: true },
  // Odprt obrazec novega termina: "dodaj še barvanje" doda drugo storitev.
  { ukazi: ['Zapiši Matejo jutri ob enajstih na moško striženje.', 'Dodaj še barvanje.'], konec: { stranka: '101', storitev: 's2', dodaj1: 's1' } },
  // Opomba stranke: končen odgovor iz baze, ne izmišljen.
  { ukazi: ['Ima Ana Novak kakšno opombo?'], konec: {}, odgovor: { 0: /zamujala/ } },
  // Isto kot zadnjič.
  { ukazi: ['Zapiši Matejo isto kot zadnjič čez šest tednov.'], konec: { stranka: '101', storitev: 's1', oseba: 'o1', dan: '2026-12-24' } },
  // Sporoči stranki: predlog SMS (pošlje šele potrditev). Ana prejema v angleščini → model napiše znova.
  { ukazi: ['Sporoči Mateji, da jutri zamujamo kakšnih 15 minut.'], konec: {}, odgovor: { 0: /SMS za Mateja Kova[čc]i[čc]: ».*15/ }, ne: { 0: /jutri danes|danes jutri/i } },
  // Popravek odprtega predloga: model mora znova poklicati orodje (ne samo reči, da je spremenil).
  { ukazi: ['Sporoči Mateji, da jutri zamujamo 15 minut.', 'Brez podpisa na koncu.'], konec: {}, odgovor: { 1: /SMS za Mateja Kova[čc]i[čc]: ».*15 minut/ }, ne: { 1: /Salon Lepota/ } },
  { ukazi: ['Sporoči Mateji, da jutri zamujamo 15 minut.', 'Dodaj še, da se opravičujemo.'], konec: {}, odgovor: { 1: /SMS za Mateja Kova[čc]i[čc]: ».*(opravic|oprost)/i } },
  { ukazi: ['Sporoči Ani Novak, da danes zamujamo deset minut.'], konec: {}, odgovor: { 0: /SMS za Ana Novak: ».*(late|minutes)/i } },
  // Povzetek dneva (model, ne hitra pot) in številke za lastnika (samo zaslon).
  { ukazi: ['Kako bo izgledal ponedeljek, kaj vse imamo?'], konec: {}, odgovor: { 0: /termin/i } },
  { ukazi: ['Koliko smo zaslužili ta mesec v primerjavi s prejšnjim?'], konec: {}, odgovor: { 0: /Zaslužek po ceniku/ } },  // Zapolnitev luknje (salon Z5: Tina jutri prosta od 10.30; Mateja ima kasnejši termin, Ana privolitev, Nina ne).
  { podjetje: 'Z5', ukazi: ['Stranka je odpovedala jutri ob pol enajstih pri Tini. Koga naj pokličem?'], konec: {}, odgovor: { 0: /Mateja Kos[\s\S]*Ana Novak[\s\S]*Nina Bela/ } },
  { podjetje: 'Z5', ukazi: ['Kdo bi lahko prišel jutri ob pol enajstih k Tini?', 'Pošlji Mateji predlog.'], konec: {}, odgovor: { 1: /SMS za Mateja Kos: ».*(prestav|sprostil|prost)/i } },
  { podjetje: 'Z5', ukazi: ['Kdo bi lahko prišel jutri ob pol enajstih k Tini?', 'Pošlji vsem SMS.'], konec: {}, odgovor: { 1: /SMS za (Mateja Kos|Ana Novak)|privolit/i }, ne: { 1: /SMS za Nina|popust/i } },
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
    A.termini.push({
      id: 't9', vrstica: 'v-t9', idStranke: 'ABC-12345', stranka: 'Tim Zupančič', datum: '2026-11-17', zacetek: '10:00', konec: '10:30',
      storitev: 'Moško striženje', osebaId: 'o1', oseba: 'Tina', status: 'scheduled', lokacijaId: null,
    });

    let uspesnih = 0;
    let robotskih = 0;
    for (const p of POGOVORI) {
      const podjetje = p.podjetje ?? 'A1';
      const { d } = okolje({ podjetje, nastavitve: { ...structuredClone(NASTAVITVE), L3: { ...NASTAVITVE.A1 } } });
      const llm = llmAnthropic(process.env.GLAS_LLM_MODEL || 'claude-haiku-5-5', 15000);
      d.llm = () => llm;
      const zgodovina: string[] = [];
      let obrazec: OdprtObrazec | null = null;
      let shranjeno = false;
      let moznosti: { id: string; oznaka: string }[] = [];
      let preverjeno = true;
      console.log('\n════════');
      for (const [i, u] of p.ukazi.entries()) {
        if (obrazec && ukazObrazcu(u) === 'shrani') {
          shranjeno = true;
          console.log(`» ${u}\n  (brskalnik: requestSubmit obrazca)`);
          continue;
        }
        const t = Date.now();
        // Dotik možnosti (#ID) ali izbira po imenu, kot v brskalniku.
        const izbira = u.startsWith('#') ? moznosti.find((m) => m.id === u.slice(1)) ?? null : moznosti.length ? izberiMoznost(u, moznosti) : null;
        const besedilo = u.startsWith('#') ? (izbira?.oznaka ?? u) : u;
        const r = (await obdelajUkaz(
          { k: kontekst(podjetje === 'A1' ? {} : { podjetje, osebaId: null }), vhod: 'besedilo', besedilo, prejsnjiUkazi: [...zgodovina], odprtObrazec: obrazec, izbira },
          d
        )) as { ukazId?: string; status?: string; odgovor?: string; govor?: string; obrazec?: OdprtObrazec; vprasanje?: { moznosti?: { id: string; oznaka: string }[] } };
        if (r.ukazId) zgodovina.push(r.ukazId);
        if (r.obrazec) obrazec = r.obrazec;
        moznosti = r.vprasanje?.moznosti ?? [];
        const besedila = `${r.odgovor ?? ''}\n${r.govor ?? ''}`;
        if (p.odgovor?.[i] && !p.odgovor[i].test(besedila)) preverjeno = false;
        if (p.ne?.[i]?.test(besedila)) preverjeno = false;
        if (ROBOTSKO.test(r.govor ?? '')) robotskih++;
        console.log(`» ${u}\n  ${Date.now() - t} ms | ${r.status} | ${r.odgovor}\n  🔊 ${r.govor}`);
      }
      const ok = preverjeno && Object.entries(p.konec).every(([k, v]) => obrazec?.polja[k] === v) && (!p.shrani || shranjeno);
      if (ok) uspesnih++;
      console.log(`  ${ok ? 'OK' : 'NAROBE'} obrazec=${JSON.stringify(obrazec?.polja ?? null)}`);
    }
    console.log(`\nuspešnih ${uspesnih}/${POGOVORI.length}, robotskih odgovorov ${robotskih}`);
    expect(uspesnih).toBeGreaterThanOrEqual(POGOVORI.length - 1);
    expect(robotskih).toBe(0);
  }, 600_000);
});
