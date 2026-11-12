// app/api/glas/seja/route.ts
//
// Začetek pogovora (pritisk na gumb asistenta). Preveri prijavo, pravico, vklop
// in kvoto, nato vrne kratkotrajna Soniox ključa (razpoznava + glas) in namige
// za razpoznavo (imena strank s termini, zaposleni, storitve, izrazi).
// Kvota se tu ne porabi: šteje se vsak ukaz (/api/glas/ukaz).
//
// {samo: "tts"}: samo nov ključ za glas. Odprta STT povezava ostane veljavna tudi po
// poteku ključa, TTS pa ključ preveri ob vsakem govoru (preizkus 12. 11. 2026),
// zato ga brskalnik med pogovorom obnavlja v ozadju.

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { zberiNamige } from '@/lib/glas/jedro';
import { imaPravico } from '@/lib/glas/pravice';
import { opozoriloKvote } from '@/lib/glas/poraba';
import { NapakaPonudnika } from '@/lib/glas/ponudniki/skupno';
import { SONIOX, zacasniKljuc } from '@/lib/glas/ponudniki/soniox';
import { zdajVPasu } from '@/lib/glas/razresevanje/datumi';
import { kontekstIzSeje, preberiJson } from '@/lib/glas/streznik';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

/** Ključ mora le odpreti povezavo; brskalnik ga porabi takoj. */
const KLJUC_VELJA_S = 60;

const napaka = (status: number, koda: string, sporocilo: string) =>
  NextResponse.json({ ok: false, koda, sporocilo }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: NextRequest) {
  const omejitev = await rateLimit(req, 'ai');
  if (!omejitev.success) return napaka(429, 'prehitro', 'Preveč zahtevkov. Počakajte trenutek.');

  const telo = (await preberiJson(req, 256)) ?? {};
  const samoTts = telo.samo === 'tts';

  const kont = await kontekstIzSeje();
  if (!kont.ok) return kont.odziv;
  const { k, odvisnosti } = kont;
  if (!imaPravico(k, 'glas.uporaba')) return napaka(403, 'ni_pravice', 'Za glasovnega asistenta nimate pravice.');

  const seja = await createServerSupabaseClient();
  // Mesec se v SQL šteje po Europe/Ljubljana (jp_glas_rezerviraj_ukaz).
  const mesec = zdajVPasu(new Date(), 'Europe/Ljubljana').datum.slice(0, 7) + '-01';
  const [{ data: nast }, { data: poraba }, { data: uporabnik }] = await Promise.all([
    seja.from('glas_nastavitve_podjetja').select('vklopljeno, mesecna_kvota').eq('company_id', k.podjetje).maybeSingle(),
    seja.from('glas_poraba_mesec').select('ukazi').eq('company_id', k.podjetje).eq('mesec', mesec).maybeSingle(),
    seja.from('glas_nastavitve_uporabnika').select('vklopljeno').eq('company_id', k.podjetje).eq('user_id', k.userId).maybeSingle(),
  ]);
  if (nast?.vklopljeno !== true) return napaka(403, 'izklopljeno', 'Glasovni asistent za to podjetje ni vklopljen.');
  if (uporabnik && uporabnik.vklopljeno === false) {
    return napaka(403, 'uporabnik_izklopljen', 'Glasovni asistent je za vaš račun izklopljen.');
  }
  const kvota = Number(nast.mesecna_kvota ?? 0);
  const porabljeno = Number(poraba?.ukazi ?? 0);
  if (kvota > 0 && porabljeno >= kvota) {
    return napaka(402, 'kvota', opozoriloKvote(porabljeno, kvota) ?? 'Mesečna kvota je porabljena.');
  }

  const danes = zdajVPasu(new Date(), k.casovniPas).datum;
  try {
    if (samoTts) {
      const tts = await zacasniKljuc('tts_rt', KLJUC_VELJA_S);
      return NextResponse.json({ ok: true, tts: { kljuc: tts.kljuc } }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const [stt, tts, namigi] = await Promise.all([
      zacasniKljuc('transcribe_websocket', KLJUC_VELJA_S),
      zacasniKljuc('tts_rt', KLJUC_VELJA_S),
      zberiNamige(odvisnosti.podatki, danes, 100).catch(() => [] as string[]),
    ]);
    console.info(JSON.stringify({ glas: 'seja', podjetje: k.podjetje, namigov: namigi.length }));
    return NextResponse.json(
      {
        ok: true,
        jezik: 'sl',
        stt: { url: SONIOX.sttUrl, kljuc: stt.kljuc, model: SONIOX.sttModel, namigi, najdaljsiKonecMs: SONIOX.najdaljsiKonecMs },
        tts: { url: SONIOX.ttsUrl, kljuc: tts.kljuc, model: SONIOX.ttsModel, glas: SONIOX.glas, hitrost: SONIOX.hitrost },
        kvota,
        porabljeno,
        opozorilo: opozoriloKvote(porabljeno, kvota),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    const vrsta = e instanceof NapakaPonudnika ? e.vrsta : 'notranja';
    console.error(JSON.stringify({ glas: 'seja_napaka', vrsta }));
    return napaka(503, 'glas_ni_na_voljo', 'Glasovna povezava trenutno ne deluje. Poskusite znova čez trenutek.');
  }
}
