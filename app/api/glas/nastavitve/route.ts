// app/api/glas/nastavitve/route.ts
//
// Stran AI → Asistent+: vklop za podjetje, jezik in izklop posameznih članov.
//   GET  vsak član (bere svoje stanje); lastnik/admin dobi še seznam izklopljenih članov.
//   POST samo lastnik ali admin. Vklop je mogoč samo pri paketu Pro (ali višjem).
// glas_nastavitve_podjetja nima pravila za pisanje, zato zapiše service role — po
// preverjanju vloge in paketa tukaj. Vsaka sprememba gre v glas_revizija (samo ID-ji).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rateLimit';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { JEZIKI_ASISTENTA, JEZIKI_NA_VOLJO, KVOTA_PRO, jeJezikAsistenta, jezikZaPogovor } from '@/lib/glas/paket';
import { kontekstIzSeje, preberiJson, UUID } from '@/lib/glas/streznik';
import { zdajVPasu } from '@/lib/glas/razresevanje/datumi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BREZ_PREDPOMNILNIKA = { 'Cache-Control': 'no-store' };
const napaka = (status: number, koda: string) => NextResponse.json({ ok: false, koda }, { status, headers: BREZ_PREDPOMNILNIKA });

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  const kont = await kontekstIzSeje();
  if (!kont.ok) return kont.odziv;
  const { k, glasVPaketu } = kont;
  const urednik = k.vloga === 'owner' || k.vloga === 'admin';

  const seja = await createServerSupabaseClient();
  const mesec = zdajVPasu(new Date(), 'Europe/Ljubljana').datum.slice(0, 7) + '-01';
  const [{ data: nast }, { data: poraba }, { data: clani }] = await Promise.all([
    // '*': stolpec jezik pride z migracijo 1793600001; pred njo poizvedba ne sme pasti.
    seja.from('glas_nastavitve_podjetja').select('*').eq('company_id', k.podjetje).maybeSingle(),
    seja.from('glas_poraba_mesec').select('ukazi').eq('company_id', k.podjetje).eq('mesec', mesec).maybeSingle(),
    // RLS: lastnik/admin vidi vse vrstice podjetja, ostali samo svojo.
    seja.from('glas_nastavitve_uporabnika').select('user_id, vklopljeno').eq('company_id', k.podjetje),
  ]);
  const n = (nast ?? {}) as { vklopljeno?: boolean; jezik?: unknown; mesecna_kvota?: number };
  const izklopljeni = ((clani ?? []) as { user_id: string; vklopljeno: boolean }[]).filter((c) => !c.vklopljeno).map((c) => c.user_id);

  return NextResponse.json(
    {
      ok: true,
      urednik,
      paket: glasVPaketu,
      vklopljeno: n.vklopljeno === true,
      jezik: jezikZaPogovor(n.jezik),
      jeziki: JEZIKI_ASISTENTA,
      jezikiNaVoljo: JEZIKI_NA_VOLJO,
      jezikShranjen: 'jezik' in n,
      kvota: Number(n.mesecna_kvota ?? 0),
      porabljeno: Number(poraba?.ukazi ?? 0),
      jaz: { userId: k.userId, vklopljen: !izklopljeni.includes(k.userId) },
      // Zaposleni (staff) potrebujejo še pravico "Asistent+" v pravicah vlog (Nastavitve → Člani).
      pravicaZaposlenih: k.pravice?.can_access_asistent_plus === true,
      izklopljeniClani: urednik ? izklopljeni : [],
    },
    { headers: BREZ_PREDPOMNILNIKA }
  );
}

export async function POST(req: NextRequest) {
  const omejitev = await rateLimit(req, 'ai');
  if (!omejitev.success) return napaka(429, 'prehitro');

  const telo = await preberiJson(req, 1024);
  if (!telo) return napaka(400, 'neveljavno');

  const kont = await kontekstIzSeje();
  if (!kont.ok) return kont.odziv;
  const { k, glasVPaketu } = kont;
  if (k.vloga !== 'owner' && k.vloga !== 'admin') return napaka(403, 'samo_lastnik');

  const db = admin();

  // Izklop ali vklop posameznega člana.
  const clan = telo.clan as { userId?: unknown; vklopljeno?: unknown } | undefined;
  if (clan !== undefined) {
    if (typeof clan?.userId !== 'string' || !UUID.test(clan.userId) || typeof clan.vklopljeno !== 'boolean') {
      return napaka(400, 'neveljavno');
    }
    const { data: jeClan } = await db
      .from('company_members')
      .select('user_id')
      .eq('company_id', k.podjetjeUuid)
      .eq('user_id', clan.userId)
      .maybeSingle();
    if (!jeClan) return napaka(404, 'ni_clan');
    const { error } = await db.from('glas_nastavitve_uporabnika').upsert(
      { company_id: k.podjetje, user_id: clan.userId, vklopljeno: clan.vklopljeno, spremenil: k.userId, updated_at: new Date().toISOString() },
      { onConflict: 'company_id,user_id' }
    );
    if (error) return napaka(500, 'zapis');
    await revizija(db, k.podjetje, k.userId, { clan: clan.userId, vklopljeno: clan.vklopljeno });
    return NextResponse.json({ ok: true }, { headers: BREZ_PREDPOMNILNIKA });
  }

  // Nastavitve podjetja.
  const sprememba: Record<string, unknown> = {};
  if (telo.vklopljeno !== undefined) {
    if (typeof telo.vklopljeno !== 'boolean') return napaka(400, 'neveljavno');
    if (telo.vklopljeno && !glasVPaketu) return napaka(403, 'paket');
    sprememba.vklopljeno = telo.vklopljeno;
  }
  if (telo.jezik !== undefined) {
    if (!jeJezikAsistenta(telo.jezik)) return napaka(400, 'neveljavno');
    if (!JEZIKI_NA_VOLJO.includes(telo.jezik)) return napaka(400, 'jezik_kmalu');
    sprememba.jezik = telo.jezik;
  }
  if (Object.keys(sprememba).length === 0) return napaka(400, 'neveljavno');

  const { data: obstojece } = await db
    .from('glas_nastavitve_podjetja')
    .select('mesecna_kvota')
    .eq('company_id', k.podjetje)
    .maybeSingle();
  // Ob vklopu dobi podjetje kvoto paketa Pro; višja, ročno nastavljena ostane.
  if (sprememba.vklopljeno === true) sprememba.mesecna_kvota = Math.max(Number(obstojece?.mesecna_kvota ?? 0), KVOTA_PRO);

  const { error } = await db
    .from('glas_nastavitve_podjetja')
    .upsert({ company_id: k.podjetje, ...sprememba, updated_at: new Date().toISOString() }, { onConflict: 'company_id' });
  if (error) {
    // 42703 = stolpec ne obstaja: migracija 1793600001 (jezik) še ni pognana.
    return napaka(error.code === '42703' || error.code === 'PGRST204' ? 503 : 500, error.code === '42703' || error.code === 'PGRST204' ? 'migracija' : 'zapis');
  }
  await revizija(db, k.podjetje, k.userId, sprememba);
  return NextResponse.json({ ok: true }, { headers: BREZ_PREDPOMNILNIKA });
}

async function revizija(db: ReturnType<typeof admin>, podjetje: string, userId: string, podrobnosti: Record<string, unknown>) {
  const { error } = await db.from('glas_revizija').insert({ company_id: podjetje, user_id: userId, dogodek: 'nastavitve', podrobnosti });
  if (error) console.error(JSON.stringify({ glas: 'revizija_napaka', koda: error.code ?? 'napaka' }));
}
