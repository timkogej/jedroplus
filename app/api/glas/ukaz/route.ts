// app/api/glas/ukaz/route.ts
//
// En glasovni ukaz. Sprejme multipart (polje "zvok") ali JSON ({besedilo}).
// Podjetje, vloga in pravice pridejo izključno iz seje.

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';
import { obdelajUkaz } from '@/lib/glas/jedro';
import { kontekstIzSeje, preberiJson, UUID } from '@/lib/glas/streznik';
import { preberiKonfiguracijo } from '@/lib/glas/konfiguracija';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Formati, ki jih snemajo brskalniki (Chrome/Firefox webm/ogg, iOS Safari mp4).
const DOVOLJENI_MIME = /^(audio\/(webm|ogg|mp4|mpeg|mp3|wav|x-wav|aac|m4a|x-m4a)|video\/webm)(;.*)?$/i;

const napaka = (status: number, koda: string, sporocilo: string) =>
  NextResponse.json({ ok: false, koda, sporocilo }, { status });

export async function POST(req: NextRequest) {
  const omejitev = await rateLimit(req, 'ai');
  if (!omejitev.success) return napaka(429, 'prehitro', 'Preveč zahtevkov. Počakajte trenutek.');

  const konf = preberiKonfiguracijo();
  const vrsta = req.headers.get('content-type') ?? '';
  let zvok: Blob | null = null;
  let besedilo: string | null = null;
  let prejsnji: string | null = null;
  let izbira: { id: string; oznaka: string } | null = null;

  if (vrsta.startsWith('multipart/form-data')) {
    const dolzina = Number(req.headers.get('content-length') ?? '0');
    if (dolzina > konf.najvecZvokaBajtov + 64 * 1024) return napaka(413, 'prevelik', 'Posnetek je predolg (največ 30 sekund).');
    let obrazec: FormData;
    try {
      obrazec = await req.formData();
    } catch {
      return napaka(400, 'neveljavno', 'Neveljaven zahtevek.');
    }
    const f = obrazec.get('zvok');
    if (!(f instanceof Blob) || f.size === 0) return napaka(400, 'prazno', 'Ni posnetka.');
    if (f.size > konf.najvecZvokaBajtov) return napaka(413, 'prevelik', 'Posnetek je predolg (največ 30 sekund).');
    if (!DOVOLJENI_MIME.test(f.type || '')) return napaka(415, 'format', 'Nepodprt format posnetka.');
    zvok = f;
    prejsnji = typeof obrazec.get('prejsnji') === 'string' ? String(obrazec.get('prejsnji')) : null;
  } else {
    const telo = await preberiJson(req, 4096);
    if (!telo) return napaka(400, 'neveljavno', 'Neveljaven zahtevek.');
    if (typeof telo.besedilo !== 'string' || !telo.besedilo.trim()) return napaka(400, 'prazno', 'Ni besedila.');
    if (telo.besedilo.length > konf.najvecBesedila) return napaka(413, 'predolgo', 'Ukaz je predolg.');
    besedilo = telo.besedilo;
    prejsnji = typeof telo.prejsnji === 'string' ? telo.prejsnji : null;
    const iz = telo.izbira as { id?: unknown; oznaka?: unknown } | undefined;
    if (iz && typeof iz.id === 'string' && typeof iz.oznaka === 'string' && iz.id.length <= 64 && iz.oznaka.length <= 160) {
      izbira = { id: iz.id, oznaka: iz.oznaka };
    }
  }
  if (prejsnji && !UUID.test(prejsnji)) prejsnji = null;

  const kont = await kontekstIzSeje();
  if (!kont.ok) return kont.odziv;

  const r = await obdelajUkaz(
    { k: kont.k, vhod: zvok ? 'aplikacija' : 'besedilo', zvok, besedilo, prejsnjiUkazId: prejsnji, izbira },
    kont.odvisnosti
  );
  if (!r.ok) return NextResponse.json(r, { status: r.http });
  return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } });
}
