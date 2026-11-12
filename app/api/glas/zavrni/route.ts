// app/api/glas/zavrni/route.ts — uporabnik je predlog zavrnil (nič se ne izvede).

import { NextRequest, NextResponse } from 'next/server';
import { zavrniPredlog } from '@/lib/glas/jedro';
import { kontekstIzSeje, preberiJson, UUID } from '@/lib/glas/streznik';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const telo = await preberiJson(req, 512);
  const predlogId = typeof telo?.predlog === 'string' ? telo.predlog : '';
  if (!UUID.test(predlogId)) return NextResponse.json({ ok: false }, { status: 404 });

  const kont = await kontekstIzSeje();
  if (!kont.ok) return kont.odziv;

  const ok = await zavrniPredlog({ k: kont.k, predlogId }, kont.odvisnosti);
  return NextResponse.json({ ok });
}
