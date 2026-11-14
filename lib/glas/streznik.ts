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
import { paketDovoliGlas, paketPodjetja } from './paket';
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
  /** `glasVPaketu`: paket podjetja vključuje Asistent+ (Pro+); ob napaki branja paketa true (ne zapremo asistenta zaradi izpada). */
  | { ok: true; k: Kontekst; odvisnosti: Odvisnosti; glasVPaketu: boolean }
  | { ok: false; odziv: NextResponse };

const napaka = (status: number, koda: string, sporocilo: string) =>
  NextResponse.json({ ok: false, koda, sporocilo }, { status });

export async function kontekstIzSeje(): Promise<IzidKonteksta> {
  const seja = await createServerSupabaseClient();
  // getClaims preveri žeton lokalno (asimetrični ključi projekta, kot lib/auth/serverUser),
  // brez klica na Supabase Auth; s starim žetonom sam vpraša Supabase.
  const { data: zahtevki, error: napakaPrijave } = await seja.auth.getClaims();
  const userId = typeof zahtevki?.claims?.sub === 'string' ? zahtevki.claims.sub : null;
  if (napakaPrijave || !userId) return { ok: false, odziv: napaka(401, 'ni_prijave', 'Niste prijavljeni.') };
  const email = typeof zahtevki?.claims?.email === 'string' ? zahtevki.claims.email : null;

  const admin = adminOdjemalec();
  // Član in besedilni ID podjetja v eni poizvedbi (en krog manj).
  const { data: clan } = await admin
    .from('company_members')
    .select('company_id, role, person_id, companies(company_id)')
    .eq('user_id', userId)
    .maybeSingle();
  const vloga = (clan?.role as string | undefined) ?? null;
  if (!clan?.company_id || (vloga !== 'owner' && vloga !== 'admin' && vloga !== 'staff')) {
    return { ok: false, odziv: napaka(403, 'ni_clan', 'Niste član podjetja.') };
  }
  const podjetje = (Array.isArray(clan.companies) ? clan.companies[0] : clan.companies) as { company_id?: string } | null | undefined;
  const besedilniId = podjetje?.company_id ?? null;
  if (!besedilniId) return { ok: false, odziv: napaka(403, 'ni_clan', 'Podjetje ni najdeno.') };

  const [{ data: pravice }, regija, glasVPaketu] = await Promise.all([
    admin.from('staff_role_permissions').select('*').eq('company_id', clan.company_id).maybeSingle(),
    fetchCompanyRegionServer(seja, besedilniId),
    paketPodjetja(admin, String(clan.company_id)).then(paketDovoliGlas, () => true),
  ]);

  const k: Kontekst = {
    podjetje: besedilniId,
    podjetjeUuid: String(clan.company_id),
    userId,
    email,
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
  return { ok: true, k, odvisnosti, glasVPaketu };
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
