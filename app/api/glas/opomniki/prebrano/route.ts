// app/api/glas/opomniki/prebrano/route.ts
//
// Asistent je ob odprtju povedal neprebrane opomnike → označi njihova obvestila kot prebrana.
// Z uporabnikovo sejo (RLS: samo svoja obvestila), samo vrstice z entity_type 'glas_opomnik'.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rateLimit';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { kontekstIzSeje, preberiJson, UUID } from '@/lib/glas/streznik';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Vhod = z.object({ ids: z.array(z.string().regex(UUID)).min(1).max(10) });

export async function POST(req: NextRequest) {
  const omejitev = await rateLimit(req, 'api');
  if (!omejitev.success) return NextResponse.json({ ok: false, koda: 'prehitro' }, { status: 429 });
  const v = Vhod.safeParse(await preberiJson(req, 1024));
  if (!v.success) return NextResponse.json({ ok: false, koda: 'napacen_vhod' }, { status: 400 });
  const kont = await kontekstIzSeje();
  if (!kont.ok) return kont.odziv;
  const seja = await createServerSupabaseClient();
  const { error } = await seja
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .in('id', v.data.ids)
    .eq('recipient_user_id', kont.k.userId)
    .eq('entity_type', 'glas_opomnik');
  if (error) return NextResponse.json({ ok: false, koda: 'napaka' }, { status: 500 });
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
