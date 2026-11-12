// app/api/glas/potrdi/route.ts
//
// Potrditev predloga z enkratnim žetonom. Ponovni klic (dvojni klik, ponovljen
// zahtevek) vrne isti rezultat in ničesar ne izvede dvakrat.

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';
import { potrdiPredlog } from '@/lib/glas/jedro';
import { kontekstIzSeje, preberiJson, UUID } from '@/lib/glas/streznik';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const omejitev = await rateLimit(req, 'api');
  if (!omejitev.success) return NextResponse.json({ ok: false, koda: 'prehitro', sporocilo: 'Preveč zahtevkov.' }, { status: 429 });

  const telo = await preberiJson(req, 1024);
  const predlogId = typeof telo?.predlog === 'string' ? telo.predlog : '';
  const zeton = typeof telo?.zeton === 'string' ? telo.zeton : '';
  if (!UUID.test(predlogId) || !zeton) {
    return NextResponse.json({ ok: false, koda: 'ni_najden', sporocilo: 'Predlog ne obstaja.' }, { status: 404 });
  }

  const kont = await kontekstIzSeje();
  if (!kont.ok) return kont.odziv;

  const r = await potrdiPredlog({ k: kont.k, predlogId, zeton }, kont.odvisnosti);
  if (!r.ok) return NextResponse.json(r, { status: r.http });
  return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } });
}
