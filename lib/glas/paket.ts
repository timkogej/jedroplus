// lib/glas/paket.ts
//
// Asistent+ je vključen v paket Pro (in višje); Plus in Free ga nimata
// (Timova odločitev 14. 11. 2026). Vklop na strani AI je zato mogoč samo pri
// Pro, strežnik pa paket preveri tudi ob vsaki seji in ukazu — podjetje, ki
// preide s Pro na Plus, asistenta izgubi, čeprav je v nastavitvah še vklopljen.

import type { SupabaseClient } from '@supabase/supabase-js';
import { planAtLeast, type PlanCode } from '@/lib/planAccess';

export const GLAS_NAJNIZJI_PAKET: PlanCode = 'JEDRO_PRO';

/** Mesečna kvota ukazov, ki jo podjetje dobi ob vklopu (Pro). Višje ročno nastavljene ostanejo. */
export const KVOTA_PRO = 1000;

/** Jeziki, ki jih je mogoče izbrati; `JEZIKI_NA_VOLJO` že delujejo, ostali so "kmalu". */
export const JEZIKI_ASISTENTA = ['sl', 'en', 'de', 'it', 'hr'] as const;
export type JezikAsistenta = (typeof JEZIKI_ASISTENTA)[number];
export const JEZIKI_NA_VOLJO: readonly JezikAsistenta[] = ['sl'];

export function jeJezikAsistenta(x: unknown): x is JezikAsistenta {
  return typeof x === 'string' && (JEZIKI_ASISTENTA as readonly string[]).includes(x);
}

/** Jezik, v katerem asistent dejansko teče: izbrani, če že deluje, sicer slovenščina. */
export function jezikZaPogovor(izbran: unknown): JezikAsistenta {
  return jeJezikAsistenta(izbran) && JEZIKI_NA_VOLJO.includes(izbran) ? izbran : 'sl';
}

export function paketDovoliGlas(koda: string | null | undefined): boolean {
  return planAtLeast(koda ? koda.toUpperCase().replace(/[\s-]+/g, '_') : null, GLAS_NAJNIZJI_PAKET);
}

// Paket se spremeni redko (Stripe), ukazi pa pridejo vsakih nekaj sekund: kratek
// predpomnilnik v procesu prihrani poizvedbo na ukaz. Spremembo paketa strežnik
// upošteva najkasneje po minuti.
const PREDPOMNILNIK_MS = 60_000;
const predpomnilnik = new Map<string, { koda: string | null; cas: number }>();

/** Koda aktivnega paketa podjetja (npr. "JEDRO_PRO") ali null. `podjetjeUuid` = companies.id. */
export async function paketPodjetja(admin: SupabaseClient, podjetjeUuid: string, zdaj = Date.now()): Promise<string | null> {
  const v = predpomnilnik.get(podjetjeUuid);
  if (v && zdaj - v.cas < PREDPOMNILNIK_MS) return v.koda;
  const { data, error } = await admin
    .from('company_subscriptions')
    .select('status, plan:plans(code)')
    .eq('company_id', podjetjeUuid)
    .eq('status', 'active')
    .limit(1);
  if (error) throw new Error(`paket: ${error.code ?? 'napaka'}`);
  const vrstica = (data ?? [])[0] as { plan?: { code?: string } | { code?: string }[] | null } | undefined;
  const plan = Array.isArray(vrstica?.plan) ? vrstica?.plan[0] : vrstica?.plan;
  const koda = plan?.code ? String(plan.code).toUpperCase().replace(/[\s-]+/g, '_') : null;
  predpomnilnik.set(podjetjeUuid, { koda, cas: zdaj });
  return koda;
}

/** Po spremembi na strani AI (ali v testih) naj se paket prebere znova. */
export function pozabiPaket(podjetjeUuid?: string): void {
  if (podjetjeUuid) predpomnilnik.delete(podjetjeUuid);
  else predpomnilnik.clear();
}
