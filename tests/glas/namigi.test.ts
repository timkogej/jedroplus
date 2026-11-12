// Namigi za STT: prednost, nedavne stranke, omejitev na 100, odpornost.
import { describe, expect, it } from 'vitest';
import { obdelajUkaz, zberiNamige } from '@/lib/glas/jedro';
import type { SttZahteva } from '@/lib/glas/ponudniki/stt';
import type { OsebaPovzetek, PodatkiSalona, StoritevPovzetek, TerminPovzetek } from '@/lib/glas/tipi';
import { DANES, kontekst, okolje, podatkiPomnilnik, ZVOK } from './pomoc';

const termin = (stranka: string, datum: string, status: TerminPovzetek['status'] = 'completed'): TerminPovzetek => ({
  id: `${stranka}-${datum}`, idStranke: null, stranka, datum, zacetek: '10:00', konec: '11:00', storitev: '', osebaId: 'o1', oseba: '', status, lokacijaId: null,
});
const oseba = (ime: string, aktivna = true): OsebaPovzetek => ({ id: ime, ime, priimek: '', aktivna, urnik: null, imaUrnikPodjetja: true, opravljaVse: true, storitve: [] });
const storitev = (naziv: string): StoritevPovzetek => ({ id: naziv, naziv, trajanjeMin: 60, aktivna: true });

function salon(o: { termini?: TerminPovzetek[]; osebe?: OsebaPovzetek[]; storitve?: StoritevPovzetek[]; napaka?: 'termini' | 'storitve' }) {
  const klici: { od: string; doo: string; padajoce: boolean }[] = [];
  const p: PodatkiSalona = {
    ...podatkiPomnilnik('A1'),
    async storitve() {
      if (o.napaka === 'storitve') throw new Error('x');
      return o.storitve ?? [];
    },
    async osebe() { return o.osebe ?? []; },
    async termini(od, doo, m) {
      klici.push({ od, doo, padajoce: Boolean(m?.padajoce) });
      if (o.napaka === 'termini') throw new Error('x');
      const r = (o.termini ?? []).filter((t) => t.datum >= od && t.datum <= doo).sort((a, b) => a.datum.localeCompare(b.datum));
      return m?.padajoce ? r.reverse() : r;
    },
  };
  return { p, klici };
}

describe('namigi za STT', () => {
  it('vrstni red: jutrišnje stranke, zaposleni, izrazi, storitve, nedavne stranke', async () => {
    const { p } = salon({
      termini: [termin('Nedavna Stranka', '2026-11-05'), termin('Jutrišnja Stranka', '2026-11-13', 'scheduled')],
      osebe: [oseba('Tina'), oseba('Bivša', false)],
      storitve: [storitev('Barvanje')],
    });
    const n = await zberiNamige(p, DANES);
    expect(n[0]).toBe('Jutrišnja Stranka');
    expect(n[1]).toBe('Tina');
    expect(n).not.toContain('Bivša');
    expect(n.indexOf('oksidant')).toBeLessThan(n.indexOf('Barvanje'));
    expect(n.at(-1)).toBe('Nedavna Stranka');
  });

  it('nedavne: najnovejše najprej, ob istem dnevu pogostejše; brez odpovedanih in neprihodov', async () => {
    const { p } = salon({
      termini: [
        termin('Stara', '2026-10-01'),
        termin('Redka', '2026-11-10'),
        termin('Pogosta', '2026-11-10'), termin('Pogosta', '2026-10-20'),
        termin('Odpovedana', '2026-11-11', 'cancelled'),
        termin('Ni prišla', '2026-11-11', 'no_show'),
        termin('Prestara', '2026-09-01'), // več kot 45 dni nazaj
      ],
    });
    const n = await zberiNamige(p, DANES);
    const stranke = n.filter((x) => ['Stara', 'Redka', 'Pogosta', 'Odpovedana', 'Ni prišla', 'Prestara'].includes(x));
    expect(stranke).toEqual(['Pogosta', 'Redka', 'Stara']);
  });

  it('odpovedan jutrišnji termin ni prednosten, stranka brez podvajanja', async () => {
    const { p } = salon({
      termini: [termin('Ana Novak', '2026-11-13', 'cancelled'), termin('Ana Novak', '2026-11-01'), termin('Mateja Kos', '2026-11-13', 'scheduled'), termin('Mateja Kos', '2026-11-02')],
    });
    const n = await zberiNamige(p, DANES);
    expect(n[0]).toBe('Mateja Kos');
    expect(n.filter((x) => x === 'Mateja Kos')).toHaveLength(1);
    expect(n).toContain('Ana Novak'); // kot nedavna
  });

  it('največ 100; bližnje stranke ostanejo, storitev največ 30', async () => {
    const pretekli = Array.from({ length: 300 }, (_, i) => termin(`Stranka ${i}`, `2026-11-${String(1 + (i % 11)).padStart(2, '0')}`));
    const { p } = salon({
      termini: [...pretekli, termin('Jutri Prva', '2026-11-13', 'scheduled')],
      osebe: [oseba('Tina')],
      storitve: Array.from({ length: 50 }, (_, i) => storitev(`Storitev ${i}`)),
    });
    const n = await zberiNamige(p, DANES);
    expect(n).toHaveLength(100);
    expect(n[0]).toBe('Jutri Prva');
    expect(n.filter((x) => x.startsWith('Storitev '))).toHaveLength(30);
    expect(new Set(n.map((x) => x.toLowerCase())).size).toBe(100);
  });

  it('pretekle termine bere od najnovejših (omejitev 2000 ne odreže zadnjih tednov)', async () => {
    const { p, klici } = salon({});
    await zberiNamige(p, DANES);
    expect(klici).toContainEqual({ od: '2026-11-12', doo: '2026-11-13', padajoce: false });
    expect(klici).toContainEqual({ od: '2026-09-28', doo: '2026-11-11', padajoce: true });
  });

  it('predolga ali večbesedna imena izpusti; napaka enega vira ne podre ostalih', async () => {
    const { p } = salon({
      napaka: 'storitve',
      termini: [termin('x'.repeat(60), '2026-11-13', 'scheduled'), termin('Ena dva tri štiri pet šest', '2026-11-13', 'scheduled'), termin('Maja Krajnc', '2026-11-13', 'scheduled')],
    });
    const n = await zberiNamige(p, DANES);
    expect(n[0]).toBe('Maja Krajnc');
    expect(n).toContain('oksidant');
  });

  it('jedro pošlje namige ponudniku STT (ne več kot 100)', async () => {
    let prejeto: SttZahteva | null = null;
    const env = okolje({ stt: { ime: 'lazni', async prepisi(z) { prejeto = z; return { besedilo: 'kaj imam jutri', sekunde: 2, zNamigi: true }; } } });
    await obdelajUkaz({ k: kontekst(), vhod: 'aplikacija', zvok: ZVOK }, env.d);
    expect(prejeto).not.toBeNull();
    const n = prejeto!.namigi;
    expect(n.length).toBeLessThanOrEqual(100);
    expect(n.slice(0, 2)).toEqual(['Mateja Kovačič', 'Ana Novak']); // jutrišnji termini
    expect(n).not.toContain('Špela Žagar'); // jutri odpovedan, prej ni bila
    expect(n).not.toContain('Mateja Tuja'); // drugo podjetje
  });
});
