// lib/glas/shramba/pomnilnik.ts
//
// Shramba v pomnilniku za teste. Obnašanje mora ustrezati SQL funkcijam v
// migraciji 1793500000 (preizkušene posebej: tests/glas/sql/zazeni.sh).

import { randomUUID } from 'node:crypto';
import type {
  NovPredlog, RezervacijaUkaza, ShrambaGlasa, ShranjenPredlog, ZacetekPotrditve, ZakljucekUkaza, ZapisRevizije,
} from './tipi';
import { preberiIzid, preberiKontekst } from './tipi';

interface Ukaz { id: string; podjetje: string; userId: string; ustvarjen: number; steje: boolean; zakljucen: ZakljucekUkaza | null }
interface Predlog extends ShranjenPredlog { zeton_hash: string; status: string; potece: number; rezultat: unknown; napaka: string | null }

export interface NastavitvePomnilnik {
  vklopljeno: boolean;
  kvota: number;
  naMinuto: number;
  izklopljeni?: string[];
}

export function shrambaVPomnilniku(nastavitve: Record<string, NastavitvePomnilnik>, ura: () => number = Date.now) {
  const ukazi = new Map<string, Ukaz>();
  const predlogi = new Map<string, Predlog>();
  const poraba = new Map<string, number>();
  const revizije: ZapisRevizije[] = [];

  const s: ShrambaGlasa & {
    ukazi: Map<string, Ukaz>; predlogi: Map<string, Predlog>; poraba: Map<string, number>; revizije: ZapisRevizije[];
  } = {
    ukazi, predlogi, poraba, revizije,

    async rezervirajUkaz(podjetje: string, userId: string): Promise<RezervacijaUkaza> {
      const n = nastavitve[podjetje];
      if (!n || !n.vklopljeno) return { ok: false, koda: 'izklopljeno' };
      if (n.izklopljeni?.includes(userId)) return { ok: false, koda: 'uporabnik_izklopljen' };
      const zadnja = [...ukazi.values()].filter((u) => u.userId === userId && u.ustvarjen > ura() - 60_000).length;
      if (zadnja >= n.naMinuto) return { ok: false, koda: 'prehitro' };
      const p = poraba.get(podjetje) ?? 0;
      if (p >= n.kvota) return { ok: false, koda: 'kvota', porabljeno: p, kvota: n.kvota };
      poraba.set(podjetje, p + 1);
      const id = randomUUID();
      ukazi.set(id, { id, podjetje, userId, ustvarjen: ura(), steje: true, zakljucen: null });
      return { ok: true, ukazId: id, porabljeno: p + 1, kvota: n.kvota };
    },

    async zakljuciUkaz(ukazId, z, vrniKvoto) {
      const u = ukazi.get(ukazId);
      if (!u || u.zakljucen) return;
      if (vrniKvoto && u.steje) {
        poraba.set(u.podjetje, (poraba.get(u.podjetje) ?? 1) - 1);
        u.steje = false;
      }
      u.zakljucen = z;
    },

    async prejsnjiUkaz(ukazId, userId, podjetje) {
      const u = ukazi.get(ukazId);
      if (!u || u.userId !== userId || u.podjetje !== podjetje || !u.zakljucen || u.ustvarjen < ura() - 5 * 60_000) return null;
      if (!u.zakljucen.prepis || !u.zakljucen.odgovor) return null;
      const p = [...predlogi.values()].filter((x) => x.ukaz_id === ukazId && x.user_id === userId).at(-1);
      return { prepis: u.zakljucen.prepis, odgovor: u.zakljucen.odgovor, kontekst: preberiKontekst(u.zakljucen.kontekst), izid: p ? preberiIzid(p.status, p.rezultat) : null };
    },

    async ustvariPredlog(p: NovPredlog) {
      const id = randomUUID();
      predlogi.set(id, {
        id, company_id: p.podjetje, user_id: p.userId, ukaz_id: p.ukazId, orodje: p.orodje, parametri: p.parametri,
        parametri_hash: p.parametriHash, povzetek: p.povzetek, zeton_hash: p.zetonHash, status: 'caka',
        potece: p.potece.getTime(), rezultat: null, napaka: null,
      });
      return id;
    },

    async zacniPotrditev(predlogId, userId, zetonHash): Promise<ZacetekPotrditve> {
      const p = predlogi.get(predlogId);
      if (!p || p.user_id !== userId || p.zeton_hash !== zetonHash) return { ok: false, koda: 'ni_najden' };
      if (p.status === 'caka' && p.potece > ura()) {
        p.status = 'izvaja';
        return { ok: true, predlog: structuredClone(p) };
      }
      if (p.status === 'caka') {
        p.status = 'poteklo';
        return { ok: false, koda: 'poteklo' };
      }
      return { ok: false, koda: p.status as 'izvedeno', rezultat: p.rezultat, napaka: p.napaka };
    },

    async zakljuciPotrditev(predlogId, status, rezultat, napaka) {
      const p = predlogi.get(predlogId);
      if (!p || p.status !== 'izvaja') return;
      p.status = status;
      p.rezultat = rezultat;
      p.napaka = napaka;
    },

    async zavrniPredlog(predlogId, userId) {
      const p = predlogi.get(predlogId);
      if (!p || p.user_id !== userId || p.status !== 'caka') return false;
      p.status = 'zavrnjeno';
      return true;
    },

    async revizija(z) {
      revizije.push(z);
    },
  };
  return s;
}
