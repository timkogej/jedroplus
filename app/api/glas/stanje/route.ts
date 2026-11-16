// app/api/glas/stanje/route.ts
//
// Ali je asistent na voljo temu uporabniku in koliko kvote je porabljene.
// Bere z uporabnikovo sejo (RLS na glas_* tabelah).

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { imaPravico } from '@/lib/glas/pravice';
import { opozoriloKvote } from '@/lib/glas/poraba';
import { kontekstIzSeje } from '@/lib/glas/streznik';
import { zdajVPasu } from '@/lib/glas/razresevanje/datumi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const kont = await kontekstIzSeje();
  if (!kont.ok) return kont.odziv;
  const { k, glasVPaketu } = kont;

  const seja = await createServerSupabaseClient();
  // Mesec se v SQL šteje po Europe/Ljubljana (jp_glas_rezerviraj_ukaz).
  const mesec = zdajVPasu(new Date(), 'Europe/Ljubljana').datum.slice(0, 7) + '-01';
  const [{ data: nast }, { data: poraba }, { data: uporabnik }] = await Promise.all([
    seja.from('glas_nastavitve_podjetja').select('vklopljeno, mesecna_kvota, tts_vklopljen').eq('company_id', k.podjetje).maybeSingle(),
    seja.from('glas_poraba_mesec').select('ukazi').eq('company_id', k.podjetje).eq('mesec', mesec).maybeSingle(),
    seja.from('glas_nastavitve_uporabnika').select('vklopljeno').eq('company_id', k.podjetje).eq('user_id', k.userId).maybeSingle(),
  ]);
  const kvota = Number(nast?.mesecna_kvota ?? 0);
  const porabljeno = Number(poraba?.ukazi ?? 0);
  return NextResponse.json(
    {
      ok: true,
      // Na voljo samo pri paketu Pro+, vklopljenem podjetju in neizklopljenem članu (stran AI).
      vklopljeno: nast?.vklopljeno === true && glasVPaketu && uporabnik?.vklopljeno !== false,
      paket: glasVPaketu,
      pravica: imaPravico(k, 'glas.uporaba'),
      kvota,
      porabljeno,
      opozorilo: opozoriloKvote(porabljeno, kvota),
      tts: nast?.tts_vklopljen === true,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
