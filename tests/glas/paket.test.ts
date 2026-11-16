// Asistent+ je vključen v Pro (in višje); jezik pogovora je izbrani, če že deluje.
import { afterEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { jezikZaPogovor, paketDovoliGlas, paketPodjetja, pozabiPaket } from '@/lib/glas/paket';

afterEach(() => pozabiPaket());

describe('paket za Asistent+', () => {
  it('Pro in Premium da, Plus, Free in neznano ne', () => {
    expect(paketDovoliGlas('JEDRO_PRO')).toBe(true);
    expect(paketDovoliGlas('jedro-pro')).toBe(true);
    expect(paketDovoliGlas('JEDRO_PREMIUM')).toBe(true);
    expect(paketDovoliGlas('JEDRO_PLUS')).toBe(false);
    expect(paketDovoliGlas('FREE')).toBe(false);
    expect(paketDovoliGlas(null)).toBe(false);
    expect(paketDovoliGlas('NEKAJ')).toBe(false);
  });

  it('paket podjetja se prebere enkrat na minuto (predpomnilnik)', async () => {
    let klicev = 0;
    const veriga = {
      select: () => veriga,
      eq: () => veriga,
      limit: async () => {
        klicev++;
        return { data: [{ status: 'active', plan: { code: 'jedro pro' } }], error: null };
      },
    };
    const db = { from: () => veriga } as unknown as SupabaseClient;
    expect(await paketPodjetja(db, 'p1', 0)).toBe('JEDRO_PRO');
    expect(await paketPodjetja(db, 'p1', 30_000)).toBe('JEDRO_PRO');
    expect(klicev).toBe(1);
    expect(await paketPodjetja(db, 'p1', 61_000)).toBe('JEDRO_PRO');
    expect(klicev).toBe(2);
  });

  it('brez aktivne naročnine → null', async () => {
    const veriga = { select: () => veriga, eq: () => veriga, limit: async () => ({ data: [], error: null }) };
    const db = { from: () => veriga } as unknown as SupabaseClient;
    expect(await paketPodjetja(db, 'p2')).toBeNull();
  });
});

describe('jezik pogovora', () => {
  it('vsi jeziki delujejo; neveljavni padejo na slovenščino', () => {
    for (const j of ['sl', 'en', 'de', 'it', 'hr']) expect(jezikZaPogovor(j)).toBe(j);
    expect(jezikZaPogovor(undefined)).toBe('sl');
    expect(jezikZaPogovor('xx')).toBe('sl');
  });
});
