// lib/glas/streznik.ts
//
// Povezava API poti z jedrom: kontekst iz seje (nikoli iz telesa zahteve),
// odvisnosti (shramba s service role samo za knjigo ukazov; podatki salona z
// uporabnikovo sejo, da velja RLS).
//
// Namenoma samo piškotna seja (brez Bearer): podatki salona se berejo z
// uporabnikovo sejo, Bearer žetona pa strežniški odjemalec ne prenese naprej.

import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { fetchCompanyRegionServer } from '@/lib/region.server';
import type { StaffPermissions } from '@/types/roles';
import { izberiLlm } from './ponudniki/llm';
import { izberiStt } from './ponudniki/stt';
import { izberiTts } from './ponudniki/tts';
import { preberiKonfiguracijo } from './konfiguracija';
import { podatkiSupabase } from './podatki/supabase';
import { shrambaSupabase } from './shramba/supabase';
import type { Odvisnosti } from './jedro';
import type { Kontekst, Vloga } from './tipi';

function adminOdjemalec() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type IzidKonteksta =
  | { ok: true; k: Kontekst; odvisnosti: Odvisnosti }
  | { ok: false; odziv: NextResponse };

const napaka = (status: number, koda: string, sporocilo: string) =>
  NextResponse.json({ ok: false, koda, sporocilo }, { status });

export async function kontekstIzSeje(): Promise<IzidKonteksta> {
  const seja = await createServerSupabaseClient();
  const {
    data: { user },
  } = await seja.auth.getUser();
  if (!user) return { ok: false, odziv: napaka(401, 'ni_prijave', 'Niste prijavljeni.') };

  const admin = adminOdjemalec();
  const { data: clan } = await admin
    .from('company_members')
    .select('company_id, role, person_id')
    .eq('user_id', user.id)
    .maybeSingle();
  const vloga = (clan?.role as string | undefined) ?? null;
  if (!clan?.company_id || (vloga !== 'owner' && vloga !== 'admin' && vloga !== 'staff')) {
    return { ok: false, odziv: napaka(403, 'ni_clan', 'Niste član podjetja.') };
  }
  const { data: podjetje } = await admin.from('companies').select('company_id').eq('id', clan.company_id).maybeSingle();
  const besedilniId = (podjetje?.company_id as string | undefined) ?? null;
  if (!besedilniId) return { ok: false, odziv: napaka(403, 'ni_clan', 'Podjetje ni najdeno.') };

  const [{ data: pravice }, regija] = await Promise.all([
    admin.from('staff_role_permissions').select('*').eq('company_id', clan.company_id).maybeSingle(),
    fetchCompanyRegionServer(seja, besedilniId),
  ]);

  const k: Kontekst = {
    podjetje: besedilniId,
    podjetjeUuid: String(clan.company_id),
    userId: user.id,
    email: user.email ?? null,
    vloga: vloga as Vloga,
    pravice: (pravice as StaffPermissions | null) ?? null,
    osebaId: clan.person_id ? String(clan.person_id) : null,
    casovniPas: regija.timezone,
    zdaj: new Date(),
  };

  const konf = preberiKonfiguracijo();
  const odvisnosti: Odvisnosti = {
    konf,
    stt: () => izberiStt(konf),
    llm: () => izberiLlm(konf),
    tts: () => izberiTts(konf),
    shramba: shrambaSupabase(admin),
    podatki: podatkiSupabase(seja, besedilniId),
  };
  return { ok: true, k, odvisnosti };
}

/** Telo JSON z omejeno velikostjo (zaščita pred velikimi zahtevki). */
export async function preberiJson(req: Request, najvec = 4096): Promise<Record<string, unknown> | null> {
  const dolzina = Number(req.headers.get('content-length') ?? '0');
  if (dolzina > najvec) return null;
  const besedilo = await req.text();
  if (besedilo.length > najvec) return null;
  try {
    const v = JSON.parse(besedilo);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
