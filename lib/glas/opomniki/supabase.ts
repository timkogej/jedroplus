// lib/glas/opomniki/supabase.ts
//
// Produkcijska shramba opomnikov: service role, a vsak klic je vezan na uporabnika
// in podjetje iz seje (nikoli iz zahteve ali modela). Branje je omejeno na
// user_id; zapis in preklic gresta prek SQL funkcij (migracija 1793700002).

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NAJVEC_OPOMNIKOV, type ShrambaOpomnikov } from './tipi';

export function shrambaOpomnikov(admin: SupabaseClient): ShrambaOpomnikov {
  return {
    async dodaj(o) {
      const { data, error } = await admin.rpc('jp_glas_dodaj_opomnik', {
        p_company: o.podjetje,
        p_company_uuid: o.podjetjeUuid,
        p_user: o.userId,
        p_besedilo: o.besedilo,
        p_ob: o.ob,
        p_termin: o.idTermina,
        p_stranka: o.idStranke,
        p_pas: o.casovniPas,
        p_jezik: o.jezik,
        p_ukaz: o.ukazId,
        p_najvec: NAJVEC_OPOMNIKOV,
      });
      if (error) throw new Error(`opomnik: ${error.code ?? 'napaka'}`);
      const r = data as { ok?: boolean; id?: string };
      return r?.ok && r.id ? { ok: true, id: r.id } : { ok: false, koda: 'omejitev' };
    },

    async cakajoci(podjetje, userId) {
      const { data, error } = await admin
        .from('glas_opomniki')
        .select('id, besedilo, ob, id_termina, id_stranke')
        .eq('company_id', podjetje)
        .eq('user_id', userId)
        .eq('stanje', 'caka')
        .order('ob', { ascending: true, nullsFirst: false })
        .limit(NAJVEC_OPOMNIKOV + 10);
      if (error) throw new Error(`opomniki: ${error.code ?? 'napaka'}`);
      return (data ?? []).map((r) => ({
        id: String(r.id),
        besedilo: String(r.besedilo),
        ob: r.ob ? String(r.ob) : null,
        idTermina: r.id_termina ? String(r.id_termina) : null,
        idStranke: r.id_stranke ? String(r.id_stranke) : null,
      }));
    },

    async preklici(podjetje, userId, id) {
      const { data, error } = await admin.rpc('jp_glas_preklici_opomnik', { p_id: id, p_company: podjetje, p_user: userId });
      if (error) throw new Error(`preklic opomnika: ${error.code ?? 'napaka'}`);
      return data === true;
    },

    async imaPush(podjetjeUuid, userId) {
      const { count, error } = await admin
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', podjetjeUuid)
        .eq('user_id', userId);
      if (error) return true; // ne vemo: raje brez opozorila
      return (count ?? 0) > 0;
    },

    async prejemnik(podjetjeUuid, idOsebe) {
      const { data, error } = await admin
        .from('company_members')
        .select('user_id')
        .eq('company_id', podjetjeUuid)
        .eq('person_id', idOsebe)
        .limit(2);
      if (error) throw new Error(`prejemnik: ${error.code ?? 'napaka'}`);
      // Dva računa na isti osebi: ne ugibamo.
      return data && data.length === 1 && data[0].user_id ? String(data[0].user_id) : null;
    },
  };
}
