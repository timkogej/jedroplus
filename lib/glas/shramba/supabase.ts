// lib/glas/shramba/supabase.ts
//
// Produkcijska shramba: SQL funkcije iz migracije 1793500000 prek service role.
// Člani teh tabel ne morejo pisati (RLS), zato je to edina pot do porabe in
// predlogov. Napaka pri reviziji ne sme podreti ukaza — se samo zabeleži.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ShrambaGlasa, ShranjenPredlog, ZacetekPotrditve, RezervacijaUkaza } from './tipi';
import { preberiIzid, preberiKontekst } from './tipi';

export function shrambaSupabase(admin: SupabaseClient): ShrambaGlasa {
  return {
    async rezervirajUkaz(podjetje, userId, vhod) {
      const { data, error } = await admin.rpc('jp_glas_rezerviraj_ukaz', { p_company: podjetje, p_user: userId, p_vhod: vhod });
      if (error) throw new Error(`rezervacija: ${error.code ?? 'napaka'}`);
      const r = data as Record<string, unknown>;
      if (r.ok === true) {
        return { ok: true, ukazId: String(r.ukaz_id), porabljeno: Number(r.porabljeno), kvota: Number(r.kvota) };
      }
      return {
        ok: false,
        koda: String(r.koda) as Extract<RezervacijaUkaza, { ok: false }>['koda'],
        porabljeno: r.porabljeno === undefined ? undefined : Number(r.porabljeno),
        kvota: r.kvota === undefined ? undefined : Number(r.kvota),
      };
    },

    async zakljuciUkaz(ukazId, z, vrniKvoto) {
      const { error } = await admin.rpc('jp_glas_zakljuci_ukaz', { p_ukaz: ukazId, p_podatki: z, p_vrni_kvoto: vrniKvoto });
      if (error) console.error(JSON.stringify({ glas: 'zakljuci_ukaz', koda: error.code, ukaz: ukazId }));
    },

    async prejsnjiUkaz(ukazId, userId, podjetje) {
      const beri = (stolpci: string) =>
        admin
          .from('glas_ukazi')
          .select(stolpci)
          .eq('id', ukazId)
          .eq('user_id', userId)
          .eq('company_id', podjetje)
          .gte('created_at', new Date(Date.now() - 5 * 60_000).toISOString())
          .maybeSingle();
      // Predlog tega ukaza (če ga je bil): ali ga je uporabnik potrdil z »ja« — sicer model misli, da ni shranjeno.
      const predlogP = admin
        .from('glas_predlogi')
        .select('status, rezultat')
        .eq('ukaz_id', ukazId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      let { data, error } = await beri('prepis, odgovor, kontekst, created_at');
      // Dokler migracija 1793600000 ni zagnana, stolpca kontekst ni: zgodovina dela brez fokusa.
      if (error?.code === '42703') ({ data, error } = await beri('prepis, odgovor, created_at'));
      const r = data as { prepis?: unknown; odgovor?: unknown; kontekst?: unknown } | null;
      if (!r?.prepis || !r?.odgovor) return null;
      const { data: pr } = await predlogP;
      const izid = pr ? preberiIzid((pr as { status?: unknown }).status, (pr as { rezultat?: unknown }).rezultat) : null;
      return { prepis: String(r.prepis), odgovor: String(r.odgovor), kontekst: preberiKontekst(r.kontekst), izid };
    },

    async ustvariPredlog(p) {
      const { data, error } = await admin
        .from('glas_predlogi')
        .insert({
          company_id: p.podjetje,
          user_id: p.userId,
          ukaz_id: p.ukazId,
          orodje: p.orodje,
          razred: p.razred,
          parametri: p.parametri,
          parametri_hash: p.parametriHash,
          zeton_hash: p.zetonHash,
          povzetek: p.povzetek,
          potece: p.potece.toISOString(),
        })
        .select('id')
        .single();
      if (error || !data) throw new Error(`predlog: ${error?.code ?? 'napaka'}`);
      return String(data.id);
    },

    async zacniPotrditev(predlogId, userId, zetonHash): Promise<ZacetekPotrditve> {
      const { data, error } = await admin.rpc('jp_glas_zacni_potrditev', {
        p_predlog: predlogId,
        p_user: userId,
        p_zeton_hash: zetonHash,
      });
      if (error) {
        // Neveljaven UUID ipd. — enako kot neobstoječ predlog.
        if (error.code === '22P02') return { ok: false, koda: 'ni_najden' };
        throw new Error(`potrditev: ${error.code ?? 'napaka'}`);
      }
      const r = data as Record<string, unknown>;
      if (r.ok === true) return { ok: true, predlog: r.predlog as ShranjenPredlog };
      return {
        ok: false,
        koda: String(r.koda) as Extract<ZacetekPotrditve, { ok: false }>['koda'],
        rezultat: r.rezultat,
        napaka: (r.napaka as string | null) ?? null,
      };
    },

    async zakljuciPotrditev(predlogId, status, rezultat, napaka) {
      const { error } = await admin.rpc('jp_glas_zakljuci_potrditev', {
        p_predlog: predlogId,
        p_status: status,
        p_rezultat: rezultat ?? null,
        p_napaka: napaka,
      });
      if (error) console.error(JSON.stringify({ glas: 'zakljuci_potrditev', koda: error.code, predlog: predlogId }));
    },

    async zavrniPredlog(predlogId, userId) {
      const { data, error } = await admin.rpc('jp_glas_zavrni_predlog', { p_predlog: predlogId, p_user: userId });
      if (error) return false;
      return data === true;
    },

    async revizija(z) {
      const { error } = await admin.from('glas_revizija').insert({
        company_id: z.podjetje,
        user_id: z.userId,
        ukaz_id: z.ukazId ?? null,
        predlog_id: z.predlogId ?? null,
        dogodek: z.dogodek,
        orodje: z.orodje ?? null,
        podrobnosti: z.podrobnosti ?? {},
      });
      if (error) console.error(JSON.stringify({ glas: 'revizija', koda: error.code }));
    },
  };
}
