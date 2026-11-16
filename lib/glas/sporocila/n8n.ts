// lib/glas/sporocila/n8n.ts
//
// Produkcijski pošiljatelj: omejitev v SQL (service role), pošiljanje prek n8n
// toka glas-sporocilo s podpisom HMAC (kot Receptionist+ – SMS stranki, a z
// ločenim ključem GLAS_N8N_HMAC_SECRET). V dnevnik gre samo koda izida —
// nikoli telefon, e-naslov ali besedilo.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { izidIzOdgovora, podpisi } from './protokol';
import type { IzidPosiljanja, PosiljateljSporocil, ZahtevaPosiljanja } from './tipi';
import { OMEJITEV_NA_PODJETJE, OMEJITEV_NA_STRANKO } from './tipi';

const PRIVZET_URL = 'https://n8n.jedroplus.com/webhook/glas-sporocilo';
const CAKAJ_MS = 15_000;

export function posiljateljN8n(admin: SupabaseClient, okolje: Record<string, string | undefined> = process.env): PosiljateljSporocil {
  return {
    async rezerviraj(p) {
      const { data, error } = await admin.rpc('jp_glas_rezerviraj_sporocilo', {
        p_company: p.podjetje,
        p_user: p.userId,
        p_ukaz: p.ukazId,
        p_stranka: p.idStranke,
        p_termin: p.idTermina,
        p_kanal: p.kanal,
        p_dolzina: p.dolzina,
        p_na_stranko: OMEJITEV_NA_STRANKO,
        p_na_podjetje: OMEJITEV_NA_PODJETJE,
      });
      if (error) throw new Error(`rezervacija sporočila: ${error.code ?? 'napaka'}`);
      const r = data as { ok?: boolean; id?: string; koda?: string };
      if (r?.ok && r.id) return { ok: true, id: r.id };
      return { ok: false, koda: r?.koda === 'stranka' ? 'stranka' : 'podjetje' };
    },

    async poslji(z: ZahtevaPosiljanja) {
      const izid = await poslji(z, okolje);
      const razlog = izid.status === 'poslano' ? null : izid.razlog;
      const { error } = await admin.rpc('jp_glas_zakljuci_sporocilo', { p_id: z.id, p_status: izid.status, p_razlog: razlog });
      if (error) console.error(JSON.stringify({ glas: 'sporocilo', id: z.id, zakljucek: error.code ?? 'napaka' }));
      console.log(JSON.stringify({ glas: 'sporocilo', id: z.id, kanal: z.kanal, status: izid.status, razlog }));
      return izid;
    },
  };
}

async function poslji(z: ZahtevaPosiljanja, okolje: Record<string, string | undefined>): Promise<IzidPosiljanja> {
  const skrivnost = okolje.GLAS_N8N_HMAC_SECRET;
  if (!skrivnost) return { status: 'napaka', razlog: 'ni_nastavljeno' };
  const telo = JSON.stringify({
    id: z.id,
    company_id: z.podjetje,
    kanal: z.kanal,
    to: z.prejemnik,
    text: z.besedilo,
    subject: z.zadeva,
    company_name: z.imeSalona,
    language: z.jezik,
    client_id: z.idStranke,
    termin_id: z.idTermina,
  });
  const ts = String(Math.floor(Date.now() / 1000));
  try {
    const r = await fetch(okolje.GLAS_N8N_SPOROCILO_URL || PRIVZET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-timestamp': ts, 'x-signature': podpisi(skrivnost, ts, telo) },
      body: telo,
      signal: AbortSignal.timeout(CAKAJ_MS),
      cache: 'no-store',
    });
    if (!r.ok) return { status: r.status >= 500 ? 'neznano' : 'napaka', razlog: `http_${r.status}` };
    return izidIzOdgovora(await r.json().catch(() => null));
  } catch (e) {
    // Časovna omejitev ali prekinjena povezava: n8n je morda že poslal.
    return { status: 'neznano', razlog: e instanceof Error && e.name === 'TimeoutError' ? 'cas' : 'povezava' };
  }
}
