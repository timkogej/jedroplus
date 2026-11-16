// app/api/termini/serija/route.ts
//
// Poveže že shranjene termine v serijo (»serija 2/6« v koledarju). Termini so shranjeni po
// obstoječi poti (n8n); tu se zapiše samo povezava. Baza preveri, da so vsi termini tega
// podjetja (jp_termini_serija_dodaj, service role).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { rateLimit } from '@/lib/rateLimit';
import { imaPravico } from '@/lib/glas/pravice';
import { imaZgodnjiDostop } from '@/lib/zgodnjiDostop';
import { kontekstIzSeje, preberiJson } from '@/lib/glas/streznik';
import { NAJVEC_TERMINOV } from '@/lib/termini/serija';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Vhod = z.object({
  termini: z.array(z.string().trim().min(1).max(40)).min(2).max(NAJVEC_TERMINOV),
  vsakihTednov: z.number().int().min(1).max(26),
});

const odziv = (status: number, koda: string) => NextResponse.json({ ok: false, koda }, { status });

export async function POST(req: NextRequest) {
  const omejitev = await rateLimit(req, 'api');
  if (!omejitev.success) return odziv(429, 'prehitro');
  const v = Vhod.safeParse(await preberiJson(req, 2048));
  if (!v.success) return odziv(400, 'napacen_vhod');

  const kont = await kontekstIzSeje();
  if (!kont.ok) return kont.odziv;
  const { k } = kont;
  if (!imaPravico(k, 'termini.ustvarjanje')) return odziv(403, 'ni_pravice');
  // Ponavljajoči termini: zgodnji dostop (lib/zgodnjiDostop).
  if (!imaZgodnjiDostop(k.podjetje)) return odziv(403, 'ni_pravice');

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.rpc('jp_termini_serija_dodaj', {
    p_company: k.podjetje,
    p_termini: v.data.termini,
    p_vsakih: v.data.vsakihTednov,
    p_user: k.userId,
  });
  if (error) return odziv(500, 'napaka');
  const r = data as { ok?: boolean; id?: string; koda?: string } | null;
  if (!r?.ok) return odziv(409, r?.koda ?? 'napaka');
  return NextResponse.json({ ok: true, id: r.id }, { headers: { 'Cache-Control': 'no-store' } });
}
