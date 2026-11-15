// app/api/glas/seja/route.ts
//
// Začetek pogovora (pritisk na gumb asistenta). Preveri prijavo, pravico, vklop
// in kvoto, nato vrne kratkotrajna Soniox ključa (razpoznava + glas) in namige
// za razpoznavo (imena strank s termini, zaposleni, storitve, izrazi).
// Kvota se tu ne porabi: šteje se vsak ukaz (/api/glas/ukaz).
//
// {samo: "tts"}: samo nov ključ za glas. Odprta STT povezava ostane veljavna tudi po
// poteku ključa, TTS pa ključ preveri ob vsakem govoru (preizkus 12. 11. 2026),
// zato ga brskalnik med daljšim pogovorom obnavlja v ozadju.
//
// Brskalnik sejo kliče vnaprej (ko se pokaže gumb asistenta), ne šele ob tapu.

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { zberiNamige } from '@/lib/glas/jedro';
import { imaPravico } from '@/lib/glas/pravice';
import { opozoriloKvote } from '@/lib/glas/poraba';
import { NapakaPonudnika } from '@/lib/glas/ponudniki/skupno';
import { SONIOX, zacasniKljuc } from '@/lib/glas/ponudniki/soniox';
import { zdajVPasu } from '@/lib/glas/razresevanje/datumi';
import { jezikZaPogovor } from '@/lib/glas/paket';
import { kontekstIzSeje, preberiJson } from '@/lib/glas/streznik';
import { govorOpomnikov, neprebraniOpomniki } from '@/lib/glas/opomniki/neprebrani';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

/**
 * Brskalnik sejo pripravi vnaprej (ko se gumb asistenta pokaže), da je pogovor
 * ob tapu takoj pripravljen; zato ključa veljata 5 minut. Ključ je omejen na
 * razpoznavo oz. glas in odpre le povezavo (preizkus 13. 11. 2026: isti ključ
 * odpre več povezav). Brskalnik sejo osveži pred potekom.
 */
const KLJUC_VELJA_S = 300;

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
  if (!kont.glasVPaketu) return napaka(403, 'paket', 'Asistent+ je vključen v paket Pro.');

  const seja = await createServerSupabaseClient();
  // Mesec se v SQL šteje po Europe/Ljubljana (jp_glas_rezerviraj_ukaz).
  const mesec = zdajVPasu(new Date(), 'Europe/Ljubljana').datum.slice(0, 7) + '-01';
  const danes = zdajVPasu(new Date(), k.casovniPas).datum;
  // Nastavitve, kvota, ključa in namigi vzporedno (en krog namesto treh). Ključa
  // nastanejo tudi, če je asistent izklopljen; takrat ju preprosto ne vrnemo.
  const kljuci = samoTts
    ? Promise.all([null, zacasniKljuc('tts_rt', KLJUC_VELJA_S)] as const)
    : Promise.all([zacasniKljuc('transcribe_websocket', KLJUC_VELJA_S), zacasniKljuc('tts_rt', KLJUC_VELJA_S)] as const);
  kljuci.catch(() => {}); // obravnavano spodaj; brez nerešene zavrnitve ob zgodnjem izhodu
  const namigiP = samoTts ? Promise.resolve([] as string[]) : zberiNamige(odvisnosti.podatki, danes, 100).catch(() => [] as string[]);
  // Neprebrani osebni opomniki (zadnjih 12 ur): asistent jih pove ob odprtju.
  const opomnikiP = samoTts ? Promise.resolve([]) : neprebraniOpomniki(seja, k.userId, k.podjetjeUuid).catch(() => []);
  const [{ data: nast }, { data: poraba }, { data: uporabnik }] = await Promise.all([
    // '*': stolpec jezik pride z migracijo 1793600001; pred njo poizvedba ne sme pasti.
    seja.from('glas_nastavitve_podjetja').select('*').eq('company_id', k.podjetje).maybeSingle(),
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

  try {
    const [[stt, tts], namigi, opomniki] = await Promise.all([kljuci, namigiP, opomnikiP]);
    if (samoTts || !stt) {
      return NextResponse.json({ ok: true, tts: { kljuc: tts.kljuc } }, { headers: { 'Cache-Control': 'no-store' } });
    }
    console.info(JSON.stringify({ glas: 'seja', podjetje: k.podjetje, namigov: namigi.length }));
    return NextResponse.json(
      {
        ok: true,
        jezik: jezikZaPogovor((nast as { jezik?: unknown }).jezik),
        veljaS: KLJUC_VELJA_S,
        stt: { url: SONIOX.sttUrl, kljuc: stt.kljuc, model: SONIOX.sttModel, namigi, najdaljsiKonecMs: SONIOX.najdaljsiKonecMs },
        tts: { url: SONIOX.ttsUrl, kljuc: tts.kljuc, model: SONIOX.ttsModel, glas: SONIOX.glas, hitrost: SONIOX.hitrost },
        kvota,
        porabljeno,
        opozorilo: opozoriloKvote(porabljeno, kvota),
        opomniki: opomniki.length
          ? { ids: opomniki.map((o) => o.id), govor: govorOpomnikov(opomniki, jezikZaPogovor((nast as { jezik?: unknown }).jezik)) }
          : null,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    const vrsta = e instanceof NapakaPonudnika ? e.vrsta : 'notranja';
    console.error(JSON.stringify({ glas: 'seja_napaka', vrsta }));
    return napaka(503, 'glas_ni_na_voljo', 'Glasovna povezava trenutno ne deluje. Poskusite znova čez trenutek.');
  }
}
